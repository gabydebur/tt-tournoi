import uuid
from datetime import datetime

from sqlalchemy import and_, exists, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.match import Match, MatchStatus
from app.models.table import TableStatus, TournamentTable
from app.models.tournament import Tournament, TournamentStatus
from app.schemas.match import PlayerBrief, SuggestedMatchResponse


async def get_suggested_matches(
    tournament_id: uuid.UUID,
    db: AsyncSession,
) -> list[SuggestedMatchResponse]:
    """
    Return SCHEDULED matches where:
    - Both players are free (no IN_PROGRESS match)
    - At least one FREE table exists for this tournament
    Sorted by waiting time desc (those waiting longest come first).
    """
    # Check tournament is IN_PROGRESS
    t_result = await db.execute(
        select(Tournament).where(Tournament.id == tournament_id)
    )
    tournament = t_result.scalar_one_or_none()
    if tournament is None or tournament.status != TournamentStatus.IN_PROGRESS:
        return []

    # Check if there are free tables
    free_table_result = await db.execute(
        select(TournamentTable).where(
            and_(
                TournamentTable.tournament_id == tournament_id,
                TournamentTable.status == TableStatus.FREE,
            )
        ).limit(1)
    )
    has_free_table = free_table_result.scalar_one_or_none() is not None
    if not has_free_table:
        return []

    # Subquery: players currently IN_PROGRESS
    busy_as_p1 = select(Match.player1_id).where(Match.status == MatchStatus.IN_PROGRESS)
    busy_as_p2 = select(Match.player2_id).where(Match.status == MatchStatus.IN_PROGRESS)

    # Get all SCHEDULED matches for this tournament's series
    from app.models.series import Series

    scheduled_result = await db.execute(
        select(Match)
        .join(Series, Match.series_id == Series.id)
        .where(
            and_(
                Series.tournament_id == tournament_id,
                Match.status == MatchStatus.SCHEDULED,
                Match.player1_id.notin_(busy_as_p1),
                Match.player2_id.notin_(busy_as_p2),
                Match.player1_id.notin_(busy_as_p2),
                Match.player2_id.notin_(busy_as_p1),
            )
        )
        .options(
            selectinload(Match.player1),
            selectinload(Match.player2),
        )
    )
    scheduled_matches = scheduled_result.scalars().all()

    if not scheduled_matches:
        return []

    # For each match, determine waiting_since: the finished_at of the player's last match
    # We approximate by using scheduled_at as a proxy (longest scheduled = highest priority)
    # More precisely: find the latest finished_at among both players' finished matches
    all_player_ids = set()
    for m in scheduled_matches:
        all_player_ids.add(m.player1_id)
        all_player_ids.add(m.player2_id)

    # Get last finished match time per player
    from sqlalchemy import func, or_

    last_finished_result = await db.execute(
        select(
            func.greatest(Match.player1_id, Match.player2_id).label("dummy"),  # just for grouping trick
            Match.player1_id,
            Match.player2_id,
            func.max(Match.finished_at).label("last_finished"),
        )
        .where(
            and_(
                Match.status == MatchStatus.FINISHED,
                or_(
                    Match.player1_id.in_(all_player_ids),
                    Match.player2_id.in_(all_player_ids),
                ),
            )
        )
        .group_by(Match.player1_id, Match.player2_id)
    )

    # Build player_id -> last_finished_at map
    player_last_finished: dict[uuid.UUID, datetime | None] = {pid: None for pid in all_player_ids}
    for row in last_finished_result:
        if row.last_finished:
            for pid in [row.player1_id, row.player2_id]:
                if pid in player_last_finished:
                    current = player_last_finished[pid]
                    if current is None or row.last_finished > current:
                        player_last_finished[pid] = row.last_finished

    def waiting_since(match: Match) -> datetime | None:
        t1 = player_last_finished.get(match.player1_id)
        t2 = player_last_finished.get(match.player2_id)
        if t1 is None and t2 is None:
            return match.scheduled_at
        candidates = [x for x in [t1, t2] if x is not None]
        # The match can start when both are free: take the later of the two
        return max(candidates)

    # Sort: those waiting longest first (earliest waiting_since -> waited the most)
    sorted_matches = sorted(
        scheduled_matches,
        key=lambda m: waiting_since(m) or datetime.min,
    )

    suggestions: list[SuggestedMatchResponse] = []
    for match in sorted_matches:
        p1 = match.player1
        p2 = match.player2
        if p1 is None or p2 is None:
            continue
        suggestions.append(
            SuggestedMatchResponse(
                id=match.id,
                series_id=match.series_id,
                pool_id=match.pool_id,
                player1=PlayerBrief(
                    id=p1.id,
                    first_name=p1.first_name,
                    last_name=p1.last_name,
                    points=p1.points,
                    club=p1.club,
                ),
                player2=PlayerBrief(
                    id=p2.id,
                    first_name=p2.first_name,
                    last_name=p2.last_name,
                    points=p2.points,
                    club=p2.club,
                ),
                waiting_since=waiting_since(match),
                day_number=match.day_number,
            )
        )

    return suggestions
