import uuid

from pydantic import BaseModel


class PlayerUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    fft_license: str | None = None
    points: int | None = None
    club: str | None = None


class PlayerResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    user_id: uuid.UUID
    first_name: str
    last_name: str
    fft_license: str | None
    points: int
    club: str | None
