import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_role
from app.database import get_db
from app.models.player import Player
from app.models.user import User, UserRole
from app.schemas.player import PlayerResponse, PlayerUpdate

router = APIRouter(prefix="/players", tags=["players"])


@router.get("", response_model=list[PlayerResponse])
async def list_players(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> list[PlayerResponse]:
    result = await db.execute(select(Player))
    players = result.scalars().all()
    return [PlayerResponse.model_validate(p) for p in players]


@router.get("/me/registrations")
async def my_registrations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy.orm import selectinload

    from app.models.registration import Registration
    from app.models.series import Series
    from app.models.tournament import Tournament
    from app.schemas.registration import (
        RegistrationDetailResponse,
        RegPlayer,
        RegSeries,
    )

    if current_user.player is None:
        return []

    result = await db.execute(
        select(Registration)
        .where(Registration.player_id == current_user.player.id)
        .options(
            selectinload(Registration.series).selectinload(Series.tournament),
            selectinload(Registration.player),
        )
    )
    regs = result.scalars().all()

    out = []
    for r in regs:
        series = None
        tournament_name = None
        if r.series:
            series = RegSeries(id=r.series.id, name=r.series.name, max_points=r.series.max_points)
            if r.series.tournament:
                tournament_name = r.series.tournament.name

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

        out.append(
            RegistrationDetailResponse(
                id=r.id,
                player_id=r.player_id,
                series_id=r.series_id,
                status=r.status,
                registered_at=r.registered_at,
                player=player,
                series=series,
                tournament_name=tournament_name,
            )
        )
    return out


@router.get("/{player_id}", response_model=PlayerResponse)
async def get_player(
    player_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> PlayerResponse:
    result = await db.execute(select(Player).where(Player.id == player_id))
    player = result.scalar_one_or_none()
    if player is None:
        raise HTTPException(status_code=404, detail="Player not found")
    return PlayerResponse.model_validate(player)


@router.put("/{player_id}", response_model=PlayerResponse)
async def update_player(
    player_id: uuid.UUID,
    body: PlayerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PlayerResponse:
    result = await db.execute(select(Player).where(Player.id == player_id))
    player = result.scalar_one_or_none()
    if player is None:
        raise HTTPException(status_code=404, detail="Player not found")

    # Allow ADMIN or the player themselves
    is_self = current_user.player is not None and current_user.player.id == player_id
    if current_user.role != UserRole.ADMIN and not is_self:
        raise HTTPException(status_code=403, detail="Not authorized to update this player")

    update_data = body.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(player, field, value)

    db.add(player)
    await db.flush()
    return PlayerResponse.model_validate(player)
