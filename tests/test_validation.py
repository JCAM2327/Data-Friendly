import pandas as pd

from dataclean.profile import profile_dataframe
from dataclean.validation import assess_quality, evaluate_rule, suggest_rules

HEADERS = {"X-User-Id": "test-user"}


def _sample_frame() -> pd.DataFrame:
    return pd.DataFrame({
        "id": [1, 2, 3, 4],
        "precio": [10.0, -5.0, 20.0, None],
        "edad": [30, 31, 150, 40],
        "inicio": pd.to_datetime(["2024-01-01", "2024-02-01", "2024-03-01", "2024-04-01"]),
        "fin": pd.to_datetime(["2024-01-10", "2024-02-05", "2023-12-01", "2024-04-10"]),
    })


def test_evaluate_rule_kinds():
    df = _sample_frame()
    assert evaluate_rule(df, {"kind": "min", "column": "precio", "min": 0})["failed"] == 1
    assert evaluate_rule(df, {"kind": "range", "column": "edad", "min": 0, "max": 120})["failed"] == 1
    assert evaluate_rule(df, {"kind": "not_null", "column": "precio"})["failed"] == 1
    assert evaluate_rule(df, {"kind": "unique", "column": "id"})["passed"] is True
    assert evaluate_rule(
        df, {"kind": "date_order", "column": "inicio", "column2": "fin"}
    )["failed"] == 1


def test_suggest_rules_from_names_and_kinds():
    df = _sample_frame()
    rules = suggest_rules(df)
    kinds = {(rule["kind"], rule["column"]) for rule in rules}
    assert ("min", "precio") in kinds
    assert ("range", "edad") in kinds
    assert ("unique", "id") in kinds
    assert ("not_null", "id") in kinds
    assert ("date_order", "inicio") in kinds


def test_assess_quality_scores_and_blockers():
    df = _sample_frame()
    profile = profile_dataframe(df)
    rules = suggest_rules(df, profile)
    assessment = assess_quality(df, rules, profile=profile)
    keys = {dimension["key"] for dimension in assessment["dimensions"]}
    assert keys == {
        "completitud",
        "unicidad",
        "consistencia",
        "validez",
        "integridad",
        "coherencia",
    }
    assert 0 <= assessment["score"] <= 100
    assert assessment["readiness"] in {"listo", "revision", "no_recomendado"}
    assert assessment["readiness_label"]
    assert any("Regla" in message or "Coherencia" in message for message in assessment["blockers"])
