import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    auth,
    demo,
    matches,
    players,
    pools,
    registrations,
    series,
    tables,
    tournaments,
    websocket,
)
from app.database import AsyncSessionLocal, Base, engine
from app.services.seed import seed_admin

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create all tables (dev mode)
    logger.info("Starting up TT Tournament API...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created/verified.")

    # Seed initial data (admin account)
    async with AsyncSessionLocal() as session:
        await seed_admin(session)

    yield
    # Shutdown
    logger.info("Shutting down TT Tournament API...")
    await engine.dispose()


app = FastAPI(
    title="TT Tournament API",
    description="Table Tennis Tournament Management System",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow all origins in dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(auth.router, prefix="/api")
app.include_router(players.router, prefix="/api")
app.include_router(tournaments.router, prefix="/api")
app.include_router(series.router, prefix="/api")
app.include_router(registrations.router, prefix="/api")
app.include_router(tables.router, prefix="/api")
app.include_router(matches.router, prefix="/api")
app.include_router(pools.router, prefix="/api")
app.include_router(demo.router, prefix="/api")

# WebSocket routes (no /api prefix)
app.include_router(websocket.router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "tt-tournament-api"}
