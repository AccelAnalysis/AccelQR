"""add description column to qrcodes

Revision ID: 2026_02_11_add_description_to_qrcodes
Revises: 2025_06_17_add_scans_table
Create Date: 2026-02-11

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260211_add_desc_qrcodes'
down_revision = '2025_06_17_add_scans_table'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    col_names = {col['name'] for col in inspector.get_columns('qrcodes')}
    if 'description' in col_names:
        return

    with op.batch_alter_table('qrcodes', schema=None) as batch_op:
        batch_op.add_column(sa.Column('description', sa.Text(), nullable=True))


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    col_names = {col['name'] for col in inspector.get_columns('qrcodes')}
    if 'description' not in col_names:
        return

    with op.batch_alter_table('qrcodes', schema=None) as batch_op:
        batch_op.drop_column('description')
