from sqlalchemy import Column, String, Float, DateTime, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base

class WeatherType(str, enum.Enum):
    CLEAR = "clear"
    RAIN = "rain"
    FOG = "fog"
    SNOW = "snow"

class Scenario(Base):
    __tablename__ = "scenarios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    
    # Road network stored as JSONB array of road segments
    # Each segment: {type: 'road', points: [{x, y}], width: number, lanes: number}
    roads = Column(JSONB, default=list)
    
    # Traffic infrastructure stored as JSONB
    # traffic_lights: [{x, y, cycle: {green: ms, yellow: ms, red: ms}}]
    traffic_lights = Column(JSONB, default=list)
    
    # stop_signs: [{x, y, direction: degrees}]
    stop_signs = Column(JSONB, default=list)
    
    # crosswalks: [{x1, y1, x2, y2, pedestrian_spawn_rate: number}]
    crosswalks = Column(JSONB, default=list)
    
    # Hazards: [{type: 'cone'|'barrier'|'parked_car'|'slippery', x, y}]
    hazards = Column(JSONB, default=list)
    
    # Weather configuration
    weather = Column(SQLEnum(WeatherType), default=WeatherType.CLEAR)
    weather_intensity = Column(Float, default=0.5)  # 0-1 scale
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
