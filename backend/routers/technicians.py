from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from auth import get_current_user

router = APIRouter(prefix="/api/technicians", tags=["Technicians"])

@router.get("", response_model=List[schemas.TechnicianResponse])
def get_technicians(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Technician).all()

@router.get("/{tech_id}", response_model=schemas.TechnicianResponse)
def get_technician(tech_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    tech = db.query(models.Technician).filter(models.Technician.id == tech_id).first()
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    return tech

@router.post("/{tech_id}/location")
def update_technician_location(
    tech_id: str,
    loc: schemas.TechnicianLocationUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Only the technician themselves or an owner/dispatcher can update location
    if current_user.role == "technician" and current_user.tech_id != tech_id:
        raise HTTPException(status_code=403, detail="Cannot update another technician's location")

    tech = db.query(models.Technician).filter(models.Technician.id == tech_id).first()
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")

    tech.current_lat = loc.lat
    tech.current_lon = loc.lon
    tech.last_location_update = datetime.utcnow()
    db.commit()

    return {"status": "success", "tech_id": tech_id, "lat": loc.lat, "lon": loc.lon}
