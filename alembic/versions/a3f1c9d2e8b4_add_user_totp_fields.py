"""
Add two-factor auth fields to User.

Revision ID: a3f1c9d2e8b4
Revises: 7e2037e10b22
Create Date: 2026-10-17 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a3f1c9d2e8b4"
down_revision: str | Sequence[str] | None = "7e2037e10b22"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("user", sa.Column("totp_secret", sa.String(), nullable=True))
    op.add_column(
        "user",
        sa.Column(
            "totp_enabled", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("user", "totp_enabled")
    op.drop_column("user", "totp_secret")
