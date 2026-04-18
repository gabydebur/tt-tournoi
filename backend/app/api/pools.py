import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, require_role
from app.database import get_db
from app.models.match import Match, MatchStatus
from app.models.pool import Pool, PoolPlayer, PoolStatus
from app.models.registration import Registration, RegistrationStatus
from app.models.series import PhaseFormat, Series
from app.models.table import TableStatus, TournamentTable
from app.models.tournament import Tournament, TournamentStatus
from app.models.user import User, UserRole
from app.schemas.pool import (
    ConfirmPoolsSummary,
    PoolDetail,
    PoolPlayerBrief,
    StartPoolRequest,
    SwapPlayersRequest,
)
from app.services.pool_generator import create_pool_matches, generate_pools
from app.services.websocket_manager import manager

router = APIRouter(tags=["pools"])


async def _load_pools_with_players(
    tournament_id: uuid.UUID, db: AsyncSession
) -> list[PoolDetail]:
    result = await db.execute(
        select(Pool)
        .join(Series, Pool.series_id == Series.id)
        .where(Series.tournament_id == tournament_id)
        .options(
            selectinload(Pool.series),
            selectinload(Pool.pool_players).selectinload(PoolPlayer.player),
        )
        .order_by(Series.name, Pool.name)
    )
    pools = result.scalars().all()

    out: list[PoolDetail] = []
    for pool in pools:
        players = []
        for pp in pool.pool_players:
            if pp.player is None:
                continue
            players.append(
                PoolPlayerBrief(
                    id=pp.player.id,
                    first_name=pp.player.first_name,
                    last_name=pp.player.last_name,
                    points=pp.player.points,
                    club=pp.player.club,
                )
            )
        out.append(
            PoolDetail(
                id=pool.id,
                name=pool.name,
                status=pool.status,
                table_id=pool.table_id,
                series_id=pool.series_id,
                series_name=pool.series.name if pool.series else "",
                players=players,
            )
        )
    return out


async def _generate_all_draft_pools(
    tournament_id: uuid.UUID, db: AsyncSession
) -> list[PoolDetail]:
    # Load tournament with series
    result = await db.execute(
        select(Tournament)
        .where(Tournament.id == tournament_id)
        .options(selectinload(Tournament.series))
    )
    tournament = result.scalar_one_or_none()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")

    # Delete existing DRAFT pools for this tournament
    series_ids = [s.id for s in tournament.series]
    if series_ids:
        draft_pools_result = await db.execute(
            select(Pool).where(
                Pool.series_id.in_(series_ids),
                Pool.status == PoolStatus.DRAFT,
            )
        )
        draft_pools = draft_pools_result.scalars().all()
        for p in draft_pools:
            await db.delete(p)
        await db.flush()

    # Generate pools for each series from CONFIRMED registrations
    for series in tournament.series:
        if series.phase_format not in (
            PhaseFormat.POOLS_ONLY,
            PhaseFormat.POOLS_THEN_ELIMINATION,
        ):
            continue

        reg_result = await db.execute(
            select(Registration)
            .where(
                Registration.series_id == series.id,
                Registration.status == RegistrationStatus.CONFIRMED,
            )
            .options(selectinload(Registration.player))
        )
        registrations = reg_result.scalars().all()
        confirmed_players = [r.player for r in registrations if r.player is not None]

        await generate_pools(
            series, confirmed_players, db, create_matches=False, status=PoolStatus.DRAFT
        )

    await db.flush()
    return await _load_pools_with_players(tournament_id, db)


@router.post("/tournaments/{tournament_id}/pools/generate", response_model=list[PoolDetail])
async def generate_tournament_pools(
    tournament_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.REFEREE)),
) -> list[PoolDetail]:
    return await _generate_all_draft_pools(tournament_id, db)


@router.post("/tournaments/{tournament_id}/pools/regenerate", response_model=list[PoolDetail])
async def regenerate_tournament_pools(
    tournament_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.REFEREE)),
) -> list[PoolDetail]:
    return await _generate_all_draft_pools(tournament_id, db)


@router.get("/tournaments/{tournament_id}/pools", response_model=list[PoolDetail])
async def list_tournament_pools(
    tournament_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[PoolDetail]:
    return await _load_pools_with_players(tournament_id, db)


@router.post("/pools/swap-players", response_model=list[PoolDetail])
async def swap_players(
    body: SwapPlayersRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.REFEREE)),
) -> list[PoolDetail]:
    result = await db.execute(
        select(Pool).where(Pool.id.in_([body.pool_a_id, body.pool_b_id]))
    )
    pools = {p.id: p for p in result.scalars().all()}
    pool_a = pools.get(body.pool_a_id)
    pool_b = pools.get(body.pool_b_id)
    if pool_a is None or pool_b is None:
        raise HTTPException(status_code=404, detail="Pool not found")
    if pool_a.status != PoolStatus.DRAFT or pool_b.status != PoolStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Both pools must be DRAFT to swap players")
    if pool_a.series_id != pool_b.series_id:
        raise HTTPException(
            status_code=400, detail="Pools must belong to the same series"
        )

    # Fetch pool_players entries
    pp_a_result = await db.execute(
        select(PoolPlayer).where(
            PoolPlayer.pool_id == body.pool_a_id,
            PoolPlayer.player_id == body.player_a_id,
        )
    )
    pp_a = pp_a_result.scalar_one_or_none()
    pp_b_result = await db.execute(
        select(PoolPlayer).where(
            PoolPlayer.pool_id == body.pool_b_id,
            PoolPlayer.player_id == body.player_b_id,
        )
    )
    pp_b = pp_b_result.scalar_one_or_none()
    if pp_a is None or pp_b is None:
        raise HTTPException(status_code=404, detail="Player not found in given pool")

    # Delete both; re-create with pools swapped
    await db.delete(pp_a)
    await db.delete(pp_b)
    await db.flush()

    new_a = PoolPlayer(
        pool_id=body.pool_b_id,
        player_id=body.player_a_id,
    )
    new_b = PoolPlayer(
        pool_id=body.pool_a_id,
        player_id=body.player_b_id,
    )
    db.add(new_a)
    db.add(new_b)
    await db.flush()

    # Return pools for the tournament
    series_result = await db.execute(
        select(Series).where(Series.id == pool_a.series_id)
    )
    series = series_result.scalar_one()
    return await _load_pools_with_players(series.tournament_id, db)


@router.post(
    "/tournaments/{tournament_id}/pools/confirm", response_model=ConfirmPoolsSummary
)
async def confirm_pools(
    tournament_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.REFEREE)),
) -> ConfirmPoolsSummary:
    t_result = await db.execute(
        select(Tournament).where(Tournament.id == tournament_id)
    )
    tournament = t_result.scalar_one_or_none()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")

    # Load all DRAFT pools with series info
    result = await db.execute(
        select(Pool)
        .join(Series, Pool.series_id == Series.id)
        .where(
            Series.tournament_id == tournament_id,
            Pool.status == PoolStatus.DRAFT,
        )
        .options(selectinload(Pool.series))
    )
    pools = result.scalars().all()

    matches_created = 0
    for pool in pools:
        pool.status = PoolStatus.CONFIRMED
        db.add(pool)
        # Create matches
        created = await create_pool_matches(pool, pool.series, db)
        matches_created += len(created)

    tournament.status = TournamentStatus.IN_PROGRESS
    db.add(tournament)
    await db.flush()

    return ConfirmPoolsSummary(
        tournament_id=tournament_id,
        pools_confirmed=len(pools),
        matches_created=matches_created,
    )


@router.post("/pools/{pool_id}/start", response_model=PoolDetail)
async def start_pool(
    pool_id: uuid.UUID,
    body: StartPoolRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.REFEREE)),
) -> PoolDetail:
    result = await db.execute(
        select(Pool)
        .where(Pool.id == pool_id)
        .options(
            selectinload(Pool.series),
            selectinload(Pool.pool_players).selectinload(PoolPlayer.player),
        )
    )
    pool = result.scalar_one_or_none()
    if pool is None:
        raise HTTPException(status_code=404, detail="Pool not found")
    if pool.status != PoolStatus.CONFIRMED:
        raise HTTPException(status_code=400, detail="Pool must be CONFIRMED to start")

    # Check table
    table_result = await db.execute(
        select(TournamentTable).where(TournamentTable.id == body.table_id)
    )
    table = table_result.scalar_one_or_none()
    if table is None:
        raise HTTPException(status_code=404, detail="Table not found")
    if table.status != TableStatus.FREE:
        raise HTTPException(status_code=400, detail="Table is not free")

    # Pick the first match (lowest order_in_pool)
    match_result = await db.execute(
        select(Match)
        .where(
            Match.pool_id == pool.id,
            Match.status == MatchStatus.SCHEDULED,
        )
        .order_by(Match.order_in_pool)
        .limit(1)
    )
    first_match = match_result.scalar_one_or_none()
    if first_match is None:
        raise HTTPException(status_code=400, detail="Pool has no scheduled matches")

    first_match.status = MatchStatus.IN_PROGRESS
    first_match.table_id = body.table_id
    first_match.started_at = datetime.now(timezone.utc)
    db.add(first_match)

    pool.status = PoolStatus.IN_PROGRESS
    pool.table_id = body.table_id
    pool.current_match_id = first_match.id
    db.add(pool)

    table.status = TableStatus.OCCUPIED
    table.current_match_id = first_match.id
    db.add(table)

    await db.flush()

    tournament_id = pool.series.tournament_id if pool.series else None
    if tournament_id:
        await manager.broadcast(
            str(tournament_id),
            {
                "event": "pool_started",
                "pool_id": str(pool.id),
                "table_id": str(body.table_id),
            },
        )
        await manager.broadcast(
            str(tournament_id),
            {
                "event": "match_started",
                "match_id": str(first_match.id),
                "table_id": str(body.table_id),
            },
        )

    players = []
    for pp in pool.pool_players:
        if pp.player is None:
            continue
        players.append(
            PoolPlayerBrief(
                id=pp.player.id,
                first_name=pp.player.first_name,
                last_name=pp.player.last_name,
                points=pp.player.points,
                club=pp.player.club,
            )
        )

    return PoolDetail(
        id=pool.id,
        name=pool.name,
        status=pool.status,
        table_id=pool.table_id,
        series_id=pool.series_id,
        series_name=pool.series.name if pool.series else "",
        players=players,
    )
