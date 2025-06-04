import os
from datetime import datetime, timedelta
from io import BytesIO
from flask import Flask, request, jsonify, send_file, make_response, redirect
from sqlalchemy import text
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
import qrcode
from dotenv import load_dotenv
import geoip2.database
import geoip2.errors
from user_agents import parse
from typing import Dict, Optional
import requests  # For IP geolocation
from urllib.parse import urlparse

# Load environment variables
load_dotenv()

app = Flask(__name__)

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint to verify the server is running"""
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.utcnow().isoformat(),
        'service': 'qr-tracker-backend',
        'database': app.config.get('SQLALCHEMY_DATABASE_URI', 'not configured').split('@')[-1] if 'SQLALCHEMY_DATABASE_URI' in app.config else 'not configured'
    }), 200

@app.route('/api/test-redirect/<short_code>', methods=['GET'])
def test_redirect(short_code):
    """Test endpoint to verify redirect functionality"""
    try:
        # Get the QR code
        qr = QRCode.query.filter_by(short_code=short_code).first()
        if not qr:
            return jsonify({
                'status': 'error',
                'message': 'QR code not found',
                'short_code': short_code
            }), 404
            
        return jsonify({
            'status': 'success',
            'short_code': qr.short_code,
            'target_url': qr.target_url,
            'created_at': qr.created_at.isoformat()
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/db-config', methods=['GET'])
def db_config():
    """Endpoint to verify database configuration"""
    return jsonify({
        'database_url': app.config.get('SQLALCHEMY_DATABASE_URI', 'not configured'),
        'database_type': 'postgresql' if 'postgresql' in app.config.get('SQLALCHEMY_DATABASE_URI', '').lower() else 'sqlite',
        'tables_created': 'qrcodes' in [table.name for table in db.metadata.sorted_tables]
    }), 200

@app.route('/api/test-db', methods=['GET'])
def test_db():
    """Test database connection and return status"""
    try:
        # Test database connection
        db.session.execute(text('SELECT 1'))
        
        # Get database info
        db_url = app.config['SQLALCHEMY_DATABASE_URI']
        db_display = db_url.split('@')[-1] if db_url and '@' in db_url else db_url
        
        # Check if tables exist
        inspector = db.inspect(db.engine)
        tables_exist = 'qrcodes' in inspector.get_table_names()
        
        return jsonify({
            'status': 'success',
            'message': 'Database connection successful',
            'database': db_display or 'Not configured',
            'tables_exist': tables_exist,
            'tables': inspector.get_table_names()
        }), 200
    except Exception as e:
        app.logger.error(f"Database connection failed: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e),
            'database': app.config['SQLALCHEMY_DATABASE_URI'].split('@')[-1] if app.config['SQLALCHEMY_DATABASE_URI'] else 'Not configured'
        }), 500

# Configure CORS with specific allowed origins
allowed_origins = [
    "https://accelqr-1.onrender.com",  # Production frontend
    "http://localhost:5173",           # Local development
    "http://127.0.0.1:5173"            # Local development alternative
]

CORS(app, resources={
    r"/api/*": {
        "origins": allowed_origins,
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        "allow_headers": ["Content-Type", "Authorization"],
        "expose_headers": ["Content-Range", "X-Total-Count"],
        "supports_credentials": True
    }
})

# Configure SQLAlchemy
uri = os.getenv('DATABASE_URL')
print(f"DATABASE_URL from environment: {uri}")

if uri:
    # Handle PostgreSQL URL (Render provides DATABASE_URL)
    if uri.startswith('postgres://'):
        uri = uri.replace('postgres://', 'postgresql://', 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = uri
    print(f"Using PostgreSQL database: {uri}")
else:
    # Fallback to SQLite for local development
    os.makedirs('instance', exist_ok=True)
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(os.getcwd(), "instance/qrcodes.db")}'
    print("Using SQLite database")

app.logger.info(f"Final database URL: {app.config['SQLALCHEMY_DATABASE_URI']}")

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_recycle': 300,
}

# Initialize SQLAlchemy
db = SQLAlchemy(app)
migrate = Migrate(app, db)

def init_db():
    """Initialize the database and create tables"""
    with app.app_context():
        try:
            print("Creating database tables...")
            db.create_all()
            print("Database tables created successfully")
            # Verify tables were created
            inspector = db.inspect(db.engine)
            tables = inspector.get_table_names()
            print(f"Tables in database: {tables}")
        except Exception as e:
            print(f"Error creating database tables: {e}")
            raise

# Initialize database on startup
init_db()

# Add a route to manually trigger table creation
@app.route('/api/create-tables', methods=['POST'])
def create_tables():
    """Manually trigger table creation"""
    try:
        db.create_all()
        return jsonify({
            'status': 'success',
            'message': 'Database tables created successfully',
            'tables': db.inspect(db.engine).get_table_names()
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Error creating tables: {str(e)}'
        }), 500

# Database tables are now created by init_db()

class QRCode(db.Model):
    __tablename__ = 'qrcodes'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    target_url = db.Column(db.String(500), nullable=False)
    short_code = db.Column(db.String(20), unique=True, nullable=False)
    folder = db.Column(db.String(100), index=True, nullable=True)  # Add folder field
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    scans = db.relationship('Scan', backref='qrcode', lazy=True, cascade='all, delete-orphan')

class Scan(db.Model):
    __tablename__ = 'scans'
    
    id = db.Column(db.Integer, primary_key=True)
    qr_code_id = db.Column(db.Integer, db.ForeignKey('qrcodes.id', ondelete='CASCADE'), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    ip_address = db.Column(db.String(50))
    user_agent = db.Column(db.String(200))
    
    # Enhanced tracking fields
    country = db.Column(db.String(100), index=True)
    region = db.Column(db.String(100))
    city = db.Column(db.String(100))
    timezone = db.Column(db.String(50))
    device_type = db.Column(db.String(50))  # mobile, tablet, desktop, other
    os_family = db.Column(db.String(100))
    browser_family = db.Column(db.String(100))
    referrer_domain = db.Column(db.String(200))
    time_on_page = db.Column(db.Integer)  # in seconds
    scrolled = db.Column(db.Boolean, default=False)
    scan_method = db.Column(db.String(50))  # camera, image_upload, etc.

def get_geographic_data(ip_address):
    """Get geographic data from IP address"""
    if ip_address == '127.0.0.1':
        return {
            'country': 'Local',
            'region': 'Development',
            'city': 'Localhost',
            'timezone': 'UTC'
        }
    
    try:
        response = requests.get(f'http://ip-api.com/json/{ip_address}')
        data = response.json()
        if data['status'] == 'success':
            return {
                'country': data.get('country', 'Unknown'),
                'region': data.get('regionName', 'Unknown'),
                'city': data.get('city', 'Unknown'),
                'timezone': data.get('timezone', 'UTC')
            }
    except Exception as e:
        print(f"Error getting geolocation: {e}")
    
    return {
        'country': 'Unknown',
        'region': 'Unknown',
        'city': 'Unknown',
        'timezone': 'UTC'
    }

@app.route('/api/qrcodes', methods=['POST'])
def create_qrcode():
    data = request.json
    if not data or not data.get('target_url') or not data.get('name'):
        return jsonify({'error': 'Missing required fields'}), 400
    
    import random
    import string
    
    # Generate a random short code
    short_code = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
    
    qr = QRCode(
        name=data['name'],
        target_url=data['target_url'],
        short_code=short_code,
        folder=data.get('folder')  # Add folder if provided
    )
    
    db.session.add(qr)
    db.session.commit()
    
    # Create response without accessing the scans relationship
    response_data = {
        'id': qr.id,
        'name': qr.name,
        'target_url': qr.target_url,
        'short_code': qr.short_code,
        'folder': qr.folder,
        'created_at': qr.created_at.isoformat(),
        'scan_count': 0  # Initialize with 0 scans
    }
    
    # Commit the transaction
    db.session.commit()
    
    return jsonify(response_data), 201

@app.route('/api/qrcodes', methods=['GET'])
def get_qrcodes():
    try:
        # Get query parameters
        folder = request.args.get('folder')
        search = request.args.get('search', '').strip()
        
        # Base query
        query = QRCode.query
        
        # Filter by folder if specified
        if folder and folder != 'all':
            if folder == 'uncategorized':
                query = query.filter(QRCode.folder.is_(None))
            else:
                query = query.filter(QRCode.folder == folder)
        
        # Search by name or URL if search term is provided
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (QRCode.name.ilike(search_term)) | 
                (QRCode.target_url.ilike(search_term))
            )
        
        # Order by most recently created first
        query = query.order_by(QRCode.created_at.desc())
        
        # Get all matching QR codes
        qrcodes = query.all()
        
        # Convert to list of dictionaries
        qrcodes_data = [{
            'id': qr.id,
            'name': qr.name,
            'target_url': qr.target_url,
            'short_code': qr.short_code,
            'folder': qr.folder,
            'created_at': qr.created_at.isoformat(),
            'scan_count': len(qr.scans)  # Get actual scan count from the relationship
        } for qr in qrcodes]
        
        return jsonify(qrcodes_data), 200
        
    except Exception as e:
        return jsonify({
            'error': 'Failed to fetch QR codes',
            'details': str(e)
        }), 500

@app.route('/api/folders', methods=['GET'])
def get_folders():
    try:
        app.logger.info("Fetching folders...")
        # Get all unique folder names
        folders = [folder[0] for folder in db.session.query(QRCode.folder).distinct().all() if folder[0]]
        app.logger.info(f"Found folders: {folders}")
        return jsonify(folders), 200
    except Exception as e:
        app.logger.error(f"Error fetching folders: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to fetch folders', 'details': str(e)}), 500

@app.route('/api/folders', methods=['POST'])
def create_folder():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        folder_name = data.get('name')
        
        if not folder_name or not folder_name.strip():
            return jsonify({'error': 'Folder name is required'}), 400
        
        app.logger.info(f"Creating folder: {folder_name}")
        
        # Check if folder already exists
        existing_folder = db.session.query(QRCode).filter_by(folder=folder_name).first()
        if existing_folder:
            return jsonify({'error': 'Folder already exists'}), 409
        
        # Generate a unique short code for the folder
        import random
        import string
        short_code = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
        
        # Create a dummy QR code to represent the folder
        new_qr = QRCode(
            name=f'Folder: {folder_name}',
            target_url='#',
            short_code=short_code,
            folder=folder_name
        )
        
        db.session.add(new_qr)
        db.session.commit()
        
        return jsonify({'message': 'Folder created successfully'}), 201
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error creating folder: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to create folder', 'details': str(e)}), 500

@app.route('/api/folders/<string:folder_name>', methods=['PUT'])
def update_folder(folder_name):
    data = request.get_json()
    new_name = data.get('name')
    
    if not new_name or not new_name.strip():
        return jsonify({'error': 'New folder name is required'}), 400
        
    if new_name == folder_name:
        return jsonify({'message': 'No changes made'}), 200
    
    # Check if new folder name already exists
    existing_folder = db.session.query(QRCode).filter(
        QRCode.folder == new_name
    ).first()
    
    if existing_folder:
        return jsonify({'error': 'A folder with this name already exists'}), 400
    
    try:
        # Update all QR codes with the old folder name
        updated = db.session.query(QRCode).filter(
            QRCode.folder == folder_name
        ).update({
            QRCode.folder: new_name
        }, synchronize_session=False)
        
        if updated == 0:
            return jsonify({'error': 'Folder not found'}), 404
            
        db.session.commit()
        return jsonify({'message': 'Folder updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/folders/<string:folder_name>', methods=['DELETE'])
def delete_folder(folder_name):
    try:
        # Get all QR codes in the folder
        qr_codes = QRCode.query.filter_by(folder=folder_name).all()
        
        if not qr_codes:
            return jsonify({'error': 'Folder not found'}), 404
        
        # Delete all QR codes in the folder (this will cascade delete their scans)
        for qr in qr_codes:
            db.session.delete(qr)
        
        db.session.commit()
        return jsonify({'message': 'Folder and all its QR codes deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/qrcodes/<int:qrcode_id>', methods=['GET', 'PATCH'])
def get_or_update_qrcode(qrcode_id):
    qr = QRCode.query.get_or_404(qrcode_id)
    
    if request.method == 'PATCH':
        data = request.json
        if 'name' in data:
            qr.name = data['name']
        if 'target_url' in data:
            qr.target_url = data['target_url']
        if 'folder' in data:
            qr.folder = data['folder'] if data['folder'] else None
        
        db.session.commit()
    
    return jsonify({
        'id': qr.id,
        'name': qr.name,
        'target_url': qr.target_url,
        'short_code': qr.short_code,
        'folder': qr.folder,
        'created_at': qr.created_at.isoformat(),
        'scan_count': len(qr.scans)
    })

@app.route('/api/qrcodes/<short_code>/stats', methods=['GET'])
@app.route('/api/qrcodes/<int:qrcode_id>/stats', methods=['GET'])
def get_qrcode_stats(qrcode_id=None, short_code=None):
    try:
        # Handle both ID and short_code based on which one is provided
        if qrcode_id is not None:
            qr = QRCode.query.get_or_404(qrcode_id)
        else:
            qr = QRCode.query.filter_by(short_code=short_code).first_or_404()
        
        # Get scan data for the last 30 days
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        
        # First, get the total number of scans for this QR code
        total_scans = db.session.query(db.func.count(Scan.id)).filter(
            Scan.qr_code_id == qr.id
        ).scalar() or 0
        
        # Then get the recent scans count (last 30 days)
        recent_scans_count = db.session.query(db.func.count(Scan.id)).filter(
            Scan.qr_code_id == qr.id,
            Scan.timestamp >= thirty_days_ago
        ).scalar() or 0
        
        # Get daily scan counts for the last 30 days using a raw SQL query to avoid ORM issues
        from sqlalchemy import text
        
        daily_scans_query = text("""
        SELECT 
            date(timestamp) as day, 
            COUNT(*) as count 
        FROM scans 
        WHERE qr_code_id = :qr_code_id AND timestamp >= :start_date 
        GROUP BY date(timestamp)
        """)
        
        # Execute the raw query with parameters
        result = db.session.execute(
            daily_scans_query,
            {'qr_code_id': qr.id, 'start_date': thirty_days_ago}
        ).fetchall()
        
        # Convert to a dictionary for easier processing
        daily_scans = {str(row[0]): row[1] for row in result}
        
        # Ensure we have entries for all days in the last 30 days
        today = datetime.utcnow().date()
        for i in range(30):
            day = (today - timedelta(days=i)).strftime('%Y-%m-%d')
            if day not in daily_scans:
                daily_scans[day] = 0
        
        # Convert to list of {date, count} objects and sort by date
        daily_scans_list = [{'date': k, 'count': v} for k, v in sorted(daily_scans.items())]
        
        return jsonify({
            'total_scans': total_scans,
            'recent_scans': recent_scans_count,
            'daily_scans': daily_scans_list
        })
        
    except Exception as e:
        app.logger.error(f"Error in get_qrcode_stats: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'Failed to fetch QR code stats',
            'details': str(e)
        }), 500

@app.route('/api/qrcodes/<short_code>/image', methods=['GET'])
def get_qrcode_image(short_code):
    qr = QRCode.query.filter_by(short_code=short_code).first_or_404()
    
    # Use production URL for the QR code
    production_url = 'https://accelqr.onrender.com'
    
    # Generate QR code with the production URL
    img = qrcode.make(f'{production_url}/r/{short_code}')
    img_io = BytesIO()
    img.save(img_io, 'PNG')
    img_io.seek(0)
    
    return send_file(img_io, mimetype='image/png')

@app.route('/api/qrcodes/<int:qrcode_id>', methods=['PUT'])
def update_qrcode(qrcode_id):
    qr = QRCode.query.get_or_404(qrcode_id)
    data = request.get_json()
    
    # Update fields if they exist in the request
    if 'name' in data:
        qr.name = data['name']
    if 'target_url' in data:
        qr.target_url = data['target_url']
    if 'folder' in data:
        qr.folder = data['folder']
    if 'description' in data:
        qr.description = data.get('description', '')
    
    db.session.commit()
    return jsonify({
        'id': qr.id,
        'name': qr.name,
        'target_url': qr.target_url,
        'folder': qr.folder,
        'description': getattr(qr, 'description', '')
    }), 200

@app.route('/api/qrcodes/<int:qrcode_id>', methods=['DELETE'])
def delete_qrcode(qrcode_id):
    qr = QRCode.query.get_or_404(qrcode_id)
    db.session.delete(qr)
    db.session.commit()
    return jsonify({'message': 'QR code deleted successfully'}), 200

@app.route('/r/<short_code>', methods=['GET'])
def redirect_short_code(short_code):
    qr = QRCode.query.filter_by(short_code=short_code).first_or_404()
    
    # Get referrer domain
    referrer = request.referrer
    referrer_domain = None
    if referrer:
        parsed_uri = urlparse(referrer)
        referrer_domain = parsed_uri.netloc
    
    # Parse user agent
    user_agent_data = parse(request.user_agent.string)
    
    # Get geographic data
    geo_data = get_geographic_data(request.remote_addr)
    
    # Create scan record with enhanced data
    scan = Scan(
        qr_code_id=qr.id,
        ip_address=request.remote_addr,
        user_agent=request.user_agent.string,
        referrer_domain=referrer_domain,
        scan_method=request.args.get('scan_method', 'camera'),
        device_type='mobile' if user_agent_data.is_mobile else 
                   'tablet' if user_agent_data.is_tablet else 
                   'desktop' if user_agent_data.is_pc else 'other',
        os_family=user_agent_data.os.family,
        browser_family=user_agent_data.browser.family,
        country=geo_data['country'],
        region=geo_data['region'],
        city=geo_data['city'],
        timezone=geo_data['timezone']
    )
    
    db.session.add(scan)
    db.session.commit()
    
    # Add scan ID to URL for tracking time on page
    redirect_url = qr.target_url
    if '?' in redirect_url:
        redirect_url += f'&scan_id={scan.id}'
    else:
        redirect_url += f'?scan_id={scan.id}'
    
    # Redirect directly instead of using HTML meta refresh
    return redirect(redirect_url, code=302)

def get_date_range(time_range):
    try:
        if not time_range:
            time_range = '30d'  # Default to 30 days if no time range is provided
            
        now = datetime.utcnow()
        time_range = str(time_range).lower()  # Ensure time_range is a string and lowercase
        
        if time_range == '24h':
            return now - timedelta(hours=24), now, 'hour', '%H:00'
        elif time_range == '3d':
            return now - timedelta(days=3), now, 'day', '%Y-%m-%d'
        elif time_range == 'week':
            return now - timedelta(weeks=1), now, 'day', '%Y-%m-%d'
        elif time_range == '30d':
            return now - timedelta(days=30), now, 'day', '%Y-%m-%d'
        elif time_range == '60d':
            return now - timedelta(days=60), now, 'day', '%Y-%m-%d'
        elif time_range == '90d':
            return now - timedelta(days=90), now, 'day', '%Y-%m-%d'
        elif time_range == '6m':
            return now - timedelta(days=180), now, 'month', '%Y-%m'
        elif time_range == 'year':
            return now - timedelta(days=365), now, 'month', '%Y-%m'
        else:  # all time or unknown
            first_scan = db.session.query(db.func.min(Scan.timestamp)).scalar()
            if not first_scan:
                first_scan = now - timedelta(days=30)  # Default to 30 days if no data
            return first_scan, now, 'month', '%Y-%m'
    except Exception as e:
        app.logger.error(f"Error in get_date_range: {str(e)}")
        # Return a default range in case of any error
        now = datetime.utcnow()
        return now - timedelta(days=30), now, 'day', '%Y-%m-%d'

@app.route('/api/stats/dashboard/export', methods=['GET'])
def export_dashboard_stats():
    # Get query parameters
    folder = request.args.get('folder')
    time_range = request.args.get('time_range', '30d')
    
    # Get the stats data
    stats = get_dashboard_stats().get_json()
    
    # Create CSV content
    csv_data = []
    
    # Add header
    csv_data.append(['Metric', 'Value'])
    
    # Add summary stats
    csv_data.append(['Total QR Codes', stats['total_qrcodes']])
    csv_data.append(['Total Scans', stats['total_scans']])
    csv_data.append(['Time Range', f"{stats['time_range']['start']} to {stats['time_range']['end']}"])
    csv_data.append(['Group By', stats['time_range']['group_by']])
    csv_data.append(['Folder', stats['folder']])
    
    # Add empty row before scan data
    csv_data.append([])
    csv_data.append(['Date', 'Scan Count'])
    
    # Add scan data
    for scan in stats['scans']:
        csv_data.append([scan['date'], scan['count']])
    
    # Convert to CSV string
    csv_string = '\n'.join([','.join(map(str, row)) for row in csv_data])
    
    # Create response with CSV data
    response = make_response(csv_string)
    response.headers['Content-Type'] = 'text/csv'
    response.headers['Content-Disposition'] = f'attachment; filename=dashboard_export_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}.csv'
    
    return response

@app.route('/api/stats/dashboard', methods=['GET'])
def get_dashboard_stats():
    try:
        # Get query parameters
        folder = request.args.get('folder')
        time_range = request.args.get('time_range', '30d')  # Default to 30 days
        
        app.logger.info(f"Fetching dashboard stats for folder: {folder}, time_range: {time_range}")
        
        # Parse the time range
        start_date, end_date, group_by, date_format = get_date_range(time_range)
        
        app.logger.info(f"Date range: {start_date} to {end_date}, group_by: {group_by}")
        
        # Base query for QR codes - filter out folder placeholders
        qrcode_query = QRCode.query.filter(
            QRCode.target_url != '#'  # Filter out dummy folder entries
        )
        
        # Apply folder filter if specified
        if folder and folder.lower() != 'all qrcodes':
            qrcode_query = qrcode_query.filter(QRCode.folder == folder)
        
        # Get total number of QR codes (excluding folder placeholders)
        total_qrcodes = qrcode_query.count()
        app.logger.info(f"Total QR codes (excluding folders): {total_qrcodes}")
        
        # Base query for scans - only include basic fields that definitely exist
        scan_query = db.session.query(Scan.id, Scan.timestamp, Scan.qr_code_id)
        
        # Filter by time range
        scan_query = scan_query.filter(Scan.timestamp.between(start_date, end_date))
        
        # Apply folder filter to scans if specified
        if folder and folder.lower() != 'all qrcodes':
            scan_query = scan_query.join(QRCode).filter(QRCode.folder == folder)
        
        # Get total number of scans in the selected time range
        total_scans = scan_query.count()
        
        # Base query for time-based scans - using SQLite compatible date functions
        if group_by == 'hour':
            date_trunc = db.func.strftime('%Y-%m-%d %H:00:00', Scan.timestamp)
        elif group_by == 'day':
            date_trunc = db.func.date(Scan.timestamp)
        else:  # month
            date_trunc = db.func.strftime('%Y-%m-01', Scan.timestamp)
        
        # Create a subquery with just the basic fields we need
        subq = db.session.query(
            Scan.id,
            Scan.timestamp,
            Scan.qr_code_id,
            date_trunc.label('date_group')
        ).filter(
            Scan.timestamp.between(start_date, end_date)
        ).subquery()
        
        # Get scan counts by time period
        scans_query = db.session.query(
            subq.c.date_group.label('date'),
            db.func.count(subq.c.id).label('count')
        ).group_by('date_group').order_by('date_group')
        
        # Apply folder filter to time-based scans if specified
        if folder and folder.lower() != 'all qrcodes':
            scans_query = scans_query.join(QRCode, subq.c.qr_code_id == QRCode.id)
            scans_query = scans_query.filter(QRCode.folder == folder)
        
        # Execute the query
        scans_data = scans_query.all()
        
        # Convert to list of dicts for JSON serialization
        scans = [{
            'date': str(scan.date) if not isinstance(scan.date, str) else scan.date,
            'count': scan.count
        } for scan in scans_data]
        
        response = {
            'total_qrcodes': total_qrcodes,
            'total_scans': total_scans,
            'scans': scans,
            'time_range': {
                'start': start_date.isoformat() if hasattr(start_date, 'isoformat') else str(start_date),
                'end': end_date.isoformat() if hasattr(end_date, 'isoformat') else str(end_date),
                'group_by': group_by,
                'date_format': date_format
            },
            'folder': folder or 'All QR Codes'
        }
        
        app.logger.info(f"Successfully fetched dashboard stats. QR Codes: {total_qrcodes}, Scans: {total_scans}")
        return jsonify(response)
        
    except Exception as e:
        app.logger.error(f"Error in get_dashboard_stats: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'Failed to fetch dashboard stats',
            'details': str(e)
        }), 500

@app.route('/api/stats/daily-scans', methods=['GET'])
def get_daily_scan_stats():
    # Get folder from query parameter
    folder = request.args.get('folder')
    
    # Get scan data for the last 30 days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    
    # Base query
    query = db.session.query(
        db.func.date(Scan.timestamp).label('date'),
        db.func.count(Scan.id).label('count')
    ).join(
        QRCode, Scan.qr_code_id == QRCode.id
    ).filter(
        Scan.timestamp >= thirty_days_ago
    )
    
    # Add folder filter if specified
    if folder and folder.lower() != 'all qr codes':
        query = query.filter(QRCode.folder == folder)
    
    # Execute the query
    daily_scans = query.group_by(
        db.func.date(Scan.timestamp)
    ).all()
    
    # Convert to dictionary for easier lookup
    scans_dict = {str(scan.date): scan.count for scan in daily_scans}
    
    # Ensure we have entries for all days in the last 30 days
    today = datetime.utcnow().date()
    result = []
    for i in range(30):
        day = (today - timedelta(days=i)).strftime('%Y-%m-%d')
        result.insert(0, {
            'date': day,
            'count': scans_dict.get(day, 0)
        })
    
    return jsonify({
        'daily_scans': result,
        'total_scans': sum(scan.count for scan in daily_scans),
        'total_qrcodes': QRCode.query.count()
    })

@app.route('/api/qrcodes/<int:qrcode_id>/enhanced-stats', methods=['GET'])
def get_enhanced_qrcode_stats(qrcode_id):
    try:
        qr = QRCode.query.get_or_404(qrcode_id)
        
        # Initialize stats with default values
        stats = {
            'total_scans': 0,
            'scans_by_country': {},
            'scans_by_device': {},
            'scans_by_os': {},
            'scans_by_browser': {},
            'scans_by_hour': {str(h).zfill(2): 0 for h in range(24)},
            'scans_by_weekday': {i: 0 for i in range(7)},
            'avg_time_on_page': 0,
            'scroll_rate': 0,
            'top_referrers': {}
        }
        
        # Get basic scan count using a simple query
        scan_count = db.session.query(Scan.id).filter(Scan.qr_code_id == qrcode_id).count()
        stats['total_scans'] = scan_count
        
        if scan_count == 0:
            return jsonify(stats)
            
        # Get scan data with only the fields we need
        scans = db.session.query(
            Scan.timestamp,
            getattr(Scan, 'country', None).label('country'),
            getattr(Scan, 'region', None).label('region'),
            getattr(Scan, 'city', None).label('city'),
            getattr(Scan, 'timezone', None).label('timezone'),
            getattr(Scan, 'device_type', None).label('device_type'),
            getattr(Scan, 'os_family', None).label('os_family'),
            getattr(Scan, 'browser_family', None).label('browser_family'),
            getattr(Scan, 'referrer_domain', None).label('referrer_domain'),
            getattr(Scan, 'time_on_page', None).label('time_on_page'),
            getattr(Scan, 'scrolled', None).label('scrolled'),
            getattr(Scan, 'scan_method', None).label('scan_method')
        ).filter(Scan.qr_code_id == qrcode_id).all()
        
        # Calculate time-based stats
        time_on_page_total = 0
        time_on_page_count = 0
        scrolled_count = 0
        
        for scan in scans:
            # Country stats
            if hasattr(scan, 'country') and scan.country:
                stats['scans_by_country'][scan.country] = stats['scans_by_country'].get(scan.country, 0) + 1
            
            # Device stats
            if hasattr(scan, 'device_type') and scan.device_type:
                stats['scans_by_device'][scan.device_type] = stats['scans_by_device'].get(scan.device_type, 0) + 1
            
            # OS stats
            if hasattr(scan, 'os_family') and scan.os_family:
                stats['scans_by_os'][scan.os_family] = stats['scans_by_os'].get(scan.os_family, 0) + 1
            
            # Browser stats
            if hasattr(scan, 'browser_family') and scan.browser_family:
                stats['scans_by_browser'][scan.browser_family] = stats['scans_by_browser'].get(scan.browser_family, 0) + 1
            
            # Time-based stats
            if scan.timestamp:
                stats['scans_by_hour'][str(scan.timestamp.hour).zfill(2)] += 1
                stats['scans_by_weekday'][scan.timestamp.weekday()] += 1
            
            # Interaction stats
            if hasattr(scan, 'time_on_page') and scan.time_on_page is not None:
                time_on_page_total += scan.time_on_page
                time_on_page_count += 1
            
            if hasattr(scan, 'scrolled') and scan.scrolled:
                scrolled_count += 1
                
            # Referrer stats
            if hasattr(scan, 'referrer_domain') and scan.referrer_domain:
                stats['top_referrers'][scan.referrer_domain] = stats['top_referrers'].get(scan.referrer_domain, 0) + 1
        
        # Calculate averages
        if time_on_page_count > 0:
            stats['avg_time_on_page'] = round(time_on_page_total / time_on_page_count, 2)
        
        if scans:
            stats['scroll_rate'] = round((scrolled_count / len(scans)) * 100, 2)
        
        # Sort and limit top referrers
        stats['top_referrers'] = dict(sorted(
            stats['top_referrers'].items(), 
            key=lambda x: x[1], 
            reverse=True
        )[:10])  # Top 10 referrers
        
        return jsonify(stats)
        
    except Exception as e:
        # If there's an error, return a basic response
        return jsonify({
            'total_scans': 0,
            'scans_by_country': {},
            'scans_by_device': {},
            'scans_by_os': {},
            'scans_by_browser': {},
            'scans_by_hour': {},
            'scans_by_weekday': {},
            'avg_time_on_page': 0,
            'scroll_rate': 0,
            'top_referrers': {},
            'error': str(e)
        }), 200

# Initialize database
def init_db():
    with app.app_context():
        # Create all database tables
        db.create_all()
        print("Database tables created successfully")

if __name__ == '__main__':
    # Initialize database when starting the app
    init_db()
    # Run the application
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
