"""migrate_overtimes_timestamps_to_timestamptz

Revision ID: 6f7e27ef722d
Revises: 58bb2b3932ea
Create Date: 2026-06-18 21:02:54.708879

Меняем start_time и end_time в таблице overtimes с timestamp without time zone
на timestamptz. Данные хранились как наивный UTC, поэтому используем
USING col AT TIME ZONE 'UTC' — это правильно интерпретирует наивное значение
как UTC и конвертирует в timestamptz.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6f7e27ef722d'
down_revision: Union[str, None] = '58bb2b3932ea'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE overtimes
            ALTER COLUMN start_time TYPE timestamptz
            USING start_time AT TIME ZONE 'UTC'
    """)
    op.execute("""
        ALTER TABLE overtimes
            ALTER COLUMN end_time TYPE timestamptz
            USING end_time AT TIME ZONE 'UTC'
    """)


def downgrade() -> None:
    # При откате: timestamptz -> timestamp (срезаем tzinfo, оставляем UTC-значение)
    op.execute("""
        ALTER TABLE overtimes
            ALTER COLUMN start_time TYPE timestamp without time zone
            USING start_time AT TIME ZONE 'UTC'
    """)
    op.execute("""
        ALTER TABLE overtimes
            ALTER COLUMN end_time TYPE timestamp without time zone
            USING end_time AT TIME ZONE 'UTC'
    """)
