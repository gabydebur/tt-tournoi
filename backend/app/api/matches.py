import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, require_role
from app.database import get_db
from app.models.match import Match, MatchStatus, SetResult
from app.models.player import Player
from app.models.pool import PoolPlayer
from app.models.series import PhaseFormat, Series
from app.models.table import TableStatus, TournamentTable
from app.models.tournament import TournamentStatus
from app.models.user import User, UserRole
from app.models.pool import Pool, PoolStatus
from app.schemas.match import (
    MatchDetailResponse,
    MatchResultRequest,
    MatchStartRequest,
    PlayerBrief,
    SetResultResponse,
    SuggestionsResponse,
)
from app.services.match_suggestion import get_suggestions
from app.services.websocket_manager import manager

router = APIRouter(tags=["matches"])


def _set_is_won(score_p1: int, score_p2: int) -> tuple[bool, bool]:
    """Returns (p1_won, p2_won) for a set."""
    winning_score = 11
    if score_p1 >= winning_score and (score_p1 - score_p2) >= 2:
        return True, False
    if score_p2 >= winning_score and (score_p2 - score_p1) >= 2:
        return False, True
    return False, False


def _compute_match_winner(sets: list[dict], sets_to_win: int) -> tuple[int, int, int, int]:
    """
    Returns (p1_sets_won, p2_sets_won, p1_games_won, p2_games_won).
    """
    p1_sets = 0
    p2_sets = 0
    p1_games = 0
    p2_games = 0
    for s in sets:
        p1_score = s["score_player1"]
        p2_score = s["score_player2"]
        p1_games += p1_score
        p2_games += p2_score
        p1_won, p2_won = _set_is_won(p1_score, p2_score)
        if p1_won:
            p1_sets += 1
        elif p2_won:
            p2_sets += 1
    return p1_sets, p2_sets, p1_games, p2_games


@router.get("/tournaments/{tournament_id}/matches", response_model=list[MatchDetailResponse])
async def list_matches(
    tournament_id: uuid.UUID,
    day: int | None = Query(None),
    series_id: uuid.UUID | None = Query(None),
    match_status: MatchStatus | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[MatchDetailResponse]:
    conditions = [Series.tournament_id == tournament_id]
    if series_id:
        conditions.append(Match.series_id == series_id)
    if match_status:
        conditions.append(Match.status == match_status)
    if day is not None:
        conditions.append(Match.day_number == day)

    result = await db.execute(
        select(Match)
        .join(Series, Match.series_id == Series.id)
        .where(and_(*conditions))
        .options(
            selectinload(Match.player1),
            selectinload(Match.player2),
            selectinload(Match.winner),
            selectinload(Match.sets),
        )
        .order_by(Match.scheduled_at)
    )
    matches = result.scalars().all()

    out = []
    for m in matches:
        out.append(_to_detail_response(m))
    return out


@router.get(
    "/tournaments/{tournament_id}/matches/suggestions", response_model=SuggestionsResponse
)
async def suggested_matches(
    tournament_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.REFEREE)),
) -> SuggestionsResponse:
    return await get_suggestions(tournament_id, db)


@router.get("/matches/{match_id}", response_model=MatchDetailResponse)
async def get_match(
    match_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> MatchDetailResponse:
    result = await db.execute(
        select(Match)
        .where(Match.id == match_id)
        .options(
            selectinload(Match.player1),
            selectinload(Match.player2),
            selectinload(Match.winner),
            selectinload(Match.sets),
        )
    )
    match = result.scalar_one_or_none()
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")
    return _to_detail_response(match)


@router.post("/matches/{match_id}/start", response_model=MatchDetailResponse)
async def start_match(
    match_id: uuid.UUID,
    body: MatchStartRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.REFEREE)),
) -> MatchDetailResponse:
    result = await db.execute(
        select(Match)
        .where(Match.id == match_id)
        .options(
            selectinload(Match.player1),
            selectinload(Match.player2),
            selectinload(Match.winner),
            selectinload(Match.sets),
        )
    )
    match = result.scalar_one_or_none()
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")
    if match.status != MatchStatus.SCHEDULED:
        raise HTTPException(status_code=400, detail="Match is not in SCHEDULED status")

    # Check table is FREE
    table_result = await db.execute(
        select(TournamentTable).where(TournamentTable.id == body.table_id)
    )
    table = table_result.scalar_one_or_none()
    if table is None:
        raise HTTPException(status_code=404, detail="Table not found")
    if table.status != TableStatus.FREE:
        raise HTTPException(status_code=400, detail="Table is not free")

    # Assign table and start match
    match.table_id = body.table_id
    match.status = MatchStatus.IN_PROGRESS
    match.started_at = datetime.now(timezone.utc)
    table.status = TableStatus.OCCUPIED
    table.current_match_id = match.id

    db.add(match)
    db.add(table)
    await db.flush()

    # Broadcast event
    series_result = await db.execute(select(Series).where(Series.id == match.series_id))
    series = series_result.scalar_one_or_none()
    if series:
        await manager.broadcast(
            str(series.tournament_id),
            {"event": "match_started", "match_id": str(match.id), "table_id": str(body.table_id)},
        )

    return _to_detail_response(match)


@router.post("/matches/{match_id}/result", response_model=MatchDetailResponse)
async def submit_result(
    match_id: uuid.UUID,
    body: MatchResultRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.REFEREE)),
) -> MatchDetailResponse:
    result = await db.execute(
        select(Match)
        .where(Match.id == match_id)
        .options(
            selectinload(Match.player1),
            selectinload(Match.player2),
            selectinload(Match.winner),
            selectinload(Match.sets),
            selectinload(Match.series),
        )
    )
    match = result.scalar_one_or_none()
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")
    if match.status != MatchStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Match is not IN_PROGRESS")

    sets_data = [s.model_dump() for s in body.sets]
    p1_sets, p2_sets, p1_games, p2_games = _compute_match_winner(sets_data, match.sets_to_win)

    # Validate winner
    if p1_sets < match.sets_to_win and p2_sets < match.sets_to_win:
        raise HTTPException(
            status_code=400,
            detail=f"No winner determined. Need {match.sets_to_win} sets to win.",
        )

    winner_id = match.player1_id if p1_sets >= match.sets_to_win else match.player2_id
    loser_id = match.player2_id if winner_id == match.player1_id else match.player1_id

    # Save set results
    for idx, set_data in enumerate(sets_data, start=1):
        sr = SetResult(
            id=uuid.uuid4(),
            match_id=match.id,
            set_number=idx,
            score_player1=set_data["score_player1"],
            score_player2=set_data["score_player2"],
        )
        db.add(sr)

    match.status = MatchStatus.FINISHED
    match.winner_id = winner_id
    match.finished_at = datetime.now(timezone.utc)

    match_table_id = match.table_id
    match_pool_id = match.pool_id

    db.add(match)
    await db.flush()

    # Update PoolPlayer stats if this is a pool match
    if match_pool_id:
        await _update_pool_stats(
            match=match,
            winner_id=winner_id,
            loser_id=loser_id,
            p1_sets=p1_sets,
            p2_sets=p2_sets,
            p1_games=p1_games,
            p2_games=p2_games,
            db=db,
        )

    series = match.series

    # Pool match auto-advance
    if match_pool_id:
        # Find next match in pool
        next_result = await db.execute(
            select(Match)
            .where(
                Match.pool_id == match_pool_id,
                Match.status == MatchStatus.SCHEDULED,
            )
            .order_by(Match.order_in_pool)
            .limit(1)
        )
        next_match = next_result.scalar_one_or_none()

        # Load pool
        pool_result = await db.execute(
            select(Pool).where(Pool.id == match_pool_id)
        )
        pool = pool_result.scalar_one_or_none()

        if next_match is not None:
            next_match.status = MatchStatus.IN_PROGRESS
            next_match.table_id = match_table_id
            next_match.started_at = datetime.now(timezone.utc)
            db.add(next_match)
            if pool:
                pool.current_match_id = next_match.id
                db.add(pool)
            if match_table_id:
                table_result = await db.execute(
                    select(TournamentTable).where(TournamentTable.id == match_table_id)
                )
                table = table_result.scalar_one_or_none()
                if table:
                    table.current_match_id = next_match.id
                    db.add(table)
            await db.flush()
            if series:
                await manager.broadcast(
                    str(series.tournament_id),
                    {
                        "event": "match_started",
                        "match_id": str(next_match.id),
                        "table_id": str(match_table_id) if match_table_id else None,
                    },
                )
        else:
            # Pool finished — free table
            if pool:
                pool.status = PoolStatus.FINISHED
                pool.current_match_id = None
                pool.table_id = None
                db.add(pool)
            if match_table_id:
                table_result = await db.execute(
                    select(TournamentTable).where(TournamentTable.id == match_table_id)
                )
                table = table_result.scalar_one_or_none()
                if table:
                    table.status = TableStatus.FREE
                    table.current_match_id = None
                    db.add(table)
            await db.flush()
            if series and pool:
                await manager.broadcast(
                    str(series.tournament_id),
                    {"event": "pool_finished", "pool_id": str(pool.id)},
                )
    else:
        # Elimination or standalone match — free the table
        if match_table_id:
            table_result = await db.execute(
                select(TournamentTable).where(TournamentTable.id == match_table_id)
            )
            table = table_result.scalar_one_or_none()
            if table:
                table.status = TableStatus.FREE
                table.current_match_id = None
                db.add(table)

    # Handle elimination bracket advancement
    if series and match.elimination_round is not None:
        from app.services.bracket_generator import advance_bracket

        winner_player_result = await db.execute(select(Player).where(Player.id == winner_id))
        winner_player = winner_player_result.scalar_one_or_none()
        if winner_player:
            await advance_bracket(match, winner_player, series, db)

    await db.flush()

    # Reload with sets
    await db.refresh(match)
    result2 = await db.execute(
        select(Match)
        .where(Match.id == match_id)
        .options(
            selectinload(Match.player1),
            selectinload(Match.player2),
            selectinload(Match.winner),
            selectinload(Match.sets),
        )
    )
    match = result2.scalar_one()

    # Broadcast event
    if series:
        await manager.broadcast(
            str(series.tournament_id),
            {
                "event": "match_finished",
                "match_id": str(match.id),
                "winner_id": str(winner_id),
            },
        )

    return _to_detail_response(match)


async def _update_pool_stats(
    match: Match,
    winner_id: uuid.UUID,
    loser_id: uuid.UUID,
    p1_sets: int,
    p2_sets: int,
    p1_games: int,
    p2_games: int,
    db: AsyncSession,
) -> None:
    """Update PoolPlayer stats after a pool match finishes."""
    from sqlalchemy import and_

    # Determine which player is p1/p2 in the pool stat context
    # winner/loser sets and games
    if winner_id == match.player1_id:
        winner_sets = p1_sets
        loser_sets = p2_sets
        winner_games = p1_games
        loser_games = p2_games
    else:
        winner_sets = p2_sets
        loser_sets = p1_sets
        winner_games = p2_games
        loser_games = p1_games

    # Update winner
    winner_pp_result = await db.execute(
        select(PoolPlayer).where(
            and_(PoolPlayer.pool_id == match.pool_id, PoolPlayer.player_id == winner_id)
        )
    )
    winner_pp = winner_pp_result.scalar_one_or_none()
    if winner_pp:
        winner_pp.wins += 1
        winner_pp.sets_won += winner_sets
        winner_pp.sets_lost += loser_sets
        winner_pp.games_won += winner_games
        winner_pp.games_lost += loser_games
        db.add(winner_pp)

    # Update loser
    loser_pp_result = await db.execute(
        select(PoolPlayer).where(
            and_(PoolPlayer.pool_id == match.pool_id, PoolPlayer.player_id == loser_id)
        )
    )
    loser_pp = loser_pp_result.scalar_one_or_none()
    if loser_pp:
        loser_pp.losses += 1
        loser_pp.sets_won += loser_sets
        loser_pp.sets_lost += winner_sets
        loser_pp.games_won += loser_games
        loser_pp.games_lost += winner_games
        db.add(loser_pp)


def _player_to_brief(player: Player | None) -> PlayerBrief | None:
    if player is None:
        return None
    return PlayerBrief(
        id=player.id,
        first_name=player.first_name,
        last_name=player.last_name,
        points=player.points,
        club=player.club,
    )


def _to_detail_response(match: Match) -> MatchDetailResponse:
    sets = [
        SetResultResponse(
            id=s.id,
            match_id=s.match_id,
            set_number=s.set_number,
            score_player1=s.score_player1,
            score_player2=s.score_player2,
        )
        for s in (match.sets or [])
    ]
    return MatchDetailResponse(
        id=match.id,
        series_id=match.series_id,
        pool_id=match.pool_id,
        elimination_round=match.elimination_round,
        player1_id=match.player1_id,
        player2_id=match.player2_id,
        table_id=match.table_id,
        status=match.status,
        winner_id=match.winner_id,
        day_number=match.day_number,
        scheduled_at=match.scheduled_at,
        started_at=match.started_at,
        finished_at=match.finished_at,
        sets_to_win=match.sets_to_win,
        sets=sets,
        player1=_player_to_brief(match.player1),
        player2=_player_to_brief(match.player2),
        winner=_player_to_brief(match.winner),
    )
