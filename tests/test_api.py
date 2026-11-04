"""Pruebas de la API FastAPI."""

from pathlib import Path

from fastapi.testclient import TestClient

from dataclean.api import app

client = TestClient(app)


def test_upload_and_get_importances():
    sample = Path(__file__).parent.parent / "examples" / "sample.csv"
    with open(sample, "rb") as f:
        response = client.post(
            "/datasets",
            files={"file": ("sample.csv", f, "text/csv")},
            headers={"X-User-Id": "test-user"},
        )
    assert response.status_code == 201
    data = response.json()
    dataset_id = data["dataset_id"]
    assert "summary" in data

    imp_response = client.get(
        f"/datasets/{dataset_id}/importances",
        headers={"X-User-Id": "test-user"},
    )
    assert imp_response.status_code == 200
    imp = imp_response.json()
    assert imp["dataset_id"] == dataset_id
    assert "models" in imp
    assert len(imp["models"]) >= 1
    for model in imp["models"]:
        assert "feature_importances" in model
        assert isinstance(model["feature_importances"], list)
        assert len(model["feature_importances"]) > 0
