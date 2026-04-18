import pytest


async def _register_player(async_client, email: str, points: int) -> dict:
    resp = await async_client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "pw",
            "first_name": email.split("@")[0],
            "last_name": "Player",
            "points": points,
        },
    )
    assert resp.status_code == 201, resp.text
    token = resp.json()["access_token"]
    # Get /me
    me = await async_client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert me.status_code == 200
    return {"token": token, "player_id": me.json()["player"]["id"]}


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_full_tournament_flow(async_client, admin_token):
    # Create tournament
    resp = await async_client.post(
        "/api/tournaments",
        headers=_auth(admin_token),
        json={
            "name": "Test Tournament",
            "max_series_per_player": 2,
        },
    )
    assert resp.status_code == 201, resp.text
    tournament_id = resp.json()["id"]
    assert resp.json()["max_series_per_player"] == 2

    # Open registration
    resp = await async_client.post(
        f"/api/tournaments/{tournament_id}/open-registration",
        headers=_auth(admin_token),
    )
    assert resp.status_code == 200

    # Create series
    resp = await async_client.post(
        f"/api/tournaments/{tournament_id}/series",
        headers=_auth(admin_token),
        json={
            "name": "Open",
            "max_points": 2000,
            "phase_format": "POOLS_THEN_ELIMINATION",
            "players_per_pool": 4,
            "sets_to_win_match": 2,
        },
    )
    assert resp.status_code == 201, resp.text
    series_id = resp.json()["id"]

    # Create table
    resp = await async_client.post(
        f"/api/tournaments/{tournament_id}/tables",
        headers=_auth(admin_token),
        json={"count": 1},
    )
    assert resp.status_code == 201
    table_id = resp.json()[0]["id"]

    # Register 4 players
    players = []
    for i in range(4):
        p = await _register_player(async_client, f"p{i}@test.com", 500 + i * 50)
        players.append(p)

        # Register player into series
        resp = await async_client.post(
            f"/api/tournaments/{tournament_id}/series/{series_id}/register",
            headers=_auth(p["token"]),
        )
        assert resp.status_code == 201, resp.text
        reg_id = resp.json()["id"]
        # Confirm registration (admin)
        resp = await async_client.put(
            f"/api/registrations/{reg_id}/confirm",
            headers=_auth(admin_token),
        )
        assert resp.status_code == 200

    # Generate pools (DRAFT)
    resp = await async_client.post(
        f"/api/tournaments/{tournament_id}/pools/generate",
        headers=_auth(admin_token),
    )
    assert resp.status_code == 200, resp.text
    pools = resp.json()
    assert len(pools) == 1
    pool_id = pools[0]["id"]
    assert pools[0]["status"] == "DRAFT"
    assert len(pools[0]["players"]) == 4

    # Confirm pools
    resp = await async_client.post(
        f"/api/tournaments/{tournament_id}/pools/confirm",
        headers=_auth(admin_token),
    )
    assert resp.status_code == 200, resp.text
    summary = resp.json()
    # 4 players -> 6 matches (round-robin)
    assert summary["pools_confirmed"] == 1
    assert summary["matches_created"] == 6

    # Start pool on table
    resp = await async_client.post(
        f"/api/pools/{pool_id}/start",
        headers=_auth(admin_token),
        json={"table_id": table_id},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "IN_PROGRESS"

    # List matches
    resp = await async_client.get(
        f"/api/tournaments/{tournament_id}/matches",
        headers=_auth(admin_token),
    )
    assert resp.status_code == 200
    all_matches = resp.json()
    assert len(all_matches) == 6

    # Play all matches sequentially
    for _ in range(6):
        # Find IN_PROGRESS match
        resp = await async_client.get(
            f"/api/tournaments/{tournament_id}/matches?status=IN_PROGRESS",
            headers=_auth(admin_token),
        )
        assert resp.status_code == 200
        in_progress = resp.json()
        assert len(in_progress) == 1
        m = in_progress[0]
        # Submit result — player1 wins 2-0
        resp = await async_client.post(
            f"/api/matches/{m['id']}/result",
            headers=_auth(admin_token),
            json={
                "sets": [
                    {"score_player1": 11, "score_player2": 5},
                    {"score_player1": 11, "score_player2": 7},
                ]
            },
        )
        assert resp.status_code == 200, resp.text

    # After all matches done, check pool status
    resp = await async_client.get(
        f"/api/tournaments/{tournament_id}/pools",
        headers=_auth(admin_token),
    )
    assert resp.status_code == 200
    pools = resp.json()
    assert pools[0]["status"] == "FINISHED"

    # Check table is freed
    resp = await async_client.get(
        f"/api/tournaments/{tournament_id}/tables",
        headers=_auth(admin_token),
    )
    tables = resp.json()
    assert tables[0]["status"] == "FREE"


@pytest.mark.asyncio
async def test_max_series_per_player_limit(async_client, admin_token):
    # Tournament with max_series_per_player = 1
    resp = await async_client.post(
        "/api/tournaments",
        headers=_auth(admin_token),
        json={"name": "Limit Test", "max_series_per_player": 1},
    )
    tournament_id = resp.json()["id"]
    await async_client.post(
        f"/api/tournaments/{tournament_id}/open-registration",
        headers=_auth(admin_token),
    )

    # Create 2 series
    resp = await async_client.post(
        f"/api/tournaments/{tournament_id}/series",
        headers=_auth(admin_token),
        json={"name": "S1", "max_points": 2000},
    )
    s1_id = resp.json()["id"]
    resp = await async_client.post(
        f"/api/tournaments/{tournament_id}/series",
        headers=_auth(admin_token),
        json={"name": "S2", "max_points": 2000},
    )
    s2_id = resp.json()["id"]

    # Register a player
    p = await _register_player(async_client, "lim@test.com", 500)
    resp = await async_client.post(
        f"/api/tournaments/{tournament_id}/series/{s1_id}/register",
        headers=_auth(p["token"]),
    )
    assert resp.status_code == 201

    # Second registration should fail due to limit
    resp = await async_client.post(
        f"/api/tournaments/{tournament_id}/series/{s2_id}/register",
        headers=_auth(p["token"]),
    )
    assert resp.status_code == 400
    assert "Maximum series limit" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_display_state_public(async_client, admin_token):
    resp = await async_client.post(
        "/api/tournaments",
        headers=_auth(admin_token),
        json={"name": "Display Test"},
    )
    tournament_id = resp.json()["id"]
    # Public access (no auth)
    resp = await async_client.get(f"/api/tournaments/{tournament_id}/display-state")
    assert resp.status_code == 200
    data = resp.json()
    assert data["tournament"]["name"] == "Display Test"
    assert data["active_series"] == []
    assert data["active_matches"] == []
