import os
from datetime import datetime, timedelta
from io import BytesIO
from flask import Flask, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
import qrcode
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

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

app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///qrcodes.db')
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

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5001)
