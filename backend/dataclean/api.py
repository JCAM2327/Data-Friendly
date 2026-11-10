"""API FastAPI con aislamiento de informes por usuario, autenticación opcional por API key y documentación OpenAPI enriquecida."""

from __future__ import annotations

import os
import re
import time
from pathlib import Path
from typing import Any, Literal

import pandas as pd
from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel, Field

from dataclean.advisor import suggest_modeling_strategy
from dataclean.cli import analyze_frame
from dataclean.eda import run_eda
from dataclean.io import SUPPORTED_EXTENSIONS, load_dataframe
from dataclean.plan import apply_plan
from dataclean.profile import profile_dataframe
from dataclean.report import render_report_html
from dataclean.store import DatasetStore
from dataclean.validation import assess_quality, suggest_rules

app = FastAPI(
    title="Data Friendly API",
    description=(
        "API de Data Friendly para perfilar datasets tabulares, detectar problemas de calidad, "
        "generar y aplicar planes de limpieza (incluye clipping de outliers IQR, estrategias de imputación configurables, estandarización opcional de columnas numéricas, codificación opcional de variables categóricas con soporte drop_first, exclusión opcional de columnas numéricas de baja varianza y exclusión opcional de columnas numéricas altamente correlacionadas), detectar variable objetivo, comparar modelos baseline e informar importancia de variables (con candidatos a exclusión por umbral de importancia opcional, agregación de importancias máximo/media entre modelos, visualización de barras en el informe HTML y exposición explícita de las importancias calculadas). "
        "Soporta carga de CSV, Excel (.xlsx/.xls) y Parquet. "
        "Los informes se aíslan por usuario mediante la cabecera obligatoria `X-User-Id`. "
        "Si se configura la variable de entorno `DATACLEAN_API_KEY`, se exige adicionalmente la cabecera `X-API-Key`. "
        "El parámetro opcional `scale_numeric` activa la estandarización z-score de columnas numéricas en el plan. "
        "El parámetro opcional `encode_categorical` (onehot|ordinal) activa la codificación de columnas categóricas en el plan. "
        "El parámetro opcional `onehot_drop_first` omite la categoría de referencia en codificación one-hot. "
        "El parámetro opcional `drop_low_variance_threshold` excluye columnas numéricas de baja varianza. "
        "El parámetro opcional `drop_high_correlation_threshold` excluye columnas numéricas altamente correlacionadas. "
        "Incluye análisis exploratorio (distribuciones, correlaciones, series temporales e insights), "
        "sugerencia de reglas de validación y evaluación de calidad en seis dimensiones."
    ),
    version="0.32.1",
    openapi_tags=[
        {"name": "Datasets", "description": "Carga, consulta y gestión de datasets y sus informes."},
        {"name": "Informes", "description": "Exportación de informes HTML y descarga de datos limpios."},
        {"name": "Sistema", "description": "Estado del servicio y configuración operativa."},
    ],
)


def _cors_origins() -> list[str]:
    raw = os.environ.get("DATACLEAN_CORS_ORIGINS", "*")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def _max_upload_bytes() -> int:
    raw = os.environ.get("DATACLEAN_MAX_UPLOAD_BYTES", str(50 * 1024 * 1024))
    try:
        return max(1, int(raw))
    except ValueError:
        return 50 * 1024 * 1024


def _max_dataset_age_hours() -> float:
    raw = os.environ.get("DATACLEAN_MAX_AGE_HOURS", "24")
    try:
        return max(0.0, float(raw))
    except ValueError:
        return 24.0


def _cleanup_interval_seconds() -> float:
    raw = os.environ.get("DATACLEAN_CLEANUP_INTERVAL_SECONDS", "3600")
    try:
        return max(60.0, float(raw))
    except ValueError:
        return 3600.0


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

store = DatasetStore()
_last_cleanup = 0.0


def _maybe_cleanup_expired() -> None:
    global _last_cleanup
    now = time.monotonic()
    if now - _last_cleanup < _cleanup_interval_seconds():
        return
    _last_cleanup = now
    store.cleanup_expired(_max_dataset_age_hours())


USER_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def get_user_id(
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> str:
    expected_key = os.environ.get("DATACLEAN_API_KEY")
    if expected_key and (not x_api_key or x_api_key != expected_key):
        raise HTTPException(status_code=401, detail="Cabecera X-API-Key requerida o inválida")
    if not x_user_id or not x_user_id.strip():
        raise HTTPException(status_code=401, detail="Cabecera X-User-Id requerida")
    user_id = x_user_id.strip()
    if not USER_ID_RE.fullmatch(user_id):
        raise HTTPException(
            status_code=400,
            detail="X-User-Id inválido: usa solo letras, números, guiones y guiones bajos (máximo 64)",
        )
    return user_id


class Summary(BaseModel):
    issue_count: int = Field(..., description="Cantidad de issues de calidad detectados")
    high_or_critical: int = Field(..., description="Issues de severidad alta o crítica")
    plan_steps: int = Field(..., description="Número de pasos del plan de limpieza")
    ready_for_modeling: bool = Field(..., description="Si el dataset está listo para modelado")
    target_column: str | None = Field(None, description="Columna objetivo detectada")
    target_task: str | None = Field(None, description="Tipo de tarea (classification/regression)")
    model_status: str | None = Field(None, description="Estado de la comparación de modelos")
    model_winner: str | None = Field(None, description="Modelo ganador según métricas")


class UploadResponse(BaseModel):
    dataset_id: str = Field(..., description="Identificador único del dataset")
    filename: str = Field(..., description="Nombre del archivo original")
    summary: Summary
    html_url: str = Field(..., description="Ruta relativa al informe HTML")


class AcceptResponse(BaseModel):
    dataset_id: str
    applied: bool = Field(..., description="Indica si el plan quedó aplicado")
    rows: int | None = Field(None, description="Número de filas del CSV limpio")
    message: str | None = Field(None, description="Mensaje informativo opcional")


class ValidationRuleModel(BaseModel):
    id: str | None = Field(None, description="Identificador de la regla")
    kind: Literal["min", "max", "range", "not_null", "unique", "date_order"] = Field(
        ..., description="Tipo de regla"
    )
    column: str = Field(..., description="Columna a validar")
    column2: str | None = Field(None, description="Segunda columna para date_order")
    min: float | None = Field(None, description="Valor mínimo para min/range")
    max: float | None = Field(None, description="Valor máximo para max/range")
    critical: bool = Field(True, description="Si el incumplimiento bloquea la calidad")


class ValidateRequest(BaseModel):
    rules: list[ValidationRuleModel] | None = Field(
        None,
        description="Reglas a evaluar; si se omiten se usan las sugeridas automáticamente",
    )


@app.get(
    "/health",
    tags=["Sistema"],
    summary="Estado del servicio",
    description="Comprueba que la API está disponible y devuelve la versión desplegada.",
)
def health() -> dict[str, str]:
    return {"status": "ok", "version": app.version}


@app.post(
    "/datasets",
    status_code=201,
    tags=["Datasets"],
    summary="Cargar dataset tabular",
    description="Sube un archivo CSV, Excel (.xlsx/.xls) o Parquet, genera el informe de perfil/calidad/plan/modelado y lo persiste aislado por usuario. El parámetro opcional scale_numeric activa la estandarización z-score de columnas numéricas. El parámetro opcional encode_categorical (onehot|ordinal) activa la codificación de columnas categóricas. El parámetro opcional onehot_drop_first omite la categoría de referencia. El parámetro opcional drop_low_variance_threshold excluye columnas numéricas de baja varianza. El parámetro opcional drop_high_correlation_threshold excluye columnas numéricas altamente correlacionadas.",
    response_model=UploadResponse,
    responses={
        400: {"description": "Archivo inválido o formato no soportado"},
        401: {"description": "Cabecera X-User-Id ausente o vacía, o X-API-Key requerida/inválida"},
    },
)
async def upload_dataset(
    file: UploadFile = File(..., description="Archivo tabular (CSV, Excel, Parquet) a analizar"),
    user_id: str = Depends(get_user_id),
    target: str | None = Query(
        None,
        description="Columna objetivo explícita; si se omite, se infiere por nombre y cardinalidad",
    ),
    scale_numeric: bool = Query(
        False,
        description="Incluir estandarización z-score de columnas numéricas en el plan de limpieza",
    ),
    encode_categorical: str | None = Query(
        None,
        description="Codificación opcional de columnas categóricas: onehot o ordinal (por frecuencia)",
        pattern="^(onehot|ordinal)$",
    ),
    onehot_drop_first: bool = Query(
        False,
        description="Al usar one-hot, omitir la primera categoría ordenada como referencia para evitar multicolinealidad",
    ),
    drop_low_variance_threshold: float | None = Query(
        None,
        description="Excluir columnas numéricas cuyo desvío estándar observado (población) sea inferior a este umbral",
    ),
    drop_high_correlation_threshold: float | None = Query(
        None,
        description="Excluir columnas numéricas con |correlación| absoluta superior o igual a este umbral respecto a otra",
    ),
    importance_threshold: float | None = Query(
        None,
        description="Umbral de importancia: features cuya importancia máxima en modelos no baseline sea inferior se reportan como candidatos a exclusión",
    ),
    drop_low_importance: bool = Query(
        False,
        description="Incluir automáticamente en el plan de limpieza las columnas cuya importancia máxima sea inferior al umbral (requiere importance_threshold)",
    ),
) -> UploadResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nombre de archivo requerido")
    safe_filename = Path(file.filename.replace("\\", "/")).name
    if safe_filename in {"", ".", ".."}:
        raise HTTPException(status_code=400, detail="Nombre de archivo inválido")
    ext = Path(safe_filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Formato no soportado: {ext}. Soportados: {', '.join(sorted(SUPPORTED_EXTENSIONS))}",
        )
    max_bytes = _max_upload_bytes()
    declared_size = getattr(file, "size", None)
    if declared_size is not None and declared_size > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"El archivo supera el límite de {max_bytes} bytes",
        )
    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"El archivo supera el límite de {max_bytes} bytes",
        )
    try:
        df = load_dataframe(content, filename=safe_filename)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Archivo inválido: {exc}") from exc
    report, _ = analyze_frame(
        df,
        source=safe_filename,
        target=target,
        scale_numeric=scale_numeric,
        encode_categorical=encode_categorical,
        onehot_drop_first=onehot_drop_first,
        drop_low_variance_threshold=drop_low_variance_threshold,
        drop_high_correlation_threshold=drop_high_correlation_threshold,
        importance_threshold=importance_threshold,
        drop_low_importance=drop_low_importance,
    )
    _maybe_cleanup_expired()
    record = store.create(user_id, safe_filename, df, report, content=content)
    return UploadResponse(
        dataset_id=record["dataset_id"],
        filename=record["filename"],
        summary=Summary(**record["summary"]),
        html_url=f"/datasets/{record['dataset_id']}/report.html",
    )


@app.get(
    "/datasets",
    tags=["Datasets"],
    summary="Listar datasets",
    description="Devuelve los datasets del usuario, ordenados del más reciente al más antiguo.",
)
def list_datasets(user_id: str = Depends(get_user_id)) -> list[dict[str, Any]]:
    return store.list_for_user(user_id)


@app.get(
    "/datasets/{dataset_id}",
    tags=["Datasets"],
    summary="Consultar dataset",
    description="Recupera el registro completo del dataset (informe, plan, estado) perteneciente al usuario.",
    responses={404: {"description": "Dataset no encontrado o no pertenece al usuario"}},
)
def get_dataset(dataset_id: str, user_id: str = Depends(get_user_id)) -> dict[str, Any]:
    record = store.get(user_id, dataset_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Dataset no encontrado")
    return record


@app.delete(
    "/datasets/{dataset_id}",
    status_code=204,
    tags=["Datasets"],
    summary="Eliminar dataset",
    description="Borra de forma permanente el dataset y sus archivos asociados.",
    responses={404: {"description": "Dataset no encontrado"}},
)
def delete_dataset(dataset_id: str, user_id: str = Depends(get_user_id)) -> None:
    if not store.delete(user_id, dataset_id):
        raise HTTPException(status_code=404, detail="Dataset no encontrado")


def _clean_rule(raw: dict[str, Any], index: int) -> dict[str, Any]:
    rule = {key: value for key, value in raw.items() if value is not None}
    rule["id"] = rule.get("id") or f"user-{index}"
    rule["critical"] = bool(raw.get("critical", True))
    return rule


def _load_current(user_id: str, record: dict[str, Any]) -> tuple[pd.DataFrame, str]:
    dataset_id = record["dataset_id"]
    folder = store.dataset_dir(user_id, dataset_id)
    df = store.load_original(user_id, dataset_id)
    source = "original"
    if record.get("applied"):
        cleaned_parquet = folder / "cleaned.parquet"
        cleaned_csv = folder / "cleaned.csv"
        if cleaned_parquet.exists():
            df = pd.read_parquet(cleaned_parquet)
        elif cleaned_csv.exists():
            df = pd.read_csv(cleaned_csv)
        source = "cleaned"
    return df, source


@app.get(
    "/datasets/{dataset_id}/preview",
    tags=["Informes"],
    summary="Vista previa del dataset",
    description="Devuelve una muestra tabular del dataset original o del resultado limpio si el plan fue aceptado.",
    responses={404: {"description": "Dataset no encontrado"}},
)
def preview_dataset(
    dataset_id: str,
    limit: int = Query(20, ge=1, le=100, description="Cantidad máxima de filas a devolver"),
    user_id: str = Depends(get_user_id),
) -> dict[str, Any]:
    record = store.get(user_id, dataset_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Dataset no encontrado")

    df, source = _load_current(user_id, record)

    head = df.head(limit)
    rows = head.astype(object).where(pd.notna(head), None).to_dict(orient="records")
    return {
        "dataset_id": dataset_id,
        "source": source,
        "applied": bool(record.get("applied")),
        "columns": [str(column) for column in df.columns],
        "rows": rows,
        "total_rows": int(len(df)),
        "returned_rows": int(len(rows)),
    }


@app.get(
    "/datasets/{dataset_id}/eda",
    tags=["Informes"],
    summary="Análisis exploratorio",
    description=(
        "Devuelve estadísticas descriptivas, distribuciones, correlaciones, series "
        "temporales e insights accionables sobre el dataset original o limpio."
    ),
    responses={404: {"description": "Dataset no encontrado"}},
)
def dataset_eda(dataset_id: str, user_id: str = Depends(get_user_id)) -> dict[str, Any]:
    record = store.get(user_id, dataset_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Dataset no encontrado")
    df, source = _load_current(user_id, record)
    return {"dataset_id": dataset_id, "source": source, **run_eda(df)}


@app.get(
    "/datasets/{dataset_id}/validation/suggestions",
    tags=["Informes"],
    summary="Reglas de validación sugeridas",
    description="Propone reglas de calidad a partir del nombre y tipo detectado de cada columna.",
    responses={404: {"description": "Dataset no encontrado"}},
)
def validation_suggestions(
    dataset_id: str, user_id: str = Depends(get_user_id)
) -> dict[str, Any]:
    record = store.get(user_id, dataset_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Dataset no encontrado")
    df, source = _load_current(user_id, record)
    return {
        "dataset_id": dataset_id,
        "source": source,
        "rules": suggest_rules(df),
    }


@app.post(
    "/datasets/{dataset_id}/validate",
    tags=["Informes"],
    summary="Evaluar calidad de datos",
    description=(
        "Evalúa reglas de validación (min, max, range, not_null, unique, date_order) "
        "y calcula un score multidimensional de calidad. Si no se envían reglas, "
        "usa las sugeridas automáticamente."
    ),
    responses={404: {"description": "Dataset no encontrado"}},
)
def validate_dataset(
    dataset_id: str,
    payload: ValidateRequest | None = None,
    user_id: str = Depends(get_user_id),
) -> dict[str, Any]:
    record = store.get(user_id, dataset_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Dataset no encontrado")
    df, source = _load_current(user_id, record)
    profile = profile_dataframe(df)
    rules = [
        _clean_rule(rule.model_dump(), index)
        for index, rule in enumerate(payload.rules or [])
    ] if payload and payload.rules else suggest_rules(df, profile)
    assessment = assess_quality(df, rules, profile=profile)
    return {"dataset_id": dataset_id, "source": source, **assessment}


@app.get(
    "/datasets/{dataset_id}/advisor",
    tags=["Informes"],
    summary="Asesor de estrategia de modelado",
    description=(
        "Devuelve recomendaciones de estrategia supervisada o no supervisada y, "
        "cuando es viable, una evaluación mínima de clustering con KMeans y silueta."
    ),
    responses={404: {"description": "Dataset no encontrado"}},
)
def get_advisor(dataset_id: str, user_id: str = Depends(get_user_id)) -> dict[str, Any]:
    record = store.get(user_id, dataset_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Dataset no encontrado")
    df, source = _load_current(user_id, record)
    target_report = record.get("report", {}).get("target")
    model_report = record.get("report", {}).get("modeling")
    advice = suggest_modeling_strategy(df, target_report, model_report)
    return {"dataset_id": dataset_id, "source": source, **advice}


@app.post(
    "/datasets/{dataset_id}/accept",
    tags=["Datasets"],
    summary="Aceptar plan de limpieza",
    description="Aplica el plan de limpieza generado, persiste el CSV limpio y marca el dataset como aplicado.",
    response_model=AcceptResponse,
    responses={404: {"description": "Dataset no encontrado"}},
)
def accept_plan(dataset_id: str, user_id: str = Depends(get_user_id)) -> AcceptResponse:
    record = store.get(user_id, dataset_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Dataset no encontrado")
    if record.get("applied"):
        return AcceptResponse(
            dataset_id=dataset_id,
            applied=True,
            message="El plan ya estaba aplicado",
        )
    df = store.load_original(user_id, dataset_id)
    plan = record["report"].get("plan") or []
    cleaned = apply_plan(df, plan)
    record["applied"] = True
    record["report"]["applied"] = True
    store.update(user_id, dataset_id, record, cleaned)
    return AcceptResponse(dataset_id=dataset_id, applied=True, rows=len(cleaned))


@app.get(
    "/datasets/{dataset_id}/report.html",
    response_class=HTMLResponse,
    tags=["Informes"],
    summary="Informe HTML",
    description="Devuelve un documento HTML autocontenido con el perfil, issues, plan, objetivo y comparación de modelos.",
    responses={404: {"description": "Dataset no encontrado"}},
)
def report_html(dataset_id: str, user_id: str = Depends(get_user_id)) -> str:
    record = store.get(user_id, dataset_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Dataset no encontrado")
    df, source = _load_current(user_id, record)
    enriched = dict(record)
    try:
        enriched["advisor"] = suggest_modeling_strategy(
            df,
            record.get("report", {}).get("target"),
            record.get("report", {}).get("modeling"),
        )
    except Exception:
        enriched["advisor"] = {}
    enriched["advisor_source"] = source
    return render_report_html(enriched)


@app.get(
    "/datasets/{dataset_id}/cleaned.csv",
    tags=["Informes"],
    summary="Descargar CSV limpio",
    description="Descarga el archivo CSV resultante tras aplicar el plan de limpieza. Requiere que el plan haya sido aceptado.",
    responses={
        400: {"description": "El plan aún no ha sido aplicado"},
        404: {"description": "Dataset o archivo limpio no encontrado"},
    },
)
def download_cleaned(dataset_id: str, user_id: str = Depends(get_user_id)) -> FileResponse:
    record = store.get(user_id, dataset_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Dataset no encontrado")
    if not record.get("applied"):
        raise HTTPException(status_code=400, detail="El plan aún no ha sido aplicado")
    folder = store.dataset_dir(user_id, dataset_id)
    cleaned_path = folder / "cleaned.csv"
    if not cleaned_path.exists():
        raise HTTPException(status_code=404, detail="Archivo limpio no encontrado")
    return FileResponse(
        cleaned_path,
        media_type="text/csv",
        filename=f"{dataset_id}_cleaned.csv",
    )


@app.get(
    "/datasets/{dataset_id}/importances",
    tags=["Informes"],
    summary="Importancias de variables",
    description="Devuelve las importancias de variables calculadas en la comparación de modelos no baseline, persistidas en el informe, incluyendo la agregación de máximo y media entre modelos.",
    responses={404: {"description": "Dataset no encontrado o sin informe de modelado"}},
)
def get_feature_importances(dataset_id: str, user_id: str = Depends(get_user_id)) -> dict[str, Any]:
    record = store.get(user_id, dataset_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Dataset no encontrado")
    modeling = record.get("report", {}).get("modeling")
    if not modeling or modeling.get("status") != "compared":
        raise HTTPException(status_code=404, detail="Informe de modelado no disponible")
    models_imp = []
    for model in modeling.get("models") or []:
        if model.get("feature_importances"):
            models_imp.append({
                "name": model["name"],
                "feature_importances": model["feature_importances"],
            })
    return {
        "dataset_id": dataset_id,
        "task": modeling.get("task"),
        "column": modeling.get("column"),
        "models": models_imp,
        "low_importance_candidates": modeling.get("low_importance_candidates"),
        "aggregated_importances": modeling.get("aggregated_importances"),
    }


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
        tags=app.openapi_tags,
    )
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi
