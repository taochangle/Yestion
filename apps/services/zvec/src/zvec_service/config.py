from __future__ import annotations

import os


class Settings:
    """Runtime configuration for the Zvec service."""

    def __init__(self) -> None:
        self.host = os.getenv("ZVEC_HOST", "0.0.0.0")
        self.port = int(os.getenv("ZVEC_PORT", "8765"))
        self.data_dir = os.getenv("ZVEC_DATA_DIR", "./data/zvec")

        # Embedding provider: "local" (sentence-transformers) or "openai" (OpenAI-compatible API)
        self.embedding_provider = os.getenv("ZVEC_EMBEDDING_PROVIDER", "local")
        self.embedding_model = os.getenv(
            "ZVEC_EMBEDDING_MODEL",
            "all-MiniLM-L6-v2" if self.embedding_provider == "local" else "text-embedding-3-small",
        )
        self.embedding_dimension = int(
            os.getenv("ZVEC_EMBEDDING_DIM", "384" if self.embedding_provider == "local" else "1536")
        )
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "")
        self.openai_base_url = os.getenv("OPENAI_BASE_URL", "")
        self.local_model_source = os.getenv("ZVEC_LOCAL_MODEL_SOURCE", "huggingface")
        self.local_device = os.getenv("ZVEC_LOCAL_DEVICE", "")
        self.local_offline = os.getenv("ZVEC_LOCAL_OFFLINE", "0") == "1"


settings = Settings()
