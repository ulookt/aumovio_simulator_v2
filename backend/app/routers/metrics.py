from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.database import get_db
from app.models.telemetry import Telemetry
from app.models.safety_risk import SafetyRisk
from app.models.job import Job
from app.schemas.telemetry import TelemetryCreate, TelemetryResponse

router = APIRouter(prefix="/metrics", tags=["metrics"])

@router.post("/telemetry", response_model=TelemetryResponse, status_code=status.HTTP_201_CREATED)
def create_telemetry(telemetry: TelemetryCreate, db: Session = Depends(get_db)):
    """Store telemetry data point"""
    # Verify job exists
    job = db.query(Job).filter(Job.id == telemetry.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    db_telemetry = Telemetry(**telemetry.model_dump())
    db.add(db_telemetry)
    db.commit()
    db.refresh(db_telemetry)
    return db_telemetry

@router.get("/telemetry/{job_id}", response_model=List[TelemetryResponse])
def get_job_telemetry(job_id: UUID, db: Session = Depends(get_db)):
    """Get all telemetry data for a job"""
    telemetry = db.query(Telemetry).filter(
        Telemetry.job_id == job_id
    ).order_by(Telemetry.timestamp).all()
    
    if not telemetry:
        raise HTTPException(status_code=404, detail="No telemetry data found")
    
    return telemetry

@router.get("/safety/{job_id}")
def get_safety_risk(job_id: UUID, db: Session = Depends(get_db)):
    """Get safety risk analysis for a job"""
    safety_risk = db.query(SafetyRisk).filter(SafetyRisk.job_id == job_id).first()
    
    if not safety_risk:
        raise HTTPException(status_code=404, detail="Safety risk data not found")
    
    return {
        "id": safety_risk.id,
        "job_id": safety_risk.job_id,
        "collision_heatmap": safety_risk.collision_heatmap,
        "near_miss_count": safety_risk.near_miss_count,
        "hazard_exposure_score": safety_risk.hazard_exposure_score,
        "overall_safety_score": safety_risk.overall_safety_score,
        "created_at": safety_risk.created_at
    }

@router.get("/insights/{job_id}")
def get_ai_insights(job_id: UUID, db: Session = Depends(get_db)):
    """Get AI-generated insights for a job"""
    from app.models.assistant import AssistantMessage, ContextType
    
    insights = db.query(AssistantMessage).filter(
        AssistantMessage.job_id == job_id,
        AssistantMessage.context_type == ContextType.TELEMETRY_ANALYSIS
    ).order_by(AssistantMessage.created_at.desc()).first()
    
    if not insights:
        return {"insights": "No AI insights generated yet"}
    
    return {
        "id": insights.id,
        "content": insights.content,
        "created_at": insights.created_at
    }
