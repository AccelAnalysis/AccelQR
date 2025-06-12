from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

# Initialize SQLAlchemy
db = SQLAlchemy()

def init_db(app):
    """Initialize the database with the Flask app."""
    with app.app_context():
        # Create all tables
        db.create_all()
        print("Database tables created successfully")

class QRCode(db.Model):
    __tablename__ = 'qrcodes'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    target_url = db.Column(db.String(500), nullable=False)
    short_code = db.Column(db.String(10), unique=True, nullable=False)
    folder = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    scans = db.relationship('Scan', backref='qrcode', lazy=True, cascade="all, delete-orphan")

class Scan(db.Model):
    __tablename__ = 'scans'
    
    id = db.Column(db.Integer, primary_key=True)
    qr_code_id = db.Column(db.Integer, db.ForeignKey('qrcodes.id'), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    ip_address = db.Column(db.String(50))
    user_agent = db.Column(db.Text)
    country = db.Column(db.String(100), index=True)
    region = db.Column(db.String(100))
    city = db.Column(db.String(100))
    timezone = db.Column(db.String(50))
    device_type = db.Column(db.String(50))
    os_family = db.Column(db.String(100))
    browser_family = db.Column(db.String(100))
    referrer_domain = db.Column(db.String(200))
    time_on_page = db.Column(db.Integer)
    scrolled = db.Column(db.Boolean, default=False)
    scan_method = db.Column(db.String(50))
