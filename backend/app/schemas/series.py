import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.series import PhaseFormat


class SeriesCreate(BaseModel):
    name: str
    max_points: int
    min_points: int | None = None
    phase_format: PhaseFormat = PhaseFormat.POOLS_THEN_ELIMINATION
    sets_to_win_match: int = 2
    sets_to_win_final: int = 3
    players_per_pool: int = 4


class SeriesUpdate(BaseModel):
    name: str | None = None
    max_points: int | None = None
    min_points: int | None = None
    phase_format: PhaseFormat | None = None
    sets_to_win_match: int | None = None
    sets_to_win_final: int | None = None
    players_per_pool: int | None = None


class SeriesResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    tournament_id: uuid.UUID
    name: str
    max_points: int
    min_points: int | None
    phase_format: PhaseFormat
    sets_to_win_match: int
    sets_to_win_final: int
    players_per_pool: int
    created_at: datetime
