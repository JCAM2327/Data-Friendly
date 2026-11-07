"""API FastAPI con aislamiento de informes por usuario, autenticación opcional por API key y documentación OpenAPI enriquecida."""

from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Any, Literal

import pandas as pd
from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel, Field

from dataclean.cli import analyze_frame
from dataclean.eda import run_eda
from dataclean.io import SUPPORTED_EXTENSIONS, load_dataframe
from dataclean.plan import apply_plan
from dataclean.profile import profile_dataframe
from dataclean.report import render_report_html
from dataclean.store import DatasetStore
from dataclean.validation import assess_quality, suggest_rules

app = FastAPI(
    title="DataClean AI",
    description=(
        "Plataforma para perfilar datasets tabulares, detectar problemas de calidad, "
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
    version="0.31.0",
    openapi_tags=[
        {"name": "Datasets", "description": "Carga, consulta y gestión de datasets y sus informes."},
        {"name": "Informes", "description": "Exportación de informes HTML y descarga de datos limpios."},
        {"name": "Sistema", "description": "Estado del servicio y configuración operativa."},
    ],
)

# ... (the rest of the file would be included in full in a real call)
