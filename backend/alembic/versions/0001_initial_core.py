"""Initial core tables for MariaDB migration."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0001_initial_core"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "document_store",
        sa.Column("collection", sa.String(length=64), nullable=False),
        sa.Column("document_id", sa.String(length=64), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=False), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=False), nullable=False),
        sa.PrimaryKeyConstraint("collection", "document_id"),
        mysql_ENGINE="InnoDB",
        mysql_DEFAULT_CHARSET="utf8mb4",
        mysql_COLLATE="utf8mb4_unicode_ci",
    )
    op.create_index(
        "ix_document_store_collection",
        "document_store",
        ["collection"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_document_store_collection", table_name="document_store")
    op.drop_table("document_store")
