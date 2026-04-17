import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_role
from app.database import get_db
from app.models.table import TournamentTable
from app.models.tournament import Tournament
from app.models.user import User, UserRole
from app.schemas.table import TableCreate, TableResponse, TableUpdate

router = APIRouter(tags=["tables"])


@router.get("/tournaments/{tournament_id}/tables", response_model=list[TableResponse])
async def list_tables(
    tournament_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[TableResponse]:
    result = await db.execute(
        select(TournamentTable)
        .where(TournamentTable.tournament_id == tournament_id)
        .order_by(TournamentTable.number)
    )
    tables = result.scalars().all()
    return [TableResponse.model_validate(t) for t in tables]


@router.post(
    "/tournaments/{tournament_id}/tables",
    response_model=list[TableResponse],
    status_code=status.HTTP_201_CREATED,
)
async def bulk_create_tables(
    tournament_id: uuid.UUID,
    body: TableCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> list[TableResponse]:
    t_result = await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    if t_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Tournament not found")

    if body.count < 1 or body.count > 100:
        raise HTTPException(status_code=400, detail="Count must be between 1 and 100")

    # Get current max table number
    existing_result = await db.execute(
        select(TournamentTable)
        .where(TournamentTable.tournament_id == tournament_id)
        .order_by(TournamentTable.number.desc())
        .limit(1)
    )
    last_table = existing_result.scalar_one_or_none()
    start_number = (last_table.number + 1) if last_table else 1

    created: list[TournamentTable] = []
    for i in range(body.count):
        table = TournamentTable(
            id=uuid.uuid4(),
            tournament_id=tournament_id,
            number=start_number + i,
        )
        db.add(table)
        created.append(table)

    await db.flush()
    return [TableResponse.model_validate(t) for t in created]


@router.put("/tables/{table_id}", response_model=TableResponse)
async def update_table(
    table_id: uuid.UUID,
    body: TableUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.REFEREE)),
) -> TableResponse:
    result = await db.execute(select(TournamentTable).where(TournamentTable.id == table_id))
    table = result.scalar_one_or_none()
    if table is None:
        raise HTTPException(status_code=404, detail="Table not found")

    update_data = body.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(table, field, value)

    db.add(table)
    await db.flush()
    return TableResponse.model_validate(table)
