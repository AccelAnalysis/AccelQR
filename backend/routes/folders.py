from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from models import QRCode

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
    data = request.get_json()
    name = data.get('name') if data else None
    if not name or not isinstance(name, str):
        return jsonify({'msg': 'Folder name is required'}), 400
    # Check if folder already exists in any QR code
    exists = db.session.query(QRCode).filter(QRCode.folder == name).first()
    if exists:
        return jsonify({'msg': 'Folder already exists', 'name': name}), 200
    # No folder exists yet, but since folders are just labels, we "create" it by returning success
    return jsonify({'msg': 'Folder created', 'name': name}), 201
