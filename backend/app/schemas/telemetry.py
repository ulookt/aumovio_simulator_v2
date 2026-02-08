from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID

class TelemetryCreate(BaseModel):
    job_id: UUID
    timestamp: int = Field(..., ge=0)
    speed: float = Field(..., ge=0.0)
    acceleration: float = Field(default=0.0)
    brake_intensity: float = Field(default=0.0, ge=0.0, le=10.0)
    steering_angle: float = Field(default=0.0, ge=-45.0, le=45.0)
    position_x: float
    position_y: float
    lap_number: Optional[int] = None

class TelemetryResponse(BaseModel):
    id: UUID
    job_id: UUID
    timestamp: int
    speed: float
    acceleration: float
    brake_intensity: float
    steering_angle: float
    position_x: float
    position_y: float
    lap_number: Optional[int] = None

    class Config:
        from_attributes = True
