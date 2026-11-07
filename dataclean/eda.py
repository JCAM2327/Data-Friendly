"""Análisis exploratorio de datos sobre un DataFrame."""

from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd

from dataclean.inspect import column_kind, is_identifier, to_datetime, to_number

METRIC_RE = (
    r"(venta|sales|importe|precio|price|monto|amount|total|ingreso|revenue|"
    r"cantidad|unidades|qty)"
)
ENTITY_RE = (
    r"(producto|product|categor|cliente|customer|pais|country|region|canal|"
    r"channel|tienda|store|marca|brand|segment)"
)


def run_eda(df: pd.DataFrame) -> dict[str, Any]:
    work = df.copy()
    work.columns = [str(column) for column in df.columns]
    n_rows = len(work)

    numeric_labels: list[str] = []
    categorical_labels: list[str] = []
    date_labels: list[str] = []
    id_like: set[str] = set()
    for label in work.columns:
        series = work[label]
        kind = column_kind(series)
        if is_identifier(series, n_rows, kind):
            id_like.add(label)
            continue
        if kind == "numeric":
            numeric_labels.append(label)
        elif kind in {"categorical", "boolean"}:
            categorical_labels.append(label)
        elif kind == "date":
            date_labels.append(label)

    numeric = [
        stats
        for label in numeric_labels
        if (stats := _numeric_stats(label, work[label])) is not None
    ]
    categorical = [
        stats
        for label in categorical_labels
        if (stats := _categorical_stats(label, work[label])) is not None
    ]

    matrix_columns = [item["column"] for item in numeric][:12]
    num_df = work[matrix_columns].apply(pd.to_numeric, errors="coerce") if matrix_columns else pd.DataFrame()
    corr = num_df.corr(method="pearson", min_periods=5) if len(matrix_columns) >= 2 else pd.DataFrame()
    correlations: list[dict[str, Any]] = []
    matrix: list[list[float]] = []
    for i, first in enumerate(matrix_columns):
        row: list[float] = []
        for j, second in enumerate(matrix_columns):
            if i == j:
                value = 1.0
            else:
                raw = corr.loc[first, second] if not corr.empty else np.nan
                value = 0.0 if pd.isna(raw) else round(float(raw), 2)
                if j > i and not pd.isna(raw):
                    correlations.append({"a": first, "b": second, "r": round(float(raw), 2)})
            row.append(value)
        matrix.append(row)
    correlations.sort(key=lambda item: abs(item["r"]), reverse=True)
    strong_pairs = [item for item in correlations if abs(item["r"]) >= 0.7]

    scatter: list[dict[str, Any]] = []
    for pair in correlations[:3]:
        if abs(pair["r"]) < 0.3:
            continue
        points_df = num_df[[pair["a"], pair["b"]]].dropna().head(1000)
        scatter.append({
            "a": pair["a"],
            "b": pair["b"],
            "points": [
                {"x": float(row[pair["a"]]), "y": float(row[pair["b"]])}
                for _, row in points_df.iterrows()
            ],
        })

    metric = next((label for label in numeric_labels if _matches(label, METRIC_RE)), None)
    if metric is None and numeric_labels:
        metric = numeric_labels[0]
    series = [
        item
        for date_label in date_labels[:2]
        if (item := _time_series(work, date_label, metric)) is not None
    ]

    insights: list[str] = []
    for pair in strong_pairs[:5]:
        insights.append(
            f"{pair['a']} y {pair['b']} están altamente relacionadas (r = {pair['r']})."
        )
    for item in numeric:
        if abs(item["skew"]) >= 1:
            direction = "derecha" if item["skew"] > 0 else "izquierda"
            insights.append(
                f"{item['column']} tiene una distribución sesgada a la {direction} "
                f"(asimetría {item['skew']})."
            )
        if item["n"] and item["outliers"] / item["n"] > 0.05:
            pct = round(item["outliers"] / item["n"] * 100, 1)
            insights.append(
                f"{item['column']} presenta {item['outliers']} valores atípicos según IQR ({pct}%)."
            )
    for item in categorical:
        if item["dominant_pct"] >= 50 and item["cardinality"] > 1:
            top = item["top"][0]
            insights.append(
                f"En {item['column']} domina \"{top['value']}\" con el {item['dominant_pct']}% "
                "de los registros."
            )
    for item in series:
        if item["trend_pct"] is not None and abs(item["trend_pct"]) >= 10:
            direction = "creciente" if item["trend_pct"] > 0 else "decreciente"
            metric_label = item["value_column"] or "el volumen de registros"
            insights.append(
                f"{metric_label} agregado por {item['date_column']} muestra una tendencia "
                f"{direction} ({item['trend_pct']:+.1f}% entre la primera y la segunda mitad)."
            )

    questions: list[str] = []
    entities = [label for label in categorical_labels if _matches(label, ENTITY_RE)]
    metrics = [label for label in numeric_labels if _matches(label, METRIC_RE)]
    for entity in (entities or categorical_labels)[:3]:
        if metrics:
            questions.append(f"¿Qué {entity} genera más {metrics[0]}?")
        questions.append(
            f"¿Cuál es el valor más frecuente de {entity} y cuánto pesa sobre el total?"
        )
    if series:
        questions.append(
            f"¿Cómo evolucionó {series[0]['value_column'] or 'el volumen de registros'} "
            f"a lo largo de {series[0]['date_column']}?"
        )
    if len(matrix_columns) >= 2:
        suffix = ""
        if correlations:
            suffix = f" (destaca {correlations[0]['a']} ~ {correlations[0]['b']})"
        questions.append(f"¿Qué variables presentan mayor correlación?{suffix}")
    if metrics and categorical_labels and series:
        questions.append(
            f"¿La evolución de {metrics[0]} es igual en todos los valores de "
            f"{categorical_labels[0]}?"
        )
    for item in [item for item in numeric if item["outliers"] > 0][:2]:
        questions.append(
            f"¿Qué explica los {item['outliers']} valores atípicos de {item['column']}?"
        )

    recommendations: list[dict[str, str]] = []
    if series:
        recommendations.append({
            "title": "Análisis de series temporales",
            "reason": (
                f"Hay {len(series[0]['points'])} periodos mensuales en "
                f"{series[0]['date_column']}; permite estudiar estacionalidad y pronóstico."
            ),
        })
    if metrics and len(numeric_labels) >= 2:
        recommendations.append({
            "title": "Regresión",
            "reason": (
                f"{metrics[0]} es una métrica continua y hay {len(numeric_labels) - 1} "
                "variable(s) numérica(s) más que podrían explicarla."
            ),
        })
    if categorical_labels and metrics:
        recommendations.append({
            "title": "Comparación entre grupos (ANOVA / Kruskal-Wallis)",
            "reason": (
                f"Comparar {metrics[0]} entre las categorías de {categorical_labels[0]} "
                f"({categorical[0]['cardinality'] if categorical else '?'} grupos)."
            ),
        })
    if strong_pairs:
        recommendations.append({
            "title": "Reducción de dimensionalidad o selección de variables",
            "reason": (
                f"{len(strong_pairs)} par(es) con |r| >= 0,7 indican redundancia "
                "(multicolinealidad)."
            ),
        })
    if len(numeric_labels) >= 3:
        recommendations.append({
            "title": "Clustering / segmentación",
            "reason": (
                f"{len(numeric_labels)} variables numéricas permiten agrupar registros "
                "con perfiles similares."
            ),
        })
    if len(categorical_labels) >= 2:
        recommendations.append({
            "title": "Tablas de contingencia y Chi-cuadrado",
            "reason": (
                f"Estudiar la asociación entre {categorical_labels[0]} y "
                f"{categorical_labels[1]}."
            ),
        })
    if any(abs(item["skew"]) >= 1 for item in numeric):
        recommendations.append({
            "title": "Transformación de variables",
            "reason": (
                "Algunas distribuciones son muy asimétricas; una transformación "
                "logarítmica o de rangos mejoraría modelos lineales."
            ),
        })
    if not recommendations:
        recommendations.append({
            "title": "Ampliar el dataset",
            "reason": "Hay pocas variables numéricas o categóricas útiles para análisis más profundos.",
        })

    return {
        "rows": n_rows,
        "excluded_identifiers": sorted(id_like),
        "numeric": numeric,
        "categorical": categorical,
        "correlations": correlations,
        "matrix_columns": matrix_columns,
        "matrix": matrix,
        "strong_pairs": strong_pairs,
        "scatter": scatter,
        "series": series,
        "insights": insights,
        "questions": questions,
        "recommendations": recommendations,
    }


def _numeric_stats(column: str, series: pd.Series) -> dict[str, Any] | None:
    values = to_number(series).dropna().to_numpy(dtype=float)
    n = len(values)
    if n < 2:
        return None
    mean = float(values.mean())
    std = float(values.std(ddof=1))
    p5, p25, p50, p75, p95 = np.quantile(values, [0.05, 0.25, 0.5, 0.75, 0.95])
    iqr = float(p75 - p25)
    lower = float(p25 - 1.5 * iqr)
    upper = float(p75 + 1.5 * iqr)
    outliers = int(((values < lower) | (values > upper)).sum())
    skew = float((((values - mean) / std) ** 3).mean()) if std else 0.0
    bins = min(20, max(5, math.ceil(math.log2(n) + 1)))
    minimum = float(values.min())
    maximum = float(values.max())
    width = (maximum - minimum) / bins or 1.0
    counts = [0] * bins
    for value in values:
        index = min(bins - 1, int((value - minimum) / width))
        counts[index] += 1
    return {
        "column": column,
        "n": n,
        "mean": _r(mean),
        "median": _r(float(p50)),
        "min": _r(minimum),
        "max": _r(maximum),
        "std": _r(std),
        "p5": _r(float(p5)),
        "p25": _r(float(p25)),
        "p75": _r(float(p75)),
        "p95": _r(float(p95)),
        "iqr": _r(iqr),
        "skew": _r(skew),
        "outliers": outliers,
        "histogram": [
            {"bin": _r(minimum + i * width, 1), "count": count}
            for i, count in enumerate(counts)
        ],
    }


def _categorical_stats(column: str, series: pd.Series) -> dict[str, Any] | None:
    values = series.dropna().astype(str).str.strip()
    counts = values.value_counts()
    n = int(counts.sum())
    if n == 0:
        return None
    top = [
        {
            "value": str(value),
            "count": int(count),
            "pct": _r(count / n * 100, 1),
        }
        for value, count in counts.head(10).items()
    ]
    return {
        "column": column,
        "n": n,
        "cardinality": int(len(counts)),
        "top": top,
        "dominant_pct": top[0]["pct"] if top else 0.0,
    }


def _time_series(work: pd.DataFrame, date_column: str, metric: str | None) -> dict[str, Any] | None:
    dates = to_datetime(work[date_column])
    valid = dates.notna()
    if int(valid.sum()) < 2:
        return None
    frame = pd.DataFrame({"period": dates[valid].dt.to_period("M").astype(str)})
    if metric is not None:
        frame["value"] = to_number(work[metric])[valid].fillna(0)
    else:
        frame["value"] = 1.0
    grouped = frame.groupby("period", sort=True)["value"].sum()
    points = [
        {"period": str(period), "value": _r(float(value))}
        for period, value in grouped.items()
    ]
    if len(points) < 2:
        return None
    trend_pct: float | None = None
    if len(points) >= 4:
        half = len(points) // 2
        first = sum(point["value"] for point in points[:half]) / half
        second = sum(point["value"] for point in points[-half:]) / half
        trend_pct = _r((second - first) / abs(first) * 100, 1) if first else None
    return {
        "date_column": date_column,
        "value_column": metric,
        "points": points,
        "trend_pct": trend_pct,
    }


def _matches(label: str, pattern: str) -> bool:
    import re

    return bool(re.search(pattern, label, flags=re.IGNORECASE))


def _r(value: float, digits: int = 2) -> float:
    return round(float(value), digits)
