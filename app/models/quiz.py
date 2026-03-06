from app.extensions import db

class Quiz(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    chapter_id = db.Column(db.Integer, db.ForeignKey('chapter.id'), nullable=False)
    date_of_quiz = db.Column(db.String(20)) # Format: YYYY-MM-DD
    time_duration = db.Column(db.Integer)    # In Minutes
    remarks = db.Column(db.String(255))      # e.g., "Mid-term Exam"
    questions = db.relationship('Question', backref='quiz', cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'chapter_id': self.chapter_id,
            'date_of_quiz': self.date_of_quiz,
            'time_duration': self.time_duration,
            'remarks': self.remarks,
            'total_questions': len(self.questions) # Helpful for the UI
        }

class Question(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quiz.id'), nullable=False)
    question_statement = db.Column(db.Text, nullable=False)
    option1 = db.Column(db.String(255), nullable=False)
    option2 = db.Column(db.String(255), nullable=False)
    option3 = db.Column(db.String(255), nullable=False)
    option4 = db.Column(db.String(255), nullable=False)
    correct_option = db.Column(db.Integer, nullable=False) # 1, 2, 3, or 4

    def to_dict(self):
        return {
            'id': self.id,
            'quiz_id': self.quiz_id,
            'question_statement': self.question_statement,
            'options': [self.option1, self.option2, self.option3, self.option4],
            'correct_option': self.correct_option
        }