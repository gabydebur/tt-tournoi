import uuid

from pydantic import BaseModel

from app.models.table import TableStatus


class TableCreate(BaseModel):
    count: int


class TableUpdate(BaseModel):
    status: TableStatus | None = None
    number: int | None = None


class TableResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    tournament_id: uuid.UUID
    number: int
    status: TableStatus
    current_match_id: uuid.UUID | None
