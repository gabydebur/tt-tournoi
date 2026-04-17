import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, require_role
from app.database import get_db
from app.models.registration import Registration, RegistrationStatus
from app.models.series import Series
from app.models.tournament import Tournament, TournamentStatus
from app.models.user import User, UserRole
from app.schemas.registration import (
    RegistrationDetailResponse,
    RegistrationResponse,
    RegPlayer,
    RegSeries,
)

router = APIRouter(tags=["registrations"])


async def _get_registration_or_404(registration_id: uuid.UUID, db: AsyncSession) -> Registration:
    result = await db.execute(
        select(Registration)
        .where(Registration.id == registration_id)
        .options(selectinload(Registration.player), selectinload(Registration.series))
    )
    reg = result.scalar_one_or_none()
    if reg is None:
        raise HTTPException(status_code=404, detail="Registration not found")
    return reg


@router.get("/tournaments/{tournament_id}/registrations", response_model=list[RegistrationDetailResponse])
async def list_registrations(
    tournament_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.REFEREE)),
) -> list[RegistrationDetailResponse]:
    # Get all series for this tournament
    series_result = await db.execute(
        select(Series).where(Series.tournament_id == tournament_id)
    )
    series_ids = [s.id for s in series_result.scalars().all()]

    if not series_ids:
        return []

    result = await db.execute(
        select(Registration)
        .where(Registration.series_id.in_(series_ids))
        .options(selectinload(Registration.player), selectinload(Registration.series))
    )
    registrations = result.scalars().all()

    out = []
    for r in registrations:
        player = None
        if r.player:
            player = RegPlayer(
                id=r.player.id,
                first_name=r.player.first_name,
                last_name=r.player.last_name,
                points=r.player.points,
                club=r.player.club,
                fft_license=r.player.fft_license,
            )
        series = None
        if r.series:
            series = RegSeries(
                id=r.series.id,
                name=r.series.name,
                max_points=r.series.max_points,
            )
        out.append(
            RegistrationDetailResponse(
                id=r.id,
                player_id=r.player_id,
                series_id=r.series_id,
                status=r.status,
                registered_at=r.registered_at,
                player=player,
                series=series,
            )
        )
    return out


@router.post(
    "/tournaments/{tournament_id}/series/{series_id}/register",
    response_model=RegistrationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register_player(
    tournament_id: uuid.UUID,
    series_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PLAYER)),
) -> RegistrationResponse:
    if current_user.player is None:
        raise HTTPException(status_code=400, detail="User has no player profile")

    # Validate tournament
    t_result = await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    tournament = t_result.scalar_one_or_none()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if tournament.status != TournamentStatus.REGISTRATION_OPEN:
        raise HTTPException(status_code=400, detail="Tournament registration is not open")

    # Validate series
    s_result = await db.execute(
        select(Series).where(Series.id == series_id, Series.tournament_id == tournament_id)
    )
    series = s_result.scalar_one_or_none()
    if series is None:
        raise HTTPException(status_code=404, detail="Series not found")

    # Check points eligibility
    player = current_user.player
    if player.points > series.max_points:
        raise HTTPException(
            status_code=400,
            detail=f"Player points ({player.points}) exceed series max_points ({series.max_points})",
        )
    if series.min_points is not None and player.points < series.min_points:
        raise HTTPException(
            status_code=400,
            detail=f"Player points ({player.points}) are below series min_points ({series.min_points})",
        )

    # Check for duplicate
    existing_result = await db.execute(
        select(Registration).where(
            Registration.player_id == player.id,
            Registration.series_id == series_id,
        )
    )
    if existing_result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="Already registered for this series")

    registration = Registration(
        id=uuid.uuid4(),
        player_id=player.id,
        series_id=series_id,
        status=RegistrationStatus.PENDING,
    )
    db.add(registration)
    await db.flush()
    return RegistrationResponse.model_validate(registration)


@router.put("/registrations/{registration_id}/confirm", response_model=RegistrationResponse)
async def confirm_registration(
    registration_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> RegistrationResponse:
    reg = await _get_registration_or_404(registration_id, db)
    if reg.status == RegistrationStatus.REJECTED:
        raise HTTPException(status_code=400, detail="Cannot confirm a rejected registration")
    reg.status = RegistrationStatus.CONFIRMED
    db.add(reg)
    await db.flush()
    return RegistrationResponse.model_validate(reg)


@router.put("/registrations/{registration_id}/reject", response_model=RegistrationResponse)
async def reject_registration(
    registration_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> RegistrationResponse:
    reg = await _get_registration_or_404(registration_id, db)
    reg.status = RegistrationStatus.REJECTED
    db.add(reg)
    await db.flush()
    return RegistrationResponse.model_validate(reg)


@router.delete("/registrations/{registration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_registration(
    registration_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    reg = await _get_registration_or_404(registration_id, db)

    is_self = current_user.player is not None and current_user.player.id == reg.player_id
    if current_user.role != UserRole.ADMIN and not is_self:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this registration")

    await db.delete(reg)
    await db.flush()
