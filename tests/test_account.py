import pytest

from app.core import security, totp
from app.core.rate_limit import rate_limiter
from app.models.execution import Execution
from app.models.execution_node import ExecutionNode
from app.models.users import User
from app.models.workflow import Workflow

PASSWORD = "Password123"


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    rate_limiter._requests.clear()
    yield
    rate_limiter._requests.clear()


@pytest.fixture(name="user")
def user_fixture(session):
    user = User(email="carol@example.com", hashed_password=security.hash_password(PASSWORD))
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _login(client, password=PASSWORD):
    return client.post(
        "/auth/login", data={"username": "carol@example.com", "password": password}
    )


def _headers(client):
    return {"Authorization": f"Bearer {_login(client).json()['access_token']}"}


def test_update_profile_name_and_email(client, user):
    headers = _headers(client)

    res = client.patch("/auth/me", json={"full_name": "Carol D"}, headers=headers)
    assert res.status_code == 200
    assert res.json()["full_name"] == "Carol D"

    # Email change requires the current password
    res = client.patch("/auth/me", json={"email": "new@example.com"}, headers=headers)
    assert res.status_code == 400

    res = client.patch(
        "/auth/me",
        json={"email": "new@example.com", "current_password": PASSWORD},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["email"] == "new@example.com"


def test_change_password(client, user):
    headers = _headers(client)

    res = client.post(
        "/auth/me/password",
        json={"current_password": "wrong", "new_password": "NewPass456"},
        headers=headers,
    )
    assert res.status_code == 400

    res = client.post(
        "/auth/me/password",
        json={"current_password": PASSWORD, "new_password": "weak"},
        headers=headers,
    )
    assert res.status_code == 422

    res = client.post(
        "/auth/me/password",
        json={"current_password": PASSWORD, "new_password": "NewPass456"},
        headers=headers,
    )
    assert res.status_code == 200
    assert _login(client).status_code == 400
    assert _login(client, "NewPass456").status_code == 200


def test_delete_account(client, user, session):
    workflow = Workflow(name="wf", owner_id=user.id, data={"nodes": [], "connections": {}})
    session.add(workflow)
    session.commit()
    execution = Execution(workflow_id=workflow.id, owner_id=user.id)
    session.add(execution)
    session.commit()
    session.add(ExecutionNode(execution_id=execution.id, node_name="Start"))
    session.commit()

    headers = _headers(client)

    res = client.request("DELETE", "/auth/me", json={"password": "wrong"}, headers=headers)
    assert res.status_code == 400

    res = client.request("DELETE", "/auth/me", json={"password": PASSWORD}, headers=headers)
    assert res.status_code == 200
    session.expire_all()
    assert session.get(User, user.id) is None
    assert session.get(Workflow, workflow.id) is None
    assert session.get(Execution, execution.id) is None


def test_two_factor_flow(client, user):
    headers = _headers(client)

    setup = client.post("/auth/2fa/setup", headers=headers).json()
    secret = setup["secret"]
    assert setup["otpauth_uri"].startswith("otpauth://totp/")

    assert client.post("/auth/2fa/enable", json={"code": "000000"}, headers=headers).status_code == 400
    res = client.post(
        "/auth/2fa/enable", json={"code": totp.generate_code(secret)}, headers=headers
    )
    assert res.status_code == 200
    assert res.json()["totp_enabled"] is True

    # Password login now returns a challenge, not a token
    body = _login(client).json()
    assert body["requires_2fa"] is True
    assert body["access_token"] is None
    challenge = body["challenge_token"]

    # The challenge token can't be used as a session
    res = client.get("/auth/me", headers={"Authorization": f"Bearer {challenge}"})
    assert res.status_code == 403

    res = client.post("/auth/login/2fa", json={"challenge_token": challenge, "code": "000000"})
    assert res.status_code == 400

    res = client.post(
        "/auth/login/2fa",
        json={"challenge_token": challenge, "code": totp.generate_code(secret)},
    )
    assert res.status_code == 200
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/auth/me", headers=headers).status_code == 200

    res = client.post(
        "/auth/2fa/disable",
        json={"password": PASSWORD, "code": totp.generate_code(secret)},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["totp_enabled"] is False
    assert _login(client).json()["access_token"]
