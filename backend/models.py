import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from database import Base

def generate_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}"

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: generate_id("user_"))
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False, default="technician")  # owner, dispatcher, technician
    tech_id = Column(String, ForeignKey("technicians.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    technician = relationship("Technician", back_populates="user_account")

class Technician(Base):
    __tablename__ = "technicians"

    id = Column(String, primary_key=True)  # tech_1, tech_2 etc
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    phone = Column(String, default="(555) 000-0000")
    avatar = Column(String, default="TK")
    color = Column(String, default="#3b82f6")
    specialties = Column(JSON, default=list)  # ["Refrigerators", "Washers"]
    rating = Column(Float, default=5.0)
    jobs_completed_this_month = Column(Integer, default=0)
    revenue_this_month = Column(Float, default=0.0)

    # GPS coordinates for technician live tracking on map
    current_lat = Column(Float, nullable=True)
    current_lon = Column(Float, nullable=True)
    last_location_update = Column(DateTime, nullable=True)

    user_account = relationship("User", back_populates="technician", uselist=False)
    jobs = relationship("Job", back_populates="assigned_tech")
    shifts = relationship("Shift", back_populates="technician")

class Job(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True, default=lambda: generate_id("job_"))
    customer_name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    address = Column(String, nullable=False)
    city = Column(String, default="Austin")
    zip_code = Column(String, default="78701")

    # Geolocation coordinates for Map view & routing
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    appliance_type = Column(String, nullable=False)
    brand = Column(String, nullable=False)
    issue_description = Column(Text, nullable=False)
    scheduled_date = Column(String, nullable=False)  # YYYY-MM-DD
    scheduled_time_window = Column(String, nullable=False)  # 09:00 AM - 11:00 AM
    urgency = Column(String, default="normal")  # normal, urgent, emergency
    
    # Lifecycle status: draft_ticket -> scheduled -> en_route -> on_site -> in_progress -> parts_ordered -> completed -> canceled
    status = Column(String, default="draft_ticket")
    assigned_tech_id = Column(String, ForeignKey("technicians.id"), nullable=True)

    # Billing & Financials
    labor_cost = Column(Float, default=0.0)
    parts_cost = Column(Float, default=0.0)
    parts_used = Column(JSON, default=list)  # List of part names/descriptions
    diagnostic_fee = Column(Float, default=85.0)
    total_amount = Column(Float, default=0.0)
    payment_status = Column(String, default="unpaid")  # unpaid, paid_card, paid_cash, invoice_sent

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assigned_tech = relationship("Technician", back_populates="jobs")
    timeline = relationship("JobTimeline", back_populates="job", cascade="all, delete-orphan", order_by="JobTimeline.timestamp")

class JobTimeline(Base):
    __tablename__ = "job_timeline"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(String, ForeignKey("jobs.id"), nullable=False)
    status = Column(String, nullable=False)
    note = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    job = relationship("Job", back_populates="timeline")

class Shift(Base):
    __tablename__ = "shifts"

    id = Column(String, primary_key=True, default=lambda: generate_id("shift_"))
    tech_id = Column(String, ForeignKey("technicians.id"), nullable=False)
    date = Column(String, nullable=False)  # YYYY-MM-DD
    start_time = Column(String, default="08:00")
    end_time = Column(String, default="17:00")
    status = Column(String, default="confirmed")  # confirmed, pending, day_off

    technician = relationship("Technician", back_populates="shifts")
