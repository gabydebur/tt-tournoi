import random
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.match import Match, MatchStatus
from app.models.player import Player
from app.models.pool import Pool, PoolPlayer, PoolStatus
from app.models.series import Series


def _pool_name(index: int) -> str:
    """Return pool name: A, B, C, ..., Z, AA, AB, ..."""
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    if index < 26:
        return letters[index]
    return letters[index // 26 - 1] + letters[index % 26]


def _generate_round_robin_pairs(players: list[Player]) -> list[tuple[Player, Player]]:
    """Generate all unique pairs for round-robin."""
    pairs: list[tuple[Player, Player]] = []
    for i in range(len(players)):
        for j in range(i + 1, len(players)):
            pairs.append((players[i], players[j]))
    return pairs


async def generate_pools(
    series: Series,
    confirmed_players: list[Player],
    db: AsyncSession,
    create_matches: bool = True,
    status: PoolStatus = PoolStatus.DRAFT,
) -> list[Pool]:
    """
    Shuffle players, distribute into groups of series.players_per_pool,
    create Pool + PoolPlayer records. When create_matches is True, also
    generate round-robin Match records with order_in_pool set.

    Returns list of created Pool objects.
    """
    if not confirmed_players:
        return []

    players = list(confirmed_players)
    random.shuffle(players)

    players_per_pool = series.players_per_pool
    groups: list[list[Player]] = []

    # Distribute players into groups
    for i in range(0, len(players), players_per_pool):
        groups.append(players[i : i + players_per_pool])

    created_pools: list[Pool] = []

    for idx, group in enumerate(groups):
        pool = Pool(
            id=uuid.uuid4(),
            series_id=series.id,
            name=_pool_name(idx),
            status=status,
        )
        db.add(pool)
        await db.flush()  # get pool.id

        # Create PoolPlayer entries
        for player in group:
            pp = PoolPlayer(
                pool_id=pool.id,
                player_id=player.id,
                wins=0,
                losses=0,
                sets_won=0,
                sets_lost=0,
                games_won=0,
                games_lost=0,
            )
            db.add(pp)

        if create_matches:
            pairs = _generate_round_robin_pairs(group)
            for order_idx, (player1, player2) in enumerate(pairs, start=1):
                match = Match(
                    id=uuid.uuid4(),
                    series_id=series.id,
                    pool_id=pool.id,
                    player1_id=player1.id,
                    player2_id=player2.id,
                    status=MatchStatus.SCHEDULED,
                    day_number=1,
                    sets_to_win=series.sets_to_win_match,
                    scheduled_at=datetime.now(timezone.utc),
                    order_in_pool=order_idx,
                )
                db.add(match)

        created_pools.append(pool)

    await db.flush()
    return created_pools


async def create_pool_matches(pool: Pool, series: Series, db: AsyncSession) -> list[Match]:
    """Create round-robin matches for a pool that doesn't yet have matches."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    # Load players for pool
    result = await db.execute(
        select(PoolPlayer)
        .where(PoolPlayer.pool_id == pool.id)
        .options(selectinload(PoolPlayer.player))
    )
    pool_players = result.scalars().all()
    players = [pp.player for pp in pool_players if pp.player is not None]

    pairs = _generate_round_robin_pairs(players)
    created: list[Match] = []
    for order_idx, (player1, player2) in enumerate(pairs, start=1):
        match = Match(
            id=uuid.uuid4(),
            series_id=series.id,
            pool_id=pool.id,
            player1_id=player1.id,
            player2_id=player2.id,
            status=MatchStatus.SCHEDULED,
            day_number=1,
            sets_to_win=series.sets_to_win_match,
            scheduled_at=datetime.now(timezone.utc),
            order_in_pool=order_idx,
        )
        db.add(match)
        created.append(match)
    await db.flush()
    return created
