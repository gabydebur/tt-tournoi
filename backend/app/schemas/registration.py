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


class RegPlayer(BaseModel):
    """Nested player info inside a registration (for admin/referee views)."""
    id: uuid.UUID
    first_name: str
    last_name: str
    points: int
    club: str | None = None
    fft_license: str | None = None


class RegSeries(BaseModel):
    """Nested series info inside a registration."""
    id: uuid.UUID
    name: str
    max_points: int


class RegistrationDetailResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    player_id: uuid.UUID
    series_id: uuid.UUID
    status: RegistrationStatus
    registered_at: datetime
    player: RegPlayer | None = None
    series: RegSeries | None = None
    tournament_name: str | None = None
