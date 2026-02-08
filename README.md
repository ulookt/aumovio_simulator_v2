# Aumovio Simulator v2

A completely rebuilt autonomous driving simulation and experimentation platform with professional canvas-based map editor, AI-driven vehicles, manual driving physics, async job processing, and AI-powered insights.

## 🚀 Features

### ✨ Core Modules

1. **Scenario Builder** - Professional canvas-based map editor
   - Draw road networks with freehand brush, straight lines, and curves
   - Place traffic infrastructure (lights, stop signs, crosswalks)
   - Add hazards (cones, barriers, parked vehicles, slippery zones)
   - Configure weather conditions (clear, rain, fog, snow) with intensity control
   - Persistent storage with PostgreSQL JSONB

2. **Scene Simulation** - Unified execution environment
   - **AI Simulation Mode**: Autonomous vehicles with behavioral driving logic
     - Lane following
     - Traffic light obedience
     - Pedestrian yielding
     - Hazard avoidance
   - **Manual Driving Mode**: Physics-based manual control
     - Realistic velocity/acceleration physics
     - Weather-dependent friction (clear/rain/fog/snow)
     - Keyboard controls (arrow keys, WASD, Space, Shift)
     - Collision detection and response

3. **Jobs Dashboard** - Async simulation processing
   - Celery worker tasks for background execution
   - Real-time job status tracking (pending, running, completed, failed)
   - Auto-refresh every 3 seconds
   - Compute cost estimation

4. **Metrics & Analytics** - Comprehensive telemetry analysis
   - Speed/brake/steering charts (Recharts visualizations)
   - Safety risk computation (collision heatmaps, near-miss detection)
   - Hazard exposure scoring
   - AI-generated insights via OpenAI API

5. **AI Assistant** - Conversational automotive AI
   - Floating chat widget
   - Context-aware responses
   - Telemetry-based driving coaching
   - Technical assistance and explanations

---

## 🛠️ Technology Stack

**Backend:**
- FastAPI (Python 3.11)
- PostgreSQL (database)
- Celery (async task processing)
- Redis (message broker, caching)
- SQLAlchemy (ORM)
- OpenAI API (AI insights)

**Frontend:**
- React 18
- Vite
- React Router
- Tailwind CSS
- Recharts (analytics visualization)
- Axios (API client)

**Infrastructure:**
- Docker & Docker Compose
- Nginx (production frontend serving)

---

## 📦 Installation & Setup

### Prerequisites

- Docker & Docker Compose installed
- OpenAI API key (optional, for AI features)

### Quick Start

1. **Clone and navigate to project:**
   ```bash
   cd /Users/ulookt/Desktop/simple_aumovio_simulator/aumovio_simulator_v2
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   # Edit .env and add your OPENAI_API_KEY
   ```

3. **Start all services:**
   ```bash
   docker-compose up --build
   ```

4. **Access the platform:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

---

## 🏗️ Architecture

```
┌─────────────────┐
│   Frontend      │ React SPA (Vite + Tailwind)
│   Port: 3000    │
└────────┬────────┘
         │
         ↓  HTTP/REST
┌─────────────────┐
│   Backend API   │ FastAPI
│   Port: 8000    │
└────┬────────┬───┘
     │        │
     │        └───────→ ┌─────────────┐
     │                  │   Redis     │ Message Broker
     │                  │  Port: 6379 │
     │                  └─────────────┘
     │                         │
     ↓                         │
┌─────────────┐               │
│  PostgreSQL │               │
│  Port: 5432 │               ↓
└─────────────┘        ┌──────────────┐
                       │ Celery Worker│ Background jobs
                       └──────────────┘
                              │
                              ↓
                       ┌──────────────┐
                       │  OpenAI API  │ AI insights
                       └──────────────┘
```

---

## 📚 Usage Guide

### 1. Create a Scenario

1. Navigate to **Scenario Builder**
2. Enter scenario name
3. Configure weather type and intensity
4. (Canvas drawing tools coming in next phase)
5. Click **Save Scenario**

### 2. Run Simulations

1. Go to **Scene Simulation**
2. Select saved scenario from dropdown
3. Choose simulation mode:
   - **AI Simulation**: Watch autonomous vehicles navigate
   - **Manual Driving**: Drive yourself with keyboard
4. Click **Start Simulation**

### 3. Monitor Jobs

1. Navigate to **Jobs Dashboard**
2. View running/completed jobs
3. Jobs auto-refresh every 3 seconds
4. See status, duration, cost, and metadata

### 4. Analyze Results

1. Go to **Metrics & Analytics**
2. Select completed job
3. View tabs:
   - **Telemetry**: Speed/brake/steering charts
   - **Safety**: Overall score, near misses, hazard exposure
   - **AI Insights**: OpenAI-generated analysis

### 5. Ask AI Assistant

1. Click floating chat button (bottom-right)
2. Ask questions about:
   - Vehicle mechanics
   - Driving techniques
   - Simulation results
   - Safety recommendations

---

## 🔧 Development

### Run Backend Locally

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Run Celery Worker Locally

```bash
cd backend
celery -A app.celery_app worker --loglevel=info
```

### Run Frontend Locally

```bash
cd frontend
npm install
npm run dev
```

---

## 🌟 API Endpoints

### Scenarios
- `POST /api/scenarios/` - Create scenario
- `GET /api/scenarios/` - List scenarios
- `GET /api/scenarios/{id}` - Get scenario
- `PUT /api/scenarios/{id}` - Update scenario
- `DELETE /api/scenarios/{id}` - Delete scenario

### Jobs
- `POST /api/jobs/` - Create job (dispatches Celery task)
- `GET /api/jobs/` - List jobs (optional status filter)
- `GET /api/jobs/{id}` - Get job status

### Metrics
- `POST /api/metrics/telemetry` - Store telemetry point
- `GET /api/metrics/telemetry/{job_id}` - Get telemetry data
- `GET /api/metrics/safety/{job_id}` - Get safety analysis
- `GET /api/metrics/insights/{job_id}` - Get AI insights

### Assistant
- `POST /api/assistant/chat` - Chat with AI assistant

---

## 🔑 Environment Variables

```bash
DATABASE_URL=postgresql://aumovio:aumovio_pass@postgres:5432/aumovio
REDIS_URL=redis://redis:6379/0
OPENAI_API_KEY=your_api_key_here
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

---

## 📝 Project Status

### ✅ Completed
- Complete backend infrastructure (FastAPI + PostgreSQL + Celery + Redis)
- All database models and API endpoints
- Physics engine for manual driving
- AI driver behavioral logic
- Safety analyzer with heatmap generation
- OpenAI integration for insights and chat
- Full frontend with React Router
- All 4 core pages (Scenario Builder, Simulation, Jobs, Metrics)
- AI Assistant chat widget
- Docker Compose multi-service setup

### 🚧 Coming Next
- Canvas drawing tools for Scenario Builder
- Real-time simulation rendering on canvas
- Enhanced AI vehicle animations
- Manual driving keyboard controls integration
- Collision heatmap visualization
- Database migration scripts

---

## 📄 License

MIT License - Built for demonstration and portfolio purposes.

---

**Built with ❤️ for autonomous AI engineering**
