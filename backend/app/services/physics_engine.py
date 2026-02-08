import math
from typing import Dict, List, Tuple

class PhysicsEngine:
    """2D physics engine for manual driving simulation"""
    
    # Weather-dependent friction coefficients
    FRICTION_COEFFICIENTS = {
        "clear": 1.0,
        "rain": 0.7,
        "fog": 0.8,
        "snow": 0.5
    }
    
    def __init__(self, weather: str = "clear"):
        self.friction = self.FRICTION_COEFFICIENTS.get(weather, 1.0)
        self.gravity = 9.81  # m/s²
    
    def update_velocity(
        self, 
        current_velocity: float,
        acceleration_input: float,  # -1 to 1
        brake_input: float,  # 0 to 1
        dt: float  # Time delta in seconds
    ) -> Tuple[float, float]:
        """
        Update velocity based on inputs
        Returns: (new_velocity, actual_acceleration)
        """
        # Maximum acceleration (reduced by friction)
        max_acceleration = 5.0 * self.friction  # m/s²
        max_braking = 8.0 * self.friction  # m/s²
        
        # Calculate acceleration
        if brake_input > 0:
            # Braking
            acceleration = -brake_input * max_braking
        else:
            # Accelerating or coasting
            acceleration = acceleration_input * max_acceleration
        
        # Air resistance (quadratic drag)
        drag_coefficient = 0.02
        drag = -drag_coefficient * current_velocity * abs(current_velocity)
        
        # Rolling resistance
        rolling_resistance = -0.5 * self.friction * (1 if current_velocity > 0 else -1 if current_velocity < 0 else 0)
        
        total_acceleration = acceleration + drag + rolling_resistance
        
        # Update velocity
        new_velocity = current_velocity + total_acceleration * dt
        
        # Clamp to reasonable limits
        max_speed = 50.0  # m/s (~180 km/h)
        new_velocity = max(-max_speed, min(max_speed, new_velocity))
        
        # Stop completely at very low speeds
        if abs(new_velocity) < 0.1:
            new_velocity = 0.0
        
        return new_velocity, total_acceleration
    
    def calculate_steering(
        self,
        current_heading: float,  # radians
        steering_input: float,  # -1 to 1
        speed: float,
        dt: float
    ) -> float:
        """
        Calculate new heading based on steering input
        Returns: new_heading in radians
        """
        # Maximum turn rate depends on speed (slower = tighter turns)
        base_turn_rate = 1.5  # radians per second at low speed
        
        # Reduce turn rate at high speeds
        speed_factor = 1.0 / (1.0 + speed * 0.05)
        max_turn_rate = base_turn_rate * speed_factor
        
        # Calculate turn rate
        turn_rate = steering_input * max_turn_rate
        
        # Update heading
        new_heading = current_heading + turn_rate * dt
        
        # Normalize to -π to π
        new_heading = math.atan2(math.sin(new_heading), math.cos(new_heading))
        
        return new_heading
    
    def calculate_position(
        self,
        current_x: float,
        current_y: float,
        velocity: float,
        heading: float,
        dt: float
    ) -> Tuple[float, float]:
        """
        Calculate new position based on velocity and heading
        Returns: (new_x, new_y)
        """
        dx = velocity * math.cos(heading) * dt
        dy = velocity * math.sin(heading) * dt
        
        return current_x + dx, current_y + dy
    
    def check_collision(
        self,
        vehicle_x: float,
        vehicle_y: float,
        obstacles: List[Dict]
    ) -> bool:
        """
        Check if vehicle collides with any obstacles
        """
        vehicle_radius = 2.0  # meters
        
        for obstacle in obstacles:
            dx = vehicle_x - obstacle["x"]
            dy = vehicle_y - obstacle["y"]
            distance = math.sqrt(dx * dx + dy * dy)
            
            obstacle_radius = obstacle.get("radius", 1.0)
            if distance < (vehicle_radius + obstacle_radius):
                return True
        
        return False
    
    def apply_collision_response(
        self,
        velocity: float
    ) -> float:
        """
        Reduce velocity after collision
        """
        return velocity * 0.3  # Lose 70% of speed
