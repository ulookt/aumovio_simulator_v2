import React, { useState, useEffect, useRef } from 'react';
import { scenariosAPI, jobsAPI } from '@/services/api';
import { Play, Pause, RotateCcw, Settings } from 'lucide-react';

const SceneSimulation = () => {
    const canvasRef = useRef(null);
    const [scenarios, setScenarios] = useState([]);
    const [selectedScenario, setSelectedScenario] = useState(null);
    const [simulationType, setSimulationType] = useState('ai_simulation');
    const [isRunning, setIsRunning] = useState(false);
    const [vehicles, setVehicles] = useState([]);
    const [playerVehicle, setPlayerVehicle] = useState(null);
    const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });

    const keysPressed = useRef({});
    const animationFrameId = useRef(null);

    useEffect(() => {
        loadScenarios();

        // Keyboard controls
        const handleKeyDown = (e) => {
            keysPressed.current[e.key] = true;
        };
        const handleKeyUp = (e) => {
            keysPressed.current[e.key] = false;
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    useEffect(() => {
        if (!isRunning) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        const animate = () => {
            // Clear canvas
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.scale(camera.zoom, camera.zoom);
            ctx.translate(-canvas.width / 2 + camera.x, -canvas.height / 2 + camera.y);

            // Draw grid
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let x = -1000; x <= 1000; x += 50) {
                ctx.moveTo(x, -1000);
                ctx.lineTo(x, 1000);
            }
            for (let y = -1000; y <= 1000; y += 50) {
                ctx.moveTo(-1000, y);
                ctx.lineTo(1000, y);
            }
            ctx.stroke();

            // Draw scenario roads
            if (selectedScenario?.roads) {
                selectedScenario.roads.forEach(road => {
                    if (road.points && road.points.length > 1) {
                        ctx.beginPath();
                        ctx.moveTo(road.points[0].x, road.points[0].y);
                        for (let i = 1; i < road.points.length; i++) {
                            ctx.lineTo(road.points[i].x, road.points[i].y);
                        }
                        ctx.lineWidth = road.width || 40;
                        ctx.strokeStyle = '#334155';
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.stroke();

                        // Center line
                        ctx.lineWidth = 2;
                        ctx.strokeStyle = '#fbbf24';
                        ctx.setLineDash([10, 10]);
                        ctx.stroke();
                        ctx.setLineDash([]);
                    }
                });
            }

            // Draw traffic lights
            if (selectedScenario?.traffic_lights) {
                selectedScenario.traffic_lights.forEach(light => {
                    ctx.fillStyle = '#1f2937';
                    ctx.fillRect(light.x - 5, light.y - 20, 10, 40);
                    ctx.fillStyle = light.state === 'red' ? '#ef4444' : '#10b981';
                    ctx.beginPath();
                    ctx.arc(light.x, light.y - 10, 4, 0, Math.PI * 2);
                    ctx.fill();
                });
            }

            // Update and draw vehicles
            const updatedVehicles = vehicles.map(vehicle => {
                const newVehicle = { ...vehicle };

                // Simple AI: follow road path
                if (simulationType === 'ai_simulation') {
                    newVehicle.x += Math.cos(newVehicle.angle) * newVehicle.speed;
                    newVehicle.y += Math.sin(newVehicle.angle) * newVehicle.speed;

                    // Random slight angle changes
                    if (Math.random() < 0.02) {
                        newVehicle.angle += (Math.random() - 0.5) * 0.2;
                    }
                }

                // Draw vehicle
                ctx.save();
                ctx.translate(newVehicle.x, newVehicle.y);
                ctx.rotate(newVehicle.angle);
                ctx.fillStyle = newVehicle.color || '#3b82f6';
                ctx.fillRect(-8, -4, 16, 8);
                ctx.fillStyle = '#60a5fa';
                ctx.fillRect(-8, -3, 4, 6);
                ctx.restore();

                return newVehicle;
            });

            setVehicles(updatedVehicles);

            // Draw player vehicle (manual mode)
            if (simulationType === 'manual_driving' && playerVehicle) {
                let newPlayer = { ...playerVehicle };

                // Handle keyboard input
                if (keysPressed.current['ArrowUp'] || keysPressed.current['w']) {
                    newPlayer.speed = Math.min(newPlayer.speed + 0.2, 5);
                }
                if (keysPressed.current['ArrowDown'] || keysPressed.current['s']) {
                    newPlayer.speed = Math.max(newPlayer.speed - 0.3, -2);
                }
                if (keysPressed.current['ArrowLeft'] || keysPressed.current['a']) {
                    newPlayer.angle -= 0.05;
                }
                if (keysPressed.current['ArrowRight'] || keysPressed.current['d']) {
                    newPlayer.angle += 0.05;
                }
                if (keysPressed.current[' ']) {
                    newPlayer.speed = Math.min(newPlayer.speed + 0.5, 8);
                }

                // Apply friction
                newPlayer.speed *= 0.98;

                // Move player
                newPlayer.x += Math.cos(newPlayer.angle) * newPlayer.speed;
                newPlayer.y += Math.sin(newPlayer.angle) * newPlayer.speed;

                // Draw player vehicle
                ctx.save();
                ctx.translate(newPlayer.x, newPlayer.y);
                ctx.rotate(newPlayer.angle);
                ctx.fillStyle = '#10b981';
                ctx.fillRect(-10, -5, 20, 10);
                ctx.fillStyle = '#34d399';
                ctx.fillRect(-10, -4, 5, 8);
                ctx.restore();

                setPlayerVehicle(newPlayer);

                // Camera follows player
                setCamera({
                    x: -newPlayer.x,
                    y: -newPlayer.y,
                    zoom: 1
                });
            }

            ctx.restore();

            // Draw HUD
            if (simulationType === 'manual_driving' && playerVehicle) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(10, 10, 200, 80);
                ctx.fillStyle = '#fff';
                ctx.font = '14px monospace';
                ctx.fillText(`Speed: ${Math.abs(playerVehicle.speed).toFixed(1)} m/s`, 20, 30);
                ctx.fillText(`Position: (${playerVehicle.x.toFixed(0)}, ${playerVehicle.y.toFixed(0)})`, 20, 50);
                ctx.fillText(`Vehicles: ${vehicles.length}`, 20, 70);
            }

            animationFrameId.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, [isRunning, vehicles, playerVehicle, selectedScenario, simulationType, camera]);

    const loadScenarios = async () => {
        try {
            const response = await scenariosAPI.list();
            setScenarios(response.data);
        } catch (error) {
            console.error('Failed to load scenarios:', error);
        }
    };

    const startSimulation = () => {
        if (!selectedScenario) {
            alert('Please select a scenario');
            return;
        }

        setIsRunning(true);

        // Spawn vehicles
        const spawnedVehicles = [];
        const numVehicles = simulationType === 'ai_simulation' ? 5 : 3;

        for (let i = 0; i < numVehicles; i++) {
            spawnedVehicles.push({
                x: Math.random() * 400 - 200,
                y: Math.random() * 400 - 200,
                angle: Math.random() * Math.PI * 2,
                speed: 1 + Math.random() * 2,
                color: `hsl(${Math.random() * 360}, 70%, 60%)`
            });
        }
        setVehicles(spawnedVehicles);

        // Create player vehicle for manual mode
        if (simulationType === 'manual_driving') {
            setPlayerVehicle({
                x: 0,
                y: 0,
                angle: 0,
                speed: 0
            });
        }

        // Create backend job
        jobsAPI.create({
            scenario_id: selectedScenario.id,
            simulation_type: simulationType,
            duration_seconds: 60,
            vehicle_count: numVehicles
        }).catch(err => console.error('Failed to create job:', err));
    };

    const pauseSimulation = () => {
        setIsRunning(false);
    };

    const resetSimulation = () => {
        setIsRunning(false);
        setVehicles([]);
        setPlayerVehicle(null);
        setCamera({ x: 0, y: 0, zoom: 1 });
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold">Scene Simulation</h1>
                <div className="flex gap-2">
                    {!isRunning ? (
                        <button
                            onClick={startSimulation}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors"
                        >
                            <Play size={18} fill="currentColor" />
                            Start
                        </button>
                    ) : (
                        <button
                            onClick={pauseSimulation}
                            className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-semibold transition-colors"
                        >
                            <Pause size={18} fill="currentColor" />
                            Pause
                        </button>
                    )}
                    <button
                        onClick={resetSimulation}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors"
                    >
                        <RotateCcw size={18} />
                        Reset
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
                {/* Simulation Canvas */}
                <div className="col-span-2 bg-card rounded-xl overflow-hidden border border-border">
                    <canvas
                        ref={canvasRef}
                        width={800}
                        height={600}
                        className="w-full h-auto bg-dark-bg"
                    />
                </div>

                {/* Control Panel */}
                <div className="bg-card p-6 rounded-xl border border-border">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Settings className="w-5 h-5 text-primary" />
                        Control Panel
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                Select Scenario
                            </label>
                            <select
                                value={selectedScenario?.id || ''}
                                onChange={(e) => {
                                    const scenario = scenarios.find(s => s.id === e.target.value);
                                    setSelectedScenario(scenario);
                                }}
                                className="w-full px-3 py-2 bg-dark-bg border border-gray-600 rounded-md text-white focus:outline-none focus:border-blue-500"
                                disabled={isRunning}
                            >
                                <option value="">-- Choose Scenario --</option>
                                {scenarios.map((scenario) => (
                                    <option key={scenario.id} value={scenario.id}>
                                        {scenario.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                Simulation Mode
                            </label>
                            <div className="space-y-2">
                                <label className="flex items-center p-3 bg-dark-bg rounded-lg border border-gray-700 cursor-pointer hover:bg-gray-800 transition-colors">
                                    <input
                                        type="radio"
                                        value="ai_simulation"
                                        checked={simulationType === 'ai_simulation'}
                                        onChange={(e) => setSimulationType(e.target.value)}
                                        className="mr-3"
                                        disabled={isRunning}
                                    />
                                    <div>
                                        <div className="font-medium">AI Simulation</div>
                                        <div className="text-xs text-gray-400">Watch autonomous vehicles</div>
                                    </div>
                                </label>
                                <label className="flex items-center p-3 bg-dark-bg rounded-lg border border-gray-700 cursor-pointer hover:bg-gray-800 transition-colors">
                                    <input
                                        type="radio"
                                        value="manual_driving"
                                        checked={simulationType === 'manual_driving'}
                                        onChange={(e) => setSimulationType(e.target.value)}
                                        className="mr-3"
                                        disabled={isRunning}
                                    />
                                    <div>
                                        <div className="font-medium">Manual Driving</div>
                                        <div className="text-xs text-gray-400">Drive with keyboard</div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {simulationType === 'manual_driving' && (
                            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                                <h3 className="font-semibold mb-2 text-blue-400">Controls</h3>
                                <div className="text-sm text-gray-300 space-y-1">
                                    <div className="flex justify-between">
                                        <span>Accelerate:</span>
                                        <span className="font-mono text-blue-400">↑ / W</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Brake:</span>
                                        <span className="font-mono text-blue-400">↓ / S</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Steer:</span>
                                        <span className="font-mono text-blue-400">← → / A D</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Boost:</span>
                                        <span className="font-mono text-blue-400">SPACE</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {isRunning && (
                            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                                <h3 className="font-semibold mb-2 text-green-400">Simulation Active</h3>
                                <div className="text-sm text-gray-300">
                                    <div>Vehicles: {vehicles.length}</div>
                                    <div>Mode: {simulationType === 'ai_simulation' ? 'AI' : 'Manual'}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SceneSimulation;
