"""add system settings and telegram fields

Revision ID: 2b3213fb3b9d
Revises: a16d910fb53e
Create Date: 2026-03-06 07:15:17.456239

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2b3213fb3b9d'
down_revision: Union[str, None] = 'a16d910fb53e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Создаем таблицу настроек
    op.create_table('system_settings',
        sa.Column('key', sa.String(), nullable=False),
        sa.Column('value', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('key')
    )
    # 2. Добавляем поля пользователям
    op.add_column('users', sa.Column('telegram_chat_id', sa.String(), nullable=True))
    # Добавляем server_default='2', чтобы старым юзерам проставилось 2
    op.add_column('users', sa.Column('notification_level', sa.Integer(), nullable=False, server_default='2'))


def downgrade() -> None:
    op.drop_column('users', 'notification_level')
    op.drop_column('users', 'telegram_chat_id')
    op.drop_table('system_settings')