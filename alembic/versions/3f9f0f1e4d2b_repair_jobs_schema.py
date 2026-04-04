"""repair jobs schema

Revision ID: 3f9f0f1e4d2b
Revises: d9ca45776511
Create Date: 2026-04-04 19:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "3f9f0f1e4d2b"
down_revision: Union[str, Sequence[str], None] = "d9ca45776511"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_index(indexes, name: str) -> bool:
    return any(index.get("name") == name for index in indexes)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = inspector.get_table_names()

    if "jobs" not in table_names:
        op.create_table(
            "jobs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("description", sa.String(), nullable=True),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column("task_type", sa.String(), nullable=False),
            sa.Column("payload", sa.JSON(), nullable=True),
            sa.Column("result", sa.JSON(), nullable=True),
            sa.Column("error", sa.String(), nullable=True),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("scheduled_at", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_jobs_title", "jobs", ["title"])
        op.create_index("ix_jobs_status", "jobs", ["status"])
        op.create_index("ix_jobs_user_id", "jobs", ["user_id"])
        op.create_index("ix_jobs_scheduled_at", "jobs", ["scheduled_at"])
        return

    columns = {column["name"] for column in inspector.get_columns("jobs")}

    if "title" not in columns:
        op.add_column("jobs", sa.Column("title", sa.String(), nullable=True))
        columns.add("title")

    if "description" not in columns:
        op.add_column("jobs", sa.Column("description", sa.String(), nullable=True))
        columns.add("description")

    if "status" not in columns:
        op.add_column("jobs", sa.Column("status", sa.String(), nullable=False, server_default="pending"))
        op.alter_column("jobs", "status", server_default=None)
        columns.add("status")

    if "task_type" not in columns:
        # Keep nullable for legacy rows created before task types existed.
        op.add_column("jobs", sa.Column("task_type", sa.String(), nullable=True))
        columns.add("task_type")

    if "payload" not in columns:
        op.add_column("jobs", sa.Column("payload", sa.JSON(), nullable=True))
        columns.add("payload")

    if "result" not in columns:
        op.add_column("jobs", sa.Column("result", sa.JSON(), nullable=True))
        columns.add("result")

    if "error" not in columns:
        op.add_column("jobs", sa.Column("error", sa.String(), nullable=True))
        columns.add("error")

    if "user_id" not in columns:
        op.add_column("jobs", sa.Column("user_id", sa.Integer(), nullable=True))
        columns.add("user_id")

    if "created_at" not in columns:
        op.add_column(
            "jobs",
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )
        op.alter_column("jobs", "created_at", server_default=None)
        columns.add("created_at")

    if "updated_at" not in columns:
        op.add_column(
            "jobs",
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )
        op.alter_column("jobs", "updated_at", server_default=None)
        columns.add("updated_at")

    if "scheduled_at" not in columns:
        op.add_column("jobs", sa.Column("scheduled_at", sa.DateTime(), nullable=True))
        columns.add("scheduled_at")

    indexes = inspector.get_indexes("jobs")

    if "title" in columns and not _has_index(indexes, "ix_jobs_title"):
        op.create_index("ix_jobs_title", "jobs", ["title"])
    if "status" in columns and not _has_index(indexes, "ix_jobs_status"):
        op.create_index("ix_jobs_status", "jobs", ["status"])
    if "user_id" in columns and not _has_index(indexes, "ix_jobs_user_id"):
        op.create_index("ix_jobs_user_id", "jobs", ["user_id"])
    if "scheduled_at" in columns and not _has_index(indexes, "ix_jobs_scheduled_at"):
        op.create_index("ix_jobs_scheduled_at", "jobs", ["scheduled_at"])


def downgrade() -> None:
    pass
