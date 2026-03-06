from celery import shared_task
from app.extensions import db
from app.models.user import User
from app.models.score import Score
from app.models.quiz import Quiz
from datetime import datetime
import csv
import os
from flask import current_app

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
    
    # 1. Define File Path inside the static folder so Flask can serve it
    export_dir = os.path.join(current_app.root_path, 'static', 'exports')
    os.makedirs(export_dir, exist_ok=True) # Ensure directory exists
    filepath = os.path.join(export_dir, f"user_{user_id}_report.csv")
    
    # 2. Write Data to CSV
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        # Write Headers
        writer.writerow(['Quiz Title', 'Subject', 'Date Attempted', 'Score', 'Total Questions', 'Percentage'])
        
        # Write Rows
        for s in scores:
            quiz = s.quiz
            subject = quiz.chapter.subject.name if quiz and quiz.chapter else "Unknown"
            
            # Prevent Division by Zero
            percentage = (s.total_scored / s.total_questions * 100) if s.total_questions > 0 else 0
            
            writer.writerow([
                quiz.remarks if quiz else "Unknown",
                subject,
                s.timestamp.strftime('%Y-%m-%d %H:%M'),
                s.total_scored,      # Updated to use the correct DB column
                s.total_questions,
                f"{percentage:.2f}%"
            ])
            
    print(f"EXPORT COMPLETE: Saved to {filepath}")
    return f"Report generated for User {user_id}"


# ====================================================================
# REQUIREMENT 5.a: SCHEDULED JOB (DAILY REMINDERS)
# ====================================================================
@shared_task
def send_daily_reminders():
    """
    Scheduled Job: Runs every evening to remind users of active quizzes.
    """
    today = datetime.now().strftime('%Y-%m-%d')
    # Find quizzes happening today or future
    active_quizzes = Quiz.query.filter(Quiz.date_of_quiz >= today).all()
    
    if not active_quizzes:
        print("No upcoming quizzes. No daily reminders sent.")
        return "No upcoming quizzes to remind about today."

    students = User.query.filter_by(role='user').all()
    
    count = 0
    for student in students:
        # Simulate sending a reminder (In production: Google Chat Webhook or SMTP Email)
        print(f"REMINDER SENT TO {student.email}: You have {len(active_quizzes)} upcoming quizzes in your Daily Planner!")
        count += 1
        
    return f"Reminders sent to {count} students."


# ====================================================================
# REQUIREMENT 5.b: SCHEDULED JOB (MONTHLY ACTIVITY REPORT)
# ====================================================================
@shared_task
def generate_monthly_report():
    """
    Scheduled Job: Generates an HTML report for the Admin summarizing platform usage.
    """
    total_users = User.query.filter_by(role='user').count()
    total_quizzes = Quiz.query.count()
    total_scores = Score.query.count()
    
    # Generate HTML content
    report_content = f"""
    <html>
        <body>
            <h1>QuizMaster PRO - Monthly Activity Report</h1>
            <hr>
            <p><strong>Total Registered Students:</strong> {total_users}</p>
            <p><strong>Total Quizzes Created:</strong> {total_quizzes}</p>
            <p><strong>Total Exam Attempts:</strong> {total_scores}</p>
        </body>
    </html>
    """
    
    # In a real application, you would email this HTML string to the admin.
    # For the project requirement, logging it or saving it to a file is sufficient.
    print("================= MONTHLY REPORT GENERATED =================")
    print(report_content)
    print("==================================================================")
    
    return "Monthly report created successfully."