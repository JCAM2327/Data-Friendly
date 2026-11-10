import pandas as pd

from dataclean.eda import run_eda


def _sample_frame() -> pd.DataFrame:
    return pd.DataFrame({
        "id": [f"row-{index}" for index in range(24)],
        "fecha": pd.date_range("2024-01-01", periods=24, freq="MS"),
        "ventas": [100 + index * 10 for index in range(24)],
        "precio": [10 + index for index in range(24)],
        "categoria": ["A", "B", "C", "A"] * 6,
    })


def test_run_eda_descriptive_and_correlations():
    result = run_eda(_sample_frame())
    assert result["rows"] == 24
    assert "id" in result["excluded_identifiers"]

    numeric = {item["column"]: item for item in result["numeric"]}
    assert "ventas" in numeric
    assert numeric["ventas"]["max"] > numeric["ventas"]["min"]
    assert len(numeric["ventas"]["histogram"]) >= 5
    assert numeric["ventas"]["outliers"] >= 0

    categorical = {item["column"]: item for item in result["categorical"]}
    assert categorical["categoria"]["cardinality"] == 3
    assert len(categorical["categoria"]["top"]) == 3

    assert result["matrix_columns"] == ["ventas", "precio"]
    assert result["correlations"]
    assert any(pair["r"] >= 0.99 for pair in result["correlations"])


def test_run_eda_time_series_and_recommendations():
    result = run_eda(_sample_frame())
    assert result["series"]
    series = result["series"][0]
    assert series["date_column"] == "fecha"
    assert series["value_column"] == "ventas"
    assert len(series["points"]) == 24
    assert series["trend_pct"] is not None

    titles = {item["title"] for item in result["recommendations"]}
    assert "Análisis de series temporales" in titles
    assert result["questions"]
