from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

from app.database import Base, engine
from app.routers import scenarios, jobs, metrics, assistant, auth

load_dotenv()

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Aumovio Simulator API",
    version="2.0.0"
)

@app.on_event("startup")
async def startup_event():
    """Log environment variables on startup for debugging"""
    api_key = os.getenv("OPENAI_API_KEY", "")
    if api_key and len(api_key) > 20:
        masked = f"{api_key[:10]}...{api_key[-10:]}"
        print(f"✅ OpenAI API Key loaded: {masked}")
    else:
        print(f"⚠️  OpenAI API Key NOT SET or invalid")

    db_url = os.getenv("DATABASE_URL", "")
    print(f"✅ Database URL: {db_url[:30]}...")
    print(f"✅ Redis URL: {os.getenv('REDIS_URL', 'NOT SET')}")
    print(f"✅ CORS Origins: {os.getenv('CORS_ORIGINS', 'NOT SET')}")

# CORS configuration
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(scenarios.router, prefix="/api", tags=["scenarios"])
app.include_router(jobs.router, prefix="/api", tags=["jobs"])
app.include_router(metrics.router, prefix="/api", tags=["metrics"])
app.include_router(assistant.router, prefix="/api", tags=["assistant"])

@app.get("/")
def root():
    return {
        "name": "Aumovio Simulator API",
        "version": "2.0.0",
        "status": "running"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}
