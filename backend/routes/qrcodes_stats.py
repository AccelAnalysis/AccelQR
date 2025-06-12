from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from models import db, QRCode, Scan
from sqlalchemy import func
from datetime import datetime

bp = Blueprint('qrcodes_stats', __name__, url_prefix='/api/qrcodes')

@bp.route('/<int:qrcode_id>/stats', methods=['GET'])
@jwt_required()
def qrcode_stats(qrcode_id):
    qrcode = QRCode.query.get_or_404(qrcode_id)
    total_scans = db.session.query(func.count(Scan.id)).filter(Scan.qr_code_id == qrcode_id).scalar() or 0
    last_scan = db.session.query(Scan).filter(Scan.qr_code_id == qrcode_id).order_by(Scan.timestamp.desc()).first()
    last_scan_time = last_scan.timestamp.isoformat() if last_scan else None
    unique_cities = db.session.query(func.count(func.distinct(Scan.city))).filter(Scan.qr_code_id == qrcode_id).scalar() or 0
    unique_countries = db.session.query(func.count(func.distinct(Scan.country))).filter(Scan.qr_code_id == qrcode_id).scalar() or 0
    return jsonify({
        'id': qrcode.id,
        'name': qrcode.name,
        'short_code': qrcode.short_code,
        'total_scans': total_scans,
        'last_scan_time': last_scan_time,
        'unique_cities': unique_cities,
        'unique_countries': unique_countries
    })

@bp.route('/<int:qrcode_id>/enhanced-stats', methods=['GET'])
@jwt_required()
def qrcode_enhanced_stats(qrcode_id):
    qrcode = QRCode.query.get_or_404(qrcode_id)
    # Example enhanced stats: daily scan counts for past 30 days
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=30)
    daily_scans = db.session.query(
        func.date(Scan.timestamp).label('date'),
        func.count(Scan.id).label('count')
    ).filter(
        Scan.qr_code_id == qrcode_id,
        Scan.timestamp.between(start_date, end_date)
    ).group_by(
        func.date(Scan.timestamp)
    ).order_by(
        func.date(Scan.timestamp)
    ).all()
    formatted_daily_scans = [{'date': date.isoformat(), 'count': count} for date, count in daily_scans]
    return jsonify({
        'id': qrcode.id,
        'name': qrcode.name,
        'short_code': qrcode.short_code,
        'daily_scans': formatted_daily_scans,
        'time_range': {
            'start': start_date.isoformat(),
            'end': end_date.isoformat(),
            'group_by': 'day',
            'date_format': 'YYYY-MM-DD'
        }
    })
