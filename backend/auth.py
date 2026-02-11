from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import exceptions as jwt_exceptions
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity, decode_token
from models import User, db
from werkzeug.security import check_password_hash, generate_password_hash
from functools import wraps
import os
from datetime import timedelta, datetime
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def _is_production_env() -> bool:
    flask_env = os.getenv('FLASK_ENV', '').lower()
    return flask_env == 'production' or (not flask_env and os.getenv('RENDER') is not None)

# Create auth blueprint
auth_bp = Blueprint('auth', __name__)

# --- JWT Error Handlers ---
from flask_jwt_extended import JWTManager

def register_jwt_error_handlers(app):
    @app.errorhandler(jwt_exceptions.NoAuthorizationError)
    def handle_no_auth_error(e):
        logger.error(f"NoAuthorizationError: {str(e)}")
        return jsonify({"msg": "Missing Authorization Header"}), 401

    @app.errorhandler(jwt_exceptions.InvalidHeaderError)
    def handle_invalid_header(e):
        import traceback
        from flask import request
        logger.error(f"InvalidHeaderError: {str(e)}\n{traceback.format_exc()}")
        return jsonify({"msg": "Invalid Authorization Header"}), 422

    @app.errorhandler(jwt_exceptions.WrongTokenError)
    def handle_wrong_token(e):
        import traceback
        from flask import request
        logger.error(f"WrongTokenError: {str(e)}\n{traceback.format_exc()}")
        return jsonify({"msg": "Wrong token type"}), 422

    @app.errorhandler(jwt_exceptions.RevokedTokenError)
    def handle_revoked_token(e):
        logger.error(f"RevokedTokenError: {str(e)}")
        return jsonify({"msg": "Token has been revoked"}), 401

    @app.errorhandler(jwt_exceptions.FreshTokenRequired)
    def handle_fresh_token_required(e):
        logger.error(f"FreshTokenRequired: {str(e)}")
        return jsonify({"msg": "Fresh token required"}), 401

    # Register expired token handler for Flask-JWT-Extended 4.x
    from extensions import jwt
    @jwt.expired_token_loader
    def my_expired_token_callback(jwt_header, jwt_payload):
        logger.error("Token has expired")
        return jsonify({"msg": "Token has expired"}), 401

    @app.errorhandler(jwt_exceptions.JWTDecodeError)
    def handle_jwt_decode_error(e):
        import traceback
        from flask import request
        logger.error(f"JWTDecodeError: {str(e)}\n{traceback.format_exc()}")
        return jsonify({"msg": "Malformed token"}), 422

    @app.errorhandler(jwt_exceptions.CSRFError)
    def handle_csrf_error(e):
        logger.error(f"CSRFError: {str(e)}")
        return jsonify({"msg": "CSRF error"}), 401


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        if not user or not user.is_admin:
            return jsonify({"msg": "Admin access required"}), 403
        return fn(*args, **kwargs)
    return wrapper

@auth_bp.route('/register', methods=['POST'])
def register():
    if _is_production_env():
        return jsonify({"msg": "Not found"}), 404
    data = request.get_json()
    
    # Validate input
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({"msg": "Email and password are required"}), 400
    
    # Check if user already exists
    if User.query.filter_by(email=data['email']).first():
        return jsonify({"msg": "Email already registered"}), 400
    
    # Create new user
    user = User(
        email=data['email'],
        is_admin=not User.query.first()  # First user is admin
    )
    user.set_password(data['password'])
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify({"msg": "User created successfully"}), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        
        if not data or not data.get('email') or not data.get('password'):
            return jsonify({"msg": "Email and password are required"}), 400

        user = User.query.filter_by(email=data['email']).first()
        
        if not user:
            return jsonify({"msg": "Invalid email or password"}), 401

        if not user.check_password(data['password']):
            return jsonify({"msg": "Invalid email or password"}), 401

        access_token = create_access_token(identity=str(user.id))
        refresh_token = create_refresh_token(identity=str(user.id))

        return jsonify({
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": {"id": user.id, "email": user.email, "is_admin": user.is_admin}
        }), 200
            
    except Exception as e:
        logger.error("Error during login", exc_info=True)
        return jsonify({"msg": "An error occurred during login"}), 500

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    current_user_id = get_jwt_identity()
    # Ensure identity is a string
    new_token = create_access_token(identity=str(current_user_id))
    return jsonify({"access_token": new_token}), 200

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    try:
        current_user_id = get_jwt_identity()
        logger.info(f"/me endpoint: JWT identity is {current_user_id}")
        user = User.query.get(current_user_id)
        if not user:
            logger.warning("/me endpoint: User not found for id %s", current_user_id)
            return jsonify({"msg": "User not found"}), 404
        logger.info(f"/me endpoint: Returning user {user.email}")
        return jsonify({
            "id": user.id,
            "email": user.email,
            "is_admin": user.is_admin
        }), 200
    except Exception as e:
        logger.error(f"/me endpoint error: {str(e)}", exc_info=True)
        return jsonify({"msg": "Internal server error"}), 500

