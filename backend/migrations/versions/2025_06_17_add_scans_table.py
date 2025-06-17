"""
add scans table
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '2025_06_17_add_scans_table'
down_revision = 'baseline_user_id_20250617'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'scans',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('qr_code_id', sa.Integer, sa.ForeignKey('qrcodes.id'), nullable=False),
        sa.Column('timestamp', sa.DateTime, nullable=False),
        sa.Column('ip_address', sa.String(50)),
        sa.Column('user_agent', sa.Text),
        sa.Column('country', sa.String(100), index=True),
        sa.Column('region', sa.String(100)),
        sa.Column('city', sa.String(100)),
        sa.Column('timezone', sa.String(50)),
        sa.Column('device_type', sa.String(50)),
        sa.Column('os_family', sa.String(100)),
        sa.Column('browser_family', sa.String(100)),
        sa.Column('referrer_domain', sa.String(200)),
        sa.Column('time_on_page', sa.Integer),
        sa.Column('scrolled', sa.Boolean, default=False),
        sa.Column('scan_method', sa.String(50)),
    )

def downgrade():
    op.drop_table('scans')
