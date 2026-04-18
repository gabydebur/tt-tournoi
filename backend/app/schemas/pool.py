import uuid

from pydantic import BaseModel

from app.models.pool import PoolStatus


class PoolPlayerBrief(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    first_name: str
    last_name: str
    points: int
    club: str | None = None


class PoolDetail(BaseModel):
    id: uuid.UUID
    name: str
    status: PoolStatus
    table_id: uuid.UUID | None = None
    series_id: uuid.UUID
    series_name: str
    players: list[PoolPlayerBrief] = []


class SwapPlayersRequest(BaseModel):
    pool_a_id: uuid.UUID
    player_a_id: uuid.UUID
    pool_b_id: uuid.UUID
    player_b_id: uuid.UUID


class StartPoolRequest(BaseModel):
    table_id: uuid.UUID


class ConfirmPoolsSummary(BaseModel):
    tournament_id: uuid.UUID
    pools_confirmed: int
    matches_created: int
