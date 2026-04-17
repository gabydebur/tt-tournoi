import uuid
from datetime import date, datetime

from pydantic import BaseModel

from app.models.tournament import TournamentStatus


class TournamentCreate(BaseModel):
    name: str
    description: str | None = None
    location: str | None = None
    start_date: date | None = None
    end_date: date | None = None


class TournamentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    location: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: TournamentStatus | None = None


class TournamentResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    description: str | None
    location: str | None
    start_date: date | None
    end_date: date | None
    status: TournamentStatus
    created_at: datetime


class PoolPlayerStanding(BaseModel):
    model_config = {"from_attributes": True}

    player_id: uuid.UUID
    first_name: str
    last_name: str
    wins: int
    losses: int
    points: int
    sets_won: int
    sets_lost: int
    set_difference: int
    games_won: int
    games_lost: int
    game_difference: int


class PoolStanding(BaseModel):
    pool_id: uuid.UUID
    pool_name: str
    players: list[PoolPlayerStanding]


class SeriesStanding(BaseModel):
    series_id: uuid.UUID
    series_name: str
    pools: list[PoolStanding]


class TournamentStandingsResponse(BaseModel):
    tournament_id: uuid.UUID
    series: list[SeriesStanding]
