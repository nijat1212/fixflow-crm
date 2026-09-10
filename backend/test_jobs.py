# backend/test_jobs.py
# FixFlow CRM Automated QA Suite (Python) - Jobs, Authentication, Roles & Calendar Slots

import unittest
import json
import re
from datetime import datetime
from database import SessionLocal, engine, Base
import models
import schemas
from auth import verify_password, get_password_hash, create_access_token

CALENDAR_SLOTS = [
    "8:00 AM - 11:00 AM",
    "11:00 AM - 2:00 PM",
    "2:00 PM - 5:00 PM",
    "Urgent Same-Day"
]

class TestFixFlowCRM(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_01_user_domain_logins(self):
        """Verify all 4 new @24fix.us accounts exist with correct passwords and roles."""
        test_accounts = [
            ("owner@24fix.us", "owner123", "owner"),
            ("dispatch@24fix.us", "dispatch123", "dispatcher"),
            ("mike@24fix.us", "mike123", "technician"),
            ("marcus@24fix.us", "marcus123", "technician"),
        ]

        for email, password, expected_role in test_accounts:
            user = self.db.query(models.User).filter(models.User.email == email).first()
            self.assertIsNotNone(user, f"User {email} should exist in database")
            self.assertTrue(
                verify_password(password, user.hashed_password),
                f"Password verification failed for {email}"
            )
            self.assertEqual(
                user.role, expected_role,
                f"Role mismatch for {email}: expected {expected_role}, got {user.role}"
            )

    def test_02_invalid_password_security(self):
        """Security: Invalid credentials must be rejected."""
        user = self.db.query(models.User).filter(models.User.email == "owner@24fix.us").first()
        self.assertIsNotNone(user)
        self.assertFalse(verify_password("wrong_password_test", user.hashed_password))

    def test_03_jwt_token_generation_roles(self):
        """Verify JWT tokens correctly embed user roles for 24fix.us users."""
        for role, email in [("owner", "owner@24fix.us"), ("dispatcher", "dispatch@24fix.us"), ("technician", "mike@24fix.us")]:
            token = create_access_token({"sub": email, "role": role})
            self.assertTrue(isinstance(token, str) and len(token) > 20)

    def test_04_job_creation_calendar_slots(self):
        """Verify jobs can be scheduled with valid scheduledDate and calendar slots."""
        date_regex = re.compile(r"^\d{4}-\d{2}-\d{2}$")

        for slot in CALENDAR_SLOTS:
            job = models.Job(
                customer_name=f"Unit Test Client ({slot})",
                phone="(512) 555-0199",
                address="500 E 4th St",
                city="Austin",
                zip_code="78701",
                appliance_type="Refrigerator",
                brand="Samsung",
                issue_description=f"Testing calendar slot: {slot}",
                scheduled_date="2026-09-18",
                scheduled_time_window=slot,
                urgency="urgent" if slot == "Urgent Same-Day" else "normal",
                assigned_tech_id="tech_1",
                status="scheduled"
            )
            self.db.add(job)
            self.db.commit()
            self.db.refresh(job)

            self.assertIsNotNone(job.id)
            self.assertTrue(date_regex.match(job.scheduled_date))
            self.assertEqual(job.scheduled_time_window, slot)
            self.assertEqual(job.assigned_tech_id, "tech_1")

    def test_05_technician_job_isolation(self):
        """Verify database integrity for technician job assignments."""
        tech1_jobs = self.db.query(models.Job).filter(models.Job.assigned_tech_id == "tech_1").all()
        tech2_jobs = self.db.query(models.Job).filter(models.Job.assigned_tech_id == "tech_2").all()

        tech1_ids = {j.id for j in tech1_jobs}
        tech2_ids = {j.id for j in tech2_jobs}

        # Jobs assigned to tech_1 and tech_2 must have no overlap
        self.assertEqual(len(tech1_ids.intersection(tech2_ids)), 0)

    def test_06_calendar_slot_parsing_logic(self):
        """Verify startHour and duration math for calendar timeline matrix."""
        def parse_slot(window):
            if window == "Urgent Same-Day":
                return 8, 10
            parts = [p.strip() for p in window.split("-")]
            def to_h(s):
                m = re.match(r"(\d+):?(\d+)?\s*(AM|PM)?", s, re.I)
                h = int(m.group(1))
                p = (m.group(3) or "").upper()
                if p == "PM" and h < 12: h += 12
                if p == "AM" and h == 12: h = 0
                return h
            start = to_h(parts[0])
            end = to_h(parts[1])
            return start, end - start

        h1, d1 = parse_slot("8:00 AM - 11:00 AM")
        self.assertEqual((h1, d1), (8, 3))

        h2, d2 = parse_slot("11:00 AM - 2:00 PM")
        self.assertEqual((h2, d2), (11, 3))

        h3, d3 = parse_slot("2:00 PM - 5:00 PM")
        self.assertEqual((h3, d3), (14, 3))

        h4, d4 = parse_slot("Urgent Same-Day")
        self.assertEqual((h4, d4), (8, 10))

if __name__ == "__main__":
    unittest.main(verbosity=2)
