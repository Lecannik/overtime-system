"""increase_user_otps_code_length_for_hashing

Revision ID: 5cd86cdff984
Revises: e381ab924d55
Create Date: 2026-11-06 16:47:52.349162

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5cd86cdff984'
down_revision: Union[str, None] = 'e381ab924d55'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "user_otps",
        "code",
        existing_type=sa.String(length=6),
        type_=sa.String(length=64),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "user_otps",
        "code",
        existing_type=sa.String(length=64),
        type_=sa.String(length=6),
        existing_nullable=False,
    )
