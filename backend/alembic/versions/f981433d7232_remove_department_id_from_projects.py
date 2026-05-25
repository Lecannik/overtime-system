"""remove_department_id_from_projects

Revision ID: f981433d7232
Revises: 7175b5ddfdd5
Create Date: 2026-03-04 13:50:55.256913

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f981433d7232'
down_revision: Union[str, None] = '7175b5ddfdd5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Колонка уже удалена в dd5ddafd87dd
    pass


def downgrade() -> None:
    pass
