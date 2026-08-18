from __future__ import annotations

import logging
import os
import threading
from typing import Protocol

from .config import settings

logger = logging.getLogger(__name__)


class EmbeddingFunction(Protocol):
    def embed(self, text: str) -> list[float]: ...


class EmbeddingService:
    """Lazily builds and caches the configured embedding function."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._func: EmbeddingFunction | None = None

    def _build(self) -> EmbeddingFunction:
        if settings.embedding_provider == "openai":
            from zvec.extension import OpenAIDenseEmbedding

            kwargs: dict[str, object] = {
                "model": settings.embedding_model,
                "dimension": settings.embedding_dimension,
            }
            if settings.openai_api_key:
                kwargs["api_key"] = settings.openai_api_key
            if settings.openai_base_url:
                kwargs["base_url"] = settings.openai_base_url
            logger.info("Using OpenAI-compatible embedding: %s", settings.embedding_model)
            return OpenAIDenseEmbedding(**kwargs)

        if settings.local_offline:
            os.environ.setdefault("HF_HUB_OFFLINE", "1")
            os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
            logger.info("Local embedding running in offline mode (model must already be cached)")

        from zvec.extension import DefaultLocalDenseEmbedding

        kwargs = {"model_source": settings.local_model_source}
        if settings.local_device:
            kwargs["device"] = settings.local_device
        logger.info("Using local embedding model: %s", settings.embedding_model)
        return DefaultLocalDenseEmbedding(**kwargs)

    def embed(self, text: str) -> list[float]:
        if self._func is None:
            with self._lock:
                if self._func is None:
                    self._func = self._build()
        return self._func.embed(text)


embedding_service = EmbeddingService()
