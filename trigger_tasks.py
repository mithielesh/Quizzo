from app import create_app
from app.tasks import send_daily_reminders, generate_monthly_report
import time

app = create_app()

def trigger_notifications():
    with app.app_context():
        print("\n=======================================================")
        print("INITIATING ASYNC BACKGROUND JOBS")
        print("=======================================================")
        
        # 1. Trigger the Monthly Report (Global Notification)
        print("\n[1] Queuing Monthly Report Task...")
        report_job = generate_monthly_report.delay()
        print(f"    -> Task ID: {report_job.id}")
        
        time.sleep(1) # Tiny pause for dramatic effect
        
        # 2. Trigger the Daily Reminders (Personal Notifications)
        print("\n[2] Queuing Daily Reminders Task...")
        reminder_job = send_daily_reminders.delay()
        print(f"    -> Task ID: {reminder_job.id}")

        print("\n=======================================================")
        print("Tasks successfully handed off to Celery!")
        print(" -> Check your Celery Worker terminal to see the execution.")
        print(" -> Open the web app and click 'Alerts' to see the result.")
        print("=======================================================\n")

if __name__ == '__main__':
    trigger_notifications()