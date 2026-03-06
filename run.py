from app import create_app

app = create_app()

celery_app = app.celery_app

if __name__ == '__main__':
    app.run(debug=True)