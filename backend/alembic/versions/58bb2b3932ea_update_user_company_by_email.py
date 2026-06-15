"""update_user_company_by_email

Revision ID: 58bb2b3932ea
Revises: 16ab85ddfdd5
Create Date: 2026-06-15 16:45:32.923192

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '58bb2b3932ea'
down_revision: Union[str, None] = '16ab85ddfdd5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Обновляем компанию существующих пользователей с почтой aj-tech/ajtech
    op.execute(
        "UPDATE users SET company = 'AJ-techCom' "
        "WHERE (LOWER(email) LIKE '%aj-tech%' OR LOWER(email) LIKE '%ajtech%') "
        "AND company = 'Polymedia';"
    )


def downgrade() -> None:
    pass
