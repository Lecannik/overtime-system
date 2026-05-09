"""Add CRM and Task modules

Revision ID: fbc03923a853
Revises: e7bd3550e14d
Create Date: 2026-04-10 05:55:17.260360

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fbc03923a853'
down_revision: Union[str, None] = 'e7bd3550e14d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create leads
    op.create_table('leads',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(), nullable=False),
    sa.Column('description', sa.String(), nullable=True),
    sa.Column('contact_name', sa.String(), nullable=True),
    sa.Column('contact_phone', sa.String(), nullable=True),
    sa.Column('contact_email', sa.String(), nullable=True),
    sa.Column('source', sa.String(), nullable=True),
    sa.Column('status', sa.String(), nullable=False, server_default='NEW'),
    sa.Column('assigned_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['assigned_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )

    # 2. Create deals
    op.create_table('deals',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('lead_id', sa.Integer(), nullable=True),
    sa.Column('title', sa.String(), nullable=False),
    sa.Column('description', sa.String(), nullable=True),
    sa.Column('amount', sa.Float(), nullable=False, server_default='0.0'),
    sa.Column('currency', sa.String(), nullable=False, server_default='RUB'),
    sa.Column('status', sa.String(), nullable=False, server_default='DISCOVERY'),
    sa.Column('assigned_id', sa.Integer(), nullable=True),
    sa.Column('project_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['assigned_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['lead_id'], ['leads.id'], ),
    sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    
    # 3. Create tasks
    op.create_table('tasks',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('project_id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(), nullable=False),
    sa.Column('description', sa.String(), nullable=True),
    sa.Column('status', sa.String(), nullable=False, server_default='TODO'),
    sa.Column('priority', sa.String(), nullable=False, server_default='MEDIUM'),
    sa.Column('type', sa.String(), nullable=False, server_default='OTHER'),
    sa.Column('creator_id', sa.Integer(), nullable=False),
    sa.Column('assigned_id', sa.Integer(), nullable=True),
    sa.Column('deadline', sa.DateTime(timezone=True), nullable=True),
    sa.Column('parent_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['assigned_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['creator_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['parent_id'], ['tasks.id'], ),
    sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
    sa.PrimaryKeyConstraint('id')
    )

    # 4. Alter projects
    op.add_column('projects', sa.Column('deal_id', sa.Integer(), nullable=True))
    op.add_column('projects', sa.Column('status', sa.String(), nullable=False, server_default='ACTIVE'))
    op.add_column('projects', sa.Column('gip_id', sa.Integer(), nullable=True))
    op.add_column('projects', sa.Column('lead_engineer_id', sa.Integer(), nullable=True))
    op.add_column('projects', sa.Column('lead_programmer_id', sa.Integer(), nullable=True))
    op.add_column('projects', sa.Column('extra_data', sa.JSON(), nullable=True, server_default='{}'))
    op.create_foreign_key(None, 'projects', 'deals', ['deal_id'], ['id'])
    op.create_foreign_key(None, 'projects', 'users', ['gip_id'], ['id'])
    op.create_foreign_key(None, 'projects', 'users', ['lead_programmer_id'], ['id'])
    op.create_foreign_key(None, 'projects', 'users', ['lead_engineer_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint(None, 'projects', type_='foreignkey')
    op.drop_constraint(None, 'projects', type_='foreignkey')
    op.drop_constraint(None, 'projects', type_='foreignkey')
    op.drop_constraint(None, 'projects', type_='foreignkey')
    op.drop_column('projects', 'extra_data')
    op.drop_column('projects', 'lead_programmer_id')
    op.drop_column('projects', 'lead_engineer_id')
    op.drop_column('projects', 'gip_id')
    op.drop_column('projects', 'status')
    op.drop_column('projects', 'deal_id')
    op.drop_table('tasks')
    op.drop_table('deals')
    op.drop_table('leads')
