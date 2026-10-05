"""track AI provider for cached daily insights

Revision ID: a7d42e91c603
Revises: 192e6c6d0922
Create Date: 2026-10-05 09:35:00

"""
from alembic import op
import sqlalchemy as sa


revision = 'a7d42e91c603'
down_revision = '192e6c6d0922'
branch_labels = None
depends_on = None


def upgrade():
    columns = {column['name'] for column in sa.inspect(op.get_bind()).get_columns('daily_insight')}
    if 'provider' not in columns:
        with op.batch_alter_table('daily_insight', schema=None) as batch_op:
            batch_op.add_column(sa.Column(
                'provider', sa.String(length=40), nullable=False, server_default='Gemini'))


def downgrade():
    columns = {column['name'] for column in sa.inspect(op.get_bind()).get_columns('daily_insight')}
    if 'provider' in columns:
        with op.batch_alter_table('daily_insight', schema=None) as batch_op:
            batch_op.drop_column('provider')
