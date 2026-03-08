from flask import Blueprint, jsonify, request, send_file, current_app
from flask_login import current_user, login_required
from app.models.quiz import Quiz, Question
from app.models.subject import Subject, Chapter
from app.models.score import Score
from app.extensions import db, cache
from app.tasks import export_user_data
import os
from app.models.user import Notification

user_bp = Blueprint('user', __name__, url_prefix='/api/user')

@user_bp.route('/quizzes', methods=['GET'])
@login_required
@cache.cached(timeout=60, key_prefix='user_quizzes')
def get_available_quizzes():
    print("Fetching Quizzes from Database...")
    quizzes = Quiz.query.all()
    output = []
    for q in quizzes:
        chapter = db.session.get(Chapter, q.chapter_id)
        subject = db.session.get(Subject, chapter.subject_id)
        output.append({
            'id': q.id,
            'subject_name': subject.name,
            'chapter_name': chapter.name,
            'date_of_quiz': q.date_of_quiz,
            'time_duration': q.time_duration,
            'remarks': q.remarks,
            'question_count': len(q.questions)
        })
    return jsonify(output), 200

# --- PLAY QUIZ ENDPOINTS ---

@user_bp.route('/quiz/<int:quiz_id>', methods=['GET'])
@login_required
def get_quiz_for_play(quiz_id):
    quiz = db.session.get(Quiz, quiz_id)
    if not quiz:
        return jsonify({'message': 'Quiz not found'}), 404
        
    questions = Question.query.filter_by(quiz_id=quiz_id).all()
    
    # Send questions BUT hide the 'correct_option'
    q_list = []
    for q in questions:
        q_data = q.to_dict()
        if 'correct_option' in q_data:
            del q_data['correct_option'] # IMPORTANT: Remove answer so users can't cheat
        q_list.append(q_data)
        
    return jsonify({'quiz': quiz.to_dict(), 'questions': q_list}), 200

@user_bp.route('/quiz/<int:quiz_id>/submit', methods=['POST'])
@login_required
def submit_quiz(quiz_id):
    # --- NEW SECURITY: Prevent double submissions ---
    existing_score = Score.query.filter_by(user_id=current_user.id, quiz_id=quiz_id).first()
    if existing_score:
        return jsonify({'message': 'You have already submitted this quiz!'}), 400

    data = request.get_json() # { 'question_id': selected_option_int, ... }
    answers = data.get('answers', {})
    
    questions = Question.query.filter_by(quiz_id=quiz_id).all()
    score = 0
    total = len(questions)
    
    for q in questions:
        # Check if user answered this question
        user_ans = answers.get(str(q.id)) # JSON keys are strings
        if user_ans and int(user_ans) == q.correct_option:
            score += 1
            
    # Save Score (CRITICAL FIX: Passing total_questions so SQLite doesn't crash)
    new_score = Score(
        user_id=current_user.id,
        quiz_id=quiz_id,
        total_scored=score,
        total_questions=total
    )
    
    try:
        db.session.add(new_score)
        db.session.commit()
        
        # Clear cache when a user submits so their dashboard updates immediately
        cache.delete('user_quizzes')
        
        return jsonify({
            'message': 'Quiz Submitted!',
            'score': score,
            'total': total
        }), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error submitting quiz: {e}")
        return jsonify({'message': 'Database error during submission'}), 500

@user_bp.route('/scores', methods=['GET'])
@login_required
def get_user_scores():
    # Fetch scores for current user, newest first
    scores = Score.query.filter_by(user_id=current_user.id).order_by(Score.timestamp.desc()).all()
    
    output = []
    for s in scores:
        # We need to fetch related names to make it readable
        quiz = db.session.get(Quiz, s.quiz_id)
        if quiz:
            chapter = db.session.get(Chapter, quiz.chapter_id)
            subject = db.session.get(Subject, chapter.subject_id)
            
            output.append({
                'id': s.id,
                'quiz_id': s.quiz_id, # <--- THE CRITICAL FIX FOR FRONTEND FILTERING
                'subject_name': subject.name,
                'chapter_name': chapter.name,
                'quiz_remarks': quiz.remarks,
                'score': s.total_scored,
                'total_questions': s.total_questions,
                'timestamp': s.timestamp.strftime('%Y-%m-%d %H:%M')
            })
            
    return jsonify(output), 200

# --- DATA EXPORT ENDPOINTS ---

@user_bp.route('/export', methods=['POST'])
@login_required
def export_data():
    # We don't wait for this! We just tell Celery to start.
    job = export_user_data.delay(current_user.id)
    
    return jsonify({
        'message': 'Export started! You will be notified when done.',
        'job_id': job.id
    }), 202

@user_bp.route('/download-csv/<job_id>', methods=['GET'])
@login_required
def download_csv(job_id):
    # Retrieve the file created by Celery in app/static/exports/
    filename = f"user_{current_user.id}_report.csv"
    filepath = os.path.join(current_app.root_path, 'static', 'exports', filename)
    
    if os.path.exists(filepath):
        return send_file(filepath, as_attachment=True)
    else:
        return jsonify({'message': 'File not ready yet. Please try again in a few seconds.'}), 404

# --- USER PROFILE & SETTINGS ---

@user_bp.route('/profile', methods=['GET', 'PUT'])
@login_required
def user_profile():
    if request.method == 'GET':
        return jsonify({
            'full_name': current_user.full_name,
            'email': current_user.email,
            'qualification': current_user.qualification,
            'dob': current_user.dob,
            'created_at': current_user.created_at.strftime('%Y-%m-%d') if current_user.created_at else '2000-01-01'
        }), 200
        
    data = request.get_json()
    
    # Update regular details
    current_user.full_name = data.get('full_name', current_user.full_name)
    current_user.qualification = data.get('qualification', current_user.qualification)
    current_user.dob = data.get('dob', current_user.dob)
    
    # Secure Password Update
    new_password = data.get('new_password')
    if new_password:
        current_user.set_password(new_password)
        
    db.session.commit()
    
    # Update Vue's cache of the user's name
    return jsonify({
        'message': 'Profile updated successfully',
        'full_name': current_user.full_name,
        'qualification': current_user.qualification
    }), 200

@user_bp.route('/notifications', methods=['GET'])
@login_required
def get_notifications():
    # FIX: Students ONLY see their personalized notifications now
    notifs = Notification.query.filter_by(user_id=current_user.id).order_by(Notification.timestamp.desc()).limit(10).all()
    return jsonify([n.to_dict() for n in notifs]), 200