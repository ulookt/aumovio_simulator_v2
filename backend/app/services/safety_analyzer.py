from typing import List, Dict
import math

class SafetyAnalyzer:
    """Analyze telemetry data for safety risks"""
    
    def __init__(self, grid_size: int = 50):
        self.grid_size = grid_size
    
    def compute_collision_heatmap(
        self, 
        telemetry: List[Dict],
        canvas_width: int = 1200,
        canvas_height: int = 800
    ) -> Dict:
        """
        Generate collision heatmap from telemetry
        Returns grid with collision density
        """
        cell_width = canvas_width / self.grid_size
        cell_height = canvas_height / self.grid_size
        
        # Initialize grid
        grid = [[0 for _ in range(self.grid_size)] for _ in range(self.grid_size)]
        
        # Count high-risk events (high brake intensity)
        for t in telemetry:
            if t.brake_intensity > 5.0:  # Threshold for hard braking
                cell_x = int(t.position_x / cell_width)
                cell_y = int(t.position_y / cell_height)
                
                if 0 <= cell_x < self.grid_size and 0 <= cell_y < self.grid_size:
                    grid[cell_y][cell_x] += 1
        
        return {
            "grid_size": self.grid_size,
            "cells": grid,
            "canvas_width": canvas_width,
            "canvas_height": canvas_height
        }
    
    def detect_near_misses(self, telemetry: List[Dict]) -> int:
        """
        Detect near-miss events based on sudden braking
        """
        near_miss_count = 0
        
        for i in range(1, len(telemetry)):
            curr = telemetry[i]
            prev = telemetry[i-1]
            
            # Near miss: sudden hard braking while at high speed
            if curr.brake_intensity > 7.0 and prev.speed > 10.0:
                near_miss_count += 1
        
        return near_miss_count
    
    def calculate_hazard_exposure(
        self, 
        telemetry: List[Dict],
        hazards: List[Dict]
    ) -> float:
        """
        Calculate time spent near hazards
        Returns score 0-100
        """
        if not hazards or not telemetry:
            return 0.0
        
        danger_radius = 10.0  # meters
        exposure_count = 0
        
        for t in telemetry:
            for hazard in hazards:
                dx = t.position_x - hazard["x"]
                dy = t.position_y - hazard["y"]
                distance = math.sqrt(dx * dx + dy * dy)
                
                if distance < danger_radius:
                    exposure_count += 1
                    break
        
        # Normalize to 0-100 scale
        exposure_ratio = exposure_count / len(telemetry) if telemetry else 0
        return min(100.0, exposure_ratio * 200)  # Scale up for visibility
    
    def compute_overall_safety_score(
        self,
        telemetry: List[Dict],
        near_miss_count: int,
        hazard_exposure: float
    ) -> float:
        """
        Compute overall safety score (0-100, higher is safer)
        """
        if not telemetry:
            return 100.0
        
        # Calculate average brake intensity
        avg_brake = sum(t.brake_intensity for t in telemetry) / len(telemetry)
        
        # Base score
        score = 100.0
        
        # Penalties
        score -= near_miss_count * 5.0  # -5 points per near miss
        score -= hazard_exposure * 0.2  # Penalize hazard exposure
        score -= avg_brake * 2.0  # Penalize harsh braking
        
        # Calculate smoothness (low steering variation = smoother)
        steering_angles = [t.steering_angle for t in telemetry]
        if len(steering_angles) > 1:
            steering_variance = sum(
                abs(steering_angles[i] - steering_angles[i-1]) 
                for i in range(1, len(steering_angles))
            ) / len(steering_angles)
            score -= steering_variance  # Penalize erratic steering
        
        return max(0.0, min(100.0, score))
