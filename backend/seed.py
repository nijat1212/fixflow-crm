from database import SessionLocal, engine, Base
import models
from auth import get_password_hash

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    if db.query(models.User).count() > 0:
        print("Database already contains data, skipping seed.")
        db.close()
        return

    print("[FixFlow] Seeding initial FixFlow CRM data...")

    # 1. Technicians (with Austin, TX GPS coordinates for the map)
    tech1 = models.Technician(
        id="tech_1",
        name="Mike Miller",
        email="mike@fixflow.com",
        phone="(555) 234-5678",
        avatar="MM",
        color="#3b82f6",
        specialties=["Refrigerators", "Dishwashers", "Ovens"],
        rating=4.9,
        jobs_completed_this_month=14,
        revenue_this_month=3250.0,
        current_lat=30.2672,
        current_lon=-97.7431
    )
    tech2 = models.Technician(
        id="tech_2",
        name="Marcus Vance",
        email="marcus@fixflow.com",
        phone="(555) 876-5432",
        avatar="MV",
        color="#10b981",
        specialties=["Washing Machines", "Dryers", "Microwaves"],
        rating=4.8,
        jobs_completed_this_month=11,
        revenue_this_month=2840.0,
        current_lat=30.2849,
        current_lon=-97.7341
    )
    db.add_all([tech1, tech2])
    db.flush()

    # 2. Users (supports @24fix.us production domain and legacy @fixflow.com)
    users = [
        models.User(name="Business Owner", email="owner@24fix.us", hashed_password=get_password_hash("owner123"), role="owner", tech_id=None),
        models.User(name="Sarah (Dispatch)", email="dispatch@24fix.us", hashed_password=get_password_hash("dispatch123"), role="dispatcher", tech_id=None),
        models.User(name="Mike Miller", email="mike@24fix.us", hashed_password=get_password_hash("mike123"), role="technician", tech_id="tech_1"),
        models.User(name="Marcus Vance", email="marcus@24fix.us", hashed_password=get_password_hash("marcus123"), role="technician", tech_id="tech_2"),
        models.User(name="Business Owner", email="owner@fixflow.com", hashed_password=get_password_hash("owner123"), role="owner", tech_id=None),
        models.User(name="Sarah (Dispatch)", email="dispatch@fixflow.com", hashed_password=get_password_hash("dispatch123"), role="dispatcher", tech_id=None),
        models.User(name="Mike Miller", email="mike@fixflow.com", hashed_password=get_password_hash("mike123"), role="technician", tech_id="tech_1"),
        models.User(name="Marcus Vance", email="marcus@fixflow.com", hashed_password=get_password_hash("marcus123"), role="technician", tech_id="tech_2"),
    ]
    db.add_all(users)
    db.flush()

    # 3. Seed Jobs with Austin, TX GPS points for Map
    jobs = [
        models.Job(
            id="job_101",
            customer_name="Eleanor Vance",
            phone="(512) 555-0143",
            address="2401 South Congress Ave, Apt 3B",
            city="Austin",
            zip_code="78704",
            latitude=30.2392,
            longitude=-97.7554,
            appliance_type="Refrigerator",
            brand="Samsung",
            issue_description="French door unit leaking water from bottom compartment and ice maker jammed.",
            scheduled_date="2026-09-06",
            scheduled_time_window="09:00 AM - 11:00 AM",
            urgency="urgent",
            status="in_progress",
            assigned_tech_id="tech_1",
            diagnostic_fee=85.0,
            labor_cost=150.0,
            parts_cost=65.0,
            total_amount=300.0
        ),
        models.Job(
            id="job_102",
            customer_name="David Chen",
            phone="(512) 555-0188",
            address="1104 E 6th St",
            city="Austin",
            zip_code="78702",
            latitude=30.2642,
            longitude=-97.7289,
            appliance_type="Washing Machine",
            brand="LG",
            issue_description="Front load washer will not drain cycle, showing OE error code.",
            scheduled_date="2026-09-06",
            scheduled_time_window="11:30 AM - 01:30 PM",
            urgency="normal",
            status="scheduled",
            assigned_tech_id="tech_1",
            diagnostic_fee=85.0,
            total_amount=85.0
        ),
        models.Job(
            id="job_103",
            customer_name="Sofia Rodriguez",
            phone="(512) 555-0211",
            address="4500 Speedway",
            city="Austin",
            zip_code="78751",
            latitude=30.3065,
            longitude=-97.7265,
            appliance_type="Dishwasher",
            brand="Bosch",
            issue_description="Not heating water and cycle stops midway with E09 error.",
            scheduled_date="2026-09-06",
            scheduled_time_window="10:00 AM - 12:00 PM",
            urgency="normal",
            status="en_route",
            assigned_tech_id="tech_2",
            diagnostic_fee=85.0,
            total_amount=85.0
        ),
        models.Job(
            id="job_104",
            customer_name="James Wilson",
            phone="(512) 555-0329",
            address="3801 Guadalupe St",
            city="Austin",
            zip_code="78751",
            latitude=30.3012,
            longitude=-97.7388,
            appliance_type="Dryer",
            brand="Whirlpool",
            issue_description="Electric dryer tumbles but generates zero heat. Clothes remain damp.",
            scheduled_date="2026-09-06",
            scheduled_time_window="02:00 PM - 04:00 PM",
            urgency="normal",
            status="draft_ticket",
            assigned_tech_id=None,
            diagnostic_fee=85.0,
            total_amount=85.0
        )
    ]
    db.add_all(jobs)
    db.flush()

    # Initial timeline entries
    for job in jobs:
        t = models.JobTimeline(
            job_id=job.id,
            status=job.status,
            note="Ticket seeded in FixFlow CRM"
        )
        db.add(t)

    db.commit()
    db.close()
    print("[FixFlow] Seed completed successfully! Users, Techs, and Jobs initialized.")

if __name__ == "__main__":
    seed()
