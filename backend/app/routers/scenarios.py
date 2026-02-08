from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.database import get_db
from app.models.scenario import Scenario
from app.models.job import Job
from app.models.telemetry import Telemetry
from app.models.safety_risk import SafetyRisk
from app.models.assistant import AssistantMessage
from app.schemas.scenario import ScenarioCreate, ScenarioUpdate, ScenarioResponse

router = APIRouter(prefix="/scenarios", tags=["scenarios"])

@router.post("/", response_model=ScenarioResponse, status_code=status.HTTP_201_CREATED)
def create_scenario(scenario: ScenarioCreate, db: Session = Depends(get_db)):
    """Create a new driving scenario"""
    db_scenario = Scenario(
        name=scenario.name,
        roads=scenario.roads,
        traffic_lights=scenario.traffic_lights,
        stop_signs=scenario.stop_signs,
        crosswalks=scenario.crosswalks,
        hazards=scenario.hazards,
        weather=scenario.weather,
        weather_intensity=scenario.weather_intensity
    )
    db.add(db_scenario)
    db.commit()
    db.refresh(db_scenario)
    return db_scenario

@router.get("/", response_model=List[ScenarioResponse])
def list_scenarios(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """List all scenarios"""
    scenarios = db.query(Scenario).offset(skip).limit(limit).all()
    return scenarios

@router.get("/{scenario_id}", response_model=ScenarioResponse)
def get_scenario(scenario_id: UUID, db: Session = Depends(get_db)):
    """Get a specific scenario by ID"""
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return scenario

@router.put("/{scenario_id}", response_model=ScenarioResponse)
def update_scenario(scenario_id: UUID, scenario_update: ScenarioUpdate, db: Session = Depends(get_db)):
    """Update an existing scenario"""
    db_scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not db_scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    update_data = scenario_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_scenario, field, value)
    
    db.commit()
    db.refresh(db_scenario)
    return db_scenario

@router.delete("/{scenario_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scenario(scenario_id: UUID, db: Session = Depends(get_db)):
    """Delete a scenario and all jobs (and their related data) that reference it"""
    db_scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not db_scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    # Delete all jobs for this scenario and their related records (foreign key order)
    jobs = db.query(Job).filter(Job.scenario_id == scenario_id).all()
    for job in jobs:
        db.query(Telemetry).filter(Telemetry.job_id == job.id).delete()
        db.query(SafetyRisk).filter(SafetyRisk.job_id == job.id).delete()
        db.query(AssistantMessage).filter(AssistantMessage.job_id == job.id).delete()
        db.delete(job)

    db.delete(db_scenario)
    db.commit()
    return None
