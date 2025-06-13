"""Remove user_id from qrcodes

Revision ID: 2025_06_12_remove_user_id_from_qrcodes
Revises: 2025_06_11_add_user_id_to_qrcodes
Create Date: 2025-06-12 12:10:00.000000
"""
revision = '2025_06_12_remove_user_id_from_qrcodes'
down_revision = '2025_06_11_add_user_id_to_qrcodes'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa

def upgrade():
    # Drop foreign key constraint if exists
    with op.batch_alter_table('qrcodes') as batch_op:
        batch_op.drop_constraint('fk_qrcodes_user_id', type_='foreignkey')
        batch_op.drop_column('user_id')

def downgrade():
    # Add user_id column back (nullable, as before)
    with op.batch_alter_table('qrcodes') as batch_op:
        batch_op.add_column(sa.Column('user_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_qrcodes_user_id', 'users', ['user_id'], ['id'])
