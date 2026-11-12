from typing import List, Optional
from datetime import datetime
import os
import uuid
import shutil
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from auth import get_current_user, require_dispatcher_or_owner, require_owner

router = APIRouter(prefix="/api/jobs", tags=["Repair Jobs"])

@router.get("", response_model=List[schemas.JobResponse])
def list_jobs(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Job)

    # Role-based restriction: Technician only sees their own assigned jobs!
    if current_user.role == "technician":
        if not current_user.tech_id:
            return []
        query = query.filter(models.Job.assigned_tech_id == current_user.tech_id)

    if status_filter:
        query = query.filter(models.Job.status == status_filter)

    return query.order_by(models.Job.created_at.desc()).all()

@router.post("", response_model=schemas.JobResponse)
def create_job(
    data: schemas.JobCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_dispatcher_or_owner)
):
    new_job = models.Job(
        customer_name=data.customer_name,
        phone=data.phone,
        address=data.address,
        city=data.city,
        zip_code=data.zip_code,
        latitude=data.latitude,
        longitude=data.longitude,
        appliance_type=data.appliance_type,
        brand=data.brand or "",
        issue_description=data.issue_description,
        scheduled_date=data.scheduled_date,
        scheduled_time_window=data.scheduled_time_window or "Anytime",
        urgency=data.urgency or "normal",
        assigned_tech_id=data.assigned_tech_id,
        status="scheduled" if data.assigned_tech_id else "draft_ticket",
        photos=data.photos or []
    )

    db.add(new_job)
    db.flush()

    # Initial timeline entry
    timeline_entry = models.JobTimeline(
        job_id=new_job.id,
        status=new_job.status,
        note="Ticket created in FixFlow CRM"
    )
    db.add(timeline_entry)
    db.commit()
    db.refresh(new_job)
    return new_job

@router.get("/{job_id}", response_model=schemas.JobResponse)
def get_job(job_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if current_user.role == "technician" and job.assigned_tech_id != current_user.tech_id:
        raise HTTPException(status_code=403, detail="Access denied to this job")

    return job

@router.put("/{job_id}", response_model=schemas.JobResponse)
@router.patch("/{job_id}", response_model=schemas.JobResponse)
def update_job(
    job_id: str,
    data: schemas.JobUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_dispatcher_or_owner)
):
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    changed_fields = []
    for field, val in data.dict(exclude_unset=True).items():
        if val is not None and hasattr(job, field):
            old_val = getattr(job, field)
            if old_val != val:
                setattr(job, field, val)
                changed_fields.append(field)

    if changed_fields:
        job.updated_at = datetime.utcnow()
        timeline_entry = models.JobTimeline(
            job_id=job.id,
            status=job.status,
            note=f"Job updated by {current_user.name} ({current_user.role}): {', '.join(changed_fields)}"
        )
        db.add(timeline_entry)

    db.commit()
    db.refresh(job)
    return job

@router.post("/{job_id}/assign", response_model=schemas.JobResponse)
def assign_job(
    job_id: str,
    data: schemas.JobAssignRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_dispatcher_or_owner)
):
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    tech = db.query(models.Technician).filter(models.Technician.id == data.tech_id).first()
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")

    job.assigned_tech_id = data.tech_id
    job.status = "scheduled"

    timeline_entry = models.JobTimeline(
        job_id=job.id,
        status="scheduled",
        note=f"Assigned to technician {tech.name} ({tech.id})"
    )
    db.add(timeline_entry)
    db.commit()
    db.refresh(job)
    return job

@router.post("/{job_id}/status", response_model=schemas.JobResponse)
def update_job_status(
    job_id: str,
    data: schemas.JobStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if current_user.role == "technician" and job.assigned_tech_id != current_user.tech_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this job")

    job.status = data.status

    # Financial update if provided
    if data.labor_cost is not None:
        job.labor_cost = data.labor_cost
    if data.parts_cost is not None:
        job.parts_cost = data.parts_cost
    if data.diagnostic_fee is not None:
        job.diagnostic_fee = data.diagnostic_fee

    if data.parts_used is not None:
        job.parts_used = data.parts_used

    if data.total_amount is not None:
        job.total_amount = data.total_amount
    else:
        job.total_amount = job.diagnostic_fee + job.labor_cost + job.parts_cost

    note_parts = []
    if data.parts_used:
        note_parts.append(f"Parts Used: {', '.join(data.parts_used)}")
    if data.note:
        note_parts.append(data.note)
    final_note = " — ".join(note_parts) if note_parts else f"Status changed to {data.status}"

    timeline_entry = models.JobTimeline(
        job_id=job.id,
        status=data.status,
        note=final_note
    )
    db.add(timeline_entry)
    db.commit()
    db.refresh(job)
    return job

@router.delete("/{job_id}")
def delete_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner)
):
    """
    Permanently delete a repair ticket.
    Strictly restricted to Business Owner role.
    """
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Cascade delete timeline entries explicitly to prevent orphan foreign keys
    db.query(models.JobTimeline).filter(models.JobTimeline.job_id == job_id).delete()
    db.delete(job)
    db.commit()
    return {"status": "ok", "message": f"Job {job_id} deleted successfully", "id": job_id}


class PhotoUrlRequest(BaseModel):
    photo_url: str

@router.post("/{job_id}/photos", response_model=schemas.JobResponse)
def upload_job_photo(
    job_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Upload photo image file for a job (appliance model tag, damage, repair progress, invoice)"""
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if current_user.role == "technician" and job.assigned_tech_id != current_user.tech_id:
        raise HTTPException(status_code=403, detail="Not authorized to attach photos to this job")

    upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
    os.makedirs(upload_dir, exist_ok=True)

    ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    if not ext:
        ext = ".jpg"
    safe_name = f"{job_id}_{uuid.uuid4().hex[:8]}{ext}"
    dest_path = os.path.join(upload_dir, safe_name)

    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    photo_url = f"/uploads/{safe_name}"
    current_photos = list(job.photos or [])
    current_photos.append(photo_url)
    job.photos = current_photos
    job.updated_at = datetime.utcnow()

    timeline_entry = models.JobTimeline(
        job_id=job.id,
        status=job.status,
        note=f"Photo attached by {current_user.name} ({current_user.role})"
    )
    db.add(timeline_entry)
    db.commit()
    db.refresh(job)
    return job

@router.post("/{job_id}/photos/url", response_model=schemas.JobResponse)
def add_job_photo_url(
    job_id: str,
    data: PhotoUrlRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Add photo data URL or external link to a job"""
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    current_photos = list(job.photos or [])
    current_photos.append(data.photo_url)
    job.photos = current_photos
    job.updated_at = datetime.utcnow()

    timeline_entry = models.JobTimeline(
        job_id=job.id,
        status=job.status,
        note=f"Photo attached by {current_user.name} ({current_user.role})"
    )
    db.add(timeline_entry)
    db.commit()
    db.refresh(job)
    return job
