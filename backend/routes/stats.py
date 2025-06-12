from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, QRCode, Scan, User
from datetime import datetime, timedelta
from sqlalchemy import func, and_, extract
from collections import defaultdict

bp = Blueprint('stats', __name__, url_prefix='/api/stats')

@bp.route('/dashboard', methods=['GET'])
@jwt_required()
def dashboard_stats():
    # Get date range for last 30 days
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=30)
    
    # Get daily scan counts
    daily_scans = db.session.query(
        func.date(Scan.timestamp).label('date'),
        func.count(Scan.id).label('count')
    ).filter(
        Scan.timestamp.between(start_date, end_date)
    ).group_by(
        func.date(Scan.timestamp)
    ).order_by(
        func.date(Scan.timestamp)
    ).all()
    
    # Format daily scans for the frontend
    formatted_daily_scans = [
        {'date': date.isoformat(), 'count': count}
        for date, count in daily_scans
    ]
    
    # Get total scans
    total_scans = db.session.query(func.count(Scan.id)).scalar() or 0
    
    # Get total QR codes
    total_qrcodes = db.session.query(func.count(QRCode.id)).scalar() or 0
    
    # Get top 5 most scanned QR codes
    top_qrcodes = (
        db.session.query(QRCode, func.count(Scan.id).label('scan_count'))
        .outerjoin(Scan, QRCode.id == Scan.qr_code_id)
        .group_by(QRCode.id)
        .order_by(func.count(Scan.id).desc())
        .limit(5)
        .all()
    )

    formatted_top_qrcodes = [
        {
            'id': qr.id,
            'name': qr.name,
            'scan_count': scan_count,
            'short_code': qr.short_code
        }
        for qr, scan_count in top_qrcodes
    ]
    
    return jsonify({
        'scans': formatted_daily_scans,
        'total_scans': total_scans,
        'total_qrcodes': total_qrcodes,
        'top_qrcodes': formatted_top_qrcodes,
        'time_range': {
            'start': start_date.isoformat(),
            'end': end_date.isoformat(),
            'group_by': 'day',
            'date_format': 'YYYY-MM-DD'
        }
    })
