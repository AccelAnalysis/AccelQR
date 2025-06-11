from flask import Flask, jsonify, request, send_from_directory, redirect, url_for
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager, jwt_required
from datetime import timedelta, datetime
import os
import logging
from dotenv import load_dotenv
from pathlib import Path
import qrcode
from io import BytesIO
import base64
import uuid
import geoip2.database
from user_agents import parse
from sqlalchemy import text, inspect

# Configure logging
log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs')
os.makedirs(log_dir, exist_ok=True)
log_file = os.path.join(log_dir, f'flask_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log')

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# Initialize extensions
db = None
migrate = None
jwt = None

def create_app():
    """Create and configure the Flask application."""
    
    # Initialize Flask app
    app = Flask(__name__, static_folder='../frontend/dist', static_url_path='')
    
    # Configuration
    # Get database URL from environment variable (required)
    db_uri = os.getenv('DATABASE_URL')
    if not db_uri:
        raise ValueError("No DATABASE_URL environment variable set. Please configure your database.")
    
    # Ensure PostgreSQL URL format is correct
    if db_uri.startswith('postgres://'):
        db_uri = db_uri.replace('postgres://', 'postgresql://', 1)
    
    print(f"Using PostgreSQL database: {db_uri.split('@')[-1]}")
    
    # Database configuration
    if 'postgresql' in db_uri:
        app.config.update(
            SQLALCHEMY_DATABASE_URI=db_uri,
            SQLALCHEMY_ENGINE_OPTIONS={
                'pool_pre_ping': True,
                'pool_recycle': 300,
                'pool_size': 10,
                'max_overflow': 20,
                'connect_args': {
                    'connect_timeout': 5,
                    'keepalives': 1,
                    'keepalives_idle': 30,
                    'keepalives_interval': 10,
                    'keepalives_count': 5
                }
            },
            SQLALCHEMY_TRACK_MODIFICATIONS=False
        )
    else:
        # SQLite configuration
        app.config.update(
            SQLALCHEMY_DATABASE_URI=db_uri,
            SQLALCHEMY_TRACK_MODIFICATIONS=False
        )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-this')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = 3600  # 1 hour
    app.config['JWT_REFRESH_TOKEN_EXPIRES'] = 2592000  # 30 days
    
    # Initialize SQLAlchemy
    from models import db, User
    db.init_app(app)
    
    # Initialize JWT
    jwt = JWTManager(app)
    
    # Initialize Flask-Migrate
    migrate = Migrate(app, db)
    
    # Initialize database
    with app.app_context():
        # Verify database connection
        try:
            db.engine.connect()
            print("✓ Successfully connected to PostgreSQL database")
            
            # Log database information
            if 'sqlite' in db.engine.url.drivername:
                db_version = 'SQLite ' + db.session.execute(text("SELECT sqlite_version();")).scalar()
            else:
                db_version = db.session.execute(text("SELECT version();")).scalar()
            print(f"Database version: {db_version}")
            
            # Log all tables
            inspector = inspect(db.engine)
            tables = inspector.get_table_names()
            print(f"Database tables: {', '.join(tables) if tables else 'No tables found'}")
            
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
            
        except Exception as e:
            print(f"❌ Failed to initialize database: {str(e)}")
            raise
    
    # Configure CORS - Allow all origins for testing
    CORS(app, resources={
        r"/*": {
            "origins": "*",  # Allow all origins for testing
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True
        }
    })
    
    # Import blueprints after db initialization to avoid circular imports
    from auth import auth_bp
    from routes.qrcodes import bp as qrcodes_bp
    from routes.stats import bp as stats_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(qrcodes_bp)
    app.register_blueprint(stats_bp)
    
    # Create the routes directory if it doesn't exist
    os.makedirs(os.path.join(os.path.dirname(__file__), 'routes'), exist_ok=True)
    
    # Import models after app creation to avoid circular imports
    from models import QRCode, Scan, User
    
    # Routes
    @app.route('/api/health')
    def health_check():
        return jsonify({"status": "healthy"}), 200
    
    @app.route('/api/qrcodes', methods=['POST'])
    @jwt_required()
    def create_qrcode():
        data = request.get_json()
        if not data or not data.get('target_url'):
            return jsonify({"msg": "Target URL is required"}), 400
        
        # Generate short code
        short_code = str(uuid.uuid4())[:8]
        
        # Create QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(data['target_url'])
        qr.make(fit=True)
        
        # Generate QR code image
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Save QR code to database
        qr_code = QRCode(
            name=data.get('name', 'Untitled'),
            target_url=data['target_url'],
            short_code=short_code,
            folder=data.get('folder'),
            user_id=get_jwt_identity()
        )
        
        db.session.add(qr_code)
        db.session.commit()
        
        # Convert image to base64
        buffered = BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        return jsonify({
            "id": qr_code.id,
            "name": qr_code.name,
            "short_code": qr_code.short_code,
            "target_url": qr_code.target_url,
            "folder": qr_code.folder,
            "created_at": qr_code.created_at.isoformat(),
            "qr_code_image": f"data:image/png;base64,{img_str}",
            "short_url": f"{request.host_url}r/{short_code}"
        }), 201
    
    @app.route('/r/<short_code>', methods=['GET'])
    def redirect_short_code(short_code):
        qr_code = QRCode.query.filter_by(short_code=short_code).first_or_404()
        
        # Log the scan
        if request.remote_addr != '127.0.0.1':  # Don't log localhost scans
            user_agent = parse(request.user_agent.string)
            
            scan = Scan(
                qr_code_id=qr_code.id,
                ip_address=request.remote_addr,
                user_agent=request.user_agent.string,
                device_type=user_agent.device.family,
                os_family=user_agent.os.family,
                browser_family=user_agent.browser.family,
                referrer_domain=request.referrer
            )
            
            db.session.add(scan)
            db.session.commit()
        
        return redirect(qr_code.target_url)
    
    @app.route('/api/qrcodes', methods=['GET'])
    @jwt_required()
    def get_qrcodes():
        user_id = get_jwt_identity()
        qrcodes = QRCode.query.filter_by(user_id=user_id).all()
        
        return jsonify([{
            'id': qr.id,
            'name': qr.name,
            'target_url': qr.target_url,
            'short_code': qr.short_code,
            'folder': qr.folder,
            'created_at': qr.created_at.isoformat(),
            'scan_count': len(qr.scans),
            'short_url': f"{request.host_url}r/{qr.short_code}"
        } for qr in qrcodes])
    
    @app.route('/api/qrcodes/<int:qrcode_id>', methods=['GET'])
    @jwt_required()
    def get_qrcode(qrcode_id):
        user_id = get_jwt_identity()
        qr = QRCode.query.filter_by(id=qrcode_id, user_id=user_id).first_or_404()
        
        return jsonify({
            'id': qr.id,
            'name': qr.name,
            'target_url': qr.target_url,
            'short_code': qr.short_code,
            'folder': qr.folder,
            'created_at': qr.created_at.isoformat(),
            'scans': [{
                'id': scan.id,
                'timestamp': scan.timestamp.isoformat(),
                'ip_address': scan.ip_address,
                'device_type': scan.device_type,
                'os_family': scan.os_family,
                'browser_family': scan.browser_family,
                'referrer_domain': scan.referrer_domain
            } for scan in qr.scans],
            'short_url': f"{request.host_url}r/{qr.short_code}"
        })
    
    @app.route('/api/qrcodes/<int:qrcode_id>', methods=['DELETE'])
    @jwt_required()
    def delete_qrcode(qrcode_id):
        user_id = get_jwt_identity()
        qr = QRCode.query.filter_by(id=qrcode_id, user_id=user_id).first_or_404()
        
        db.session.delete(qr)
        db.session.commit()
        
        return jsonify({"msg": "QR code deleted successfully"}), 200
    
    # Serve frontend files
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        else:
            return send_from_directory(app.static_folder, 'index.html')
    
    return app

# Create the app
app = create_app()

if __name__ == '__main__':
    app.run(debug=True, port=5001)
