from app.core import security

# Import your FastAPI app and models
from app.models.users import User
from app.models.workflow import Workflow


def test_workflow_strict_isolation(client, session):
    # ---------------------------------------------------------
    # 1. SETUP: Create two distinct users in the database
    # ---------------------------------------------------------
    user_alice = User(
        email="alice@example.com", hashed_password=security.hash_password("password123")
    )
    user_bob = User(
        email="bob@example.com", hashed_password=security.hash_password("password123")
    )
    session.add_all([user_alice, user_bob])
    session.commit()

    # ---------------------------------------------------------
    # 2. SETUP: Create workflows assigned to different owners
    # ---------------------------------------------------------
    workflow_alice = Workflow(
        name="Alice's Secret Workflow",
        owner_id=user_alice.id,
        data={"nodes": [], "connections": {}},  # <-- Grouped inside 'data'
    )
    workflow_bob = Workflow(
        name="Bob's Top Secret Data",
        owner_id=user_bob.id,
        data={"nodes": [], "connections": {}},  # <-- Grouped inside 'data'
    )
    session.add_all([workflow_alice, workflow_bob])
    session.commit()
    session.refresh(workflow_bob)

    # ---------------------------------------------------------
    # 3. ACT: Alice logs in and gets her JWT token
    # ---------------------------------------------------------
    login_response = client.post(
        "/auth/login", data={"username": "alice@example.com", "password": "password123"}
    )
    token = login_response.json()["access_token"]

    # We attach Alice's token to the headers for future requests
    headers = {"Authorization": f"Bearer {token}"}

    # ---------------------------------------------------------
    # 4. ASSERT: Alice fetches the list of workflows
    # ---------------------------------------------------------
    list_response = client.get("/workflows/", headers=headers)
    data = list_response.json()

    assert list_response.status_code == 200

    # PROOF 1: The API should only return 1 workflow, not 2
    assert len(data) == 1

    # PROOF 2: The workflow returned must be Alice's
    assert data[0]["name"] == "Alice's Secret Workflow"

    # ---------------------------------------------------------
    # 5. ASSERT: Alice tries to "hack" the API by guessing Bob's ID
    # ---------------------------------------------------------
    hack_response = client.get(f"/workflows/{workflow_bob.id}", headers=headers)

    # PROOF 3: The API must reject this with a 404 Not Found
    # (Using 404 instead of 403 prevents attackers from confirming the ID even exists)
    assert hack_response.status_code == 404
