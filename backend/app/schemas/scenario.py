from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
from uuid import UUID

class ScenarioCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    roads: List[Dict[str, Any]] = Field(default_factory=list)
    traffic_lights: List[Dict[str, Any]] = Field(default_factory=list)
    stop_signs: List[Dict[str, Any]] = Field(default_factory=list)
    crosswalks: List[Dict[str, Any]] = Field(default_factory=list)
    hazards: List[Dict[str, Any]] = Field(default_factory=list)
    weather: str = Field(default="clear")
    weather_intensity: float = Field(default=0.5, ge=0.0, le=1.0)

class ScenarioUpdate(BaseModel):
    name: Optional[str] = None
    roads: Optional[List[Dict[str, Any]]] = None
    traffic_lights: Optional[List[Dict[str, Any]]] = None
    stop_signs: Optional[List[Dict[str, Any]]] = None
    crosswalks: Optional[List[Dict[str, Any]]] = None
    hazards: Optional[List[Dict[str, Any]]] = None
    weather: Optional[str] = None
    weather_intensity: Optional[float] = Field(None, ge=0.0, le=1.0)

class ScenarioResponse(BaseModel):
    id: UUID
    name: str
    roads: List[Dict[str, Any]]
    traffic_lights: List[Dict[str, Any]]
    stop_signs: List[Dict[str, Any]]
    crosswalks: List[Dict[str, Any]]
    hazards: List[Dict[str, Any]]
    weather: str
    weather_intensity: float
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
