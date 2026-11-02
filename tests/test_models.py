import numpy as np
import pandas as pd

from dataclean.models import compare_models


def _classification_frame(n: int = 80) -> pd.DataFrame:
    rng = np.random.default_rng(7)
    edad = rng.integers(18, 70, n)
    ingreso = edad * 1.4 + rng.normal(0, 5, n)
    objetivo = (ingreso > np.median(ingreso)).astype(int)
    return pd.DataFrame({
        "id": [f"u{i}" for i in range(n)],
        "edad": edad,
        "ingreso": ingreso,
        "objetivo": objetivo,
    })


def test_classification_compares_majority_baseline_and_two_models():
    df = _classification_frame()
    report = compare_models(df, {"found": True, "column": "objetivo", "task": "classification", "warnings": []})
    assert report["status"] == "compared"
    assert report["task"] == "classification"
    assert report["baseline"]["name"] == "baseline_mayoria"
    assert report["baseline"]["role"] == "baseline"
    names = [item["name"] for item in report["models"]]
    assert names == ["regresion_logistica", "arbol_profundidad_3"]
    assert report["primary_metric"] == "f1_macro"
    assert set(report["baseline"]["metrics"]) == {"accuracy", "f1_macro", "f1_weighted"}
    assert report["winner"] in {"baseline_mayoria", "regresion_logistica", "arbol_profundidad_3"}
    assert "id" in report["features_dropped"]
    assert report["beats_baseline"] is True
    assert report["lift_vs_baseline"] > 0
    # Feature importances present on non-baseline models
    for model in report["models"]:
        assert "feature_importances" in model
        assert isinstance(model["feature_importances"], list)
        assert len(model["feature_importances"]) > 0
        assert all("feature" in item and "importance" in item for item in model["feature_importances"])


def test_importance_threshold_reports_candidates():
    df = _classification_frame()
    report = compare_models(
        df,
        {"found": True, "column": "objetivo", "task": "classification", "warnings": []},
        importance_threshold=0.1,
    )
    assert report["status"] == "compared"
    candidates = report["low_importance_candidates"]
    assert candidates is not None
    assert isinstance(candidates, list)
    # With a high threshold relative to typical importances some or none may appear;
    # the structure must be present and sorted.
    if candidates:
        assert all("feature" in c and "max_importance" in c for c in candidates)
        assert candidates == sorted(candidates, key=lambda c: c["max_importance"])


def test_regression_compares_mean_baseline():
    rng = np.random.default_rng(3)
    x = rng.normal(0, 1, 60)
    y = 3 * x + rng.normal(0, 0.2, 60)
    df = pd.DataFrame({"x": x, "ingreso": y, "constante": 1})
    report = compare_models(df, {"found": True, "column": "ingreso", "task": "regression", "warnings": []})
    assert report["status"] == "compared"
    assert report["task"] == "regression"
    assert report["baseline"]["name"] == "baseline_media"
    assert [item["name"] for item in report["models"]] == ["regresion_lineal", "arbol_profundidad_3"]
    assert report["primary_metric"] == "rmse"
    assert report["higher_is_better"] is False
    assert "constante" in report["features_dropped"]
    assert report["winner"] == "regresion_lineal"
    assert report["beats_baseline"] is True
    for model in report["models"]:
        assert "feature_importances" in model
        assert len(model["feature_importances"]) > 0


def test_skips_without_usable_target():
    df = pd.DataFrame({"id": ["a", "b", "c"], "pais": ["AR", "AR", "AR"]})
    report = compare_models(df, {"found": False, "column": None, "task": None, "warnings": ["target_not_found"]})
    assert report["status"] == "skipped"
    assert report["models"] == []
    assert report["baseline"] is None
    assert "target_not_found" in report["warnings"]


def test_metrics_report_keeps_small_sample_and_imbalance_warnings():
    df = pd.DataFrame({
        "feature": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        "objetivo": [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    })
    report = compare_models(df, {"found": True, "column": "objetivo", "task": "classification", "warnings": ["small_sample", "class_imbalance"]})
    assert report["status"] == "compared"
    assert "small_sample" in report["warnings"]
    assert "class_imbalance" in report["warnings"]
    assert report["split"]["train_rows"] + report["split"]["test_rows"] == 10
    assert report["rationale"]


def test_skips_when_only_identifier_features_remain():
    df = pd.DataFrame({
        "id": [f"u{i}" for i in range(12)],
        "objetivo": [0, 1] * 6,
    })
    report = compare_models(df, {"found": True, "column": "objetivo", "task": "classification", "warnings": []})
    assert report["status"] == "skipped"
    assert "insufficient_features" in report["warnings"]


def test_drop_low_importance_adds_plan_steps():
    from dataclean.cli import analyze_frame
    df = _classification_frame()
    report, cleaned = analyze_frame(
        df,
        source="mem",
        apply=True,
        importance_threshold=0.05,
        drop_low_importance=True,
    )
    # Plan may contain additional drop_column with reason low_importance
    low_imp_steps = [
        s for s in report["plan"]
        if s.get("action") == "drop_column" and (s.get("params") or {}).get("reason") == "low_importance"
    ]
    # Structure is valid either way; if candidates existed and matched columns, steps were added
    if report["modeling"].get("low_importance_candidates"):
        matching = [
            c for c in report["modeling"]["low_importance_candidates"]
            if c["feature"] in df.columns
        ]
        if matching:
            assert len(low_imp_steps) > 0
            assert all(s["params"]["threshold"] == 0.05 for s in low_imp_steps)
