"""student profiles and daily insight cache

Revision ID: 9c31f5a7b204
Revises: 8e29af1c7d40
Create Date: 2026-10-05 08:40:00

"""
from alembic import op
import sqlalchemy as sa


revision = '9c31f5a7b204'
down_revision = '8e29af1c7d40'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    user_columns = {column['name'] for column in sa.inspect(bind).get_columns('user')}
    with op.batch_alter_table('user', schema=None) as batch_op:
        if 'school' not in user_columns:
            batch_op.add_column(sa.Column('school', sa.String(length=160), nullable=True))
        if 'program' not in user_columns:
            batch_op.add_column(sa.Column('program', sa.String(length=160), nullable=True))
        if 'year_of_study' not in user_columns:
            batch_op.add_column(sa.Column('year_of_study', sa.Integer(), nullable=True))
        if 'interests' not in user_columns:
            batch_op.add_column(sa.Column('interests', sa.String(length=500), nullable=True))

    inspector = sa.inspect(bind)
    if not inspector.has_table('daily_insight'):
        op.create_table(
            'daily_insight',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('day', sa.Date(), nullable=False),
            sa.Column('content', sa.Text(), nullable=False),
            sa.Column('sources', sa.Text(), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['user.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('user_id', 'day')
        )
    indexes = {index['name'] for index in sa.inspect(bind).get_indexes('daily_insight')}
    if 'ix_daily_insight_user_day' not in indexes:
        op.create_index('ix_daily_insight_user_day', 'daily_insight',
                        ['user_id', 'day'], unique=False)


def downgrade():
    bind = op.get_bind()
    if sa.inspect(bind).has_table('daily_insight'):
        indexes = {index['name'] for index in sa.inspect(bind).get_indexes('daily_insight')}
        if 'ix_daily_insight_user_day' in indexes:
            op.drop_index('ix_daily_insight_user_day', table_name='daily_insight')
        op.drop_table('daily_insight')

    user_columns = {column['name'] for column in sa.inspect(bind).get_columns('user')}
    with op.batch_alter_table('user', schema=None) as batch_op:
        if 'interests' in user_columns:
            batch_op.drop_column('interests')
        if 'year_of_study' in user_columns:
            batch_op.drop_column('year_of_study')
        if 'program' in user_columns:
            batch_op.drop_column('program')
        if 'school' in user_columns:
            batch_op.drop_column('school')
