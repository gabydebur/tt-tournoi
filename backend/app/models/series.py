import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PhaseFormat(str, PyEnum):
    POOLS_ONLY = "POOLS_ONLY"
    ELIMINATION_ONLY = "ELIMINATION_ONLY"
    POOLS_THEN_ELIMINATION = "POOLS_THEN_ELIMINATION"


class Series(Base):
    __tablename__ = "series"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tournament_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    max_points: Mapped[int] = mapped_column(Integer, nullable=False)
    min_points: Mapped[int | None] = mapped_column(Integer, nullable=True)
    phase_format: Mapped[PhaseFormat] = mapped_column(
        Enum(PhaseFormat, name="phaseformat"),
        nullable=False,
        default=PhaseFormat.POOLS_THEN_ELIMINATION,
    )
    sets_to_win_match: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    sets_to_win_final: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    players_per_pool: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    tournament: Mapped["Tournament"] = relationship("Tournament", back_populates="series")  # noqa: F821
    registrations: Mapped[list["Registration"]] = relationship(  # noqa: F821
        "Registration", back_populates="series", cascade="all, delete-orphan"
    )
    pools: Mapped[list["Pool"]] = relationship(  # noqa: F821
        "Pool", back_populates="series", cascade="all, delete-orphan"
    )
    matches: Mapped[list["Match"]] = relationship(  # noqa: F821
        "Match", back_populates="series", cascade="all, delete-orphan"
    )
