from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    job_id: Optional[UUID] = None
    context_type: str = Field(default="general", pattern="^(general|telemetry_analysis|safety_coaching)$")

class ChatResponse(BaseModel):
    reply: str
    message_id: UUID

    class Config:
        from_attributes = True
