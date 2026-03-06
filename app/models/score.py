from app.extensions import db
from datetime import datetime

class Score(db.Model):
    __tablename__ = 'score'
    id = db.Column(db.Integer, primary_key=True)
    
    # RENAME THIS COLUMN to match admin.py logic
    total_scored = db.Column(db.Integer, nullable=False) 
    
    total_questions = db.Column(db.Integer, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quiz.id'), nullable=False)
    
    user = db.relationship('User', backref='scores')
    quiz = db.relationship('Quiz', backref='scores')

    def to_dict(self):
        return {
            'id': self.id,
            # Map 'total_scored' back to 'score' so the Frontend works without changes
            'score': self.total_scored, 
            'total_questions': self.total_questions,
            'timestamp': self.timestamp.strftime('%Y-%m-%d %H:%M'),
            'user_id': self.user_id,
            'quiz_id': self.quiz_id,
            'subject_name': self.quiz.chapter.subject.name if self.quiz and self.quiz.chapter else 'Unknown',
            'quiz_remarks': self.quiz.remarks if self.quiz else 'Unknown'
        }