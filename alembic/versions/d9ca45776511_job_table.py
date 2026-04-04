"""job table

Revision ID: d9ca45776511
Revises: fd49092fc3f6
Create Date: 2026-03-31 00:27:23.723517

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd9ca45776511'
down_revision: Union[str, Sequence[str], None] = 'fd49092fc3f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'jobs',
        sa.Column('id', sa.Integer, primary_key=True),

        sa.Column('title', sa.String, nullable=False),
        sa.Column('description', sa.String, nullable=True),
        sa.Column('status', sa.String, nullable=False, index=True),
        sa.Column('task_type', sa.String, nullable=False),
        sa.Column('payload', sa.JSON, nullable=True),
        sa.Column('result', sa.JSON, nullable=True),
        sa.Column('error', sa.String, nullable=True),
        sa.Column('user_id', sa.Integer, nullable=False, index=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('scheduled_at', sa.DateTime, nullable=True, index=True),
    )

def downgrade() -> None:
    """Downgrade schema."""
    pass
