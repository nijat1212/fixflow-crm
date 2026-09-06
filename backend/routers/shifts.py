from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from auth import get_current_user, require_dispatcher_or_owner

router = APIRouter(prefix="/api/shifts", tags=["Shifts & Schedule"])

@router.get("", response_model=List[schemas.ShiftResponse])
def get_shifts(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Shift).all()

@router.post("", response_model=schemas.ShiftResponse)
def create_shift(
    data: schemas.ShiftCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_dispatcher_or_owner)
):
    shift = models.Shift(
        tech_id=data.tech_id,
        date=data.date,
        start_time=data.start_time,
        end_time=data.end_time,
        status=data.status
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return shift

@router.delete("/{shift_id}")
def delete_shift(
    shift_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_dispatcher_or_owner)
):
    shift = db.query(models.Shift).filter(models.Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    db.delete(shift)
    db.commit()
    return {"status": "deleted", "id": shift_id}
