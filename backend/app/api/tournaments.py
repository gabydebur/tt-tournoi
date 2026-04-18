import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, require_role
from app.database import get_db
from app.models.match import Match, MatchStatus
from app.models.pool import Pool, PoolPlayer, PoolStatus
from app.models.registration import Registration, RegistrationStatus
from app.models.series import Series
from app.models.table import TableStatus, TournamentTable
from app.models.tournament import Tournament, TournamentStatus
from app.models.user import User, UserRole
from app.schemas.tournament import (
    PoolPlayerStanding,
    PoolStanding,
    SeriesStanding,
    TournamentCreate,
    TournamentResponse,
    TournamentStandingsResponse,
    TournamentUpdate,
)
from app.services.pool_generator import generate_pools

router = APIRouter(prefix="/tournaments", tags=["tournaments"])


@router.get("", response_model=list[TournamentResponse])
async def list_tournaments(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[TournamentResponse]:
    result = await db.execute(select(Tournament).order_by(Tournament.created_at.desc()))
    tournaments = result.scalars().all()
    return [TournamentResponse.model_validate(t) for t in tournaments]


@router.post("", response_model=TournamentResponse, status_code=status.HTTP_201_CREATED)
async def create_tournament(
    body: TournamentCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> TournamentResponse:
    tournament = Tournament(
        id=uuid.uuid4(),
        **body.model_dump(),
    )
    db.add(tournament)
    await db.flush()
    return TournamentResponse.model_validate(tournament)


@router.get("/{tournament_id}", response_model=TournamentResponse)
async def get_tournament(
    tournament_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> TournamentResponse:
    result = await db.execute(
        select(Tournament)
        .where(Tournament.id == tournament_id)
        .options(selectinload(Tournament.series))
    )
    tournament = result.scalar_one_or_none()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")
    return TournamentResponse.model_validate(tournament)


@router.put("/{tournament_id}", response_model=TournamentResponse)
async def update_tournament(
    tournament_id: uuid.UUID,
    body: TournamentUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> TournamentResponse:
    result = await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    tournament = result.scalar_one_or_none()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")

    update_data = body.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(tournament, field, value)

    db.add(tournament)
    await db.flush()
    return TournamentResponse.model_validate(tournament)


@router.post("/{tournament_id}/open-registration", response_model=TournamentResponse)
async def open_registration(
    tournament_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> TournamentResponse:
    result = await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    tournament = result.scalar_one_or_none()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if tournament.status not in (TournamentStatus.DRAFT, TournamentStatus.REGISTRATION_CLOSED):
        raise HTTPException(status_code=400, detail="Cannot open registration from current status")
    tournament.status = TournamentStatus.REGISTRATION_OPEN
    db.add(tournament)
    await db.flush()
    return TournamentResponse.model_validate(tournament)


@router.post("/{tournament_id}/close-registration", response_model=TournamentResponse)
async def close_registration(
    tournament_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> TournamentResponse:
    result = await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    tournament = result.scalar_one_or_none()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if tournament.status != TournamentStatus.REGISTRATION_OPEN:
        raise HTTPException(status_code=400, detail="Registration is not open")
    tournament.status = TournamentStatus.REGISTRATION_CLOSED
    db.add(tournament)
    await db.flush()
    return TournamentResponse.model_validate(tournament)


@router.post("/{tournament_id}/start", response_model=TournamentResponse)
async def start_tournament(
    tournament_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> TournamentResponse:
    result = await db.execute(
        select(Tournament)
        .where(Tournament.id == tournament_id)
        .options(selectinload(Tournament.series))
    )
    tournament = result.scalar_one_or_none()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if tournament.status not in (
        TournamentStatus.REGISTRATION_CLOSED,
        TournamentStatus.REGISTRATION_OPEN,
    ):
        raise HTTPException(status_code=400, detail="Tournament cannot be started from current status")

    # Generate pools for each series
    for series in tournament.series:
        # Get confirmed players for this series
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

        from app.models.series import PhaseFormat

        if series.phase_format in (PhaseFormat.POOLS_ONLY, PhaseFormat.POOLS_THEN_ELIMINATION):
            await generate_pools(series, confirmed_players, db)

    tournament.status = TournamentStatus.IN_PROGRESS
    db.add(tournament)
    await db.flush()
    return TournamentResponse.model_validate(tournament)


@router.get("/{tournament_id}/standings", response_model=TournamentStandingsResponse)
async def get_standings(
    tournament_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> TournamentStandingsResponse:
    result = await db.execute(
        select(Tournament)
        .where(Tournament.id == tournament_id)
        .options(
            selectinload(Tournament.series).selectinload(Series.pools).selectinload(Pool.pool_players).selectinload(PoolPlayer.player)
        )
    )
    tournament = result.scalar_one_or_none()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")

    series_standings: list[SeriesStanding] = []
    for series in tournament.series:
        pool_standings: list[PoolStanding] = []
        for pool in series.pools:
            # Sort by ranking rules
            sorted_pp = sorted(
                pool.pool_players,
                key=lambda pp: (pp.points, pp.set_difference, pp.game_difference),
                reverse=True,
            )
            player_standings: list[PoolPlayerStanding] = []
            for pp in sorted_pp:
                if pp.player is None:
                    continue
                player_standings.append(
                    PoolPlayerStanding(
                        player_id=pp.player_id,
                        first_name=pp.player.first_name,
                        last_name=pp.player.last_name,
                        wins=pp.wins,
                        losses=pp.losses,
                        points=pp.points,
                        sets_won=pp.sets_won,
                        sets_lost=pp.sets_lost,
                        set_difference=pp.set_difference,
                        games_won=pp.games_won,
                        games_lost=pp.games_lost,
                        game_difference=pp.game_difference,
                    )
                )
            pool_standings.append(PoolStanding(pool_id=pool.id, pool_name=pool.name, players=player_standings))
        series_standings.append(
            SeriesStanding(series_id=series.id, series_name=series.name, pools=pool_standings)
        )

    return TournamentStandingsResponse(tournament_id=tournament_id, series=series_standings)


@router.get("/{tournament_id}/display-state")
async def get_display_state(
    tournament_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Public endpoint returning tournament display state (no auth)."""
    t_result = await db.execute(
        select(Tournament).where(Tournament.id == tournament_id)
    )
    tournament = t_result.scalar_one_or_none()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")

    # Load series + pools
    series_result = await db.execute(
        select(Series)
        .where(Series.tournament_id == tournament_id)
        .options(selectinload(Series.pools))
    )
    all_series = series_result.scalars().all()

    active_series = []
    for s in all_series:
        total_pools = len(s.pools)
        in_progress = sum(
            1 for p in s.pools if p.status == PoolStatus.IN_PROGRESS
        )
        finished_pools = sum(
            1 for p in s.pools if p.status == PoolStatus.FINISHED
        )
        # Determine phase: if all pools finished and elimination matches exist -> ELIMINATION
        phase = "POOLS"
        if total_pools > 0 and finished_pools == total_pools:
            phase = "ELIMINATION"
        active_series.append(
            {
                "id": str(s.id),
                "name": s.name,
                "phase": phase,
                "pools_in_progress": in_progress,
                "pools_total": total_pools,
            }
        )

    # Active matches
    tables_result = await db.execute(
        select(TournamentTable)
        .where(
            TournamentTable.tournament_id == tournament_id,
            TournamentTable.status == TableStatus.OCCUPIED,
        )
        .order_by(TournamentTable.number)
    )
    tables = tables_result.scalars().all()

    active_matches = []
    for t in tables:
        if t.current_match_id is None:
            continue
        m_result = await db.execute(
            select(Match)
            .where(Match.id == t.current_match_id)
            .options(
                selectinload(Match.player1),
                selectinload(Match.player2),
                selectinload(Match.sets),
                selectinload(Match.pool).selectinload(Pool.series),
                selectinload(Match.series),
            )
        )
        m = m_result.scalar_one_or_none()
        if m is None:
            continue
        sets_data = [
            {"score_player1": s.score_player1, "score_player2": s.score_player2}
            for s in (m.sets or [])
        ]
        # Current set score: last set not yet won, or 0-0
        current_set = {"p1": 0, "p2": 0}
        series_name = m.series.name if m.series else ""
        pool_name = m.pool.name if m.pool else ""
        p1 = m.player1
        p2 = m.player2
        active_matches.append(
            {
                "table_number": t.number,
                "series_name": series_name,
                "pool_name": pool_name,
                "player1": {
                    "first_name": p1.first_name if p1 else "",
                    "last_name": p1.last_name if p1 else "",
                    "points": p1.points if p1 else 0,
                },
                "player2": {
                    "first_name": p2.first_name if p2 else "",
                    "last_name": p2.last_name if p2 else "",
                    "points": p2.points if p2 else 0,
                },
                "sets": sets_data,
                "current_set_score": current_set,
            }
        )

    return {
        "tournament": {
            "id": str(tournament.id),
            "name": tournament.name,
            "status": tournament.status.value,
        },
        "active_series": active_series,
        "active_matches": active_matches,
    }
