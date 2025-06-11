from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity, decode_token
from models import User, db
from werkzeug.security import check_password_hash, generate_password_hash
from functools import wraps
import os
from datetime import timedelta, datetime
import logging
from pathlib import Path

# Configure logging
log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'logs')
os.makedirs(log_dir, exist_ok=True)
log_file = os.path.join(log_dir, f'auth_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log')

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# Create auth blueprint
auth_bp = Blueprint('auth', __name__)

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
        
        # Get the database path from the app config
        db_path = current_app.config.get('DATABASE_PATH')
        db_uri = current_app.config.get('SQLALCHEMY_DATABASE_URI')
        
        print(f"Database URI from config: {db_uri}")
        print(f"Database path from config: {db_path}")
        
        # Verify database connection
        if not db_path or not db_uri:
            print("Error: Database configuration not properly set in app config")
            return jsonify({"msg": "Server configuration error"}), 500
            
        # Check if the database file exists
        if not os.path.exists(db_path):
            print(f"Error: Database file not found at {db_path}")
            return jsonify({"msg": f"Database not found at {db_path}"}), 500
        
        # Debug: List all users in the database
        try:
            print("\nDebug: Listing all users in the database:")
            all_users = User.query.all()
            for u in all_users:
                print(f"- {u.id}: {u.email} (admin: {u.is_admin})")
        except Exception as e:
            print(f"Error listing users: {e}")
        
        # Get user from database
        print(f"\nAttempting to find user with email: {data['email']}")
        
        # Debug: Print all users in the database
        all_users = User.query.all()
        print("All users in database:")
        for u in all_users:
            print(f"- {u.id}: {u.email} (admin: {u.is_admin})")
        
        user = User.query.filter_by(email=data['email']).first()
        
        if not user:
            print(f"No user found with email: {data['email']}")
            return jsonify({"msg": "Invalid email or password"}), 401
            
        print(f"User found: {user.email}, checking password...")
        
        # Verify password
        print(f"\n=== DEBUG: Password Check ===")
        print(f"Stored password hash: {user.password_hash}")
        print(f"Checking password for user: {user.email}")
        print(f"Password being checked: {data['password']}")
        print(f"User's check_password method: {user.check_password}")
        
        # Verify password using the model's check_password method
        print(f"\n=== Password Check ===")
        print(f"Stored password hash: {user.password_hash}")
        
        # Check if password is correct
        if not user.check_password(data['password']):
            print("Password validation failed")
            return jsonify({"msg": "Invalid email or password"}), 401
            
        print("\n=== Authentication Succeeded ===")
            
        logger.info(f"Creating tokens for user {user.id}")
        access_token = create_access_token(identity=str(user.id))
        refresh_token = create_refresh_token(identity=str(user.id))
        
        logger.info(f"Login successful for user {user.id}")
        return jsonify({
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": {"id": user.id, "email": user.email, "is_admin": user.is_admin}
        }), 200
        
    except Exception as e:
        logger.error(f"Error during login: {str(e)}", exc_info=True)
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
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({"msg": "User not found"}), 404
    
    return jsonify({
        "id": user.id,
        "email": user.email,
        "is_admin": user.is_admin
    }), 200
