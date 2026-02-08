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


# ============ DRIVING STATS ENDPOINTS ============

from app.models.driving_stats import DrivingStats
from app.models.scenario import Scenario
from app.schemas.driving_stats import DrivingStatsCreate, DrivingStatsResponse, DrivingStatsSummary


@router.post("/driving-stats", response_model=DrivingStatsResponse, status_code=status.HTTP_201_CREATED)
def create_driving_stats(stats: DrivingStatsCreate, db: Session = Depends(get_db)):
    """Store driving performance stats after a Manual Driving session."""
    # Verify job exists
    job = db.query(Job).filter(Job.id == stats.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Calculate session number for this scenario
    existing_count = db.query(DrivingStats).filter(
        DrivingStats.scenario_id == stats.scenario_id
    ).count()
    session_number = existing_count + 1
    
    db_stats = DrivingStats(
        **stats.model_dump(),
        session_number=session_number
    )
    db.add(db_stats)
    db.commit()
    db.refresh(db_stats)
    return db_stats


@router.get("/driving-stats/{job_id}", response_model=DrivingStatsResponse)
def get_driving_stats(job_id: UUID, db: Session = Depends(get_db)):
    """Get driving stats for a specific job."""
    stats = db.query(DrivingStats).filter(DrivingStats.job_id == job_id).first()
    if not stats:
        raise HTTPException(status_code=404, detail="Driving stats not found")
    return stats


@router.get("/driving-stats/scenario/{scenario_id}", response_model=List[DrivingStatsSummary])
def get_scenario_sessions(scenario_id: UUID, db: Session = Depends(get_db)):
    """List all driving sessions for a scenario."""
    sessions = db.query(DrivingStats).filter(
        DrivingStats.scenario_id == scenario_id
    ).order_by(DrivingStats.session_number.desc()).all()
    return sessions


@router.post("/driving-stats/{job_id}/generate-feedback")
def generate_driving_feedback(job_id: UUID, db: Session = Depends(get_db)):
    """Generate AI feedback for driving stats using OpenAI."""
    import os
    from openai import OpenAI
    
    stats = db.query(DrivingStats).filter(DrivingStats.job_id == job_id).first()
    if not stats:
        raise HTTPException(status_code=404, detail="Driving stats not found")
    
    # Get scenario name
    scenario = db.query(Scenario).filter(Scenario.id == stats.scenario_id).first()
    scenario_name = scenario.name if scenario else "Unknown Scenario"
    
    # Build prompt for AI analysis
    prompt = f"""Analyze this driving session and provide constructive feedback:

Scenario: {scenario_name}
Session #{stats.session_number}


**DRIVING METRICS:**
- Off-road events: {stats.off_road_count} times
- Red light violations: {stats.red_light_violations}
- Yellow light violations: {stats.yellow_light_violations}
- Duration: {stats.duration_seconds:.1f} seconds
- Max speed: {stats.max_speed:.1f} km/h
- Average speed: {stats.avg_speed:.1f} km/h
- Distance traveled: {stats.distance_traveled:.1f} meters
- Turn smoothness score: {stats.turn_smoothness_score:.1f}/100

Please provide:
1. An overall driving grade (A-F)
2. Specific strengths observed
3. Areas for improvement
4. 2-3 actionable tips to become a better driver

IMPORTANT GUIDELINES:
- **Prioritize safety**: Off-road events and red light violations should heavily impact the grade.
- **Turn smoothness**: This metric is often high, so please **do not weigh it heavily** in your evaluation. Only mention it briefly at the end as a minor point. Do not let good turn smoothness mask poor safety behavior.

Keep the feedback encouraging but honest. Format nicely with emojis."""

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {"feedback": "⚠️ OpenAI API key not configured. Cannot generate AI feedback."}
    
    try:
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a friendly driving instructor analyzing simulation driving data. Be encouraging but give honest feedback."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=500,
            temperature=0.7
        )
        
        feedback = response.choices[0].message.content
        
        # Cache the feedback in the database
        stats.ai_feedback = feedback
        db.commit()
        
        return {"feedback": feedback}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")
