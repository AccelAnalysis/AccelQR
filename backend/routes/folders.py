from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from models import db, QRCode

bp = Blueprint('folders', __name__, url_prefix='/api/folders')

@bp.route('', methods=['GET'])
@jwt_required()
def get_folders():
    # Query all unique folder names from QRCode table, excluding None or empty
    folders = db.session.query(QRCode.folder).distinct().all()
    folder_list = sorted(set(f[0] for f in folders if f[0]))
    return jsonify(folder_list)
