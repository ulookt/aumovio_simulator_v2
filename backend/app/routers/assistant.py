from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
import os

from app.database import get_db
from app.models.assistant import AssistantMessage, MessageRole, ContextType
from app.models.job import Job
from app.models.telemetry import Telemetry
from app.schemas.assistant import ChatRequest, ChatResponse

router = APIRouter(prefix="/assistant", tags=["assistant"])

def get_openai_client():
    """Get OpenAI client (lazy import to avoid errors if API key not set)"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        from openai import OpenAI
        api_key = os.getenv("OPENAI_API_KEY")
        
        if not api_key:
            logger.warning("OpenAI API key not found in environment")
            return None
        
        if api_key == "your_openai_api_key_here":
            logger.warning("OpenAI API key is still set to default placeholder value")
            return None
            
        logger.info(f"Initializing OpenAI client with key: {api_key[:10]}...")
        client = OpenAI(api_key=api_key)
        logger.info("OpenAI client initialized successfully")
        return client
        
    except Exception as e:
        logger.error(f"Failed to initialize OpenAI client: {str(e)}")
        return None

@router.post("/chat", response_model=ChatResponse)
def chat_with_assistant(request: ChatRequest, db: Session = Depends(get_db)):
    """Chat with the AI assistant"""
    
    # Store user message
    user_message = AssistantMessage(
        job_id=request.job_id,
        role=MessageRole.USER,
        content=request.message,
        context_type=request.context_type
    )
    db.add(user_message)
    db.commit()
    
    # Build context
    system_prompt = """You are an automotive AI assistant for the Aumovio Simulator platform.
You help users understand vehicle mechanics, driving techniques, simulation outcomes, and autonomous system behavior.
You can analyze telemetry data and provide personalized driving coaching.
Be concise, technical, and helpful."""
    
    context_messages = [{"role": "system", "content": system_prompt}]
    
    # Add telemetry context if job_id provided
    if request.job_id:
        job = db.query(Job).filter(Job.id == request.job_id).first()
        if job:
            # Get telemetry summary
            telemetry = db.query(Telemetry).filter(
                Telemetry.job_id == request.job_id
            ).all()
            
            if telemetry:
                avg_speed = sum(t.speed for t in telemetry) / len(telemetry)
                max_speed = max(t.speed for t in telemetry)
                avg_brake = sum(t.brake_intensity for t in telemetry) / len(telemetry)
                
                context_messages.append({
                    "role": "system",
                    "content": f"""Telemetry Context:
- Simulation Type: {job.simulation_type}
- Vehicle Count: {job.vehicle_count}
- Weather: {job.weather}
- Average Speed: {avg_speed:.1f} m/s
- Max Speed: {max_speed:.1f} m/s
- Average Brake Intensity: {avg_brake:.1f}/10"""
                })
    
    # Get conversation history (last 10 messages)
    history = db.query(AssistantMessage).filter(
        AssistantMessage.job_id == request.job_id
    ).order_by(AssistantMessage.created_at.desc()).limit(10).all()
    
    for msg in reversed(history[1:]):  # Skip the just-added user message
        context_messages.append({
            "role": msg.role.value,
            "content": msg.content
        })
    
    context_messages.append({"role": "user", "content": request.message})
    
    # Call OpenAI API
    client = get_openai_client()
    if not client:
        reply_content = "AI assistant is currently unavailable (OpenAI API key not configured)"
    else:
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=context_messages,
                max_tokens=500,
                temperature=0.7
            )
            reply_content = response.choices[0].message.content
        except Exception as e:
            reply_content = f"Error communicating with AI assistant: {str(e)}"
    
    # Store assistant response
    assistant_message = AssistantMessage(
        job_id=request.job_id,
        role=MessageRole.ASSISTANT,
        content=reply_content,
        context_type=request.context_type
    )
    db.add(assistant_message)
    db.commit()
    db.refresh(assistant_message)
    
    return ChatResponse(
        reply=reply_content,
        message_id=assistant_message.id
    )
