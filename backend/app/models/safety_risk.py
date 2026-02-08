from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
from app.database import Base

class SafetyRisk(Base):
    __tablename__ = "safety_risks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), unique=True, nullable=False)
    
    # Collision heatmap: grid-based density map of collision events
    # Format: {grid_size: number, cells: [[{x, y, count}]]}
    collision_heatmap = Column(JSONB, default=dict)
    
    # Safety metrics
    near_miss_count = Column(Integer, default=0)
    hazard_exposure_score = Column(Float, default=0.0)  # Time spent near hazards
    overall_safety_score = Column(Float, default=100.0)  # 0-100 scale
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    job = relationship("Job", backref="safety_risk", uselist=False)
