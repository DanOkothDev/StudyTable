"""semester assessment timetables

Revision ID: c438df8a2b10
Revises: b7ee6c2a7d31
Create Date: 2026-10-04 23:47:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c438df8a2b10'
down_revision = 'b7ee6c2a7d31'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    semester_columns = {column['name'] for column in inspector.get_columns('semester')}
    with op.batch_alter_table('semester', schema=None) as batch_op:
        if 'timetable_filename' not in semester_columns:
            batch_op.add_column(sa.Column('timetable_filename', sa.String(length=255), nullable=True))
        if 'timetable_stored_name' not in semester_columns:
            batch_op.add_column(sa.Column('timetable_stored_name', sa.String(length=255), nullable=True))

    if not inspector.has_table('assessment'):
        op.create_table(
            'assessment',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('semester_id', sa.Integer(), nullable=False),
            sa.Column('course_id', sa.Integer(), nullable=True),
            sa.Column('course_name', sa.String(length=120), nullable=False),
            sa.Column('title', sa.String(length=160), nullable=False),
            sa.Column('date', sa.Date(), nullable=False),
            sa.ForeignKeyConstraint(['course_id'], ['course.id']),
            sa.ForeignKeyConstraint(['semester_id'], ['semester.id']),
            sa.PrimaryKeyConstraint('id')
        )

    assessment_columns = {column['name'] for column in sa.inspect(bind).get_columns('assessment')}
    required_columns = {'id', 'semester_id', 'course_id', 'course_name', 'title', 'date'}
    if not required_columns.issubset(assessment_columns):
        raise RuntimeError('Existing assessment table does not match the timetable schema')

    assessment_indexes = {index['name'] for index in sa.inspect(bind).get_indexes('assessment')}
    if 'ix_assessment_semester_date' not in assessment_indexes:
        op.create_index('ix_assessment_semester_date', 'assessment', ['semester_id', 'date'], unique=False)
    if 'ix_assessment_date' not in assessment_indexes:
        op.create_index('ix_assessment_date', 'assessment', ['date'], unique=False)


def downgrade():
    # The assessment table may have existed before this migration; keep it and its data.
    with op.batch_alter_table('semester', schema=None) as batch_op:
        semester_columns = {column['name'] for column in sa.inspect(op.get_bind()).get_columns('semester')}
        if 'timetable_stored_name' in semester_columns:
            batch_op.drop_column('timetable_stored_name')
        if 'timetable_filename' in semester_columns:
            batch_op.drop_column('timetable_filename')
