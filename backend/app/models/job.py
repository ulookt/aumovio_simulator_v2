from sqlalchemy import Column, String, Integer, Float, DateTime, Enum as SQLEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
import enum
from app.database import Base

class SimulationType(str, enum.Enum):
    AI_SIMULATION = "ai_simulation"
    MANUAL_DRIVING = "manual_driving"

class JobStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"

class Job(Base):
    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scenario_id = Column(UUID(as_uuid=True), ForeignKey("scenarios.id"), nullable=False)
    
    simulation_type = Column(SQLEnum(SimulationType), nullable=False)
    status = Column(SQLEnum(JobStatus), default=JobStatus.PENDING)
    
    # Celery task ID for tracking async execution
    celery_task_id = Column(String, nullable=True)
    
    # Simulation parameters
    duration_seconds = Column(Integer, default=60)
    vehicle_count = Column(Integer, default=5)
    weather = Column(String, nullable=True)
    
    # Cost estimation
    compute_cost_estimate = Column(Float, default=0.0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    scenario = relationship("Scenario", backref="jobs")
