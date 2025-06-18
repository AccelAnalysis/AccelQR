from flask import Blueprint, request, jsonify, current_app
from werkzeug.security import generate_password_hash, check_password_hash
from models import db, User
from flask_jwt_extended import (
    create_access_token, 
    jwt_required, 
    get_jwt_identity,
    create_refresh_token,
    get_jwt
)
import os

bp = Blueprint('auth', __name__)

@bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({"msg": "Email and password are required"}), 400
    
    # Check if admin user exists, if not create one
    admin_email = os.getenv('ADMIN_EMAIL', 'admin@example.com')
    admin_password = os.getenv('ADMIN_PASSWORD', 'admin123')
    
    user = User.query.filter_by(email=admin_email).first()
    
    if not user:
        # Create admin user if not exists
        user = User(email=admin_email, is_admin=True)
        user.set_password(admin_password)
        db.session.add(user)
        db.session.commit()
    
    if not user.check_password(password):
        return jsonify({"msg": "Invalid email or password"}), 401
    
    # Create tokens
    access_token = create_access_token(identity=user.id)
    refresh_token = create_refresh_token(identity=user.id)
    
    return jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": user.to_dict()
    }), 200

@bp.route('/api/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    current_user_id = get_jwt_identity()
    new_token = create_access_token(identity=current_user_id)
    return jsonify({"access_token": new_token}), 200

@bp.route('/api/me', methods=['GET'])
@jwt_required()
def get_current_user():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404
    return jsonify(user.to_dict())

@bp.route('/api/logout', methods=['POST'])
@jwt_required()
def logout():
    # In a real app, you might want to add the token to a blacklist
    return jsonify({"msg": "Successfully logged out"}), 200
