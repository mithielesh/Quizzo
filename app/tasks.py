from celery import shared_task
from flask import current_app
from app.extensions import db
from app.models.user import User, Notification
from app.models.score import Score
from app.models.quiz import Quiz
from datetime import datetime
import csv
import os

# ====================================================================
# REQUIREMENT 5.c: USER-TRIGGERED ASYNC JOB (CSV EXPORT)
# ====================================================================
@shared_task(ignore_result=False)
def export_user_data(user_id):
    """
    Generates a CSV report of the student's quiz performance.
    Saved to app/static/exports/user_{id}_report.csv
    """
    user = db.session.get(User, user_id)
    if not user: 
        return "User not found"
    
    scores = Score.query.filter_by(user_id=user_id).all()
    
    export_dir = os.path.join(current_app.root_path, 'static', 'exports')
    os.makedirs(export_dir, exist_ok=True) 
    filepath = os.path.join(export_dir, f"user_{user_id}_report.csv")
    
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Quiz Title', 'Subject', 'Date Attempted', 'Score', 'Total Questions', 'Percentage'])
        
        for s in scores:
            quiz = s.quiz
            subject = quiz.chapter.subject.name if quiz and quiz.chapter else "Unknown"
            
            percentage = (s.total_scored / s.total_questions * 100) if s.total_questions > 0 else 0
            
            writer.writerow([
                quiz.remarks if quiz else "Unknown",
                subject,
                s.timestamp.strftime('%Y-%m-%d %H:%M'),
                s.total_scored,
                s.total_questions,
                f"{percentage:.2f}%"
            ])
            
    print(f"EXPORT COMPLETE: Saved to {filepath}")
    
    notif = Notification(
        user_id=user_id, 
        message="Your requested Performance CSV Report has been generated successfully.",
    )
    db.session.add(notif)
    db.session.commit()
    
    return f"Report generated for User {user_id}"


# ====================================================================
# REQUIREMENT 5.a: SCHEDULED JOB (DAILY REMINDERS)
# ====================================================================
@shared_task
def send_daily_reminders():
    """
    Scheduled Job: Calculates exact pending tests for EACH student individually
    and pushes a personalized UI Notification.
    """
    today = datetime.now().strftime('%Y-%m-%d')
    active_quizzes = Quiz.query.filter(Quiz.date_of_quiz >= today).all()
    students = User.query.filter_by(role='user').all()
    
    count_sent = 0
    for student in students:
        # Calculate exactly how many pending tests THIS specific student has
        student_join_date = student.created_at.strftime('%Y-%m-%d') if student.created_at else '2000-01-01'
        attempted_quiz_ids = [s.quiz_id for s in Score.query.filter_by(user_id=student.id).all()]
        
        # Only count if the test is assigned AFTER they joined, AND they haven't taken it yet
        pending_count = sum(1 for q in active_quizzes if q.date_of_quiz >= student_join_date and q.id not in attempted_quiz_ids)
        
        # Personalized Message Logic
        if pending_count == 0:
            msg = "No upcoming tests, enjoy!!"
        else:
            test_word = "test" if pending_count == 1 else "tests"
            msg = f"Daily Reminder: You have {pending_count} upcoming {test_word} waiting in your Daily Planner."
            
        notif = Notification(user_id=student.id, message=msg)
        db.session.add(notif)
        count_sent += 1
        
    db.session.commit()
    print(f"Personalized Reminders sent to {count_sent} students.")
    return f"Reminders sent to {count_sent} students."


# ====================================================================
# REQUIREMENT 5.b: SCHEDULED JOB (MONTHLY ACTIVITY REPORT)
# ====================================================================
@shared_task
def generate_monthly_report():
    """
    Scheduled Job: Generates a Global Admin Report AND Personalized Student Report Cards.
    """
    export_dir = os.path.join(current_app.root_path, 'static', 'exports')
    os.makedirs(export_dir, exist_ok=True)
    
    # ---------------------------------------------------------
    # 1. GENERATE ADMIN PLATFORM REPORT (Global Stats)
    # ---------------------------------------------------------
    total_users = User.query.filter_by(role='user').count()
    total_quizzes = Quiz.query.count()
    total_scores = Score.query.count()
    
    admin_html = f"""
    <!DOCTYPE html><html><head><title>Platform Monthly Report</title>
    <style>body {{ font-family: Arial; padding: 40px; background: #f4f7f6; }} .box {{ background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); max-width: 600px; margin: auto; }} .stat {{ background: #e9ecef; padding: 15px; margin: 10px 0; border-left: 5px solid #0d6efd; font-size: 18px; }}</style></head>
    <body><div class="box"><h2 style="color: #0d6efd;">Platform Activity Report</h2><p>Automated summary for the current month.</p>
    <div class="stat"><strong>Total Registered Students:</strong> {total_users}</div>
    <div class="stat"><strong>Total Quizzes Created:</strong> {total_quizzes}</div>
    <div class="stat"><strong>Total Exam Attempts:</strong> {total_scores}</div>
    </div></body></html>
    """
    admin_file = os.path.join(export_dir, 'admin_monthly_report.html')
    with open(admin_file, 'w', encoding='utf-8') as f:
        f.write(admin_html)
        
    # Global Admin Notification
    notif_admin = Notification(
        user_id=None, 
        message="The automated Platform Activity Report has been generated.", 
        action_link="/static/exports/admin_monthly_report.html"
    )
    db.session.add(notif_admin)

    # ---------------------------------------------------------
    # 2. GENERATE PERSONALIZED STUDENT REPORT CARDS
    # ---------------------------------------------------------
    students = User.query.filter_by(role='user').all()
    
    for student in students:
        scores = Score.query.filter_by(user_id=student.id).all()
        total_attempts = len(scores)
        
        score_rows = ""
        total_pct = 0
        
        # Build Table Rows
        for s in scores:
            quiz_title = s.quiz.remarks if s.quiz else "Unknown Quiz"
            pct = (s.total_scored / s.total_questions * 100) if s.total_questions > 0 else 0
            total_pct += pct
            score_rows += f"<tr><td style='padding: 10px; border-bottom: 1px solid #eee;'>{quiz_title}</td><td style='padding: 10px; border-bottom: 1px solid #eee;'>{s.total_scored}/{s.total_questions} ({pct:.1f}%)</td></tr>"
            
        avg_score = round(total_pct / total_attempts, 2) if total_attempts > 0 else 0
        
        if not score_rows:
            score_rows = "<tr><td colspan='2' style='padding: 10px; text-align: center; color: #888;'>No tests attempted yet.</td></tr>"

        # Student HTML Template
        student_html = f"""
        <!DOCTYPE html><html><head><title>My Report Card</title>
        <style>body {{ font-family: Arial; padding: 40px; background: #f4f7f6; }} .box {{ background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); max-width: 600px; margin: auto; }} table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }} th {{ background: #0d6efd; color: white; padding: 10px; text-align: left; }}</style></head>
        <body><div class="box">
        <h2 style="color: #0d6efd;">Monthly Report Card</h2>
        <p><strong>Student:</strong> {student.full_name}</p>
        <p><strong>Exams Attempted:</strong> {total_attempts}</p>
        <p><strong>Average Score:</strong> {avg_score}%</p>
        <table><thead><tr><th>Quiz Title</th><th>Score</th></tr></thead><tbody>{score_rows}</tbody></table>
        </div></body></html>
        """
        
        student_file = f'student_{student.id}_report_card.html'
        with open(os.path.join(export_dir, student_file), 'w', encoding='utf-8') as f:
            f.write(student_html)
            
        # Personal Student Notification
        notif_student = Notification(
            user_id=student.id, 
            message="Your personalized Monthly Report Card is ready!", 
            action_link=f"/static/exports/{student_file}"
        )
        db.session.add(notif_student)

    db.session.commit()
    print("Personalized Reports generated for Admin and all Students.")
    return "Monthly reports created successfully."