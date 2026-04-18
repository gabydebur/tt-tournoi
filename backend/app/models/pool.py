import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PoolStatus(str, PyEnum):
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    IN_PROGRESS = "IN_PROGRESS"
    FINISHED = "FINISHED"


class Pool(Base):
    __tablename__ = "pools"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    series_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("series.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[PoolStatus] = mapped_column(
        Enum(PoolStatus, name="poolstatus"),
        nullable=False,
        default=PoolStatus.DRAFT,
    )
    table_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tournament_tables.id", ondelete="SET NULL", use_alter=True, name="fk_pool_table"),
        nullable=True,
    )
    current_match_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("matches.id", ondelete="SET NULL", use_alter=True, name="fk_pool_current_match"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    series: Mapped["Series"] = relationship("Series", back_populates="pools")  # noqa: F821
    pool_players: Mapped[list["PoolPlayer"]] = relationship(
        "PoolPlayer", back_populates="pool", cascade="all, delete-orphan"
    )
    matches: Mapped[list["Match"]] = relationship(  # noqa: F821
        "Match",
        back_populates="pool",
        foreign_keys="Match.pool_id",
        primaryjoin="Pool.id == Match.pool_id",
        order_by="Match.order_in_pool",
    )
    table: Mapped["TournamentTable | None"] = relationship(  # noqa: F821
        "TournamentTable",
        foreign_keys=[table_id],
        primaryjoin="Pool.table_id == TournamentTable.id",
    )
    current_match: Mapped["Match | None"] = relationship(  # noqa: F821
        "Match",
        foreign_keys=[current_match_id],
        primaryjoin="Pool.current_match_id == Match.id",
    )


class PoolPlayer(Base):
    __tablename__ = "pool_players"

    pool_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pools.id", ondelete="CASCADE"), primary_key=True
    )
    player_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("players.id", ondelete="CASCADE"), primary_key=True
    )
    wins: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    losses: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sets_won: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sets_lost: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    games_won: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    games_lost: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    @property
    def points(self) -> int:
        return self.wins * 2

    @property
    def set_difference(self) -> int:
        return self.sets_won - self.sets_lost

    @property
    def game_difference(self) -> int:
        return self.games_won - self.games_lost

    # Relationships
    pool: Mapped["Pool"] = relationship("Pool", back_populates="pool_players")
    player: Mapped["Player"] = relationship("Player")  # noqa: F821
