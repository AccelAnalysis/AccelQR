from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, QRCode, Scan, User
from datetime import datetime, timedelta
from sqlalchemy import func, and_
import uuid

bp = Blueprint('qrcodes', __name__, url_prefix='/api/qrcodes')

@bp.route('', methods=['GET'])
@jwt_required()
def get_qrcodes():
    current_user_id = get_jwt_identity()
    qrcodes = QRCode.query.filter_by(user_id=current_user_id).all()
    
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
    current_user_id = get_jwt_identity()
    qrcode = QRCode.query.filter_by(id=qrcode_id, user_id=current_user_id).first_or_404()
    
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
        } for scan in qrcode.scans]
    })

@bp.route('', methods=['POST'])
@jwt_required()
def create_qrcode():
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data or not data.get('target_url'):
        return jsonify({"msg": "Target URL is required"}), 400
    
    qrcode = QRCode(
        name=data.get('name', 'Untitled QR Code'),
        target_url=data['target_url'],
        short_code=str(uuid.uuid4())[:8],
        folder=data.get('folder'),
        user_id=current_user_id
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
