import pytest


@pytest.mark.asyncio
async def test_register_login_me(async_client):
    # Register
    resp = await async_client.post(
        "/api/auth/register",
        json={
            "email": "alice@test.com",
            "password": "secret1",
            "first_name": "Alice",
            "last_name": "Test",
            "points": 800,
        },
    )
    assert resp.status_code == 201, resp.text
    token = resp.json()["access_token"]
    assert token

    # Login
    resp = await async_client.post(
        "/api/auth/login",
        json={"email": "alice@test.com", "password": "secret1"},
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]

    # Me
    resp = await async_client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["email"] == "alice@test.com"
    assert data["role"] == "PLAYER"
    assert data["player"]["first_name"] == "Alice"


@pytest.mark.asyncio
async def test_login_invalid_password(async_client):
    await async_client.post(
        "/api/auth/register",
        json={
            "email": "bob@test.com",
            "password": "correct",
            "first_name": "Bob",
            "last_name": "Test",
            "points": 500,
        },
    )
    resp = await async_client.post(
        "/api/auth/login",
        json={"email": "bob@test.com", "password": "wrong"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_without_token(async_client):
    resp = await async_client.get("/api/auth/me")
    assert resp.status_code == 401
