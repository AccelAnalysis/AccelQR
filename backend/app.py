import os
from datetime import datetime, timedelta
from io import BytesIO
from flask import Flask, request, jsonify, send_file, make_response
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
import qrcode
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint to verify the server is running"""
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.utcnow().isoformat(),
        'service': 'qr-tracker-backend'
    }), 200

# Configure CORS to allow all origins for development
CORS(app, resources={
    r"/api/*": {
        "origins": ["*"],  # Allow all origins for development
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        "allow_headers": ["*"],
        "expose_headers": ["*"],
        "supports_credentials": True
    }
})

# Handle PostgreSQL URL format for Render
uri = os.getenv('DATABASE_URL')
if uri and uri.startswith('postgres://'):
    uri = uri.replace('postgres://', 'postgresql://', 1)

app.config['SQLALCHEMY_DATABASE_URI'] = uri or 'sqlite:///qrcodes.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
migrate = Migrate(app, db)

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
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    ip_address = db.Column(db.String(50))
    user_agent = db.Column(db.String(200))

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
    
    return jsonify({
        'id': qr.id,
        'name': qr.name,
        'target_url': qr.target_url,
        'short_code': qr.short_code,
        'folder': qr.folder,
        'created_at': qr.created_at.isoformat(),
        'scan_count': len(qr.scans)
    }), 201

@app.route('/api/qrcodes', methods=['GET'])
def get_qrcodes():
    folder = request.args.get('folder')
    query = QRCode.query
    
    if folder:
        if folder == 'Uncategorized':
            query = query.filter((QRCode.folder == '') | (QRCode.folder.is_(None)))
        else:
            query = query.filter(QRCode.folder == folder)
    
    qrcodes = query.all()
    
    return jsonify([{
        'id': qr.id,
        'name': qr.name,
        'target_url': qr.target_url,
        'short_code': qr.short_code,
        'folder': qr.folder,
        'created_at': qr.created_at.isoformat(),
        'scan_count': len(qr.scans)
    } for qr in qrcodes])

@app.route('/api/folders', methods=['GET'])
def get_folders():
    # Get all unique folders from the database
    folders = db.session.query(QRCode.folder).distinct().all()
    # Filter out None and empty strings, and sort alphabetically
    folder_list = sorted([f[0] for f in folders if f[0]])
    return jsonify(folder_list)

@app.route('/api/folders', methods=['POST'])
def create_folder():
    data = request.get_json()
    folder_name = data.get('name')
    
    if not folder_name or not folder_name.strip():
        return jsonify({'error': 'Folder name is required'}), 400
    
    # Check if folder already exists
    existing_folder = db.session.query(QRCode).filter(
        QRCode.folder == folder_name
    ).first()
    
    if existing_folder:
        return jsonify({'error': 'Folder already exists'}), 400
    
    # Create a dummy QR code to represent the folder
    # This ensures the folder appears in the folders list
    try:
        import random
        import string
        short_code = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
        
        qr = QRCode(
            name=f"Folder: {folder_name}",
            target_url="#",
            short_code=short_code,
            folder=folder_name
        )
        
        db.session.add(qr)
        db.session.commit()
        
        return jsonify({'message': 'Folder created successfully'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

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
    # Handle both ID and short_code based on which one is provided
    if qrcode_id is not None:
        qr = QRCode.query.get_or_404(qrcode_id)
    else:
        qr = QRCode.query.filter_by(short_code=short_code).first_or_404()
    
    # Get scan data for the last 30 days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    recent_scans = Scan.query.filter(
        Scan.qr_code_id == qr.id,
        Scan.timestamp >= thirty_days_ago
    ).all()
    
    # Group scans by day
    daily_scans = {}
    for scan in recent_scans:
        day = scan.timestamp.strftime('%Y-%m-%d')
        daily_scans[day] = daily_scans.get(day, 0) + 1
    
    # Ensure we have entries for all days in the last 30 days
    today = datetime.utcnow().date()
    for i in range(30):
        day = (today - timedelta(days=i)).strftime('%Y-%m-%d')
        if day not in daily_scans:
            daily_scans[day] = 0
    
    # Convert to list of {date, count} objects and sort by date
    daily_scans_list = [{'date': k, 'count': v} for k, v in sorted(daily_scans.items())]
    
    return jsonify({
        'total_scans': len(qr.scans),
        'recent_scans': len(recent_scans),
        'daily_scans': daily_scans_list
    })

@app.route('/api/qrcodes/<short_code>/image', methods=['GET'])
def get_qrcode_image(short_code):
    qr = QRCode.query.filter_by(short_code=short_code).first_or_404()
    
    # Get the local IP address
    import socket
    hostname = socket.gethostname()
    local_ip = socket.gethostbyname(hostname)
    
    # Generate QR code with the local IP
    img = qrcode.make(f'http://{local_ip}:5001/r/{short_code}')
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
    
    # Record the scan
    scan = Scan(
        qr_code_id=qr.id,
        ip_address=request.remote_addr,
        user_agent=request.user_agent.string
    )
    db.session.add(scan)
    db.session.commit()
    
    return f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta http-equiv="refresh" content="0;url={qr.target_url}" />
        <title>Redirecting...</title>
    </head>
    <body>
        <p>Redirecting to <a href="{qr.target_url}">{qr.target_url}</a>...</p>
        <script>
            window.location.href = "{qr.target_url}";
        </script>
    </body>
    </html>
    '''

def get_date_range(time_range):
    now = datetime.utcnow()
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
    else:  # all time
        first_scan = db.session.query(db.func.min(Scan.timestamp)).scalar()
        if not first_scan:
            first_scan = now - timedelta(days=30)  # Default to 30 days if no data
        return first_scan, now, 'month', '%Y-%m'

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
    # Get query parameters
    folder = request.args.get('folder')
    time_range = request.args.get('time_range', '30d')  # Default to 30 days
    
    # Parse the time range
    start_date, end_date, group_by, date_format = get_date_range(time_range)
    
    # Base query for QR codes
    qrcode_query = QRCode.query
    
    # Apply folder filter if specified
    if folder and folder.lower() != 'all qrcodes':
        qrcode_query = qrcode_query.filter(QRCode.folder == folder)
    
    # Get total number of QR codes
    total_qrcodes = qrcode_query.count()
    
    # Base query for scans
    scan_query = db.session.query(Scan).filter(
        Scan.timestamp.between(start_date, end_date)
    )
    
    # Apply folder filter to scans if specified
    if folder and folder.lower() != 'all qrcodes':
        scan_query = scan_query.join(QRCode).filter(QRCode.folder == folder)
    
    # Get total number of scans in the selected time range
    total_scans = scan_query.count()
    
    # Base query for time-based scans
    if group_by == 'hour':
        date_trunc = db.func.date_format(Scan.timestamp, '%Y-%m-%d %H:00:00')
    elif group_by == 'day':
        date_trunc = db.func.date(Scan.timestamp)
    else:  # month
        date_trunc = db.func.date_format(Scan.timestamp, '%Y-%m-01')
    
    scans_query = db.session.query(
        date_trunc.label('date'),
        db.func.count(Scan.id).label('count')
    ).filter(
        Scan.timestamp.between(start_date, end_date)
    )
    
    # Apply folder filter to time-based scans if specified
    if folder and folder.lower() != 'all qrcodes':
        scans_query = scans_query.join(QRCode).filter(QRCode.folder == folder)
    
    # Execute the query
    scans_data = scans_query.group_by(date_trunc).order_by(date_trunc).all()
    
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
            'start': start_date.isoformat(),
            'end': end_date.isoformat(),
            'group_by': group_by,
            'date_format': date_format
        },
        'folder': folder or 'All QR Codes'
    }
    
    # If it's an API call, return JSON
    if request.path == '/api/stats/dashboard':
        return jsonify(response)
    
    # If called internally, return the dict
    return response

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

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    # Run the application
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
