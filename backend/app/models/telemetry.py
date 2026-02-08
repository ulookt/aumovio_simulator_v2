from sqlalchemy import Column, Integer, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.database import Base

class Telemetry(Base):
    __tablename__ = "telemetry"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    
    # Timestamp in milliseconds from simulation start
    timestamp = Column(Integer, nullable=False)
    
    # Vehicle metrics
    speed = Column(Float, nullable=False)  # m/s
    acceleration = Column(Float, default=0.0)  # m/s²
    brake_intensity = Column(Float, default=0.0)  # 0-10 scale
    steering_angle = Column(Float, default=0.0)  # degrees, -45 to 45
    
    # Position
    position_x = Column(Float, nullable=False)
    position_y = Column(Float, nullable=False)
    
    # Optional lap tracking
    lap_number = Column(Integer, nullable=True)
    
    # Relationships
    job = relationship("Job", backref="telemetry_data")
