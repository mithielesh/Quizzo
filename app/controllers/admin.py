from flask import Blueprint, request, jsonify
from app.models.subject import Subject
from app.models.subject import Chapter
from app.models.quiz import Quiz, Question
from app.models.user import User
from app.models.score import Score
from app.extensions import db, cache
from datetime import datetime
import sqlalchemy as sa

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

# =====================================================
# 1. CONTENT MANAGEMENT (CRUD + DELETE + UPDATE)
# =====================================================

# --- SUBJECTS ---
@admin_bp.route('/subjects', methods=['GET'])
def get_subjects():
    subjects = Subject.query.all()
    return jsonify([sub.to_dict() for sub in subjects]), 200

@admin_bp.route('/subjects', methods=['POST'])
def create_subject():
    data = request.get_json()
    name = data.get('name')
    description = data.get('description')

    if not name: return jsonify({'message': 'Name required'}), 400
    if Subject.query.filter_by(name=name).first(): return jsonify({'message': 'Exists'}), 400

    new_subject = Subject(name=name, description=description)
    try:
        db.session.add(new_subject)
        db.session.commit()
        return jsonify({'message': 'Created', 'subject': new_subject.to_dict()}), 201
    except:
        db.session.rollback()
        return jsonify({'message': 'DB Error'}), 500

@admin_bp.route('/subjects/<int:id>', methods=['PUT'])
def update_subject(id):
    subject = db.session.get(Subject, id)
    if not subject: return jsonify({'message': 'Not found'}), 404
    data = request.get_json()
    subject.name = data.get('name', subject.name)
    subject.description = data.get('description', subject.description)
    db.session.commit()
    return jsonify({'message': 'Subject updated'}), 200

@admin_bp.route('/subjects/<int:id>', methods=['DELETE'])
def delete_subject(id):
    subject = db.session.get(Subject, id)
    if not subject: return jsonify({'message': 'Not found'}), 404
    
    # Bottom-Up Cascade Delete
    chapters = Chapter.query.filter_by(subject_id=id).all()
    for c in chapters:
        quizzes = Quiz.query.filter_by(chapter_id=c.id).all()
        for q in quizzes:
            Score.query.filter_by(quiz_id=q.id).delete()
            Question.query.filter_by(quiz_id=q.id).delete()
            db.session.delete(q)
        db.session.delete(c)
        
    db.session.delete(subject)
    db.session.commit()
    cache.delete('user_quizzes')
    return jsonify({'message': 'Subject deleted'}), 200

# --- CHAPTERS ---
@admin_bp.route('/subjects/<int:subject_id>/chapters', methods=['GET'])
def get_chapters(subject_id):
    chapters = Chapter.query.filter_by(subject_id=subject_id).all()
    return jsonify([chap.to_dict() for chap in chapters]), 200

@admin_bp.route('/subjects/<int:subject_id>/chapters', methods=['POST'])
def create_chapter(subject_id):
    data = request.get_json()
    new_chapter = Chapter(subject_id=subject_id, name=data.get('name'), description=data.get('description'))
    db.session.add(new_chapter)
    db.session.commit()
    return jsonify({'message': 'Created', 'chapter': new_chapter.to_dict()}), 201

@admin_bp.route('/chapters/<int:id>', methods=['PUT'])
def update_chapter(id):
    chapter = db.session.get(Chapter, id)
    if not chapter: return jsonify({'message': 'Not found'}), 404
    data = request.get_json()
    chapter.name = data.get('name', chapter.name)
    chapter.description = data.get('description', chapter.description)
    db.session.commit()
    return jsonify({'message': 'Chapter updated'}), 200

@admin_bp.route('/chapters/<int:id>', methods=['DELETE'])
def delete_chapter(id):
    chapter = db.session.get(Chapter, id)
    if not chapter: return jsonify({'message': 'Not found'}), 404
    
    # Bottom-Up Cascade Delete
    quizzes = Quiz.query.filter_by(chapter_id=id).all()
    for q in quizzes:
        Score.query.filter_by(quiz_id=q.id).delete()
        Question.query.filter_by(quiz_id=q.id).delete()
        db.session.delete(q)
        
    db.session.delete(chapter)
    db.session.commit()
    cache.delete('user_quizzes')
    return jsonify({'message': 'Chapter deleted'}), 200

# --- QUIZZES ---
@admin_bp.route('/chapters/<int:chapter_id>/quizzes', methods=['GET'])
def get_quizzes(chapter_id):
    quizzes = Quiz.query.filter_by(chapter_id=chapter_id).all()
    return jsonify([q.to_dict() for q in quizzes]), 200

@admin_bp.route('/chapters/<int:chapter_id>/quizzes', methods=['POST'])
def create_quiz(chapter_id):
    data = request.get_json()
    new_quiz = Quiz(
        chapter_id=chapter_id,
        date_of_quiz=data.get('date_of_quiz'),
        time_duration=data.get('time_duration'),
        remarks=data.get('remarks')
    )
    db.session.add(new_quiz)
    db.session.commit()
    cache.delete('user_quizzes')
    return jsonify({'message': 'Created', 'quiz': new_quiz.to_dict()}), 201

@admin_bp.route('/quizzes/<int:id>', methods=['PUT'])
def update_quiz(id):
    quiz = db.session.get(Quiz, id)
    if not quiz: return jsonify({'message': 'Not found'}), 404
    data = request.get_json()
    quiz.remarks = data.get('remarks', quiz.remarks)
    quiz.date_of_quiz = data.get('date_of_quiz', quiz.date_of_quiz)
    quiz.time_duration = data.get('time_duration', quiz.time_duration)
    db.session.commit()
    cache.delete('user_quizzes')
    return jsonify({'message': 'Quiz updated'}), 200

@admin_bp.route('/quizzes/<int:id>', methods=['DELETE'])
def delete_quiz(id):
    quiz = db.session.get(Quiz, id)
    if not quiz: return jsonify({'message': 'Not found'}), 404
    
    # Bottom-Up Cascade Delete
    Score.query.filter_by(quiz_id=id).delete()
    Question.query.filter_by(quiz_id=id).delete()
    
    db.session.delete(quiz)
    db.session.commit()
    cache.delete('user_quizzes')
    return jsonify({'message': 'Quiz deleted'}), 200

# --- QUESTIONS ---
@admin_bp.route('/quizzes/<int:quiz_id>/questions', methods=['GET'])
def get_questions(quiz_id):
    questions = Question.query.filter_by(quiz_id=quiz_id).all()
    return jsonify([q.to_dict() for q in questions]), 200

@admin_bp.route('/quizzes/<int:quiz_id>/questions', methods=['POST'])
def create_question(quiz_id):
    data = request.get_json()
    new_question = Question(
        quiz_id=quiz_id,
        question_statement=data.get('question_statement'),
        option1=data.get('option1'),
        option2=data.get('option2'),
        option3=data.get('option3'),
        option4=data.get('option4'),
        correct_option=int(data.get('correct_option'))
    )
    db.session.add(new_question)
    db.session.commit()
    cache.delete('user_quizzes')
    return jsonify({'message': 'Created', 'question': new_question.to_dict()}), 201

@admin_bp.route('/questions/<int:id>', methods=['PUT'])
def update_question(id):
    question = db.session.get(Question, id)
    if not question: return jsonify({'message': 'Not found'}), 404
    data = request.get_json()
    question.question_statement = data.get('question_statement', question.question_statement)
    question.option1 = data.get('option1', question.option1)
    question.option2 = data.get('option2', question.option2)
    question.option3 = data.get('option3', question.option3)
    question.option4 = data.get('option4', question.option4)
    if data.get('correct_option'):
        question.correct_option = int(data.get('correct_option'))
    db.session.commit()
    cache.delete('user_quizzes')
    return jsonify({'message': 'Question updated'}), 200

@admin_bp.route('/questions/<int:id>', methods=['DELETE'])
def delete_question(id):
    question = db.session.get(Question, id)
    if not question: return jsonify({'message': 'Not found'}), 404
    db.session.delete(question)
    db.session.commit()
    cache.delete('user_quizzes')
    return jsonify({'message': 'Question deleted'}), 200


# --- STUDENTS (UPDATE & DELETE) ---
@admin_bp.route('/students/<int:id>', methods=['PUT'])
def update_student(id):
    student = db.session.get(User, id)
    if not student or student.role != 'user': 
        return jsonify({'message': 'Student not found'}), 404
        
    data = request.get_json()
    student.full_name = data.get('full_name', student.full_name)
    student.email = data.get('email', student.email)
    student.qualification = data.get('qualification', student.qualification)
    
    dob_str = data.get('dob')
    if dob_str:
        try:
            student.dob = datetime.strptime(dob_str, '%Y-%m-%d').date()
        except ValueError:
            pass 
            
    db.session.commit()
    return jsonify({'message': 'Student details updated'}), 200

@admin_bp.route('/students/<int:id>', methods=['DELETE'])
def delete_student(id):
    student = db.session.get(User, id)
    if not student or student.role != 'user': 
        return jsonify({'message': 'Student not found'}), 404
        
    # Safely clear student's scores before deleting the account
    Score.query.filter_by(user_id=id).delete()
    
    db.session.delete(student)
    db.session.commit()
    return jsonify({'message': 'Student account deleted'}), 200


# =====================================================
# 2. ANALYTICS ENGINE (The "Brain")
# =====================================================

@admin_bp.route('/analytics/quizzes', methods=['GET'])
def get_all_quizzes_analytics():
    """Returns list of all quizzes with calculated status"""
    quizzes = Quiz.query.all()
    today = datetime.now().strftime('%Y-%m-%d')
    
    data = []
    for q in quizzes:
        if q.date_of_quiz < today: status = 'Completed'
        elif q.date_of_quiz == today: status = 'Active'
        else: status = 'Upcoming'
        
        chapter = db.session.get(Chapter, q.chapter_id)
        subject = db.session.get(Subject, chapter.subject_id)
        
        data.append({
            'id': q.id,
            'remarks': q.remarks,
            'date_of_quiz': q.date_of_quiz,
            'subject_name': subject.name,
            'chapter_name': chapter.name,
            'status': status
        })
    return jsonify(data), 200

@admin_bp.route('/analytics/quiz/<int:quiz_id>', methods=['GET'])
def get_quiz_deep_dive(quiz_id):
    quiz = db.session.get(Quiz, quiz_id)
    if not quiz: return jsonify({'message': 'Quiz not found'}), 404
    
    chapter = db.session.get(Chapter, quiz.chapter_id)
    subject = db.session.get(Subject, chapter.subject_id)
    
    all_students = User.query.filter_by(role='user').all()
    scores = Score.query.filter_by(quiz_id=quiz_id).all()
    
    score_map = {s.user_id: s.total_scored for s in scores}
    attended_ids = set(score_map.keys())
    
    student_list = []
    stats = {'attended': 0, 'missed': 0, 'pending': 0}
    score_dist = [0, 0, 0, 0, 0] 
    
    today = datetime.now().strftime('%Y-%m-%d')
    is_expired = quiz.date_of_quiz < today

    for student in all_students:
        status = 'Pending'
        score = None
        
        if student.id in attended_ids:
            status = 'Attended'
            stats['attended'] += 1
            score = score_map[student.id]
            
            total_qs = len(quiz.questions)
            if total_qs > 0:
                percentage = (score / total_qs) * 100
                index = min(int(percentage / 20), 4)
                score_dist[index] += 1
                
        elif is_expired:
            status = 'Missed'
            stats['missed'] += 1
        else:
            status = 'Pending'
            stats['pending'] += 1
            
        student_list.append({
            'id': student.id,
            'name': student.full_name,
            'email': student.email,
            'status': status,
            'score': score if score is not None else '-'
        })

    return jsonify({
        'quiz_title': quiz.remarks,
        'subject': subject.name,
        'stats': stats,
        'score_distribution': score_dist,
        'students': student_list
    }), 200

@admin_bp.route('/analytics/students/search', methods=['GET'])
def search_students():
    """Fuzzy search for students by name or email"""
    query = request.args.get('q', '')
    if not query: return jsonify([]), 200
    
    students = User.query.filter(
        (User.role == 'user') & 
        ((User.full_name.ilike(f'%{query}%')) | (User.email.ilike(f'%{query}%')))
    ).all()
    
    return jsonify([{
        'id': s.id, 
        'full_name': s.full_name, 
        'email': s.email,
        'qualification': s.qualification,
        'dob': s.dob.strftime('%Y-%m-%d') if s.dob else ''
    } for s in students]), 200

@admin_bp.route('/analytics/student/<int:user_id>', methods=['GET'])
def get_student_deep_dive(user_id):
    user = db.session.get(User, user_id)
    if not user: return jsonify({'message': 'User not found'}), 404
    
    scores = Score.query.filter_by(user_id=user_id).all()
    all_quizzes = Quiz.query.all()
    
    history = []
    total_score_sum = 0
    total_qs_sum = 0
    missed_count = 0
    today = datetime.now().strftime('%Y-%m-%d')
    
    attended_quiz_ids = {s.quiz_id for s in scores}
    score_map = {s.quiz_id: s.total_scored for s in scores}
    
    for q in all_quizzes:
        if q.id in attended_quiz_ids:
            raw_score = score_map[q.id]
            total_qs = len(q.questions)
            percentage = (raw_score / total_qs * 100) if total_qs > 0 else 0
            
            history.append({
                'quiz_id': q.id,
                'quiz_name': q.remarks,
                'date': q.date_of_quiz,
                'score': f"{raw_score}/{total_qs}",
                'percentage': round(percentage),
                'status': 'Attended'
            })
            total_score_sum += percentage
            total_qs_sum += 1
        elif q.date_of_quiz < today:
            missed_count += 1
            history.append({
                'quiz_id': q.id,
                'quiz_name': q.remarks,
                'date': q.date_of_quiz,
                'score': '-',
                'percentage': 0,
                'status': 'Missed'
            })

    avg_score = round(total_score_sum / total_qs_sum) if total_qs_sum > 0 else 0
    
    return jsonify({
        'total_quizzes': len(attended_quiz_ids),
        'avg_score': avg_score,
        'missed_quizzes': missed_count,
        'history': history
    }), 200