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
    # Daily scans for all time
    daily_scans = db.session.query(
        func.date(Scan.timestamp).label('date'),
        func.count(Scan.id).label('count')
    ).filter(
        Scan.qr_code_id == qrcode_id
    ).group_by(
        func.date(Scan.timestamp)
    ).order_by(
        func.date(Scan.timestamp)
    ).all()
    formatted_daily_scans = [{'date': date.isoformat(), 'count': count} for date, count in daily_scans]

    # All-time scan list and aggregated stats
    scans = Scan.query.filter_by(qr_code_id=qrcode_id).all()
    scan_list = []
    from collections import defaultdict
    scans_by_country = defaultdict(int)
    scans_by_device = defaultdict(int)
    scans_by_os = defaultdict(int)
    scans_by_browser = defaultdict(int)
    scans_by_hour = defaultdict(int)
    scans_by_weekday = defaultdict(int)
    top_referrers = defaultdict(int)
    total_time = 0
    scroll_count = 0

    for scan in scans:
        # Raw scan data
        scan_list.append({
            'id': scan.id,
            'timestamp': scan.timestamp.isoformat() if scan.timestamp else None,
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
        })

        # Aggregations
        scans_by_country[scan.country or 'Unknown'] += 1
        scans_by_device[scan.device_type or 'Unknown'] += 1
        scans_by_os[scan.os_family or 'Unknown'] += 1
        scans_by_browser[scan.browser_family or 'Unknown'] += 1

        if scan.timestamp:
            scans_by_hour[scan.timestamp.hour] += 1
            weekday = scan.timestamp.isoweekday() % 7
            scans_by_weekday[weekday] += 1

        if scan.time_on_page is not None:
            total_time += scan.time_on_page
        if scan.scrolled:
            scroll_count += 1

        top_referrers[scan.referrer_domain or ''] += 1

    total_scans = len(scans)
    avg_time_on_page = round(total_time / total_scans, 2) if total_scans else 0
    scroll_rate = round((scroll_count / total_scans) * 100, 0) if total_scans else 0

    return jsonify({
        'id': qrcode.id,
        'name': qrcode.name,
        'short_code': qrcode.short_code,
        'daily_scans': formatted_daily_scans,
        'scans_by_country': dict(scans_by_country),
        'scans_by_device': dict(scans_by_device),
        'scans_by_os': dict(scans_by_os),
        'scans_by_browser': dict(scans_by_browser),
        'scans_by_hour': dict(scans_by_hour),
        'scans_by_weekday': dict(scans_by_weekday),
        'avg_time_on_page': avg_time_on_page,
        'scroll_rate': scroll_rate,
        'top_referrers': dict(top_referrers),
        'scans': scan_list,
        
    })
