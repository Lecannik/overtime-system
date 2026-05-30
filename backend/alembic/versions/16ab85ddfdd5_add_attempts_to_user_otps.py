"""add_attempts_to_user_otps

Revision ID: 16ab85ddfdd5
Revises: a887b23c45de
Create Date: 2026-05-30 20:41:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '16ab85ddfdd5'
down_revision: Union[str, None] = 'a887b23c45de'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('user_otps', sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'))
    op.execute(
        "INSERT INTO projects (name, code, is_active, weekly_limit) "
        "SELECT 'Внутренний (Внутренние работы)', 'INTERNAL', true, 100 "
        "WHERE NOT EXISTS ("
        "    SELECT 1 FROM projects WHERE code = 'INTERNAL' OR name ILIKE '%внутренн%'"
        ")"
    )


def downgrade() -> None:
    op.drop_column('user_otps', 'attempts')
