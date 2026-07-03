from flask import Flask, jsonify, request, send_from_directory, redirect, url_for, session
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash
from flask_jwt_extended import jwt_required, create_access_token, get_jwt_identity
from extensions import db, jwt
from datetime import datetime, timedelta
from models import QRCode, Scan
import os
import logging
from dotenv import load_dotenv
from pathlib import Path
import qrcode
from io import BytesIO
import base64
import uuid
import geoip2.database
import geoip2.errors
from user_agents import parse
from sqlalchemy import text, inspect, func
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

GEOLITE_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'GeoLite2-City.mmdb')

# Database and JWT are now initialized in extensions.py
from flask_migrate import Migrate


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated_function

def lookup_scan_location(ip_address):
    if not ip_address or not os.path.exists(GEOLITE_DB_PATH):
        return {}

    try:
        with geoip2.database.Reader(GEOLITE_DB_PATH) as reader:
            response = reader.city(ip_address)
            return {
                'country': response.country.name,
                'country_iso_code': response.country.iso_code,
                'region': response.subdivisions.most_specific.name,
                'region_iso_code': response.subdivisions.most_specific.iso_code,
                'city': response.city.name,
                'postal_code': response.postal.code,
                'timezone': response.location.time_zone,
                'latitude': response.location.latitude,
                'longitude': response.location.longitude,
                'accuracy_radius': response.location.accuracy_radius
            }
    except (ValueError, geoip2.errors.AddressNotFoundError):
        return {}
    except Exception:
        logger.exception("Failed to look up GeoIP location for scan")
        return {}

def create_app():
    """Create and configure the Flask application."""
    # Load environment variables from .env file
    load_dotenv()

    # Create the app
    app = Flask(__name__, static_folder='../frontend/dist', static_url_path='')

    # Add ProxyFix to preserve headers behind proxies
    from werkzeug.middleware.proxy_fix import ProxyFix
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1, x_prefix=1)

    flask_env = os.getenv('FLASK_ENV', '').lower()
    is_production = flask_env == 'production' or (not flask_env and os.getenv('RENDER') is not None)

    if not is_production:
        @app.before_request
        def log_auth_header():
            auth_header = request.headers.get('Authorization')
            if auth_header:
                logging.info("Authorization header present")

    # Configure database
    db_uri = os.getenv('DATABASE_URL')
    if not db_uri:
        raise ValueError("No DATABASE_URL environment variable set. Please configure your database.")
    if db_uri.startswith('postgres://'):
        db_uri = db_uri.replace('postgres://', 'postgresql://', 1)
    if not is_production:
        print("[Startup] DATABASE_URL configured")

    app.config['SQLALCHEMY_DATABASE_URI'] = db_uri

    # Initialize Flask-Migrate
    db.init_app(app)
    from flask_migrate import Migrate
    Migrate(app, db)

    # Database configuration
    if 'postgresql' in db_uri:
        app.config.update(
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
    
    # Configure session and JWT
    secret_key = os.getenv('SECRET_KEY')
    jwt_secret_key = os.getenv('JWT_SECRET_KEY')
    if is_production and (not secret_key or not jwt_secret_key):
        raise ValueError("Missing SECRET_KEY and/or JWT_SECRET_KEY in production")
    app.secret_key = secret_key or 'your-secret-key-here'
    app.config['JWT_SECRET_KEY'] = jwt_secret_key or 'your-jwt-secret-key'
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=1)
    app.permanent_session_lifetime = timedelta(days=1)
    # Explicitly disable CSRF protection for Bearer tokens
    app.config['JWT_COOKIE_CSRF_PROTECT'] = False
    logging.info(f"[DEBUG] JWT_COOKIE_CSRF_PROTECT: {app.config.get('JWT_COOKIE_CSRF_PROTECT')}")
    
    # Initialize JWT
    jwt.init_app(app)
    from auth import register_jwt_error_handlers
    register_jwt_error_handlers(app)
    
    # Import and register blueprints
    from routes.qrcodes import bp as qrcodes_bp
    app.register_blueprint(qrcodes_bp, url_prefix='/api/qrcodes')
    from routes.stats import bp as stats_bp
    app.register_blueprint(stats_bp, url_prefix='/api/stats')
    from auth_routes import bp as auth_bp
    app.register_blueprint(auth_bp, url_prefix='/api')
    from routes.folders import bp as folders_bp
    app.register_blueprint(folders_bp, url_prefix='/api/folders')
    from routes.qrcodes_stats import bp as qrcodes_stats_bp
    app.register_blueprint(qrcodes_stats_bp, url_prefix='/api/qrcodes')
    
    # Configure CORS for production: only allow frontend domain and /api/*
    CORS(app, resources={
        r"/api/*": {
            "origins": ["https://accelqr-1.onrender.com", "http://localhost:5173"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization", "X-CSRF-TOKEN"],
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
        qr.add_data(f"{request.host_url}r/{short_code}")
        qr.make(fit=True)
        
        # Generate QR code image
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Save QR code to database
        current_user_id = get_jwt_identity()
        if current_user_id is not None:
            current_user_id = int(current_user_id)
        qr_code = QRCode(
            name=data.get('name', 'Untitled'),
            target_url=data['target_url'],
            short_code=short_code,
            folder=data.get('folder'),
            user_id=current_user_id
        )
        
        db.session.add(qr_code)
        db.session.commit()
        
        # Convert image to base64
        buffered = BytesIO()
        # Robustly ensure img is a true PIL Image before saving
        if hasattr(img, "get_image"):
            img = img.get_image()
        elif hasattr(img, "to_image"):
            img = img.to_image()
        elif not hasattr(img, "save"):
            import logging
            logging.error(f"QR make_image returned unexpected type: {type(img)}")
            raise TypeError(f"QR make_image returned unexpected type: {type(img)}")
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
            location = lookup_scan_location(request.remote_addr)
            
            scan = Scan(
                qr_code_id=qr_code.id,
                ip_address=request.remote_addr,
                user_agent=request.user_agent.string,
                country=location.get('country'),
                country_iso_code=location.get('country_iso_code'),
                region=location.get('region'),
                region_iso_code=location.get('region_iso_code'),
                city=location.get('city'),
                postal_code=location.get('postal_code'),
                timezone=location.get('timezone'),
                latitude=location.get('latitude'),
                longitude=location.get('longitude'),
                accuracy_radius=location.get('accuracy_radius'),
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
        rows = (
            db.session.query(
                QRCode,
                func.count(Scan.id).label('scan_count'),
                func.max(Scan.timestamp).label('last_scanned_at'),
            )
            .outerjoin(Scan, Scan.qr_code_id == QRCode.id)
            .group_by(QRCode.id)
            .all()
        )

        return jsonify([{
            'id': qr.id,
            'name': qr.name,
            'target_url': qr.target_url,
            'short_code': qr.short_code,
            'folder': qr.folder,
            'created_at': qr.created_at.isoformat(),
            'scan_count': int(scan_count or 0),
            'last_scanned_at': last_scanned_at.isoformat() if last_scanned_at else None,
            'short_url': f"{request.host_url}r/{qr.short_code}"
        } for qr, scan_count, last_scanned_at in rows])
    
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
                'user_agent': scan.user_agent,
                'country': scan.country,
                'country_iso_code': scan.country_iso_code,
                'region': scan.region,
                'region_iso_code': scan.region_iso_code,
                'subdivision_iso_code': scan.region_iso_code,
                'city': scan.city,
                'postal_code': scan.postal_code,
                'timezone': scan.timezone,
                'latitude': scan.latitude,
                'longitude': scan.longitude,
                'accuracy_radius': scan.accuracy_radius,
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
