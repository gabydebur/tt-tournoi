import uuid

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.match import Match, MatchStatus
from app.models.pool import Pool, PoolPlayer, PoolStatus
from app.models.series import Series
from app.models.table import TableStatus, TournamentTable
from app.schemas.match import (
    ActiveMatch,
    ActivePool,
    ActiveTable,
    EliminationToStart,
    PlayerBrief,
    PoolToStart,
    SetSnapshot,
    SuggestionsResponse,
    TableBrief,
)


def _round_name(round_number: int) -> str:
    mapping = {1: "FINAL", 2: "SEMIFINAL", 3: "QUARTERFINAL", 4: "R16", 5: "R32"}
    return mapping.get(round_number, f"R{round_number}")


async def get_suggestions(
    tournament_id: uuid.UUID, db: AsyncSession
) -> SuggestionsResponse:
    # Pools to start: CONFIRMED pools
    pools_result = await db.execute(
        select(Pool)
        .join(Series, Pool.series_id == Series.id)
        .where(
            Series.tournament_id == tournament_id,
            Pool.status == PoolStatus.CONFIRMED,
        )
        .options(
            selectinload(Pool.series),
            selectinload(Pool.pool_players).selectinload(PoolPlayer.player),
        )
        .order_by(Series.name, Pool.name)
    )
    pools = pools_result.scalars().all()

    pools_to_start: list[PoolToStart] = []
    for pool in pools:
        players = []
        for pp in pool.pool_players:
            if pp.player is None:
                continue
            players.append(
                PlayerBrief(
                    id=pp.player.id,
                    first_name=pp.player.first_name,
                    last_name=pp.player.last_name,
                    points=pp.player.points,
                    club=pp.player.club,
                )
            )
        pools_to_start.append(
            PoolToStart(
                id=pool.id,
                name=pool.name,
                series_name=pool.series.name if pool.series else "",
                players=players,
            )
        )

    # Eliminations to start: SCHEDULED matches with pool_id IS NULL
    busy_players: set[uuid.UUID] = set()
    busy_result = await db.execute(
        select(Match).where(Match.status == MatchStatus.IN_PROGRESS)
    )
    for m in busy_result.scalars().all():
        busy_players.add(m.player1_id)
        if m.player2_id is not None:
            busy_players.add(m.player2_id)

    elim_result = await db.execute(
        select(Match)
        .join(Series, Match.series_id == Series.id)
        .where(
            Series.tournament_id == tournament_id,
            Match.status == MatchStatus.SCHEDULED,
            Match.pool_id.is_(None),
        )
        .options(
            selectinload(Match.player1),
            selectinload(Match.player2),
            selectinload(Match.series),
        )
    )
    elim_matches = elim_result.scalars().all()
    eliminations_to_start: list[EliminationToStart] = []
    for m in elim_matches:
        if m.player1_id in busy_players:
            continue
        if m.player2_id is not None and m.player2_id in busy_players:
            continue
        p1 = (
            PlayerBrief(
                id=m.player1.id,
                first_name=m.player1.first_name,
                last_name=m.player1.last_name,
                points=m.player1.points,
                club=m.player1.club,
            )
            if m.player1
            else None
        )
        p2 = (
            PlayerBrief(
                id=m.player2.id,
                first_name=m.player2.first_name,
                last_name=m.player2.last_name,
                points=m.player2.points,
                club=m.player2.club,
            )
            if m.player2
            else None
        )
        round_str = _round_name(m.elimination_round) if m.elimination_round else "UNKNOWN"
        eliminations_to_start.append(
            EliminationToStart(
                id=m.id,
                series_name=m.series.name if m.series else "",
                round=round_str,
                player1=p1,
                player2=p2,
            )
        )

    # Tables
    tables_result = await db.execute(
        select(TournamentTable)
        .where(TournamentTable.tournament_id == tournament_id)
        .order_by(TournamentTable.number)
    )
    tables = tables_result.scalars().all()

    available_tables: list[TableBrief] = []
    active_tables: list[ActiveTable] = []

    for t in tables:
        if t.status == TableStatus.FREE:
            available_tables.append(
                TableBrief(id=t.id, number=t.number, status=t.status.value)
            )
            continue
        # Occupied table — load current match & pool
        current_match: ActiveMatch | None = None
        current_pool: ActivePool | None = None
        pool_progress: dict | None = None

        if t.current_match_id:
            m_result = await db.execute(
                select(Match)
                .where(Match.id == t.current_match_id)
                .options(
                    selectinload(Match.player1),
                    selectinload(Match.player2),
                    selectinload(Match.sets),
                    selectinload(Match.pool).selectinload(Pool.series),
                )
            )
            m = m_result.scalar_one_or_none()
            if m:
                p1 = (
                    PlayerBrief(
                        id=m.player1.id,
                        first_name=m.player1.first_name,
                        last_name=m.player1.last_name,
                        points=m.player1.points,
                        club=m.player1.club,
                    )
                    if m.player1
                    else None
                )
                p2 = (
                    PlayerBrief(
                        id=m.player2.id,
                        first_name=m.player2.first_name,
                        last_name=m.player2.last_name,
                        points=m.player2.points,
                        club=m.player2.club,
                    )
                    if m.player2
                    else None
                )
                sets = [
                    SetSnapshot(score_player1=s.score_player1, score_player2=s.score_player2)
                    for s in (m.sets or [])
                ]
                current_match = ActiveMatch(id=m.id, player1=p1, player2=p2, sets=sets)
                if m.pool:
                    current_pool = ActivePool(
                        id=m.pool.id,
                        name=m.pool.name,
                        series_name=m.pool.series.name if m.pool.series else "",
                    )
                    # pool progress
                    total_result = await db.execute(
                        select(Match).where(Match.pool_id == m.pool.id)
                    )
                    all_matches = total_result.scalars().all()
                    played = sum(
                        1 for mm in all_matches if mm.status == MatchStatus.FINISHED
                    )
                    pool_progress = {"played": played, "total": len(all_matches)}

        active_tables.append(
            ActiveTable(
                id=t.id,
                number=t.number,
                current_pool=current_pool,
                current_match=current_match,
                pool_progress=pool_progress,
            )
        )

    return SuggestionsResponse(
        pools_to_start=pools_to_start,
        eliminations_to_start=eliminations_to_start,
        available_tables=available_tables,
        active_tables=active_tables,
    )
