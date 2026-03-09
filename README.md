# Quizzo

[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.3+-000000?style=flat-square&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![Vue.js](https://img.shields.io/badge/Vue.js-3.0-4FC08D?style=flat-square&logo=vue.js&logoColor=white)](https://vuejs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-3.0-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Redis](https://img.shields.io/badge/Redis-7.0+-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io/)
[![Celery](https://img.shields.io/badge/Celery-5.3-37814A?style=flat-square&logo=celery&logoColor=white)](https://docs.celeryproject.org/)
[![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-7952B3?style=flat-square&logo=bootstrap&logoColor=white)](https://getbootstrap.com/)
[![Chart.js](https://img.shields.io/badge/Chart.js-4.0-FF6384?style=flat-square&logo=chart.js&logoColor=white)](https://www.chartjs.org/)

A full-stack multi-user exam preparation platform with role-based access control, real-time analytics, and automated reporting capabilities.

## System Architecture

```mermaid
flowchart LR
    %% Styling
    classDef admin fill:#35495e,stroke:#fff,stroke-width:2px,color:#fff
    classDef student fill:#4FC08D,stroke:#fff,stroke-width:2px,color:#fff
    classDef bgTask fill:#DD0031,stroke:#fff,stroke-width:2px,color:#fff

    %% Entry
    Auth([Login]) --> Role{Role?}

    %% Admin Flow
    Role -->|Admin| ADash[Admin Dash]:::admin
    ADash --> Manage[Content]:::admin & Analytics[Analytics]:::admin
    Manage --> Create[Create Subjects & Quizzes]:::admin
    Analytics --> Stats[Track Score Trends]:::admin

    %% Student Flow
    Role -->|User| SDash[Student Dash]:::student
    SDash --> Quizzes[Practice Quizzes]:::student & Perf[Performance Lab]:::student
    Quizzes --> TakeQuiz{Attempt Quiz}:::student -->|Submit| Score[Save Score]:::student --> Perf
    Perf --> Export[CSV Export]:::student

    %% Background Tasks
    Worker((Celery Workers)):::bgTask -.->|Scheduled| Reports[Daily Reminders & Reports]:::bgTask -.-> SDash
```

## Core Features

### Administrator
- Content management system for subjects, chapters, quizzes, and questions
- Real-time analytics dashboard with performance metrics
- Student account management and search functionality
- Quiz attendance tracking and score distribution analysis

### Student
- Timer-based multiple-choice quiz assessments
- Performance tracking with interactive visualizations
- Historical score analysis across subjects
- Asynchronous data export to CSV format

### Background Processing
- Scheduled daily reminders at 18:00
- Automated monthly report generation
- User-triggered asynchronous exports

## Technology Stack

**Backend**
- Flask 2.3+ with SQLAlchemy ORM
- Flask-Login for session management
- Flask-Caching with Redis backend
- Celery 5.3 for distributed task processing

**Frontend**
- Vue.js 3 (CDN-based SPA)
- Bootstrap 5 for responsive UI
- Chart.js for data visualization

**Data Layer**
- SQLite 3 for relational storage
- Redis 7.0+ for caching and message brokering

## Project Structure

```
app/
├── controllers/        API endpoints (auth, admin, user)
├── models/            Database models (User, Subject, Quiz, Score)
├── static/            Frontend assets (Vue.js, Chart.js)
├── templates/         Entry point (index.html)
├── tasks.py           Celery background jobs
└── config.py          Application configuration
```

## API Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | User authentication |
| `/api/admin/subjects` | GET/POST | Manage subjects |
| `/api/admin/analytics/quiz/<id>` | GET | Quiz performance data |
| `/api/user/quizzes` | GET | Available quizzes (cached) |
| `/api/user/quiz/<id>/submit` | POST | Submit quiz answers |
| `/api/user/export` | POST | Trigger CSV export |

## License

MIT License