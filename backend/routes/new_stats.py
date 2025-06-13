from flask import Blueprint, jsonify, request, Response
from flask_jwt_extended import jwt_required
from models import db, QRCode, Scan
from datetime import datetime, timedelta
import csv

bp = Blueprint('new_stats', __name__, url_prefix='/api/newstats')

@bp.route('/qrcode/<int:qrcode_id>/quickstats', methods=['GET'])
@jwt_required()
def quick_qrcode_stats(qrcode_id):
    qrcode = QRCode.query.get_or_404(qrcode_id)
    scans = Scan.query.filter_by(qr_code_id=qrcode_id).order_by(Scan.timestamp.desc()).all()
    scan_data = [
        {
            'scan_id': scan.id,
            'timestamp': scan.timestamp.isoformat(),
            'ip_address': scan.ip_address,
            'country': scan.country,
            'city': scan.city,
            'device_type': scan.device_type,
            'scan_method': scan.scan_method,
        }
        for scan in scans
    ]
    return jsonify({
        'qr_code': {
            'id': qrcode.id,
            'name': qrcode.name,
            'short_code': qrcode.short_code,
            'created_at': qrcode.created_at.isoformat() if qrcode.created_at else None,
        },
        'scans': scan_data
    })

@bp.route('/export', methods=['GET'])
@jwt_required()
def export_all_scans_new():
    scans = db.session.query(
        Scan.id,
        Scan.qr_code_id,
        QRCode.name.label('qr_name'),
        Scan.timestamp,
        Scan.ip_address,
        Scan.country,
        Scan.city,
        Scan.device_type,
        Scan.scan_method
    ).join(QRCode, QRCode.id == Scan.qr_code_id).order_by(Scan.timestamp.desc()).all()

    def generate():
        header = ['scan_id', 'qr_code_id', 'qr_name', 'timestamp', 'ip_address', 'country', 'city', 'device_type', 'scan_method']
        yield ','.join(header) + '\n'
        for row in scans:
            values = [str(getattr(row, col, '')) if getattr(row, col, '') is not None else '' for col in header]
            yield ','.join('"' + v.replace('"', '""') + '"' if ',' in v or '"' in v else v for v in values) + '\n'
    return Response(generate(), mimetype='text/csv', headers={
        'Content-Disposition': f'attachment; filename="qr_scans_export_{datetime.utcnow().date()}.csv"'
    })

@bp.route('/folders', methods=['POST'])
@jwt_required()
def create_folder_new():
    data = request.get_json()
    folder_name = data.get('name')
    if not folder_name:
        return jsonify({'error': 'Folder name required'}), 400
    # Check if folder exists
    exists = db.session.query(QRCode.folder).filter(QRCode.folder == folder_name).first()
    if exists:
        return jsonify({'error': 'Folder already exists'}), 400
    # Create a dummy QR code to ensure folder is registered (if your model needs it)
    # Otherwise, implement a Folder model and save it here
    return jsonify({'message': f'Folder "{folder_name}" created (dummy action).'}), 201
