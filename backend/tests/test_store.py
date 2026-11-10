"""Pruebas de persistencia de datasets."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import pandas as pd

from dataclean.store import DatasetStore


def test_store_keeps_original_bytes_and_typed_snapshot(tmp_path):
    df = pd.DataFrame({
        "codigo": pd.Series(["001", "002"], dtype="string"),
        "fecha": pd.to_datetime(["2026-01-01", "2026-01-02"]),
        "entero": pd.Series([1, None], dtype="Int64"),
        "activo": pd.Series([True, False], dtype="boolean"),
    })
    content = df.to_csv(index=False).encode("utf-8")

    store = DatasetStore(tmp_path)
    record = store.create("user", "datos.csv", df, {"summary": {}}, content=content)

    folder = store.dataset_dir("user", record["dataset_id"])
    assert (folder / "original.csv").read_bytes() == content
    assert (folder / "data.parquet").exists()

    loaded = store.load_original("user", record["dataset_id"])
    assert loaded["codigo"].tolist() == ["001", "002"]
    assert str(loaded["codigo"].dtype) == "string"
    assert pd.api.types.is_datetime64_any_dtype(loaded["fecha"])
    assert str(loaded["entero"].dtype) == "Int64"
    assert str(loaded["activo"].dtype) == "boolean"


def test_store_falls_back_to_original_file_without_snapshot(tmp_path, monkeypatch):
    df = pd.DataFrame({"a": [1, 2], "b": ["x", "y"]})
    store = DatasetStore(tmp_path)
    record = store.create("user", "datos.csv", df, {"summary": {}}, content=df.to_csv(index=False).encode("utf-8"))

    folder = store.dataset_dir("user", record["dataset_id"])
    (folder / "data.parquet").unlink()

    loaded = store.load_original("user", record["dataset_id"])
    assert loaded.to_dict("list") == {"a": [1, 2], "b": ["x", "y"]}


def test_cleanup_expired_removes_old_datasets(tmp_path):
    store = DatasetStore(tmp_path)
    record = store.create("user", "datos.csv", pd.DataFrame({"a": [1]}), {"summary": {}})
    folder = store.dataset_dir("user", record["dataset_id"])
    record["created_at"] = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
    (folder / "meta.json").write_text(json.dumps(record), encoding="utf-8")

    removed = store.cleanup_expired(24)

    assert removed == 1
    assert not folder.exists()
    assert store.list_for_user("user") == []
