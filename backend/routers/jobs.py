from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from auth import get_current_user, require_dispatcher_or_owner

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
        brand=data.brand,
        issue_description=data.issue_description,
        scheduled_date=data.scheduled_date,
        scheduled_time_window=data.scheduled_time_window,
        urgency=data.urgency,
        assigned_tech_id=data.assigned_tech_id,
        status="scheduled" if data.assigned_tech_id else "draft_ticket"
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
