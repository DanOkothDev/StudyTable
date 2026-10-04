"""add performance indexes

Revision ID: b7ee6c2a7d31
Revises: 684719662933
Create Date: 2026-10-04 23:22:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b7ee6c2a7d31'
down_revision = '684719662933'
branch_labels = None
depends_on = None


def upgrade():
    op.create_index('ix_user_email', 'user', ['email'], unique=False)
    op.create_index('ix_year_user_number', 'year', ['user_id', 'number'], unique=False)
    op.create_index('ix_semester_year_number', 'semester', ['year_id', 'number'], unique=False)
    op.create_index('ix_course_user_name', 'course', ['user_id', 'name'], unique=False)
    op.create_index('ix_course_user_semester', 'course', ['user_id', 'semester_id'], unique=False)
    op.create_index('ix_document_course_id', 'document', ['course_id'], unique=False)
    op.create_index('ix_page_document_page', 'page', ['document_id', 'page_number'], unique=False)
    op.create_index('ix_page_study_cards', 'page', ['document_id', 'studied', 'cards_made'], unique=False)
    op.create_index('ix_page_document_studied', 'page', ['document_id', 'studied'], unique=False)
    op.create_index('ix_page_document_cards_made', 'page', ['document_id', 'cards_made'], unique=False)
    op.create_index('ix_flashcard_document_page', 'flashcard', ['document_id', 'page_number'], unique=False)
    op.create_index('ix_flashcard_due_at', 'flashcard', ['due_at'], unique=False)
    op.create_index('ix_flashcard_document_due', 'flashcard', ['document_id', 'due_at'], unique=False)
    op.create_index('ix_ai_usage_user_day', 'ai_usage', ['user_id', 'day'], unique=False)
    op.create_index('ix_cat_course_created', 'cat', ['course_id', 'created_at'], unique=False)
    op.create_index('ix_cat_question_cat_position', 'cat_question', ['cat_id', 'position'], unique=False)


def downgrade():
    op.drop_index('ix_cat_question_cat_position', table_name='cat_question')
    op.drop_index('ix_cat_course_created', table_name='cat')
    op.drop_index('ix_ai_usage_user_day', table_name='ai_usage')
    op.drop_index('ix_flashcard_document_due', table_name='flashcard')
    op.drop_index('ix_flashcard_due_at', table_name='flashcard')
    op.drop_index('ix_flashcard_document_page', table_name='flashcard')
    op.drop_index('ix_page_document_cards_made', table_name='page')
    op.drop_index('ix_page_document_studied', table_name='page')
    op.drop_index('ix_page_study_cards', table_name='page')
    op.drop_index('ix_page_document_page', table_name='page')
    op.drop_index('ix_document_course_id', table_name='document')
    op.drop_index('ix_course_user_semester', table_name='course')
    op.drop_index('ix_course_user_name', table_name='course')
    op.drop_index('ix_semester_year_number', table_name='semester')
    op.drop_index('ix_year_user_number', table_name='year')
    op.drop_index('ix_user_email', table_name='user')
