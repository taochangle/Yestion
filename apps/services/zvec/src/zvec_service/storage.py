from __future__ import annotations

import logging
import os
import re
import shutil
import threading
from typing import Callable

import zvec

from .config import settings

logger = logging.getLogger(__name__)


def collection_name(workspace_id: str) -> str:
    """Zvec collection names must match [a-zA-Z0-9_]; UUIDs contain hyphens."""
    return f"workspace_{re.sub(r'[^a-zA-Z0-9_]', '_', workspace_id)}"


def build_schema(workspace_id: str, dimension: int) -> zvec.CollectionSchema:
    return zvec.CollectionSchema(
        name=collection_name(workspace_id),
        fields=[
            zvec.FieldSchema(name="title", data_type=zvec.DataType.STRING),
            zvec.FieldSchema(
                name="content",
                data_type=zvec.DataType.STRING,
                index_param=zvec.FtsIndexParam(tokenizer_name="standard"),
            ),
            zvec.FieldSchema(name="doc_type", data_type=zvec.DataType.STRING),
        ],
        vectors=[
            zvec.VectorSchema(
                name="embedding",
                data_type=zvec.DataType.VECTOR_FP32,
                dimension=dimension,
                index_param=zvec.HnswIndexParam(metric_type=zvec.MetricType.COSINE),
            ),
        ],
    )


class CollectionManager:
    """Keeps one Zvec collection open per workspace and serializes access."""

    def __init__(self, data_dir: str, schema_factory: Callable[[str], zvec.CollectionSchema]) -> None:
        self.data_dir = data_dir
        self.schema_factory = schema_factory
        self._collections: dict[str, zvec.Collection] = {}
        self._locks: dict[str, threading.RLock] = {}
        self._global = threading.RLock()

    def _path(self, workspace_id: str) -> str:
        return os.path.join(self.data_dir, f"workspace_{workspace_id}")

    def _lock_for(self, workspace_id: str) -> threading.RLock:
        with self._global:
            lock = self._locks.get(workspace_id)
            if lock is None:
                lock = threading.RLock()
                self._locks[workspace_id] = lock
            return lock

    def ensure(self, workspace_id: str) -> zvec.Collection:
        with self._lock_for(workspace_id):
            collection = self._collections.get(workspace_id)
            if collection is not None:
                return collection

            path = self._path(workspace_id)
            try:
                collection = zvec.open(
                    path=path,
                    option=zvec.CollectionOption(read_only=False, enable_mmap=True),
                )
                logger.info("Opened existing collection for workspace %s", workspace_id)
            except Exception:
                os.makedirs(self.data_dir, exist_ok=True)
                collection = zvec.create_and_open(
                    path=path,
                    schema=self.schema_factory(workspace_id),
                    option=zvec.CollectionOption(read_only=False, enable_mmap=True),
                )
                logger.info("Created collection for workspace %s", workspace_id)

            self._collections[workspace_id] = collection
            return collection

    def count(self) -> int:
        with self._global:
            return len(self._collections)

    def upsert(
        self,
        workspace_id: str,
        document_id: str,
        embedding: list[float],
        title: str,
        content: str,
        doc_type: str,
    ) -> None:
        with self._lock_for(workspace_id):
            collection = self.ensure(workspace_id)
            result = collection.upsert(
                zvec.Doc(
                    id=document_id,
                    vectors={"embedding": embedding},
                    fields={"title": title, "content": content, "doc_type": doc_type},
                )
            )
            code_method = getattr(result, "code", None)
            code = code_method() if callable(code_method) else 0
            if code != zvec.StatusCode.OK:
                raise RuntimeError(f"zvec upsert failed with code {code}")

    def delete(self, workspace_id: str, document_id: str) -> None:
        with self._lock_for(workspace_id):
            collection = self._collections.get(workspace_id)
            if collection is None:
                return
            collection.delete(ids=document_id)

    def query(self, workspace_id: str, embedding: list[float], topk: int) -> list[dict]:
        with self._lock_for(workspace_id):
            collection = self._collections.get(workspace_id)
            if collection is None:
                return []
            result = collection.query(
                queries=zvec.Query(field_name="embedding", vector=embedding),
                topk=topk,
            )
        return list(result)

    def destroy(self, workspace_id: str) -> None:
        with self._lock_for(workspace_id):
            collection = self._collections.pop(workspace_id, None)
            path = self._path(workspace_id)
            if collection is not None:
                try:
                    collection.destroy()
                except Exception as exc:  # pragma: no cover - defensive
                    logger.warning("Failed to destroy collection %s: %s", workspace_id, exc)
                else:
                    logger.info("Destroyed collection for workspace %s", workspace_id)
                    return
            if os.path.isdir(path):
                shutil.rmtree(path, ignore_errors=True)
                logger.info("Removed stale collection directory for workspace %s", workspace_id)


manager = CollectionManager(settings.data_dir, lambda ws: build_schema(ws, settings.embedding_dimension))
