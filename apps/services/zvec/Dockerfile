FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    HF_HOME=/app/.cache/huggingface

WORKDIR /app

RUN pip install --no-cache-dir "uv==0.12.1"

COPY pyproject.toml uv.lock ./
COPY src ./src

RUN uv sync --frozen --no-dev

# Pre-download the default local embedding model so the container can run offline.
# Build with --build-arg HF_ENDPOINT=https://hf-mirror.com if needed.
RUN uv run python -c "from zvec_service.embedding import embedding_service; embedding_service.embed('warmup')" || echo "warmup failed; model will be fetched at runtime"

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8765

CMD ["uvicorn", "zvec_service.main:app", "--host", "0.0.0.0", "--port", "8765"]
