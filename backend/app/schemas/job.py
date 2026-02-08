from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID

class JobCreate(BaseModel):
    scenario_id: UUID
    simulation_type: str = Field(..., pattern="^(ai_simulation|manual_driving)$")
    duration_seconds: int = Field(default=60, ge=10, le=600)
    vehicle_count: int = Field(default=5, ge=1, le=20)

class JobResponse(BaseModel):
    id: UUID
    scenario_id: UUID
    simulation_type: str
    status: str
    celery_task_id: Optional[str] = None
    duration_seconds: int
    vehicle_count: int
    weather: Optional[str] = None
    compute_cost_estimate: float
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
