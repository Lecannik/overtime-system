"""add_two_fa_method_to_user

Revision ID: ecbd350cbc5b
Revises: f67b5634d782
Create Date: 2026-04-27 12:44:29.069635

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "ecbd350cbc5b"
down_revision: Union[str, None] = "f67b5634d782"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add column as nullable first
    op.add_column("users", sa.Column("two_fa_method", sa.Enum("email", "totp", name="twofamethod", native_enum=False), nullable=True))
    # Update existing rows to default "email"
    op.execute("UPDATE users SET two_fa_method = 'email'")
    # Now set to NOT NULL
    op.alter_column("users", "two_fa_method", nullable=False)


def downgrade() -> None:
    op.drop_column("users", "two_fa_method")
