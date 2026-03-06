from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.subject import Subject
from app.models.subject import Chapter
from app.models.quiz import Quiz, Question
from app.models.score import Score
from datetime import datetime, timedelta
import random

app = create_app()

def run_seed():
    with app.app_context():
        print("Starting Database Seed...")
        
        # 1. CLEAN SLATE (Optional: Comment out if you want to keep old data)
        db.drop_all()
        db.create_all()
        print("Old data wiped. Tables recreated.")

        # =============================================
        # 2. CREATE USERS
        # =============================================
        # A. The Super Admin
        admin = User(email='admin@quizzo.com', role='admin', full_name='Super Admin', qualification='Ph.D')
        admin.set_password('admin123')
        db.session.add(admin)

        # B. The Demo Student (For your Student Dashboard Demo)
        demo_student = User(email='student@demo.com', role='user', full_name='Rahul Demo', qualification='B.Tech')
        demo_student.set_password('123456')
        db.session.add(demo_student)

        # C. The "Classroom" (25 Dummy Students for Admin Analytics)
        dummy_students = []
        for i in range(1, 26):
            s = User(email=f'student{i}@test.com', role='user', full_name=f'Student {i}', qualification='B.Sc')
            s.set_password('123')
            db.session.add(s)
            dummy_students.append(s)
        
        db.session.commit()
        print("Users Created: 1 Admin, 1 Demo Student, 25 Dummy Students.")

        # =============================================
        # 3. CREATE CONTENT (Subjects/Chapters)
        # =============================================
        sub_cs = Subject(name='Computer Science', description='Core CS concepts')
        sub_math = Subject(name='Mathematics', description='Advanced Math')
        db.session.add_all([sub_cs, sub_math])
        db.session.commit()

        chap_py = Chapter(name='Python Basics', description='Intro to Python', subject_id=sub_cs.id)
        chap_java = Chapter(name='Java Core', description='OOPs concepts', subject_id=sub_cs.id)
        chap_alg = Chapter(name='Algebra', description='Linear Algebra', subject_id=sub_math.id)
        db.session.add_all([chap_py, chap_java, chap_alg])
        db.session.commit()

        # =============================================
        # 4. CREATE QUIZZES & QUESTIONS
        # =============================================
        # Helper to create a quiz with 5 questions
        def create_full_quiz(chapter_id, title, date, duration=30):
            q = Quiz(chapter_id=chapter_id, date_of_quiz=date, time_duration=duration, remarks=title)
            db.session.add(q)
            db.session.commit()
            
            # Add 5 dummy questions
            for i in range(1, 6):
                quest = Question(
                    quiz_id=q.id,
                    question_statement=f"Sample Question {i} for {title}?",
                    option1="Option A", option2="Option B", option3="Option C", option4="Option D",
                    correct_option=1
                )
                db.session.add(quest)
            db.session.commit()
            return q

        # --- DATES ---
        today = datetime.now().strftime('%Y-%m-%d')
        yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
        future_3_days = (datetime.now() + timedelta(days=3)).strftime('%Y-%m-%d')

        # A. QUIZZES FOR ADMIN DEMO (Big Data)
        # "Unit Test 1" - Past date, taken by everyone
        admin_quiz = create_full_quiz(chap_py.id, "Mid-Term Exam (Admin Demo)", yesterday)

        # B. QUIZZES FOR STUDENT DEMO (6 Taken, 2 Missed, 2 Upcoming)
        # 1. Six Completed Quizzes (Past)
        student_quizzes_taken = []
        for i in range(1, 7):
            q = create_full_quiz(chap_py.id, f"Practice Drill {i}", yesterday)
            student_quizzes_taken.append(q)

        # 2. Two Missed Quizzes (Past)
        create_full_quiz(chap_java.id, "Missed Java Test 1", yesterday)
        create_full_quiz(chap_java.id, "Missed Java Test 2", yesterday)

        # 3. Two Upcoming Quizzes (Future - 3 Days from now)
        create_full_quiz(chap_alg.id, "Final Algebra Assessment", future_3_days)
        create_full_quiz(chap_alg.id, "Surprise Python Test", future_3_days)

        print("Content Created: Subjects, Chapters, and 12 Quizzes.")

        # =============================================
        # 5. SIMULATE SCORES (The Magic)
        # =============================================
        
        # A. Populate Admin Demo Data (The 25 students taking the Mid-Term)
        # We want a bell curve: some low, mostly avg, some high
        # ... inside seed.py ...

        # A. Populate Admin Demo Data
        for student in dummy_students:
            score_val = random.choice([1, 2, 3, 3, 3, 4, 4, 4, 5, 5])
            # FIXED: Used 'total_scored' instead of 'score'
            s = Score(total_scored=score_val, total_questions=5, user_id=student.id, quiz_id=admin_quiz.id)
            db.session.add(s)

        # B. Populate Demo Student Data
        trend_scores = [2, 3, 3, 4, 4, 5]
        for idx, quiz in enumerate(student_quizzes_taken):
            # FIXED: Used 'total_scored' instead of 'score'
            s = Score(total_scored=trend_scores[idx], total_questions=5, user_id=demo_student.id, quiz_id=quiz.id)
            db.session.add(s)

        db.session.commit()
        print("Analytics Generated: 31 Exam attempts recorded.")
        print("\nSEED COMPLETE!")
        print("------------------------------------------------")
        print("Login with:")
        print("  ADMIN:   admin@quizzo.com  / admin123")
        print("  STUDENT: student@demo.com  / 123456")
        print("------------------------------------------------")

if __name__ == '__main__':
    run_seed()