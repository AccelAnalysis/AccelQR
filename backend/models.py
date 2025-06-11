from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import create_access_token, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
from flask import current_app

# Initialize SQLAlchemy
db = SQLAlchemy()

def init_db(app):
    """Initialize the database with the Flask app."""
    with app.app_context():
        # Create all tables
        db.create_all()
        
        # Create admin user if it doesn't exist
        admin_email = "jholman@accelanalysis.com"
        admin = User.query.filter_by(email=admin_email).first()
        
        if not admin:
            print("Creating admin user...")
            admin = User(
                email=admin_email,
                is_admin=True
            )
            admin.set_password("Missions1!")
            db.session.add(admin)
            db.session.commit()
            print("Admin user created successfully")

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    qr_codes = db.relationship('QRCode', backref='user', lazy=True, cascade="all, delete-orphan")
    
    @property
    def password(self):
        raise AttributeError('password is not a readable attribute')
        
    @password.setter
    def password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class QRCode(db.Model):
    __tablename__ = 'qrcodes'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    target_url = db.Column(db.String(500), nullable=False)
    short_code = db.Column(db.String(10), unique=True, nullable=False)
    folder = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
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
