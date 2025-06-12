from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from models import db, QRCode, Scan
from datetime import datetime, timedelta
from sqlalchemy import func, and_
import uuid

bp = Blueprint('qrcodes', __name__, url_prefix='/api/qrcodes')

# No user-specific filtering

@bp.route('', methods=['GET'])
@jwt_required()
def get_qrcodes():
    qrcodes = QRCode.query.all()
    
    return jsonify([{
        'id': qr.id,
        'name': qr.name,
        'short_code': qr.short_code,
        'target_url': qr.target_url,
        'created_at': qr.created_at.isoformat(),
        'scan_count': len(qr.scans),
        'folder': qr.folder
    } for qr in qrcodes])

@bp.route('/<int:qrcode_id>', methods=['GET'])
@jwt_required()
def get_qrcode(qrcode_id):
    qrcode = QRCode.query.get_or_404(qrcode_id)
    
    return jsonify({
        'id': qrcode.id,
        'name': qrcode.name,
        'short_code': qrcode.short_code,
        'target_url': qrcode.target_url,
        'created_at': qrcode.created_at.isoformat(),
        'scans': [{
            'id': scan.id,
            'timestamp': scan.timestamp.isoformat(),
            'ip_address': scan.ip_address,
            'user_agent': scan.user_agent,
            'country': scan.country,
            'region': scan.region,
            'city': scan.city,
            'device_type': scan.device_type,
            'os_family': scan.os_family,
            'browser_family': scan.browser_family,
            'referrer_domain': scan.referrer_domain,
            'time_on_page': scan.time_on_page,
            'scrolled': scan.scrolled,
            'scan_method': scan.scan_method
        } for scan in qrcode.scans],
        'short_url': f"{request.host_url}r/{qrcode.short_code}"
    })

# New endpoint to fetch QR code by short_code
@bp.route('/shortcode/<short_code>', methods=['GET'])
@jwt_required()
def get_qrcode_by_short_code(short_code):
    from io import BytesIO
    import qrcode as qrcode_lib
    import base64
    qrcode = QRCode.query.filter_by(short_code=short_code).first_or_404()
    # Generate QR code image
    qr = qrcode_lib.QRCode(
        version=1,
        error_correction=qrcode_lib.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(qrcode.target_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    return jsonify({
        "id": qrcode.id,
        "name": qrcode.name,
        "short_code": qrcode.short_code,
        "target_url": qrcode.target_url,
        "folder": qrcode.folder,
        "created_at": qrcode.created_at.isoformat(),
        "qr_code_image": f"data:image/png;base64,{img_str}",
        "short_url": f"{request.host_url}r/{short_code}"
    })

@bp.route('/<int:qrcode_id>', methods=['PUT'])
@jwt_required()
def update_qrcode(qrcode_id):
    data = request.get_json()
    qrcode = QRCode.query.get_or_404(qrcode_id)
    
    if 'name' in data:
        qrcode.name = data['name']
    if 'target_url' in data:
        qrcode.target_url = data['target_url']
    if 'folder' in data:
        qrcode.folder = data['folder']
    
    db.session.commit()
    
    return jsonify({
        'id': qrcode.id,
        'name': qrcode.name,
        'target_url': qrcode.target_url,
        'short_code': qrcode.short_code,
        'folder': qrcode.folder,
        'created_at': qrcode.created_at.isoformat(),
        'scan_count': len(qrcode.scans)
    }), 201

@bp.route('', methods=['POST'])
@jwt_required()
def create_qrcode():
    data = request.get_json()
    
    if not data or not data.get('target_url'):
        return jsonify({"msg": "Target URL is required"}), 400
    
    qrcode = QRCode(
        name=data.get('name', 'Untitled QR Code'),
        target_url=data['target_url'],
        short_code=str(uuid.uuid4())[:8],
        folder=data.get('folder')
    )
    
    db.session.add(qrcode)
    db.session.commit()
    
    return jsonify({
        'id': qrcode.id,
        'name': qrcode.name,
        'short_code': qrcode.short_code,
        'target_url': qrcode.target_url,
        'created_at': qrcode.created_at.isoformat(),
        'folder': qrcode.folder
    }), 201
