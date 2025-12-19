from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import QRCode
from extensions import db
import uuid

bp = Blueprint('folders', __name__)

@bp.route('', methods=['GET'])
@jwt_required()
def get_folders():
    current_user_id = get_jwt_identity()
    if current_user_id is not None:
        current_user_id = int(current_user_id)
    # Query all unique folder names from QRCode table, excluding None or empty
    folders = db.session.query(QRCode.folder).filter(QRCode.user_id == current_user_id).distinct().all()
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
    current_user_id = get_jwt_identity()
    if current_user_id is not None:
        current_user_id = int(current_user_id)
    exists = db.session.query(QRCode).filter(
        QRCode.folder == name,
        QRCode.user_id == current_user_id
    ).first()
    if exists:
        logger.info(f"Folder '{name}' already exists.")
        return jsonify({'msg': 'Folder already exists', 'name': name}), 200
    # No folder exists yet, so create a dummy QRCode to ensure the folder is registered
    dummy_short_code = f"folder{uuid.uuid4().hex[:8]}"
    logger.info(f"Creating dummy QR for folder '{name}' with user_id {current_user_id}")
    dummy_qr = QRCode(
        name=f"Folder: {name} (placeholder)",
        target_url="https://example.com/folder-placeholder",
        short_code=dummy_short_code,
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


@bp.route('/<path:folder_name>', methods=['PUT'])
@jwt_required()
def rename_folder(folder_name):
    data = request.get_json() or {}
    new_name = data.get('name')
    if not new_name or not isinstance(new_name, str) or not new_name.strip():
        return jsonify({'error': 'Folder name is required'}), 400

    current_user_id = get_jwt_identity()
    if current_user_id is not None:
        current_user_id = int(current_user_id)

    updated_count = (db.session.query(QRCode)
        .filter(QRCode.folder == folder_name, QRCode.user_id == current_user_id)
        .update({QRCode.folder: new_name.strip()}, synchronize_session=False))

    if updated_count == 0:
        db.session.rollback()
        return jsonify({'error': 'Folder not found'}), 404

    db.session.commit()
    return jsonify({'msg': 'Folder renamed', 'old_name': folder_name, 'name': new_name.strip()}), 200


@bp.route('/<path:folder_name>', methods=['DELETE'])
@jwt_required()
def delete_folder(folder_name):
    current_user_id = get_jwt_identity()
    if current_user_id is not None:
        current_user_id = int(current_user_id)

    qrs = QRCode.query.filter_by(folder=folder_name, user_id=current_user_id).all()
    if not qrs:
        return jsonify({'error': 'Folder not found'}), 404

    for qr in qrs:
        db.session.delete(qr)
    db.session.commit()
    return jsonify({'msg': 'Folder deleted', 'name': folder_name}), 200
