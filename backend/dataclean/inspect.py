"""Utilidades de inspección y conversión de columnas."""

from __future__ import annotations

import warnings
from typing import Any

import pandas as pd

NULL_TOKENS = {"", "na", "n/a", "nan", "null", "none", "-", "—", "?", "undefined"}


def is_null(value: Any) -> bool:
    if value is None:
        return True
    try:
        if pd.isna(value):
            return True
    except (TypeError, ValueError):
        return False
    if isinstance(value, str):
        return value.strip().lower() in NULL_TOKENS
    return False


def to_number(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce")


def to_datetime(series: pd.Series) -> pd.Series:
    if pd.api.types.is_datetime64_any_dtype(series):
        return pd.to_datetime(series, errors="coerce")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        day_first = pd.to_datetime(series, errors="coerce", dayfirst=True)
        if day_first.notna().mean() >= 0.8:
            return day_first
        month_first = pd.to_datetime(series, errors="coerce", dayfirst=False)
    return month_first if month_first.notna().mean() > day_first.notna().mean() else day_first


def column_kind(series: pd.Series) -> str:
    """Devuelve numeric, categorical, date, text o boolean."""
    observed = series.dropna()
    if observed.empty:
        return "text"
    if pd.api.types.is_bool_dtype(series) or pd.api.types.is_bool_dtype(observed):
        return "boolean"
    if pd.api.types.is_datetime64_any_dtype(series):
        return "date"

    numeric = pd.to_numeric(observed, errors="coerce")
    numeric_share = float(numeric.notna().mean())
    if numeric_share >= 0.8:
        unique = int(numeric.nunique())
        integer_like = float((numeric.dropna() % 1 == 0).mean()) >= 0.95
        if integer_like and unique <= 12:
            return "categorical"
        return "numeric"

    dates = to_datetime(observed)
    if float(dates.notna().mean()) >= 0.8:
        return "date"

    unique = int(observed.nunique())
    if unique <= max(20, int(len(observed) * 0.05)):
        return "categorical"
    return "text"


def is_identifier(series: pd.Series, n_rows: int, kind: str | None = None) -> bool:
    if n_rows == 0:
        return False
    name = str(series.name).lower()
    named_id = name in {"id", "uuid", "guid"} or name.endswith("_id")
    unique = int(series.nunique(dropna=True))
    resolved = kind or column_kind(series)
    unique_like = (
        n_rows > 20
        and unique >= n_rows * 0.95
        and resolved in {"categorical", "text"}
    )
    return named_id or unique_like
