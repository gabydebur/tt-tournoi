from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    fft_license: str | None = None
    points: int = 0
    club: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    email: str
    role: UserRole
    is_active: bool


class PlayerOut(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    first_name: str
    last_name: str
    fft_license: str | None
    points: int
    club: str | None


class MeResponse(BaseModel):
    model_config = {"from_attributes": True}

    user: UserOut
    player: PlayerOut | None
