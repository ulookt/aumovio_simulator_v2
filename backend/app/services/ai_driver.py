import math
import random
from typing import Dict, List, Tuple

class AIDriver:
    """AI vehicle behavior for autonomous simulation"""
    
    def __init__(self, vehicle_id: int, scenario_data: Dict):
        self.vehicle_id = vehicle_id
        self.scenario_data = scenario_data
        
        # Vehicle state
        self.position_x = 0.0
        self.position_y = 0.0
        self.heading = 0.0  # radians
        self.speed = 0.0  # m/s
        
        # Waypoint following
        self.current_waypoint_index = 0
        self.waypoints = self._generate_waypoints()
        
        # Behavior parameters
        self.target_speed = 15.0  # m/s (~54 km/h)
        self.max_acceleration = 3.0  # m/s²
        self.max_braking = 5.0  # m/s²
    
    def _generate_waypoints(self) -> List[Tuple[float, float]]:
        """Generate waypoints from road network"""
        waypoints = []
        
        # Extract waypoints from first road in scenario
        roads = self.scenario_data.get("roads", [])
        if roads and len(roads) > 0:
            road = roads[0]
            points = road.get("points", [])
            for point in points:
                waypoints.append((point["x"], point["y"]))
        
        # If no roads, create a simple circular path
        if not waypoints:
            for i in range(20):
                angle = (i / 20.0) * 2 * math.pi
                x = 300 + 200 * math.cos(angle)
                y = 300 + 200 * math.sin(angle)
                waypoints.append((x, y))
        
        return waypoints
    
    def update(self, dt: float, traffic_lights: List[Dict], pedestrians: List[Dict]) -> Dict:
        """
        Update AI vehicle state
        Returns: Updated state dict
        """
        if not self.waypoints:
            return self._get_state()
        
        # Get current waypoint
        target_x, target_y = self.waypoints[self.current_waypoint_index]
        
        # Calculate distance and angle to waypoint
        dx = target_x - self.position_x
        dy = target_y - self.position_y
        distance_to_waypoint = math.sqrt(dx * dx + dy * dy)
        angle_to_waypoint = math.atan2(dy, dx)
        
        # Check if reached waypoint
        if distance_to_waypoint < 10.0:  # 10 meters threshold
            self.current_waypoint_index = (self.current_waypoint_index + 1) % len(self.waypoints)
        
        # Update heading (smooth steering)
        heading_diff = angle_to_waypoint - self.heading
        # Normalize to -π to π
        heading_diff = math.atan2(math.sin(heading_diff), math.cos(heading_diff))
        
        max_turn_rate = 0.5  # radians per second
        turn_amount = max(-max_turn_rate * dt, min(max_turn_rate * dt, heading_diff))
        self.heading += turn_amount
        
        # Check for traffic lights
        should_stop = self._check_traffic_lights(traffic_lights)
        
        # Check for pedestrians
        pedestrian_ahead = self._check_pedestrians(pedestrians)
        
        # Speed control
        if should_stop or pedestrian_ahead:
            # Brake
            self.speed = max(0, self.speed - self.max_braking * dt)
        else:
            # Accelerate to target speed
            if self.speed < self.target_speed:
                self.speed = min(self.target_speed, self.speed + self.max_acceleration * dt)
        
        # Update position
        self.position_x += self.speed * math.cos(self.heading) * dt
        self.position_y += self.speed * math.sin(self.heading) * dt
        
        return self._get_state()
    
    def _check_traffic_lights(self, traffic_lights: List[Dict]) -> bool:
        """Check if should stop for traffic light"""
        lookahead_distance = 30.0  # meters
        
        for light in traffic_lights:
            dx = light["x"] - self.position_x
            dy = light["y"] - self.position_y
            distance = math.sqrt(dx * dx + dy * dy)
            
            if distance < lookahead_distance:
                # Check light state (simplified - in real implementation, would check cycle)
                state = light.get("state", "green")
                if state == "red" or state == "yellow":
                    return True
        
        return False
    
    def _check_pedestrians(self, pedestrians: List[Dict]) -> bool:
        """Check if pedestrian is ahead"""
        lookahead_distance = 20.0  # meters
        
        for ped in pedestrians:
            dx = ped["x"] - self.position_x
            dy = ped["y"] - self.position_y
            distance = math.sqrt(dx * dx + dy * dy)
            
            if distance < lookahead_distance:
                # Check if pedestrian is in front
                angle_to_ped = math.atan2(dy, dx)
                angle_diff = abs(angle_to_ped - self.heading)
                
                if angle_diff < math.pi / 4:  # 45 degree cone in front
                    return True
        
        return False
    
    def _get_state(self) -> Dict:
        """Get current vehicle state"""
        return {
            "vehicle_id": self.vehicle_id,
            "x": self.position_x,
            "y": self.position_y,
            "heading": self.heading,
            "speed": self.speed
        }
