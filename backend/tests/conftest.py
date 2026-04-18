import asyncio
import os
import sys
from pathlib import Path

# Ensure test DB is set BEFORE importing app
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["SECRET_KEY"] = "test-secret-key"
os.environ["SEED_ADMIN_ENABLED"] = "false"

# Add backend root to path
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import event

from app import database as db_module  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.database import Base  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def test_engine():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        future=True,
    )

    # Enable FK enforcement in SQLite
    @event.listens_for(engine.sync_engine, "connect")
    def _enable_fk(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def session_maker(test_engine):
    return async_sessionmaker(
        bind=test_engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
    )


@pytest_asyncio.fixture
async def async_client(test_engine, session_maker):
    # Override the app's engine & session maker
    original_engine = db_module.engine
    original_session_local = db_module.AsyncSessionLocal
    db_module.engine = test_engine
    db_module.AsyncSessionLocal = session_maker

    async def override_get_db():
        async with session_maker() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    from app.database import get_db

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
    db_module.engine = original_engine
    db_module.AsyncSessionLocal = original_session_local


@pytest_asyncio.fixture
async def admin_user(session_maker) -> dict:
    """Create an admin user directly in DB. Returns {email, password}."""
    import uuid as uuid_mod

    email = "admin@test.com"
    password = "adminpass"
    async with session_maker() as session:
        user = User(
            id=uuid_mod.uuid4(),
            email=email,
            password_hash=hash_password(password),
            role=UserRole.ADMIN,
            is_active=True,
        )
        session.add(user)
        await session.commit()
    return {"email": email, "password": password}


@pytest_asyncio.fixture
async def admin_token(async_client, admin_user) -> str:
    resp = await async_client.post(
        "/api/auth/login",
        json={"email": admin_user["email"], "password": admin_user["password"]},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest_asyncio.fixture
async def player_token(async_client) -> str:
    resp = await async_client.post(
        "/api/auth/register",
        json={
            "email": "player1@test.com",
            "password": "playerpass",
            "first_name": "Player",
            "last_name": "One",
            "points": 500,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["access_token"]
