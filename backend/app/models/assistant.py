from sqlalchemy import Column, String, Text, DateTime, Enum as SQLEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
import enum
from app.database import Base

class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"

class ContextType(str, enum.Enum):
    GENERAL = "general"
    TELEMETRY_ANALYSIS = "telemetry_analysis"
    SAFETY_COACHING = "safety_coaching"

class AssistantMessage(Base):
    __tablename__ = "assistant_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=True)
    
    role = Column(SQLEnum(MessageRole), nullable=False)
    content = Column(Text, nullable=False)
    context_type = Column(SQLEnum(ContextType), default=ContextType.GENERAL)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    job = relationship("Job", backref="assistant_messages")
