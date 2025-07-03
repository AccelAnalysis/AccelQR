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

# Flexible endpoint to fetch QR code by id or short_code
import logging

@bp.route('/flex/<identifier>', methods=['GET'])
@jwt_required()
def get_qrcode_flexible(identifier):
    try:
        logging.info(f"[flex] Requested identifier: {identifier}")
        qrcode = QRCode.query.filter_by(short_code=identifier).first()
        if not qrcode and identifier.isdigit():
            qrcode = QRCode.query.get(identifier)
        if not qrcode:
            logging.warning(f"[flex] QR code not found for identifier: {identifier}")
            return jsonify({'msg': 'QR code not found'}), 404

        logging.info(f"[flex] Found QR code: id={qrcode.id}, short_code={qrcode.short_code}, name={qrcode.name}")
        # Generate QR code image as base64
        from io import BytesIO
        import qrcode as qrcode_lib
        import base64
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
        # Robustly ensure img is a true PIL Image before saving
        if hasattr(img, "get_image"):
            img = img.get_image()
        elif hasattr(img, "to_image"):
            img = img.to_image()
        elif not hasattr(img, "save"):
            logging.error(f"QR make_image returned unexpected type: {type(img)}")
            raise TypeError(f"QR make_image returned unexpected type: {type(img)}")
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()

        scan_dicts = []
        for scan in qrcode.scans:
            try:
                scan_info = {
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
                }
                scan_dicts.append(scan_info)
            except Exception as scan_exc:
                logging.error(f"[flex] Error serializing scan (id={getattr(scan, 'id', None)}): {scan_exc}")
        logging.info(f"[flex] Returning {len(scan_dicts)} scans for QR code id={qrcode.id}")

        return jsonify({
            'id': qrcode.id,
            'name': qrcode.name,
            'short_code': qrcode.short_code,
            'qr_code_image': f"data:image/png;base64,{img_str}",

            'target_url': qrcode.target_url,
            'created_at': qrcode.created_at.isoformat() if qrcode.created_at else None,
            'scans': scan_dicts,
            'short_url': f"{request.host_url}r/{qrcode.short_code}"
        })
    except Exception as exc:
        logging.error(f"[flex] Unhandled error for identifier {identifier}: {exc}", exc_info=True)
        return jsonify({'msg': f'Internal server error: {exc}'}), 500

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
    # Robustly ensure img is a true PIL Image before saving
    if hasattr(img, "get_image"):
        img = img.get_image()
    elif hasattr(img, "to_image"):
        img = img.to_image()
    elif not hasattr(img, "save"):
        import logging
        logging.error(f"QR make_image returned unexpected type: {type(img)}")
        raise TypeError(f"QR make_image returned unexpected type: {type(img)}")
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

@bp.route('/scans-csv/<short_code>', methods=['GET'])
def download_scans_csv_by_short_code(short_code):
    import csv
    from io import StringIO
    from flask import Response
    qrcode = QRCode.query.filter_by(short_code=short_code).first_or_404()
    scans = qrcode.scans
    output = StringIO()
    writer = csv.writer(output)
    # Write header
    writer.writerow([
        'id', 'timestamp', 'ip_address', 'user_agent', 'country', 'region', 'city',
        'device_type', 'os_family', 'browser_family', 'referrer_domain', 'time_on_page', 'scrolled', 'scan_method'
    ])
    for scan in scans:
        writer.writerow([
            scan.id,
            scan.timestamp.isoformat() if scan.timestamp else '',
            scan.ip_address,
            scan.user_agent,
            scan.country,
            scan.region,
            scan.city,
            scan.device_type,
            scan.os_family,
            scan.browser_family,
            scan.referrer_domain,
            scan.time_on_page,
            scan.scrolled,
            scan.scan_method,
        ])
    output.seek(0)
    return Response(
        output,
        mimetype='text/csv',
        headers={
            'Content-Disposition': f'attachment; filename=scans_{short_code}.csv'
        }
    )

@bp.route('/image-by-shortcode/<short_code>', methods=['GET'])
def get_qr_image_by_short_code(short_code):
    from io import BytesIO
    import qrcode as qrcode_lib
    from flask import send_file
    qrcode = QRCode.query.filter_by(short_code=short_code).first_or_404()
    qr = qrcode_lib.QRCode(
        version=1,
        error_correction=qrcode_lib.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(qrcode.target_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    # Robust PIL Image conversion
    if hasattr(img, "get_image"):
        img = img.get_image()
    elif hasattr(img, "to_image"):
        img = img.to_image()
    elif not hasattr(img, "save"):
        import logging
        logging.error(f"QR make_image returned unexpected type: {type(img)}")
        raise TypeError(f"QR make_image returned unexpected type: {type(img)}")
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    buffered.seek(0)
    return send_file(buffered, mimetype='image/png')

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
