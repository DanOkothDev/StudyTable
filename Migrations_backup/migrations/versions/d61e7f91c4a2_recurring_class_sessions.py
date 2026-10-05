"""recurring lecture timetable sessions

Revision ID: d61e7f91c4a2
Revises: c438df8a2b10
Create Date: 2026-10-05 00:06:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd61e7f91c4a2'
down_revision = 'c438df8a2b10'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table('class_session'):
        op.create_table(
            'class_session',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('semester_id', sa.Integer(), nullable=False),
            sa.Column('course_id', sa.Integer(), nullable=True),
            sa.Column('course_name', sa.String(length=120), nullable=False),
            sa.Column('title', sa.String(length=160), nullable=False),
            sa.Column('weekday', sa.Integer(), nullable=False),
            sa.Column('start_time', sa.Time(), nullable=True),
            sa.Column('end_time', sa.Time(), nullable=True),
            sa.ForeignKeyConstraint(['course_id'], ['course.id']),
            sa.ForeignKeyConstraint(['semester_id'], ['semester.id']),
            sa.PrimaryKeyConstraint('id')
        )

    indexes = {index['name'] for index in sa.inspect(bind).get_indexes('class_session')}
    if 'ix_class_session_semester_weekday' not in indexes:
        op.create_index('ix_class_session_semester_weekday', 'class_session',
                        ['semester_id', 'weekday'], unique=False)
    if 'ix_class_session_weekday' not in indexes:
        op.create_index('ix_class_session_weekday', 'class_session', ['weekday'], unique=False)


def downgrade():
    op.drop_index('ix_class_session_weekday', table_name='class_session')
    op.drop_index('ix_class_session_semester_weekday', table_name='class_session')
    op.drop_table('class_session')
