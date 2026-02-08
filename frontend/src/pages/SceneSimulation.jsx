import React, { useState, useEffect, useRef } from 'react';
import { scenariosAPI, jobsAPI } from '@/services/api';
import { Play, Pause, RotateCcw, Settings } from 'lucide-react';

// Physics constants from old project (InteractiveDriving) – stable driving feel
const DRIVING_CONFIG = {
    ACCEL: 0.13,
    BRAKE: 0.35,
    FRICTION_ROAD: 0.98,
    TURN_SPEED: 0.05,
    MAX_SPEED: 8.0,
};

// Car dimensions scaled to fit road width ~40: same proportions as old project (30x16)
const CAR_WIDTH = 24;
const CAR_HEIGHT = 12;

const SceneSimulation = () => {
    const canvasRef = useRef(null);
    const [scenarios, setScenarios] = useState([]);
    const [selectedScenario, setSelectedScenario] = useState(null);
    const [simulationType, setSimulationType] = useState('ai_simulation');
    const [isRunning, setIsRunning] = useState(false);
    const [vehicles, setVehicles] = useState([]);
    const [hudSpeed, setHudSpeed] = useState(0);

    const keysPressed = useRef({});
    const animationFrameId = useRef(null);
    const frameCount = useRef(0);

    // Manual driving: refs only (no setState per frame) so animation loop stays stable
    const playerPhysics = useRef({
        x: 0,
        y: 0,
        angle: 0,
        speed: 0,
        friction: DRIVING_CONFIG.FRICTION_ROAD,
    });
    const cameraRef = useRef({ x: 0, y: 0, zoom: 1 });
    const vehiclesRef = useRef([]);

    useEffect(() => {
        loadScenarios();
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowUp' || e.key === 'w') keysPressed.current.up = true;
            if (e.key === 'ArrowDown' || e.key === 's') keysPressed.current.down = true;
            if (e.key === 'ArrowLeft' || e.key === 'a') keysPressed.current.left = true;
            if (e.key === 'ArrowRight' || e.key === 'd') keysPressed.current.right = true;
            if (e.code === 'Space') keysPressed.current.boost = true;
        };
        const handleKeyUp = (e) => {
            if (e.key === 'ArrowUp' || e.key === 'w') keysPressed.current.up = false;
            if (e.key === 'ArrowDown' || e.key === 's') keysPressed.current.down = false;
            if (e.key === 'ArrowLeft' || e.key === 'a') keysPressed.current.left = false;
            if (e.key === 'ArrowRight' || e.key === 'd') keysPressed.current.right = false;
            if (e.code === 'Space') keysPressed.current.boost = false;
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
        const scenario = selectedScenario;
        const isManual = simulationType === 'manual_driving';

        const drawScene = (cam) => {
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.scale(cam.zoom, cam.zoom);
            ctx.translate(cam.x, cam.y);

            // Grid
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

            // Scenario roads (drawn road from Scenario Builder)
            if (scenario?.roads?.length) {
                scenario.roads.forEach((road) => {
                    if (!road.points || road.points.length < 2) return;
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
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = '#fbbf24';
                    ctx.setLineDash([10, 10]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                });
            }

            // Traffic lights
            if (scenario?.traffic_lights?.length) {
                scenario.traffic_lights.forEach((light) => {
                    ctx.fillStyle = '#1f2937';
                    ctx.fillRect(light.x - 5, light.y - 20, 10, 40);
                    ctx.fillStyle = light.state === 'red' ? '#ef4444' : '#10b981';
                    ctx.beginPath();
                    ctx.arc(light.x, light.y - 10, 4, 0, Math.PI * 2);
                    ctx.fill();
                });
            }

            // AI vehicles
            if (!isManual && vehiclesRef.current.length) {
                vehiclesRef.current.forEach((v) => {
                    v.x += Math.cos(v.angle) * v.speed;
                    v.y += Math.sin(v.angle) * v.speed;
                    if (Math.random() < 0.02) v.angle += (Math.random() - 0.5) * 0.2;
                    ctx.save();
                    ctx.translate(v.x, v.y);
                    ctx.rotate(v.angle);
                    ctx.fillStyle = v.color || '#3b82f6';
                    ctx.fillRect(-8, -4, 16, 8);
                    ctx.fillStyle = '#60a5fa';
                    ctx.fillRect(-8, -3, 4, 6);
                    ctx.restore();
                });
            }

            // Player car (manual) – red car from old project, scaled to road
            if (isManual) {
                const p = playerPhysics.current;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.angle);
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 8;
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(-CAR_WIDTH / 2, -CAR_HEIGHT / 2, CAR_WIDTH, CAR_HEIGHT);
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(CAR_WIDTH / 2 - 8, -CAR_HEIGHT / 2 + 1, 6, CAR_HEIGHT - 2);
                ctx.fillStyle = '#fbbf24';
                ctx.fillRect(CAR_WIDTH / 2 - 4, -CAR_HEIGHT / 2 + 1, 3, 3);
                ctx.fillRect(CAR_WIDTH / 2 - 4, CAR_HEIGHT / 2 - 4, 3, 3);
                ctx.restore();
            }

            ctx.restore();
        };

        const animate = () => {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (isManual) {
                const p = playerPhysics.current;
                const inp = keysPressed.current;
                const cfg = DRIVING_CONFIG;

                if (inp.up) p.speed += cfg.ACCEL;
                if (inp.down) p.speed -= cfg.BRAKE;
                if (inp.boost) p.speed += cfg.ACCEL * 2;

                p.speed *= p.friction;
                if (Math.abs(p.speed) > cfg.MAX_SPEED) {
                    p.speed = Math.sign(p.speed) * cfg.MAX_SPEED;
                }

                if (Math.abs(p.speed) > 0.1) {
                    if (inp.left) p.angle -= cfg.TURN_SPEED * Math.sign(p.speed);
                    if (inp.right) p.angle += cfg.TURN_SPEED * Math.sign(p.speed);
                }

                p.x += Math.cos(p.angle) * p.speed;
                p.y += Math.sin(p.angle) * p.speed;

                cameraRef.current = {
                    x: -p.x,
                    y: -p.y,
                    zoom: 1,
                };

                frameCount.current++;
                if (frameCount.current % 10 === 0) {
                    setHudSpeed(Math.abs(p.speed * 10).toFixed(0));
                }
            }

            drawScene(cameraRef.current);

            // HUD (screen space)
            if (isManual) {
                const p = playerPhysics.current;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(10, 10, 200, 80);
                ctx.fillStyle = '#fff';
                ctx.font = '14px monospace';
                ctx.fillText(`Speed: ${hudSpeed} km/h`, 20, 30);
                ctx.fillText(`Position: (${p.x.toFixed(0)}, ${p.y.toFixed(0)})`, 20, 50);
                ctx.fillText('WASD / Arrows • Space = boost', 20, 70);
            }

            animationFrameId.current = requestAnimationFrame(animate);
        };

        animate();
        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, [isRunning, selectedScenario, simulationType]);

    const loadScenarios = async () => {
        try {
            const response = await scenariosAPI.list();
            setScenarios(response.data);
        } catch (error) {
            console.error('Failed to load scenarios:', error);
        }
    };

    const getSpawnOnFirstRoad = (scenario) => {
        const roads = scenario?.roads;
        if (!roads?.length) return { x: 0, y: 0, angle: 0 };
        const road = roads[0];
        const points = road?.points;
        if (!points || points.length < 2) return { x: 0, y: 0, angle: 0 };
        const p0 = points[0];
        const p1 = points[1];
        const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
        return { x: p0.x, y: p0.y, angle };
    };

    const startSimulation = () => {
        if (!selectedScenario) {
            alert('Please select a scenario');
            return;
        }

        const numVehicles = simulationType === 'ai_simulation' ? 5 : 3;
        const spawned = [];
        for (let i = 0; i < numVehicles; i++) {
            spawned.push({
                x: Math.random() * 400 - 200,
                y: Math.random() * 400 - 200,
                angle: Math.random() * Math.PI * 2,
                speed: 1 + Math.random() * 2,
                color: `hsl(${Math.random() * 360}, 70%, 60%)`,
            });
        }
        vehiclesRef.current = spawned;
        setVehicles(spawned);

        if (simulationType === 'manual_driving') {
            const spawn = getSpawnOnFirstRoad(selectedScenario);
            playerPhysics.current = {
                x: spawn.x,
                y: spawn.y,
                angle: spawn.angle,
                speed: 0,
                friction: DRIVING_CONFIG.FRICTION_ROAD,
            };
            cameraRef.current = { x: -spawn.x, y: -spawn.y, zoom: 1 };
            setHudSpeed(0);
        }

        setIsRunning(true);

        jobsAPI.create({
            scenario_id: selectedScenario.id,
            simulation_type: simulationType,
            duration_seconds: 60,
            vehicle_count: numVehicles,
        }).catch((err) => console.error('Failed to create job:', err));
    };

    const pauseSimulation = () => setIsRunning(false);

    const resetSimulation = () => {
        setIsRunning(false);
        setVehicles([]);
        vehiclesRef.current = [];
        setHudSpeed(0);
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
                <div className="col-span-2 bg-card rounded-xl overflow-hidden border border-border">
                    <canvas
                        ref={canvasRef}
                        width={800}
                        height={600}
                        className="w-full h-auto bg-dark-bg"
                    />
                </div>

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
                                    const scenario = scenarios.find((s) => s.id === e.target.value);
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
                                        <div className="text-xs text-gray-400">Drive on the drawn road (WASD)</div>
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
                                    <p className="text-xs text-gray-400 mt-2">Car spawns on the start of the first road.</p>
                                </div>
                            </div>
                        )}

                        {isRunning && (
                            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                                <h3 className="font-semibold mb-2 text-green-400">Simulation Active</h3>
                                <div className="text-sm text-gray-300">
                                    <div>Vehicles: {vehicles.length}</div>
                                    <div>Mode: {simulationType === 'ai_simulation' ? 'AI' : 'Manual'}</div>
                                    {simulationType === 'manual_driving' && (
                                        <div className="mt-1 font-mono text-green-400">Speed: ~{hudSpeed} km/h</div>
                                    )}
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
