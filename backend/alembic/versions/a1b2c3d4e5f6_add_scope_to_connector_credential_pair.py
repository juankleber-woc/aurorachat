"""add scope to connector_credential_pair

Revision ID: a1b2c3d4e5f6
Revises: f1ca58b2f2ec
Create Date: 2026-04-03 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "f1ca58b2f2ec"
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
