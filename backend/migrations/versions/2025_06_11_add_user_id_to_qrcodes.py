"""Add user_id to qrcodes

Revision ID: 2025_06_11_add_user_id_to_qrcodes
Revises: 
Create Date: 2025-06-11 16:52:35.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2025_06_11_add_user_id_to_qrcodes'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Add the user_id column as nullable first
    op.add_column('qrcodes', sa.Column('user_id', sa.Integer(), nullable=True))
    
    # Set a default user_id (you'll need to replace 1 with an actual user ID)
    # This is necessary because we're adding a non-nullable column to an existing table
    op.execute("UPDATE qrcodes SET user_id = 1 WHERE user_id IS NULL")
    
    # Now alter the column to be non-nullable
    op.alter_column('qrcodes', 'user_id', nullable=False)
    
    # Add the foreign key constraint
    op.create_foreign_key('fk_qrcodes_user_id', 'qrcodes', 'users', ['user_id'], ['id'])


def downgrade():
    # Drop the foreign key constraint first
    op.drop_constraint('fk_qrcodes_user_id', 'qrcodes', type_='foreignkey')
    
    # Then drop the column
    op.drop_column('qrcodes', 'user_id')
