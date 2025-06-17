from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import QRCode
from extensions import db

bp = Blueprint('folders', __name__, url_prefix='/api/folders')

@bp.route('', methods=['GET'])
@jwt_required()
def get_folders():
    # Query all unique folder names from QRCode table, excluding None or empty
    folders = db.session.query(QRCode.folder).distinct().all()
    folder_list = sorted(set(f[0] for f in folders if f[0]))
    return jsonify(folder_list)

@bp.route('', methods=['POST'])
@jwt_required()
def create_folder():
    import logging
    logger = logging.getLogger("folders")
    data = request.get_json()
    logger.info(f"Incoming folder creation request: {data}")
    name = data.get('name') if data else None
    if not name or not isinstance(name, str):
        logger.warning("Folder name missing or invalid in request.")
        return jsonify({'msg': 'Folder name is required'}), 400
    # Check if folder already exists in any QR code
    exists = db.session.query(QRCode).filter(QRCode.folder == name).first()
    if exists:
        logger.info(f"Folder '{name}' already exists.")
        return jsonify({'msg': 'Folder already exists', 'name': name}), 200
    # No folder exists yet, so create a dummy QRCode to ensure the folder is registered
    current_user_id = get_jwt_identity()
    logger.info(f"Creating dummy QR for folder '{name}' with user_id {current_user_id}")
    dummy_qr = QRCode(
        name=f"Folder: {name} (placeholder)",
        target_url="https://example.com/folder-placeholder",
        short_code="folder" + name.replace(" ", "").lower()[:6],
        folder=name,
        user_id=current_user_id
    )
    db.session.add(dummy_qr)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to create dummy QR for folder '{name}': {e}")
        return jsonify({'msg': 'Failed to create folder', 'error': str(e)}), 500
    logger.info(f"Folder '{name}' created successfully with dummy QR id {dummy_qr.id}")
    return jsonify({'msg': 'Folder created', 'name': name, 'dummy_qrcode_id': dummy_qr.id}), 201
