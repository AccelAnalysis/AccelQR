"""add description column to qrcodes

Revision ID: 2026_02_11_add_description_to_qrcodes
Revises: 2025_06_17_add_scans_table
Create Date: 2026-02-11

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2026_02_11_add_description_to_qrcodes'
down_revision = '2025_06_17_add_scans_table'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('qrcodes', schema=None) as batch_op:
        batch_op.add_column(sa.Column('description', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('qrcodes', schema=None) as batch_op:
        batch_op.drop_column('description')
