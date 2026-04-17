import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_role
from app.database import get_db
from app.models.series import Series
from app.models.tournament import Tournament
from app.models.user import User, UserRole
from app.schemas.series import SeriesCreate, SeriesResponse, SeriesUpdate

router = APIRouter(prefix="/tournaments", tags=["series"])


async def _get_tournament_or_404(tournament_id: uuid.UUID, db: AsyncSession) -> Tournament:
    result = await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    tournament = result.scalar_one_or_none()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")
    return tournament


@router.get("/{tournament_id}/series", response_model=list[SeriesResponse])
async def list_series(
    tournament_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[SeriesResponse]:
    await _get_tournament_or_404(tournament_id, db)
    result = await db.execute(
        select(Series).where(Series.tournament_id == tournament_id).order_by(Series.created_at)
    )
    series_list = result.scalars().all()
    return [SeriesResponse.model_validate(s) for s in series_list]


@router.post("/{tournament_id}/series", response_model=SeriesResponse, status_code=status.HTTP_201_CREATED)
async def create_series(
    tournament_id: uuid.UUID,
    body: SeriesCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> SeriesResponse:
    await _get_tournament_or_404(tournament_id, db)
    series = Series(
        id=uuid.uuid4(),
        tournament_id=tournament_id,
        **body.model_dump(),
    )
    db.add(series)
    await db.flush()
    return SeriesResponse.model_validate(series)


@router.get("/{tournament_id}/series/{series_id}", response_model=SeriesResponse)
async def get_series(
    tournament_id: uuid.UUID,
    series_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> SeriesResponse:
    result = await db.execute(
        select(Series).where(Series.id == series_id, Series.tournament_id == tournament_id)
    )
    series = result.scalar_one_or_none()
    if series is None:
        raise HTTPException(status_code=404, detail="Series not found")
    return SeriesResponse.model_validate(series)


@router.put("/{tournament_id}/series/{series_id}", response_model=SeriesResponse)
async def update_series(
    tournament_id: uuid.UUID,
    series_id: uuid.UUID,
    body: SeriesUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> SeriesResponse:
    result = await db.execute(
        select(Series).where(Series.id == series_id, Series.tournament_id == tournament_id)
    )
    series = result.scalar_one_or_none()
    if series is None:
        raise HTTPException(status_code=404, detail="Series not found")

    update_data = body.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(series, field, value)

    db.add(series)
    await db.flush()
    return SeriesResponse.model_validate(series)
