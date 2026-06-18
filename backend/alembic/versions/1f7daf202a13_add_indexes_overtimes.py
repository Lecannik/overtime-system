"""add_indexes_overtimes

Revision ID: 1f7daf202a13
Revises: 6f7e27ef722d
Create Date: 2026-06-18 21:30:37.882559

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1f7daf202a13'
down_revision: Union[str, None] = '6f7e27ef722d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Самый частый запрос: заявки конкретного пользователя с фильтром по статусу
    op.create_index('ix_overtimes_user_id_status', 'overtimes', ['user_id', 'status'])
    # Аналитика по проекту, проверка недельных лимитов
    op.create_index('ix_overtimes_project_id', 'overtimes', ['project_id'])
    # Фильтрация и фильтр по дате начала
    op.create_index('ix_overtimes_start_time', 'overtimes', ['start_time'])
    # Сортировка списков (ORDER BY created_at DESC)
    op.create_index('ix_overtimes_created_at', 'overtimes', ['created_at'])
    # Страница согласования: фильтр только по статусу
    op.create_index('ix_overtimes_status', 'overtimes', ['status'])


def downgrade() -> None:
    op.drop_index('ix_overtimes_status', table_name='overtimes')
    op.drop_index('ix_overtimes_created_at', table_name='overtimes')
    op.drop_index('ix_overtimes_start_time', table_name='overtimes')
    op.drop_index('ix_overtimes_project_id', table_name='overtimes')
    op.drop_index('ix_overtimes_user_id_status', table_name='overtimes')
