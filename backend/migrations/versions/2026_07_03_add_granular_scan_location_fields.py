"""add granular scan location fields

Revision ID: 20260703_scan_location_fields
Revises: 20260211_add_desc_qrcodes
Create Date: 2026-07-03

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260703_scan_location_fields'
down_revision = '20260211_add_desc_qrcodes'
branch_labels = None
depends_on = None


NEW_COLUMNS = [
    ('country_iso_code', sa.String(length=2)),
    ('region_iso_code', sa.String(length=20)),
    ('postal_code', sa.String(length=20)),
    ('latitude', sa.Float()),
    ('longitude', sa.Float()),
    ('accuracy_radius', sa.Integer()),
]


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = {col['name'] for col in inspector.get_columns('scans')}

    with op.batch_alter_table('scans', schema=None) as batch_op:
        for column_name, column_type in NEW_COLUMNS:
            if column_name not in existing_columns:
                batch_op.add_column(sa.Column(column_name, column_type, nullable=True))


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = {col['name'] for col in inspector.get_columns('scans')}

    with op.batch_alter_table('scans', schema=None) as batch_op:
        for column_name, _column_type in reversed(NEW_COLUMNS):
            if column_name in existing_columns:
                batch_op.drop_column(column_name)
