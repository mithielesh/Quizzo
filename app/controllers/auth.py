from flask import Blueprint, request, jsonify
from flask_login import login_user, logout_user, current_user, login_required
import sqlalchemy as sa
from app.extensions import db
from app.models.user import User
from datetime import datetime

bp = Blueprint("auth", __name__, url_prefix='/api/auth')

@bp.route("/login", methods=["POST"])
def login():
    # 1. Get JSON data from VueJS
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'message': 'Email and Password required'}), 400

    # 2. Use your SQLAlchemy 2.0 syntax
    user = db.session.scalar(sa.select(User).where(User.email == email))

    # 3. Validation
    if user is None or not user.check_password(password):
        return jsonify({'message': 'Invalid credentials'}), 401

    # 4. Log user in (Creates Session Cookie)
    login_user(user)

    # 5. Return JSON (VueJS will handle the redirect)
    return jsonify({
        'message': 'Login Successful',
        'user': {
            'id': user.id,
            'email': user.email,
            'role': user.role,
            # --- NEW: Send Personal Details for Dashboard ---
            'full_name': user.full_name,
            'qualification': user.qualification,
            'dob': user.dob,
            'token': 'session_active' # Frontend expects a token field to stay logged in
        }
    }), 200

@bp.route("/logout", methods=["POST"])
@login_required
def logout():
    logout_user()
    return jsonify({'message': 'Logged out successfully'}), 200

@bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    full_name = data.get('full_name', '')
    qualification = data.get('qualification', '')
    dob = data.get('dob', '') # HTML date pickers send 'YYYY-MM-DD' strings

    if not email or not password:
        return jsonify({'message': 'Email and password are required'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'message': 'User already exists'}), 400

    # Create User using strings to match the db.String(20) model
    new_user = User(
        email=email, 
        role='user',
        full_name=full_name,
        qualification=qualification,
        dob=str(dob) # FIX: Keep as string, do not use strptime
    )
    new_user.set_password(password)
    
    try:
        db.session.add(new_user)
        db.session.commit()
        # Now to_dict() will work because we added it to the model
        return jsonify({'message': 'User created successfully', 'user': new_user.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        print(f"Registration Error: {e}")
        return jsonify({'message': 'Registration failed'}), 500

@bp.route("/check", methods=["GET"])
def check_auth():
    """Helper for Vue to check status on refresh"""
    if current_user.is_authenticated:
        return jsonify({
            'is_authenticated': True, 
            'role': current_user.role, 
            'email': current_user.email,
            'full_name': current_user.full_name # Return name on refresh
        })
    return jsonify({'is_authenticated': False}), 200