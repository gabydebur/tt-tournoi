import uuid
from enum import Enum as PyEnum

from sqlalchemy import Enum, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TableStatus(str, PyEnum):
    FREE = "FREE"
    OCCUPIED = "OCCUPIED"


class TournamentTable(Base):
    __tablename__ = "tournament_tables"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tournament_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[TableStatus] = mapped_column(
        Enum(TableStatus, name="tablestatus"),
        nullable=False,
        default=TableStatus.FREE,
    )
    current_match_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("matches.id", ondelete="SET NULL", use_alter=True, name="fk_table_current_match"),
        nullable=True,
    )

    # Relationships
    tournament: Mapped["Tournament"] = relationship("Tournament", back_populates="tables")  # noqa: F821
    current_match: Mapped["Match | None"] = relationship(  # noqa: F821
        "Match",
        foreign_keys=[current_match_id],
        primaryjoin="TournamentTable.current_match_id == Match.id",
    )
