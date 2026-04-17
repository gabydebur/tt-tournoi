import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.registration import RegistrationStatus


class RegistrationResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    player_id: uuid.UUID
    series_id: uuid.UUID
    status: RegistrationStatus
    registered_at: datetime


class RegistrationDetailResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    player_id: uuid.UUID
    series_id: uuid.UUID
    status: RegistrationStatus
    registered_at: datetime
    player_first_name: str | None = None
    player_last_name: str | None = None
    series_name: str | None = None
    tournament_name: str | None = None
