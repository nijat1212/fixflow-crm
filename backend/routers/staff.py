from typing import List, Optional
import secrets
import string
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from auth import require_owner, get_password_hash

router = APIRouter(prefix="/api/staff", tags=["Staff Management"])

@router.get("", response_model=List[schemas.UserResponse])
def list_staff(db: Session = Depends(get_db), current_user: models.User = Depends(require_owner)):
    return db.query(models.User).all()

@router.post("", response_model=schemas.UserResponse)
def create_staff_member(
    data: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner)
):
    email = data.email.strip().lower()
    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An employee with this email already exists"
        )

    tech_id = None
    if data.role == "technician":
        tech_count = db.query(models.Technician).count()
        tech_id = f"tech_{tech_count + 1}"
        new_tech = models.Technician(
            id=tech_id,
            name=data.name,
            email=email,
            phone=data.phone or "(555) 000-0000",
            avatar="".join([part[0] for part in data.name.split()[:2]]).upper() or "TK",
            color="#3b82f6",
            specialties=["General Repairs"],
            rating=5.0
        )
        db.add(new_tech)
        db.flush()

    new_user = models.User(
        name=data.name,
        email=email,
        hashed_password=get_password_hash(data.password),
        role=data.role,
        tech_id=tech_id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/{user_id}/reset-password", response_model=schemas.PasswordResetResponse)
def reset_staff_password(
    user_id: str,
    data: Optional[schemas.PasswordResetRequest] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")

    new_password = (data and data.new_password) if data else None
    if not new_password:
        # Generate friendly secure temporary password (e.g. FixB4821!)
        new_password = f"Fix{secrets.choice(string.ascii_uppercase)}{secrets.randbelow(9000) + 1000}!"

    user.hashed_password = get_password_hash(new_password)
    db.commit()

    return {
        "status": "success",
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "new_password": new_password
    }
