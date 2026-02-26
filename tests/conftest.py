import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.api.deps import get_session

# Import your app and dependencies
from app.main import app
from app.models.credentials import Credential  # noqa: F401

# Import all models so SQLModel knows to create tables for them
from app.models.users import User  # noqa: F401
from app.models.workflow import Workflow  # noqa: F401

# 1. Setup an in-memory SQLite database
# StaticPool ensures the in-memory db persists across different sessions during the test
sqlite_url = "sqlite://"
engine = create_engine(
    sqlite_url, connect_args={"check_same_thread": False}, poolclass=StaticPool
)


@pytest.fixture(name="session")
def session_fixture():
    """Creates a fresh database for every single test."""
    # Create all tables in the in-memory database
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        yield session  # Pause here and run the test!

    # After the test finishes, destroy all tables
    SQLModel.metadata.drop_all(engine)


@pytest.fixture(name="client")
def client_fixture(session: Session):
    """Creates a TestClient that uses the temporary database."""

    # Override the standard DB session dependency to use our test session instead
    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override

    client = TestClient(app)

    yield client  # Pause here and run the test!

    # Clear the overrides after the test so it doesn't leak into other tests
    app.dependency_overrides.clear()
