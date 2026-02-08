from app.celery_app import celery_app
from app.database import SessionLocal
from app.models.job import Job, JobStatus
from app.models.telemetry import Telemetry
from app.models.safety_risk import SafetyRisk
from app.models.assistant import AssistantMessage, MessageRole, ContextType
from app.services.ai_driver import AIDriver
from app.services.safety_analyzer import SafetyAnalyzer
from datetime import datetime
import time
import random

@celery_app.task(bind=True)
def run_ai_simulation(self, job_id: str, scenario_data: dict):
    """
    Celery task to run AI simulation
    """
    db = SessionLocal()
    
    try:
        # Update job status to running
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return {"status": "error", "message": "Job not found"}
        
        job.status = JobStatus.RUNNING
        job.celery_task_id = self.request.id
        db.commit()
        
        # Initialize AI vehicles
        vehicle_count = job.vehicle_count
        ai_vehicles = [AIDriver(i, scenario_data) for i in range(vehicle_count)]
        
        # Initialize pedestrians (simplified)
        crosswalks = scenario_data.get("crosswalks", [])
        pedestrians = []
        for cw in crosswalks:
            if random.random() < 0.5:  # 50% chance of pedestrian
                pedestrians.append({
                    "x": cw.get("x1", 0),
                    "y": cw.get("y1", 0)
                })
        
        # Initialize traffic lights with states
        traffic_lights = scenario_data.get("traffic_lights", [])
        for light in traffic_lights:
            light["state"] = random.choice(["green", "red"])
        
        # Run simulation
        duration_seconds = job.duration_seconds
        dt = 0.1  # 100ms time step
        simulation_time = 0
        telemetry_data = []
        
        while simulation_time < duration_seconds:
            # Update all AI vehicles
            for vehicle in ai_vehicles:
                state = vehicle.update(dt, traffic_lights, pedestrians)
                
                # Store telemetry  (sample every 500ms)
                if int(simulation_time * 10) % 5 == 0:
                    telemetry_entry = Telemetry(
                        job_id=job_id,
                        timestamp=int(simulation_time * 1000),
                        speed=state["speed"],
                        acceleration=random.uniform(-1, 1),
                        brake_intensity=random.uniform(0, 3),
                        steering_angle=random.uniform(-10, 10),
                        position_x=state["x"],
                        position_y=state["y"]
                    )
                    db.add(telemetry_entry)
                    telemetry_data.append(telemetry_entry)
            
            # Update traffic lights (cycle every 20 seconds)
            if int(simulation_time) % 20 == 0:
                for light in traffic_lights:
                    light["state"] = "green" if light["state"] == "red" else "red"
            
            simulation_time += dt
            time.sleep(dt)  # Real-time simulation
            
            # Commit telemetry periodically
            if len(telemetry_data) % 50 == 0:
                db.commit()
        
        # Final commit
        db.commit()
        
        # Compute safety analytics
        analyzer = SafetyAnalyzer()
        telemetry_list = db.query(Telemetry).filter(Telemetry.job_id == job_id).all()
        
        collision_heatmap = analyzer.compute_collision_heatmap(telemetry_list)
        near_misses = analyzer.detect_near_misses(telemetry_list)
        hazard_exposure = analyzer.calculate_hazard_exposure(
            telemetry_list, 
            scenario_data.get("hazards", [])
        )
        safety_score = analyzer.compute_overall_safety_score(
            telemetry_list,
            near_misses,
            hazard_exposure
        )
        
        # Store safety risk
        safety_risk = SafetyRisk(
            job_id=job_id,
            collision_heatmap=collision_heatmap,
            near_miss_count=near_misses,
            hazard_exposure_score=hazard_exposure,
            overall_safety_score=safety_score
        )
        db.add(safety_risk)
        db.commit()
        
        # Generate AI insights (if OpenAI available)
        try:
            import os
            from openai import OpenAI
            
            api_key = os.getenv("OPENAI_API_KEY")
            if api_key:
                client = OpenAI(api_key=api_key)
                
                avg_speed = sum(t.speed for t in telemetry_list) / len(telemetry_list)
                max_speed = max(t.speed for t in telemetry_list)
                
                prompt = f"""Analyze this autonomous driving simulation:
                
Simulation Parameters:
- Duration: {duration_seconds} seconds
- Vehicle Count: {vehicle_count}
- Weather: {scenario_data.get('weather', 'clear')}

Performance Metrics:
- Average Speed: {avg_speed:.1f} m/s
- Max Speed: {max_speed:.1f} m/s
- Near Misses: {near_misses}
- Safety Score: {safety_score:.1f}/100

Provide a concise analysis of the simulation performance and safety."""

                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": "You are an autonomous driving safety analyst."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=300
                )
                
                insight_content = response.choices[0].message.content
                
                insight = AssistantMessage(
                    job_id=job_id,
                    role=MessageRole.ASSISTANT,
                    content=insight_content,
                    context_type=ContextType.TELEMETRY_ANALYSIS
                )
                db.add(insight)
                db.commit()
        except Exception as e:
            print(f"Failed to generate AI insights: {e}")
        
        # Mark job as completed
        job.status = JobStatus.COMPLETED
        job.completed_at = datetime.utcnow()
        db.commit()
        
        return {
            "status": "completed",
            "job_id": job_id,
            "telemetry_points": len(telemetry_list),
            "safety_score": safety_score
        }
        
    except Exception as e:
        # Mark job as failed
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            job.status = JobStatus.FAILED
            db.commit()
        
        return {"status": "failed", "error": str(e)}
    
    finally:
        db.close()
