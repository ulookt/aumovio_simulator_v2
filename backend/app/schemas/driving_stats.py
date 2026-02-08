from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class DrivingStatsCreate(BaseModel):
    """Request schema for submitting driving stats after a session."""
    job_id: UUID
    scenario_id: UUID
    
    # Driving metrics
    off_road_count: int = 0
    red_light_violations: int = 0
    yellow_light_violations: int = 0
    turn_smoothness_score: float = 100.0
    
    # Summary stats
    duration_seconds: float = 0.0
    max_speed: float = 0.0
    avg_speed: float = 0.0
    distance_traveled: float = 0.0


class DrivingStatsResponse(BaseModel):
    """Response schema for driving stats."""
    id: UUID
    job_id: UUID
    scenario_id: UUID
    session_number: int
    
    off_road_count: int
    red_light_violations: int
    yellow_light_violations: int
    turn_smoothness_score: float
    
    duration_seconds: float
    max_speed: float
    avg_speed: float
    distance_traveled: float
    
    ai_feedback: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class DrivingStatsSummary(BaseModel):
    """Summary for scenario session list."""
    id: UUID
    job_id: UUID
    session_number: int
    off_road_count: int
    red_light_violations: int
    yellow_light_violations: int
    turn_smoothness_score: float
    duration_seconds: float
    created_at: datetime
    
    class Config:
        from_attributes = True
