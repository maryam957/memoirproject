from fastapi import FastAPI

from .database import Base, engine
from .routers.memories import router as memories_router


def create_app() -> FastAPI:
    app = FastAPI(title="Memoir Memory Service", version="0.1.0")
    app.include_router(memories_router)
    return app


app = create_app()


@app.on_event("startup")
def _startup() -> None:
    Base.metadata.create_all(bind=engine)
