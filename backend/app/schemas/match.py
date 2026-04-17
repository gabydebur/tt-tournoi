import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.match import MatchStatus


class SetInput(BaseModel):
    score_player1: int
    score_player2: int


class MatchResultRequest(BaseModel):
    sets: list[SetInput]


class MatchStartRequest(BaseModel):
    table_id: uuid.UUID


class SetResultResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    match_id: uuid.UUID
    set_number: int
    score_player1: int
    score_player2: int


class PlayerBrief(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    first_name: str
    last_name: str
    points: int
    club: str | None


class MatchResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    series_id: uuid.UUID
    pool_id: uuid.UUID | None
    elimination_round: int | None
    player1_id: uuid.UUID
    player2_id: uuid.UUID
    table_id: uuid.UUID | None
    status: MatchStatus
    winner_id: uuid.UUID | None
    day_number: int
    scheduled_at: datetime | None
    started_at: datetime | None
    finished_at: datetime | None
    sets_to_win: int
    sets: list[SetResultResponse] = []


class MatchDetailResponse(MatchResponse):
    player1: PlayerBrief | None = None
    player2: PlayerBrief | None = None
    winner: PlayerBrief | None = None


class SuggestedMatchResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    series_id: uuid.UUID
    pool_id: uuid.UUID | None
    player1: PlayerBrief
    player2: PlayerBrief
    waiting_since: datetime | None
    day_number: int
