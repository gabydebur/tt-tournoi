import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MatchStatus(str, PyEnum):
    SCHEDULED = "SCHEDULED"
    IN_PROGRESS = "IN_PROGRESS"
    FINISHED = "FINISHED"
    WALKOVER = "WALKOVER"


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    series_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("series.id", ondelete="CASCADE"), nullable=False, index=True
    )
    pool_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("pools.id", ondelete="SET NULL"), nullable=True, index=True
    )
    elimination_round: Mapped[int | None] = mapped_column(Integer, nullable=True)
    player1_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("players.id", ondelete="RESTRICT"), nullable=False
    )
    player2_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("players.id", ondelete="RESTRICT"), nullable=False
    )
    table_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tournament_tables.id", ondelete="SET NULL", use_alter=True, name="fk_match_table"),
        nullable=True,
    )
    status: Mapped[MatchStatus] = mapped_column(
        Enum(MatchStatus, name="matchstatus"),
        nullable=False,
        default=MatchStatus.SCHEDULED,
    )
    winner_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("players.id", ondelete="SET NULL"), nullable=True
    )
    day_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sets_to_win: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    order_in_pool: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationships
    series: Mapped["Series"] = relationship("Series", back_populates="matches")  # noqa: F821
    pool: Mapped["Pool | None"] = relationship(
        "Pool",
        back_populates="matches",
        foreign_keys=[pool_id],
        primaryjoin="Match.pool_id == Pool.id",
    )  # noqa: F821
    player1: Mapped["Player"] = relationship(  # noqa: F821
        "Player", foreign_keys=[player1_id], primaryjoin="Match.player1_id == Player.id"
    )
    player2: Mapped["Player"] = relationship(  # noqa: F821
        "Player", foreign_keys=[player2_id], primaryjoin="Match.player2_id == Player.id"
    )
    winner: Mapped["Player | None"] = relationship(  # noqa: F821
        "Player", foreign_keys=[winner_id], primaryjoin="Match.winner_id == Player.id"
    )
    table: Mapped["TournamentTable | None"] = relationship(  # noqa: F821
        "TournamentTable",
        foreign_keys=[table_id],
        primaryjoin="Match.table_id == TournamentTable.id",
    )
    sets: Mapped[list["SetResult"]] = relationship(
        "SetResult", back_populates="match", cascade="all, delete-orphan", order_by="SetResult.set_number"
    )


class SetResult(Base):
    __tablename__ = "set_results"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    match_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    set_number: Mapped[int] = mapped_column(Integer, nullable=False)
    score_player1: Mapped[int] = mapped_column(Integer, nullable=False)
    score_player2: Mapped[int] = mapped_column(Integer, nullable=False)

    # Relationships
    match: Mapped["Match"] = relationship("Match", back_populates="sets")
