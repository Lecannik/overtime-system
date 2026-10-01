"""update_projects_weekly_limit_to_200

Revision ID: e381ab924d55
Revises: 1f7daf202a13
Create Date: 2026-10-01 16:15:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e381ab924d55"
down_revision: Union[str, None] = "1f7daf202a13"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Обновляем недельный лимит у всех существующих проектов со стандартного значения 50 на 200 часов
    op.execute("UPDATE projects SET weekly_limit = 200 WHERE weekly_limit = 50;")
    op.alter_column("projects", "weekly_limit", server_default="200")


def downgrade() -> None:
    op.execute("UPDATE projects SET weekly_limit = 50 WHERE weekly_limit = 200;")
    op.alter_column("projects", "weekly_limit", server_default="50")
