"""creat new table

Revision ID: fd49092fc3f6
Revises: 
Create Date: 2026-03-30 23:44:32.622333

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fd49092fc3f6'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade():
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('username', sa.String(), nullable=False),
        sa.Column('email', sa.String()),
        sa.Column('full_name', sa.String()),
        sa.Column('password', sa.String())
    )


def downgrade():
    op.drop_table('users')

