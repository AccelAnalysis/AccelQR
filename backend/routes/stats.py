from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, QRCode, Scan, User
from datetime import datetime, timedelta
from sqlalchemy import func, and_, extract
from collections import defaultdict
import csv

bp = Blueprint('stats', __name__, url_prefix='/api/stats')

@bp.route('/dashboard', methods=['GET'])
@jwt_required()
def dashboard_stats():
    from flask import request
    # Parse start_date and end_date from query params
    date_format = '%Y-%m-%d'
    try:
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        if start_date_str and end_date_str:
            start_date = datetime.strptime(start_date_str, date_format)
            end_date = datetime.strptime(end_date_str, date_format)
        else:
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=30)
    except Exception:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)

    folder = request.args.get('folder')

    # Get daily scan counts (filtered by folder)
    if folder:
        daily_scans = db.session.query(
            func.date(Scan.timestamp).label('date'),
            func.count(Scan.id).label('count')
        ).join(QRCode, QRCode.id == Scan.qr_code_id).filter(
            QRCode.folder == folder,
            Scan.timestamp.between(start_date, end_date)
        ).group_by(
            func.date(Scan.timestamp)
        ).order_by(
            func.date(Scan.timestamp)
        ).all()
    else:
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

    # Get total scans (within range, optionally filtered by folder)
    if folder:
        total_scans = db.session.query(func.count(Scan.id)).join(QRCode, QRCode.id == Scan.qr_code_id).filter(
            QRCode.folder == folder,
            Scan.timestamp.between(start_date, end_date)
        ).scalar() or 0
    else:
        total_scans = db.session.query(func.count(Scan.id)).filter(
            Scan.timestamp.between(start_date, end_date)
        ).scalar() or 0

    # Get total QR codes (all time, optionally filtered by folder)
    if folder:
        total_qrcodes = db.session.query(func.count(QRCode.id)).filter(
            QRCode.folder == folder
        ).scalar() or 0
    else:
        total_qrcodes = db.session.query(func.count(QRCode.id)).scalar() or 0

    # Get top 5 most scanned QR codes (within range, optionally filtered by folder)
    if folder:
        top_qrcodes = (
            db.session.query(QRCode, func.count(Scan.id).label('scan_count'))
            .outerjoin(Scan, and_(QRCode.id == Scan.qr_code_id, Scan.timestamp.between(start_date, end_date)))
            .filter(QRCode.folder == folder)
            .group_by(QRCode.id)
            .order_by(func.count(Scan.id).desc())
            .limit(5)
            .all()
        )
    else:
        top_qrcodes = (
            db.session.query(QRCode, func.count(Scan.id).label('scan_count'))
            .outerjoin(Scan, and_(QRCode.id == Scan.qr_code_id, Scan.timestamp.between(start_date, end_date)))
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
