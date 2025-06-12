from flask import Flask, jsonify, request, send_from_directory, redirect, url_for, session
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash
from extensions import db, jwt
from datetime import datetime, timedelta
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
from functools import wraps

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

# Database and JWT are now initialized in extensions.py
migrate = None

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated_function

def create_app():
    """Create and configure the Flask application."""
    # Create the app
    app = Flask(__name__, static_folder='../frontend/dist', static_url_path='')
    
    # Configure database
    db_uri = os.getenv('DATABASE_URL')
    if not db_uri:
        raise ValueError("No DATABASE_URL environment variable set. Please configure your database.")
    
    # Ensure PostgreSQL URL format is correct
    if db_uri.startswith('postgres://'):
        db_uri = db_uri.replace('postgres://', 'postgresql://', 1)
    
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
    
    # Initialize extensions with app
    db.init_app(app)
    
    # Configure session and JWT
    app.secret_key = os.getenv('SECRET_KEY', 'your-secret-key-here')
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'your-jwt-secret-key')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=1)
    app.permanent_session_lifetime = timedelta(days=1)
    
    # Initialize JWT
    jwt.init_app(app)
    
    # Import and register blueprints
    from routes import qrcodes as qrcodes_blueprint
    from routes import stats as stats_blueprint
    from auth_routes import bp as auth_blueprint
    
    app.register_blueprint(qrcodes_blueprint.bp, url_prefix='/api/qrcodes')
    app.register_blueprint(stats_blueprint.bp, url_prefix='/api/stats')
    app.register_blueprint(auth_blueprint)
    
    # Configure CORS
    CORS(app, resources={
        r"/*": {
            "origins": "*",
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True
        }
    })
    
    # Create tables if they don't exist
    with app.app_context():
        db.create_all()
        
    # Add health check endpoint
    @app.route('/api/health')
    def health_check():
        return jsonify({"status": "healthy"}), 200

    # Add QR code creation endpoint
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
            folder=data.get('folder')
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
    
    # Add short URL redirection endpoint
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
    
    # Add QR code listing endpoint
    @app.route('/api/qrcodes', methods=['GET'])
    @jwt_required()
    def get_qrcodes():
        qrcodes = QRCode.query.all()
        
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
    
    # Add QR code detail endpoint
    @app.route('/api/qrcodes/<int:qrcode_id>', methods=['GET'])
    @jwt_required()
    def get_qrcode(qrcode_id):
        qr = QRCode.query.get_or_404(qrcode_id)
        
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
    
    # Add QR code deletion endpoint
    @app.route('/api/qrcodes/<int:qrcode_id>', methods=['DELETE'])
    @jwt_required()
    def delete_qrcode(qrcode_id):
        qr = QRCode.query.get_or_404(qrcode_id)
        
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

# Initialize the app
app = create_app()

if __name__ == '__main__':
    app.run(debug=True, port=5001)
