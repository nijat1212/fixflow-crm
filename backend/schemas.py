from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

# ── Auth & User Schemas ────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"

class UserBase(BaseModel):
    name: str
    email: str
    role: str  # owner, dispatcher, technician
    tech_id: Optional[str] = None

class UserCreate(UserBase):
    password: str
    phone: Optional[str] = "(555) 000-0000"

class UserResponse(UserBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True

class PasswordResetRequest(BaseModel):
    new_password: Optional[str] = None

class PasswordResetResponse(BaseModel):
    status: str
    user_id: str
    name: str
    email: str
    new_password: str

# ── Technician Schemas ─────────────────────────────────────────────────────────
class TechnicianBase(BaseModel):
    name: str
    email: str
    phone: str = "(555) 000-0000"
    avatar: str = "TK"
    color: str = "#3b82f6"
    specialties: List[str] = ["General Repairs"]
    rating: float = 5.0

class TechnicianLocationUpdate(BaseModel):
    lat: float
    lon: float

class TechnicianResponse(TechnicianBase):
    id: str
    jobs_completed_this_month: int = 0
    revenue_this_month: float = 0.0
    current_lat: Optional[float] = None
    current_lon: Optional[float] = None
    last_location_update: Optional[datetime] = None

    class Config:
        from_attributes = True

# ── Job Schemas ────────────────────────────────────────────────────────────────
class JobTimelineResponse(BaseModel):
    status: str
    note: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True

class JobCreate(BaseModel):
    customer_name: str
    phone: str
    address: str
    city: str = "Austin"
    zip_code: str = "78701"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    appliance_type: str
    brand: str
    issue_description: str
    scheduled_date: str
    scheduled_time_window: str
    urgency: str = "normal"
    assigned_tech_id: Optional[str] = None

class JobStatusUpdate(BaseModel):
    status: str
    note: Optional[str] = None
    labor_cost: Optional[float] = None
    parts_cost: Optional[float] = None
    diagnostic_fee: Optional[float] = None

class JobAssignRequest(BaseModel):
    tech_id: str

class JobResponse(BaseModel):
    id: str
    customer_name: str
    phone: str
    address: str
    city: str
    zip_code: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    appliance_type: str
    brand: str
    issue_description: str
    scheduled_date: str
    scheduled_time_window: str
    urgency: str
    status: str
    assigned_tech_id: Optional[str] = None
    labor_cost: float = 0.0
    parts_cost: float = 0.0
    diagnostic_fee: float = 85.0
    total_amount: float = 0.0
    payment_status: str = "unpaid"
    created_at: datetime
    updated_at: datetime
    timeline: List[JobTimelineResponse] = []

    class Config:
        from_attributes = True

# ── Shift Schemas ──────────────────────────────────────────────────────────────
class ShiftCreate(BaseModel):
    tech_id: str
    date: str
    start_time: str = "08:00"
    end_time: str = "17:00"
    status: str = "confirmed"

class ShiftResponse(BaseModel):
    id: str
    tech_id: str
    date: str
    start_time: str
    end_time: str
    status: str

    class Config:
        from_attributes = True
