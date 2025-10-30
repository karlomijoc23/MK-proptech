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
        "tenants",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "status", sa.String(length=32), nullable=False, server_default="active"
        ),
        sa.Column("created_at", sa.DateTime(timezone=False, fsp=6), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=False, fsp=6), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        mysql_ENGINE="InnoDB",
        mysql_DEFAULT_CHARSET="utf8mb4",
        mysql_COLLATE="utf8mb4_unicode_ci",
    )
    op.create_unique_constraint("uq_tenants_name", "tenants", ["name"])

    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("scopes_json", sa.JSON(), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(timezone=False, fsp=6), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=False, fsp=6), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        mysql_ENGINE="InnoDB",
        mysql_DEFAULT_CHARSET="utf8mb4",
        mysql_COLLATE="utf8mb4_unicode_ci",
    )
    op.create_unique_constraint("uq_users_email", "users", ["email"])
    op.create_index("ix_users_role", "users", ["role"], unique=False)

    op.create_table(
        "tenant_memberships",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column(
            "status", sa.String(length=32), nullable=False, server_default="active"
        ),
        sa.Column("created_at", sa.DateTime(timezone=False, fsp=6), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=False, fsp=6), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        mysql_ENGINE="InnoDB",
        mysql_DEFAULT_CHARSET="utf8mb4",
        mysql_COLLATE="utf8mb4_unicode_ci",
    )
    op.create_unique_constraint(
        "uq_memberships_tenant_user", "tenant_memberships", ["tenant_id", "user_id"]
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_memberships_tenant_user", "tenant_memberships", type_="unique"
    )
    op.drop_table("tenant_memberships")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_constraint("uq_users_email", "users", type_="unique")
    op.drop_table("users")
    op.drop_constraint("uq_tenants_name", "tenants", type_="unique")
    op.drop_table("tenants")
