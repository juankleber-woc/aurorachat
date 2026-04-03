"""add scope to connector_credential_pair

Revision ID: f6a7b8c9d0e1
Revises: 503883791c39, a1b2c3d4e5f6
Create Date: 2026-04-03 20:30:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f6a7b8c9d0e1"
down_revision = ("503883791c39", "a1b2c3d4e5f6")
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "connector_credential_pair",
        sa.Column(
            "scope",
            sa.String(),
            nullable=False,
            server_default="organization",
        ),
    )


def downgrade() -> None:
    op.drop_column("connector_credential_pair", "scope")
