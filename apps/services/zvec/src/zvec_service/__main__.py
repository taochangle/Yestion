from __future__ import annotations

import uvicorn

from .config import settings


def main() -> None:
    uvicorn.run("zvec_service.main:app", host=settings.host, port=settings.port)


if __name__ == "__main__":
    main()
