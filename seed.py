from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.subject import Subject, Chapter
from app.models.quiz import Quiz, Question
from app.models.score import Score
from datetime import datetime, timedelta
import random

app = create_app()

def run_seed():
    with app.app_context():
        print("Starting Enhanced Database Seed...")
        
        # 1. CLEAN SLATE
        db.drop_all()
        db.create_all()
        print("Old data wiped. Tables recreated.")

        # --- TIME TRAVEL SETUP ---
        today_datetime = datetime.now()
        ten_days_ago = today_datetime - timedelta(days=10)

        # =============================================
        # 2. CREATE USERS
        # =============================================
        # A. The Super Admin (Joined 10 days ago)
        admin = User(email='admin@quizzo.com', role='admin', full_name='Super Admin', qualification='Ph.D', created_at=ten_days_ago)
        admin.set_password('admin123')
        db.session.add(admin)

        # B. The Legacy Demo Student (Joined 10 days ago - Will see Missed Tests)
        demo_student = User(email='student@demo.com', role='user', full_name='Rahul Demo', qualification='B.Tech', created_at=ten_days_ago)
        demo_student.set_password('123456')
        db.session.add(demo_student)

        # C. The Fresh Demo Student (Joined TODAY - Will NOT see Missed Tests)
        new_student = User(email='newbie@demo.com', role='user', full_name='Fresh Fresher', qualification='B.A', created_at=today_datetime)
        new_student.set_password('123456')
        db.session.add(new_student)

        # D. The "Classroom" (30 Dummy Students for Admin Analytics, joined 10 days ago)
        dummy_students = []
        for i in range(1, 31):
            s = User(email=f'student{i}@test.com', role='user', full_name=f'Student {i}', qualification=random.choice(['B.Sc', 'B.Tech', 'BCA', 'MCA']), created_at=ten_days_ago)
            s.set_password('123')
            db.session.add(s)
            dummy_students.append(s)
        
        db.session.commit()
        print("Users Created: 1 Admin, 2 Demo Students, 30 Dummy Students.")

        # =============================================
        # 3. CREATE CONTENT (Subjects/Chapters)
        # =============================================
        subjects_data = [
            {'name': 'Computer Science', 'desc': 'Core CS concepts', 'chapters': ['Python Basics', 'Java Core', 'Data Structures', 'Algorithms']},
            {'name': 'Mathematics', 'desc': 'Advanced Math', 'chapters': ['Linear Algebra', 'Calculus', 'Probability']},
            {'name': 'Physics', 'desc': 'Fundamental Physics', 'chapters': ['Mechanics', 'Thermodynamics', 'Electromagnetism']},
            {'name': 'General Knowledge', 'desc': 'Trivia and Facts', 'chapters': ['World History', 'Geography']}
        ]

        chapters_dict = {} # To store chapter objects for easy access
        for sub_data in subjects_data:
            sub = Subject(name=sub_data['name'], description=sub_data['desc'])
            db.session.add(sub)
            db.session.commit()
            
            for chap_name in sub_data['chapters']:
                chap = Chapter(name=chap_name, description=f'Learn about {chap_name}', subject_id=sub.id)
                db.session.add(chap)
                db.session.commit()
                chapters_dict[chap_name] = chap

        print("Content Created: 4 Subjects, 12 Chapters.")

        # =============================================
        # 4. CREATE QUIZZES & QUESTIONS
        # =============================================
        # Helper to create a versatile quiz
        def create_full_quiz(chapter_id, title, date, duration=30, num_questions=5):
            q = Quiz(chapter_id=chapter_id, date_of_quiz=date, time_duration=duration, remarks=title)
            db.session.add(q)
            db.session.commit()
            
            # Add dynamic questions
            for i in range(1, num_questions + 1):
                correct_opt = random.randint(1, 4)
                quest = Question(
                    quiz_id=q.id,
                    question_statement=f"Q{i}: Which of the following best describes a key concept in {title}?",
                    option1=f"Relevant theory A for Q{i}", 
                    option2=f"Relevant theory B for Q{i}", 
                    option3=f"Relevant theory C for Q{i}", 
                    option4=f"Relevant theory D for Q{i}",
                    correct_option=correct_opt
                )
                db.session.add(quest)
            db.session.commit()
            return q

        # --- DATES ---
        def get_date_str(days_offset):
            return (today_datetime + timedelta(days=days_offset)).strftime('%Y-%m-%d')

        # Create a variety of quizzes across different dates and lengths
        all_quizzes = []
        
        # Admin Demo Quizzes (Heavy participation)
        admin_quiz_1 = create_full_quiz(chapters_dict['Data Structures'].id, "Mid-Term Exam", get_date_str(-1), duration=60, num_questions=10)
        admin_quiz_2 = create_full_quiz(chapters_dict['Calculus'].id, "Math Weekly Quiz", get_date_str(-2), duration=15, num_questions=5)
        
        # Student Demo Quizzes (Taken)
        student_quizzes_taken = []
        for i, day_offset in enumerate([-8, -6, -5, -4, -3, -2]):
            q = create_full_quiz(chapters_dict['Python Basics'].id, f"Python Drill {i+1}", get_date_str(day_offset), duration=random.choice([10, 15, 20]), num_questions=random.choice([3, 5, 7]))
            student_quizzes_taken.append(q)

        # Missed Quizzes (Past)
        create_full_quiz(chapters_dict['Java Core'].id, "Missed Java Assessment", get_date_str(-3), duration=30, num_questions=5)
        create_full_quiz(chapters_dict['Mechanics'].id, "Physics Pop Quiz", get_date_str(-1), duration=10, num_questions=3)

        # Upcoming Quizzes (Future)
        create_full_quiz(chapters_dict['Algorithms'].id, "Final Algorithms Exam", get_date_str(2), duration=120, num_questions=20)
        create_full_quiz(chapters_dict['World History'].id, "History Trivia", get_date_str(5), duration=15, num_questions=10)

        print("Quizzes & Questions Created: Varied lengths and dates.")

        # =============================================
        # 5. SIMULATE SCORES
        # =============================================
        
        # A. Populate Admin Demo Data (The 30 students taking the Admin Quizzes)
        for student in dummy_students:
            # 90% attendance rate for Admin Quiz 1
            if random.random() < 0.90: 
                score_val = random.randint(3, 10) 
                quiz_date = today_datetime - timedelta(days=1, hours=random.randint(1, 12))
                s = Score(total_scored=score_val, total_questions=10, user_id=student.id, quiz_id=admin_quiz_1.id, timestamp=quiz_date)
                db.session.add(s)

            # 85% attendance rate for Admin Quiz 2
            if random.random() < 0.85: 
                score_val = random.randint(1, 5) 
                quiz_date = today_datetime - timedelta(days=2, hours=random.randint(1, 12))
                s = Score(total_scored=score_val, total_questions=5, user_id=student.id, quiz_id=admin_quiz_2.id, timestamp=quiz_date)
                db.session.add(s)

        # B. Populate Demo Student & Classroom Data for Practice Drills
        for q in student_quizzes_taken:
            q_count = Question.query.filter_by(quiz_id=q.id).count()
            quiz_date_obj = datetime.strptime(q.date_of_quiz, '%Y-%m-%d')
            
            # 1. The main Demo Student takes it (guaranteed)
            demo_score = random.randint(int(q_count * 0.5), q_count) 
            s = Score(total_scored=demo_score, total_questions=q_count, user_id=demo_student.id, quiz_id=q.id, timestamp=quiz_date_obj)
            db.session.add(s)

            # 2. Let the 30 Dummy Students take these practice drills too! (80% attendance)
            for student in dummy_students:
                if random.random() < 0.80:
                    dummy_score = random.randint(1, q_count)
                    dummy_date = quiz_date_obj + timedelta(hours=random.randint(1, 12))
                    ds = Score(total_scored=dummy_score, total_questions=q_count, user_id=student.id, quiz_id=q.id, timestamp=dummy_date)
                    db.session.add(ds)

        db.session.commit()
        print("Analytics Generated: Healthy 80-90% attendance rates simulated.")
        print("\nSEED COMPLETE!")
        print("------------------------------------------------")
        print("Login with:")
        print(" ADMIN:        admin@quizzo.com  / admin123")
        print(" OLD STUDENT:  student@demo.com  / 123456 (Shows Missed Tests & Chart Data)")
        print(" NEW STUDENT:  newbie@demo.com   / 123456 (Clean Slate)")
        print("------------------------------------------------")

if __name__ == '__main__':
    run_seed()