import sys
from database import SessionLocal, engine, Base
import models

def clear_data_keep_staff():
    db = SessionLocal()
    print("[FixFlow] Clearing all jobs, timeline entries, and shifts...")
    db.query(models.JobTimeline).delete()
    db.query(models.Job).delete()
    db.query(models.Shift).delete()
    
    # Reset technician monthly performance counters to zero
    for tech in db.query(models.Technician).all():
        tech.jobs_completed_this_month = 0
        tech.revenue_this_month = 0.0
    
    db.commit()
    
    jobs_count = db.query(models.Job).count()
    shifts_count = db.query(models.Shift).count()
    users_count = db.query(models.User).count()
    techs_count = db.query(models.Technician).count()
    
    db.close()
    print(f"[FixFlow] Ready for fresh production! Jobs: {jobs_count}, Shifts: {shifts_count}, Users: {users_count}, Techs: {techs_count}")

if __name__ == "__main__":
    clear_data_keep_staff()
