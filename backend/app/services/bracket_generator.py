import math
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.match import Match, MatchStatus
from app.models.player import Player
from app.models.pool import Pool, PoolPlayer
from app.models.series import Series


def _get_top_players_from_pool(
    pool: Pool,
    pool_players: list[PoolPlayer],
    top_n: int,
) -> list[Player]:
    """
    Return top N players from a pool sorted by:
    points desc -> set_difference desc -> game_difference desc
    """
    sorted_pp = sorted(
        pool_players,
        key=lambda pp: (pp.points, pp.set_difference, pp.game_difference),
        reverse=True,
    )
    return [pp.player for pp in sorted_pp[:top_n] if pp.player is not None]


def _next_power_of_two(n: int) -> int:
    if n <= 1:
        return 1
    return 2 ** math.ceil(math.log2(n))


async def generate_elimination_bracket(
    series: Series,
    pool_results: list[tuple[Pool, list[PoolPlayer]]],
    db: AsyncSession,
    top_n_per_pool: int = 2,
    day_number: int = 2,
) -> list[Match]:
    """
    Take top N players from each pool and generate single-elimination bracket.
    Returns list of created Match objects for the first round.
    """
    qualified: list[Player] = []
    for pool, pool_players in pool_results:
        top = _get_top_players_from_pool(pool, pool_players, top_n_per_pool)
        qualified.extend(top)

    if len(qualified) < 2:
        return []

    # Pad to next power of two with byes (None = walkover)
    bracket_size = _next_power_of_two(len(qualified))
    byes_needed = bracket_size - len(qualified)

    # Interleave byes for fair distribution
    seeded: list[Player | None] = list(qualified)
    for _ in range(byes_needed):
        seeded.append(None)

    # Round 1 matches
    round_number = int(math.log2(bracket_size))  # e.g. 8 players -> round 3 (quarterfinal)
    created_matches: list[Match] = []

    i = 0
    while i < len(seeded) - 1:
        p1 = seeded[i]
        p2 = seeded[i + 1]
        i += 2

        if p1 is None and p2 is None:
            continue

        if p1 is None or p2 is None:
            # Walkover
            winner = p1 if p2 is None else p2
            loser_placeholder = p2 if p2 is not None else p1
            match = Match(
                id=uuid.uuid4(),
                series_id=series.id,
                pool_id=None,
                elimination_round=round_number,
                player1_id=winner.id,  # type: ignore[union-attr]
                player2_id=loser_placeholder.id,  # type: ignore[union-attr]
                status=MatchStatus.WALKOVER,
                winner_id=winner.id,  # type: ignore[union-attr]
                day_number=day_number,
                sets_to_win=series.sets_to_win_match,
                scheduled_at=datetime.now(timezone.utc),
            )
        else:
            match = Match(
                id=uuid.uuid4(),
                series_id=series.id,
                pool_id=None,
                elimination_round=round_number,
                player1_id=p1.id,
                player2_id=p2.id,
                status=MatchStatus.SCHEDULED,
                day_number=day_number,
                sets_to_win=series.sets_to_win_match,
                scheduled_at=datetime.now(timezone.utc),
            )

        db.add(match)
        created_matches.append(match)

    await db.flush()
    return created_matches


async def advance_bracket(
    finished_match: Match,
    winner: Player,
    series: Series,
    db: AsyncSession,
) -> Match | None:
    """
    After an elimination match finishes, find or create the next round match.
    Returns the next match if created, None if this was the final.
    """
    from sqlalchemy import select

    if finished_match.elimination_round is None or finished_match.elimination_round <= 1:
        # This was the final — tournament over for this series
        return None

    next_round = finished_match.elimination_round - 1

    # Determine sets_to_win for next match (final uses sets_to_win_final)
    if next_round == 1:
        sets_to_win = series.sets_to_win_final
    else:
        sets_to_win = series.sets_to_win_match

    # Look for an existing next-round match with one slot open (player2_id is a sentinel)
    # We use a simple approach: query for a SCHEDULED match in the next round that has a placeholder
    result = await db.execute(
        select(Match).where(
            Match.series_id == series.id,
            Match.elimination_round == next_round,
            Match.status == MatchStatus.SCHEDULED,
            Match.player2_id == None,  # noqa: E711
        )
    )
    next_match = result.scalar_one_or_none()

    if next_match is not None:
        # Fill the empty slot
        next_match.player2_id = winner.id
        db.add(next_match)
        await db.flush()
        return next_match

    # Check if there's a match waiting for player2
    result2 = await db.execute(
        select(Match).where(
            Match.series_id == series.id,
            Match.elimination_round == next_round,
            Match.status == MatchStatus.SCHEDULED,
        )
    )
    existing = result2.scalars().all()

    # If we find a match with only one player set (player2 vacant) — attach
    for m in existing:
        # player2 slot is vacant means it wasn't set yet
        pass

    # Create a new match with winner as player1, awaiting the other semifinal winner
    new_match = Match(
        id=uuid.uuid4(),
        series_id=series.id,
        pool_id=None,
        elimination_round=next_round,
        player1_id=winner.id,
        player2_id=None,  # type: ignore[arg-type]
        status=MatchStatus.SCHEDULED,
        day_number=finished_match.day_number + 1,
        sets_to_win=sets_to_win,
        scheduled_at=datetime.now(timezone.utc),
    )
    db.add(new_match)
    await db.flush()
    return new_match
