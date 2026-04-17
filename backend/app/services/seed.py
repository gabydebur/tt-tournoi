"""Seed initial data on application startup."""

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import hash_password
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)


async def seed_admin(db: AsyncSession) -> None:
    """Create a default admin account if it doesn't exist."""
    if not settings.SEED_ADMIN_ENABLED:
        logger.info("Admin seeding disabled (SEED_ADMIN_ENABLED=false).")
        return

    result = await db.execute(
        select(User).where(User.email == settings.SEED_ADMIN_EMAIL)
    )
    existing = result.scalar_one_or_none()

    if existing is not None:
        logger.info(
            "Admin user already exists (%s) — skipping seed.",
            settings.SEED_ADMIN_EMAIL,
        )
        return

    admin = User(
        id=uuid.uuid4(),
        email=settings.SEED_ADMIN_EMAIL,
        password_hash=hash_password(settings.SEED_ADMIN_PASSWORD),
        role=UserRole.ADMIN,
        is_active=True,
    )
    db.add(admin)
    await db.commit()

    logger.info(
        "Admin user created: email=%s  (change the password in production!)",
        settings.SEED_ADMIN_EMAIL,
    )
