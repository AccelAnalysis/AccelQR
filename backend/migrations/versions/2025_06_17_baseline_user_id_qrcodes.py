"""Baseline: add nullable user_id to qrcodes\n\nRevision ID: baseline_user_id_20250617\nRevises: \nCreate Date: 2025-06-17 13:53:00\n"""
from alembic import op
import sqlalchemy as sa

# Alembic identifiers
revision = 'baseline_user_id_20250617'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('qrcodes', sa.Column('user_id', sa.Integer(), nullable=True))

def downgrade():
    op.drop_column('qrcodes', 'user_id')
