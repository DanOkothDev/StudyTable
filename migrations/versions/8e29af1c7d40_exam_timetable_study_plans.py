"""exam timetables and study plan support

Revision ID: 8e29af1c7d40
Revises: d61e7f91c4a2
Create Date: 2026-10-05 08:15:00

"""
from alembic import op
import sqlalchemy as sa


revision = '8e29af1c7d40'
down_revision = 'd61e7f91c4a2'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    semester_columns = {column['name'] for column in sa.inspect(bind).get_columns('semester')}
    with op.batch_alter_table('semester', schema=None) as batch_op:
        if 'exam_timetable_filename' not in semester_columns:
            batch_op.add_column(sa.Column('exam_timetable_filename', sa.String(length=255), nullable=True))
        if 'exam_timetable_stored_name' not in semester_columns:
            batch_op.add_column(sa.Column('exam_timetable_stored_name', sa.String(length=255), nullable=True))

    assessment_columns = {column['name'] for column in sa.inspect(bind).get_columns('assessment')}
    if 'start_time' not in assessment_columns:
        with op.batch_alter_table('assessment', schema=None) as batch_op:
            batch_op.add_column(sa.Column('start_time', sa.Time(), nullable=True))


def downgrade():
    bind = op.get_bind()
    assessment_columns = {column['name'] for column in sa.inspect(bind).get_columns('assessment')}
    if 'start_time' in assessment_columns:
        with op.batch_alter_table('assessment', schema=None) as batch_op:
            batch_op.drop_column('start_time')

    semester_columns = {column['name'] for column in sa.inspect(bind).get_columns('semester')}
    with op.batch_alter_table('semester', schema=None) as batch_op:
        if 'exam_timetable_stored_name' in semester_columns:
            batch_op.drop_column('exam_timetable_stored_name')
        if 'exam_timetable_filename' in semester_columns:
            batch_op.drop_column('exam_timetable_filename')
