from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from datetime import datetime

from app.database import get_db
from app.models.job import Job, JobStatus, SimulationType
from app.models.scenario import Scenario
from app.models.telemetry import Telemetry
from app.models.safety_risk import SafetyRisk
from app.models.assistant import AssistantMessage
from app.schemas.job import JobCreate, JobResponse
from app.tasks.simulation_tasks import run_ai_simulation

router = APIRouter(prefix="/jobs", tags=["jobs"])

@router.post("/", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
def create_job(job: JobCreate, db: Session = Depends(get_db)):
    """Create a new simulation job"""
    # Verify scenario exists
    scenario = db.query(Scenario).filter(Scenario.id == job.scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    # Estimate compute cost (simple formula)
    cost_per_second = 0.01
    cost_estimate = job.duration_seconds * cost_per_second * job.vehicle_count * 0.1
    
    db_job = Job(
        scenario_id=job.scenario_id,
        simulation_type=job.simulation_type,
        duration_seconds=job.duration_seconds,
        vehicle_count=job.vehicle_count,
        weather=scenario.weather,
        compute_cost_estimate=round(cost_estimate, 2),
        status=JobStatus.PENDING
    )
    db.add(db_job)
    db.commit()
    db.refresh(db_job)
    
    # Dispatch Celery task for AI simulations
    if job.simulation_type == "ai_simulation":
        from app.tasks.simulation_tasks import run_ai_simulation
        task = run_ai_simulation.delay(
            str(db_job.id), 
            {
                "roads": scenario.roads,
                "traffic_lights": scenario.traffic_lights,
                "stop_signs": scenario.stop_signs,
                "crosswalks": scenario.crosswalks,
                "hazards": scenario.hazards,
                "weather": scenario.weather,
                "weather_intensity": scenario.weather_intensity
            }
        )
        db_job.celery_task_id = task.id
        db.commit()
    
    return db_job

@router.get("/", response_model=List[JobResponse])
def list_jobs(
    status_filter: str = None, 
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db)
):
    """List all jobs with optional status filter"""
    query = db.query(Job)
    
    if status_filter:
        query = query.filter(Job.status == status_filter)
    
    jobs = query.order_by(Job.created_at.desc()).offset(skip).limit(limit).all()
    return jobs

@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: UUID, db: Session = Depends(get_db)):
    """Get a specific job by ID"""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.patch("/{job_id}/status")
def update_job_status(
    job_id: UUID, 
    new_status: str,
    db: Session = Depends(get_db)
):
    """Update job status (internal endpoint for workers)"""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job.status = new_status
    if new_status == JobStatus.COMPLETED:
        job.completed_at = datetime.utcnow()
    
    db.commit()
    return {"status": "updated"}


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(job_id: UUID, db: Session = Depends(get_db)):
    """Delete a job and its related telemetry, safety_risks, and assistant_messages"""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    # Delete related records first (foreign key constraints)
    db.query(Telemetry).filter(Telemetry.job_id == job_id).delete()
    db.query(SafetyRisk).filter(SafetyRisk.job_id == job_id).delete()
    db.query(AssistantMessage).filter(AssistantMessage.job_id == job_id).delete()
    db.delete(job)
    db.commit()
    return None
