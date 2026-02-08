from sqlalchemy import Column, Integer, Float, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
from app.database import Base


class DrivingStats(Base):
    """Stores driving performance metrics for Manual Driving sessions."""
    __tablename__ = "driving_stats"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), unique=True, nullable=False)
    scenario_id = Column(UUID(as_uuid=True), ForeignKey("scenarios.id"), nullable=False)
    
    # Session numbering per scenario (e.g., "Session #3 on Highway Map")
    session_number = Column(Integer, nullable=False, default=1)
    
    # Driving performance metrics
    off_road_count = Column(Integer, default=0)  # Times left the road
    red_light_violations = Column(Integer, default=0)  # Crossed on red
    yellow_light_violations = Column(Integer, default=0)  # Crossed on yellow
    turn_smoothness_score = Column(Float, default=100.0)  # 0-100, higher is smoother
    
    # Summary statistics
    duration_seconds = Column(Float, default=0.0)
    max_speed = Column(Float, default=0.0)  # km/h
    avg_speed = Column(Float, default=0.0)  # km/h
    distance_traveled = Column(Float, default=0.0)  # meters
    
    # Cached AI feedback (generated via OpenAI)
    ai_feedback = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    job = relationship("Job", backref="driving_stats", uselist=False)
    scenario = relationship("Scenario", backref="driving_sessions")
