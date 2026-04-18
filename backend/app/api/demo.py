import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_role
from app.core.security import hash_password
from app.database import get_db
from app.models.match import Match, SetResult
from app.models.player import Player
from app.models.pool import Pool, PoolPlayer
from app.models.registration import Registration, RegistrationStatus
from app.models.series import PhaseFormat, Series
from app.models.table import TournamentTable
from app.models.tournament import Tournament, TournamentStatus
from app.models.user import User, UserRole

router = APIRouter(prefix="/demo", tags=["demo"])


class DemoSeedResponse(BaseModel):
    tournament_id: uuid.UUID
    tournament_name: str
    player_count: int
    registration_count: int
    table_count: int
    login_hint: str


FRENCH_PLAYERS = [
    ("Lucas", "Martin", 450, "TT Paris"),
    ("Emma", "Bernard", 520, "Lyon TT"),
    ("Hugo", "Dubois", 630, "Marseille TT"),
    ("Léa", "Thomas", 700, "TT Paris"),
    ("Jules", "Robert", 780, "Lille TT"),
    ("Chloé", "Richard", 850, "Toulouse TT"),
    ("Nathan", "Petit", 950, "Bordeaux TT"),
    ("Manon", "Durand", 1050, "Nice TT"),
    ("Arthur", "Leroy", 1150, "Nantes TT"),
    ("Jade", "Moreau", 1250, "TT Paris"),
    ("Louis", "Simon", 1350, "Strasbourg TT"),
    ("Alice", "Laurent", 1400, "Rennes TT"),
]


@router.post("/seed", response_model=DemoSeedResponse)
async def seed_demo(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> DemoSeedResponse:
    # Wipe existing data except ADMIN users
    # Delete in FK-safe order: sets, matches, pool_players, pools, registrations,
    # tables, series, tournaments, players, non-admin users
    await db.execute(delete(SetResult))
    # Clear current_match_id on tables first to avoid FK issues
    tables = (await db.execute(select(TournamentTable))).scalars().all()
    for t in tables:
        t.current_match_id = None
        db.add(t)
    # Clear current_match_id on pools
    pools = (await db.execute(select(Pool))).scalars().all()
    for p in pools:
        p.current_match_id = None
        p.table_id = None
        db.add(p)
    await db.flush()
    await db.execute(delete(Match))
    await db.execute(delete(PoolPlayer))
    await db.execute(delete(Pool))
    await db.execute(delete(Registration))
    await db.execute(delete(TournamentTable))
    await db.execute(delete(Series))
    await db.execute(delete(Tournament))
    await db.execute(delete(Player))
    # Delete non-admin users
    non_admin_users = (
        await db.execute(select(User).where(User.role != UserRole.ADMIN))
    ).scalars().all()
    for u in non_admin_users:
        await db.delete(u)
    await db.flush()

    # Create tournament
    today = date.today()
    tournament = Tournament(
        id=uuid.uuid4(),
        name="Tournoi Open de Printemps 2026",
        description="Tournoi démo",
        location="Paris",
        start_date=today,
        end_date=today + timedelta(days=1),
        status=TournamentStatus.REGISTRATION_OPEN,
        max_series_per_player=2,
    )
    db.add(tournament)
    await db.flush()

    # Create series
    series_900 = Series(
        id=uuid.uuid4(),
        tournament_id=tournament.id,
        name="Série 900",
        max_points=999,
        phase_format=PhaseFormat.POOLS_THEN_ELIMINATION,
        players_per_pool=4,
    )
    series_1200 = Series(
        id=uuid.uuid4(),
        tournament_id=tournament.id,
        name="Série 1200",
        max_points=1199,
        phase_format=PhaseFormat.POOLS_THEN_ELIMINATION,
        players_per_pool=4,
    )
    series_1500 = Series(
        id=uuid.uuid4(),
        tournament_id=tournament.id,
        name="Série 1500",
        max_points=1499,
        phase_format=PhaseFormat.POOLS_THEN_ELIMINATION,
        players_per_pool=4,
    )
    db.add_all([series_900, series_1200, series_1500])
    await db.flush()

    # Create players
    password_hash = hash_password("demo")
    players: list[Player] = []
    for idx, (first, last, points, club) in enumerate(FRENCH_PLAYERS, start=1):
        user = User(
            id=uuid.uuid4(),
            email=f"demo{idx}@demo.fr",
            password_hash=password_hash,
            role=UserRole.PLAYER,
            is_active=True,
        )
        db.add(user)
        await db.flush()
        player = Player(
            id=uuid.uuid4(),
            user_id=user.id,
            first_name=first,
            last_name=last,
            points=points,
            club=club,
        )
        db.add(player)
        players.append(player)
    await db.flush()

    # Register players into eligible series (max 2 per player)
    registrations_created = 0
    for player in players:
        eligible = []
        if player.points <= 999:
            eligible.append(series_900)
        if player.points <= 1199:
            eligible.append(series_1200)
        if player.points <= 1499:
            eligible.append(series_1500)
        # Max 2 per player per spec
        for s in eligible[: tournament.max_series_per_player or len(eligible)]:
            reg = Registration(
                id=uuid.uuid4(),
                player_id=player.id,
                series_id=s.id,
                status=RegistrationStatus.CONFIRMED,
            )
            db.add(reg)
            registrations_created += 1
    await db.flush()

    # Close registration
    tournament.status = TournamentStatus.REGISTRATION_CLOSED
    db.add(tournament)

    # Create 4 tables
    for i in range(1, 5):
        t = TournamentTable(
            id=uuid.uuid4(),
            tournament_id=tournament.id,
            number=i,
        )
        db.add(t)
    await db.flush()

    return DemoSeedResponse(
        tournament_id=tournament.id,
        tournament_name=tournament.name,
        player_count=len(players),
        registration_count=registrations_created,
        table_count=4,
        login_hint="Login with demo1@demo.fr..demo12@demo.fr / password: demo",
    )
