import sys
from datetime import datetime, timedelta
from database import SessionLocal, engine, Base
import models
from auth import get_password_hash

def reset_and_seed(force_reset: bool = False):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    if force_reset:
        print("[FixFlow] Resetting database tables...")
        # Clean existing data safely
        db.query(models.JobTimeline).delete()
        db.query(models.Job).delete()
        db.query(models.Shift).delete()
        db.query(models.User).delete()
        db.query(models.Technician).delete()
        db.commit()
    elif db.query(models.User).count() > 0:
        print("Database already contains data, skipping seed. Use --reset to reinitialize.")
        db.close()
        return

    print("[FixFlow] Seeding fresh, dynamic FixFlow CRM data...")

    today = datetime.now().date()
    yesterday = today - timedelta(days=1)
    tomorrow = today + timedelta(days=1)

    # 1. Technicians (with Austin, TX GPS coordinates for the map)
    tech1 = models.Technician(
        id="tech_1",
        name="Mike Miller",
        email="mike@fixflow.com",
        phone="(512) 234-5678",
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
        phone="(512) 876-5432",
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

    # 3. Dynamic Seed Jobs (Today, Tomorrow, and Completed History)
    jobs = [
        # Today: In Progress (Tech 1)
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
            scheduled_date=today.isoformat(),
            scheduled_time_window="09:00 AM - 11:00 AM",
            urgency="urgent",
            status="in_progress",
            assigned_tech_id="tech_1",
            diagnostic_fee=85.0,
            labor_cost=150.0,
            parts_cost=65.0,
            total_amount=300.0,
            payment_status="unpaid"
        ),
        # Today: Scheduled (Tech 1)
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
            scheduled_date=today.isoformat(),
            scheduled_time_window="11:30 AM - 01:30 PM",
            urgency="normal",
            status="scheduled",
            assigned_tech_id="tech_1",
            diagnostic_fee=85.0,
            labor_cost=0.0,
            parts_cost=0.0,
            total_amount=85.0,
            payment_status="unpaid"
        ),
        # Today: En Route (Tech 2)
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
            scheduled_date=today.isoformat(),
            scheduled_time_window="10:00 AM - 12:00 PM",
            urgency="normal",
            status="en_route",
            assigned_tech_id="tech_2",
            diagnostic_fee=85.0,
            labor_cost=0.0,
            parts_cost=0.0,
            total_amount=85.0,
            payment_status="unpaid"
        ),
        # Today: Draft Ticket / Unassigned (In Pool)
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
            scheduled_date=today.isoformat(),
            scheduled_time_window="02:00 PM - 04:00 PM",
            urgency="urgent",
            status="draft_ticket",
            assigned_tech_id=None,
            diagnostic_fee=85.0,
            labor_cost=0.0,
            parts_cost=0.0,
            total_amount=85.0,
            payment_status="unpaid"
        ),
        # Tomorrow: Scheduled (Tech 2)
        models.Job(
            id="job_105",
            customer_name="Amanda Clark",
            phone="(512) 555-0451",
            address="1500 Barton Springs Rd",
            city="Austin",
            zip_code="78704",
            latitude=30.2612,
            longitude=-97.7610,
            appliance_type="Oven / Range",
            brand="GE Profile",
            issue_description="Bake element will not ignite. Broil works fine.",
            scheduled_date=tomorrow.isoformat(),
            scheduled_time_window="09:00 AM - 11:00 AM",
            urgency="normal",
            status="scheduled",
            assigned_tech_id="tech_2",
            diagnostic_fee=85.0,
            total_amount=85.0,
            payment_status="unpaid"
        ),
        # Tomorrow: Scheduled (Tech 1)
        models.Job(
            id="job_106",
            customer_name="Robert Taylor",
            phone="(512) 555-0719",
            address="2200 S Lamar Blvd",
            city="Austin",
            zip_code="78704",
            latitude=30.2450,
            longitude=-97.7780,
            appliance_type="Microwave",
            brand="KitchenAid",
            issue_description="Arcing and loud buzzing when heating starts. Suspected magnetron.",
            scheduled_date=tomorrow.isoformat(),
            scheduled_time_window="01:00 PM - 03:00 PM",
            urgency="normal",
            status="scheduled",
            assigned_tech_id="tech_1",
            diagnostic_fee=85.0,
            total_amount=85.0,
            payment_status="unpaid"
        ),
        # Yesterday: Completed (Tech 1)
        models.Job(
            id="job_107",
            customer_name="Catherine Hall",
            phone="(512) 555-0992",
            address="1200 West Lynn St",
            city="Austin",
            zip_code="78703",
            latitude=30.2810,
            longitude=-97.7650,
            appliance_type="Refrigerator",
            brand="Sub-Zero",
            issue_description="Temperature fluctuating. Replaced evaporator thermistor sensor.",
            scheduled_date=yesterday.isoformat(),
            scheduled_time_window="10:00 AM - 12:00 PM",
            urgency="normal",
            status="completed",
            assigned_tech_id="tech_1",
            diagnostic_fee=85.0,
            labor_cost=120.0,
            parts_cost=75.0,
            total_amount=280.0,
            payment_status="paid_card"
        ),
        # Yesterday: Completed (Tech 2)
        models.Job(
            id="job_108",
            customer_name="Marcus Brody",
            phone="(512) 555-0633",
            address="701 Brazos St",
            city="Austin",
            zip_code="78701",
            latitude=30.2690,
            longitude=-97.7410,
            appliance_type="Washing Machine",
            brand="Maytag",
            issue_description="Loud grinding noise during spin cycle. Replaced drain pump motor assembly.",
            scheduled_date=yesterday.isoformat(),
            scheduled_time_window="02:00 PM - 04:00 PM",
            urgency="normal",
            status="completed",
            assigned_tech_id="tech_2",
            diagnostic_fee=85.0,
            labor_cost=150.0,
            parts_cost=110.0,
            total_amount=345.0,
            payment_status="paid_card"
        ),
    ]
    db.add_all(jobs)
    db.flush()

    # Initial timeline entries
    for job in jobs:
        t = models.JobTimeline(
            job_id=job.id,
            status=job.status,
            note=f"Ticket initialized as {job.status} in FixFlow CRM"
        )
        db.add(t)

    # 4. Weekly Duty Shifts for Current Week
    start_of_week = today - timedelta(days=today.weekday())  # Monday
    shifts = []
    for day_offset in range(7):
        shift_date = start_of_week + timedelta(days=day_offset)
        # Tech 1 & Tech 2 shifts
        if day_offset < 5:
            shifts.append(models.Shift(tech_id="tech_1", date=shift_date.isoformat(), start_time="08:00", end_time="17:00", status="Working"))
            shifts.append(models.Shift(tech_id="tech_2", date=shift_date.isoformat(), start_time="08:30", end_time="17:30", status="Working"))
        elif day_offset == 5:
            shifts.append(models.Shift(tech_id="tech_1", date=shift_date.isoformat(), start_time="09:00", end_time="15:00", status="Working"))
            shifts.append(models.Shift(tech_id="tech_2", date=shift_date.isoformat(), start_time="09:00", end_time="15:00", status="Off"))
        else:
            shifts.append(models.Shift(tech_id="tech_1", date=shift_date.isoformat(), start_time="00:00", end_time="00:00", status="Off"))
            shifts.append(models.Shift(tech_id="tech_2", date=shift_date.isoformat(), start_time="10:00", end_time="16:00", status="Working"))

    db.add_all(shifts)
    db.commit()
    db.close()
    print("[FixFlow] Seed completed successfully! Users, Techs, Shifts, and Jobs freshly initialized for today.")

if __name__ == "__main__":
    reset = "--reset" in sys.argv or "-r" in sys.argv
    reset_and_seed(force_reset=reset)

def seed():
    reset_and_seed(force_reset=False)
