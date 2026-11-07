"""Reglas de validación y evaluación de calidad de datos."""

from __future__ import annotations

import re
from typing import Any

import pandas as pd

from dataclean.inspect import column_kind, is_null, to_datetime, to_number
from dataclean.profile import profile_dataframe
from dataclean.quality import detect_issues

RULE_KIND_LABELS = {
    "min": "Valor mínimo (≥)",
    "max": "Valor máximo (≤)",
    "range": "Dentro de un rango",
    "not_null": "Campo obligatorio (no nulo)",
    "unique": "Identificador único",
    "date_order": "Fecha inicio ≤ fecha final",
}

READINESS_LABELS = {
    "listo": "Listo para análisis",
    "revision": "Requiere revisión",
    "no_recomendado": "No recomendado para análisis todavía",
}

NUMERIC_HINTS = (
    r"(precio|price|importe|venta|sales|monto|amount|cantidad|unidades|qty|"
    r"quantity|descuento|total)"
)
AGE_HINTS = r"(^edad$|^age$|edad_|_edad)"
ID_HINTS = r"(^id|_id$|^id_|codigo|code)"


def describe_rule(rule: dict[str, Any]) -> str:
    kind = rule["kind"]
    column = rule["column"]
    if kind == "min":
        return f"{column} >= {rule.get('min', 0)}"
    if kind == "max":
        return f"{column} <= {rule.get('max', 0)}"
    if kind == "range":
        return f"{column} entre {rule.get('min', 0)} y {rule.get('max', 0)}"
    if kind == "not_null":
        return f"{column} no nulo"
    if kind == "unique":
        return f"{column} único"
    return f"{column} <= {rule.get('column2') or '?'}"


def evaluate_rule(df: pd.DataFrame, rule: dict[str, Any]) -> dict[str, Any]:
    column = rule["column"]
    failed_rows: list[int] = []
    evaluated = 0
    if column not in df.columns:
        return {
            "rule": rule,
            "label": describe_rule(rule),
            "evaluated": 0,
            "failed": 0,
            "compliance": 100.0,
            "passed": True,
            "sample_rows": [],
        }

    series = df[column]
    kind = rule["kind"]
    if kind == "unique":
        keys = [
            None if is_null(value) else str(value).strip()
            for value in series.tolist()
        ]
        counts = pd.Series([key for key in keys if key is not None]).value_counts()
        for index, key in enumerate(keys):
            if key is None:
                continue
            evaluated += 1
            if int(counts.get(key, 0)) > 1:
                failed_rows.append(index)
    elif kind == "not_null":
        for index, value in enumerate(series.tolist()):
            evaluated += 1
            if is_null(value):
                failed_rows.append(index)
    elif kind == "date_order":
        other = rule.get("column2")
        if other not in df.columns:
            return {
                "rule": rule,
                "label": describe_rule(rule),
                "evaluated": 0,
                "failed": 0,
                "compliance": 100.0,
                "passed": True,
                "sample_rows": [],
            }
        first = to_datetime(series)
        second = to_datetime(df[other])
        for index in range(len(df)):
            a, b = first.iloc[index], second.iloc[index]
            if pd.isna(a) or pd.isna(b):
                continue
            evaluated += 1
            if a > b:
                failed_rows.append(index)
    else:
        numeric = to_number(series)
        for index, raw in enumerate(series.tolist()):
            if is_null(raw):
                continue
            evaluated += 1
            value = numeric.iloc[index]
            if pd.isna(value):
                failed_rows.append(index)
                continue
            number = float(value)
            low = float("-inf") if kind == "max" else _limit(rule, "min", 0.0)
            high = float("inf") if kind == "min" else _limit(rule, "max", 0.0)
            if number < low or number > high:
                failed_rows.append(index)

    failed = len(failed_rows)
    compliance = round((evaluated - failed) / evaluated * 100, 1) if evaluated else 100.0
    return {
        "rule": rule,
        "label": describe_rule(rule),
        "evaluated": evaluated,
        "failed": failed,
        "compliance": compliance,
        "passed": failed == 0,
        "sample_rows": failed_rows[:5],
    }


def suggest_rules(
    df: pd.DataFrame, profile: dict[str, Any] | None = None
) -> list[dict[str, Any]]:
    profile = profile or profile_dataframe(df)
    rules: list[dict[str, Any]] = []
    dates: list[str] = []

    def add(kind: str, column: str, **extra: Any) -> None:
        rules.append({
            "id": f"auto-{len(rules)}",
            "kind": kind,
            "column": column,
            "critical": True,
            **extra,
        })

    for column in profile["column_profiles"]:
        name = column["name"].lower()
        if column["kind"] == "date":
            dates.append(column["name"])
        if re.search(NUMERIC_HINTS, name):
            add("min", column["name"], min=0)
        if re.search(AGE_HINTS, name):
            add("range", column["name"], min=0, max=120)
        if re.search(ID_HINTS, name):
            add("unique", column["name"])
            add("not_null", column["name"])

    start = next((date for date in dates if re.search(r"(inicio|start|desde|alta)", date, re.IGNORECASE)), None)
    end = next((date for date in dates if re.search(r"(fin|end|hasta|baja)", date, re.IGNORECASE)), None)
    if start and end:
        add("date_order", start, column2=end)
    return rules


def assess_quality(
    df: pd.DataFrame,
    rules: list[dict[str, Any]],
    profile: dict[str, Any] | None = None,
    issues: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    profile = profile or profile_dataframe(df)
    issues = issues if issues is not None else detect_issues(df)
    rows, cols = df.shape
    cells = rows * cols or 1
    results = [
        evaluate_rule(df, rule)
        for rule in rules
        if rule.get("column") in df.columns
    ]

    nulls = int(df.isna().sum().sum())
    completeness = _clamp(100 - nulls / cells * 100)

    duplicates = int(profile.get("duplicate_rows", 0))
    uniqueness = _clamp(100 - duplicates / rows * 100) if rows else 100.0

    consistency_issues = _consistency_issues(df)
    affected = sum(item["count"] for item in consistency_issues)
    consistency = _clamp(100 - affected / cells * 100 * max(1, cols / 2))

    type_bad = 0
    type_evaluated = 0
    for column in profile["column_profiles"]:
        kind = column["kind"]
        if kind not in {"numeric", "date"}:
            continue
        series = df[column["name"]]
        parsed = to_number(series) if kind == "numeric" else to_datetime(series)
        non_null = series.notna()
        type_evaluated += int(non_null.sum())
        type_bad += int((non_null & parsed.isna()).sum())
    range_results = [item for item in results if item["rule"]["kind"] in {"min", "max", "range"}]
    range_evaluated = sum(item["evaluated"] for item in range_results)
    range_bad = sum(item["failed"] for item in range_results)
    total = type_evaluated + range_evaluated
    validity = _clamp(100 - (type_bad + range_bad) / total * 100) if total else 100.0

    integrity_results = [item for item in results if item["rule"]["kind"] in {"not_null", "unique"}]
    integrity_evaluated = sum(item["evaluated"] for item in integrity_results)
    integrity = (
        _clamp(100 - sum(item["failed"] for item in integrity_results) / integrity_evaluated * 100)
        if integrity_evaluated
        else 100.0
    )

    coherence_results = [item for item in results if item["rule"]["kind"] == "date_order"]
    coherence_evaluated = sum(item["evaluated"] for item in coherence_results)
    coherence = (
        _clamp(100 - sum(item["failed"] for item in coherence_results) / coherence_evaluated * 100)
        if coherence_evaluated
        else 100.0
    )

    dimensions = [
        {
            "key": "completitud",
            "label": "Completitud",
            "score": _r1(completeness),
            "weight": 0.25,
            "detail": f"{nulls} celda(s) nulas de {rows * cols}",
        },
        {
            "key": "unicidad",
            "label": "Unicidad",
            "score": _r1(uniqueness),
            "weight": 0.15,
            "detail": f"{duplicates} fila(s) duplicadas",
        },
        {
            "key": "consistencia",
            "label": "Consistencia",
            "score": _r1(consistency),
            "weight": 0.15,
            "detail": f"{len(consistency_issues)} problema(s) de formato o categorías",
        },
        {
            "key": "validez",
            "label": "Validez",
            "score": _r1(validity),
            "weight": 0.2,
            "detail": f"{type_bad} valor(es) con tipo incorrecto · {range_bad} fuera de rango",
        },
        {
            "key": "integridad",
            "label": "Integridad",
            "score": _r1(integrity),
            "weight": 0.15,
            "detail": (
                f"{sum(item['failed'] for item in integrity_results)} incumplimiento(s) "
                "en obligatorios/únicos"
                if integrity_evaluated
                else "Sin reglas de integridad definidas"
            ),
        },
        {
            "key": "coherencia",
            "label": "Coherencia entre variables",
            "score": _r1(coherence),
            "weight": 0.1,
            "detail": (
                f"{sum(item['failed'] for item in coherence_results)} registro(s) con fechas invertidas"
                if coherence_evaluated
                else "Sin reglas cruzadas definidas"
            ),
        },
    ]
    score = round(sum(item["score"] * item["weight"] for item in dimensions))

    blockers: list[str] = []
    warnings: list[str] = []
    for dimension in dimensions:
        if dimension["score"] < 80:
            blockers.append(
                f"{dimension['label']} en {dimension['score']}% (mínimo 80%): "
                f"{dimension['detail']}."
            )
        elif dimension["score"] < 95:
            warnings.append(
                f"{dimension['label']} en {dimension['score']}%: {dimension['detail']}."
            )
    for result in [item for item in results if not item["passed"]]:
        message = (
            f"Regla \"{result['label']}\" incumplida en {result['failed']} registro(s) "
            f"({result['compliance']}% de cumplimiento)."
        )
        (blockers if result["rule"].get("critical") else warnings).append(message)
    for issue in issues:
        if issue.get("severity") == "critical":
            column = issue.get("column")
            blockers.append(
                f"Problema crítico: {issue.get('message', issue.get('code'))}"
                f"{f' ({column})' if column else ''}."
            )
    if rows < 30:
        warnings.append(f"Solo {rows} filas: muestra pequeña para análisis fiables.")

    if not blockers and score >= 85:
        readiness = "listo"
    elif score < 60 or len(blockers) > 2:
        readiness = "no_recomendado"
    else:
        readiness = "revision"

    return {
        "dimensions": dimensions,
        "score": score,
        "readiness": readiness,
        "readiness_label": READINESS_LABELS[readiness],
        "blockers": blockers,
        "warnings": warnings,
        "results": results,
    }


def _consistency_issues(df: pd.DataFrame) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    for column in df.columns:
        series = df[column]
        if column_kind(series) not in {"categorical", "text"}:
            continue
        values = series.dropna().astype(str).str.strip()
        if values.empty:
            continue
        variants = values.groupby(values.str.lower()).nunique()
        count = int(values[values.str.lower().isin(variants[variants > 1].index)].shape[0])
        if count:
            found.append({"column": str(column), "count": count})
    return found


def _limit(rule: dict[str, Any], key: str, default: float) -> float:
    value = rule.get(key)
    return default if value is None else float(value)


def _clamp(value: float) -> float:
    return max(0.0, min(100.0, value))


def _r1(value: float) -> float:
    return round(value * 10) / 10
