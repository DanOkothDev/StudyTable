"""persist generated exam study plans

Revision ID: cd3f8a12b640
Revises: a7d42e91c603
Create Date: 2026-10-21 21:57:00

"""
from alembic import op
import sqlalchemy as sa


revision = 'cd3f8a12b640'
down_revision = 'a7d42e91c603'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('semester', schema=None) as batch_op:
        batch_op.add_column(sa.Column('exam_study_plan', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column(
            'exam_study_plan_source', sa.String(length=40), nullable=True))
        batch_op.add_column(sa.Column(
            'exam_study_plan_understanding', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('semester', schema=None) as batch_op:
        batch_op.drop_column('exam_study_plan_understanding')
        batch_op.drop_column('exam_study_plan_source')
        batch_op.drop_column('exam_study_plan')
