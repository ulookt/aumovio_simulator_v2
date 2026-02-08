import React, { useState, useEffect, useRef } from 'react';
import { scenariosAPI, jobsAPI, metricsAPI } from '@/services/api';
import { Play, Pause, RotateCcw, Settings, Trash2, ZoomIn, ZoomOut } from 'lucide-react';

// Physics constants from old project – stable driving feel
const DRIVING_CONFIG = {
    ACCEL: 0.13,
    BRAKE: 0.35,
    FRICTION_ROAD: 0.98,
    FRICTION_GRASS: 0.90,
    TURN_SPEED: 0.05,
    MAX_SPEED: 8.0,
    MAX_SPEED_GRASS: 3.5,
};

// Build flat list of road segments from scenario roads (for AI path-following)
function buildRoadSegments(roads) {
    if (!roads?.length) return [];
    const segs = [];
    roads.forEach((road) => {
        const pts = road?.points;
        const w = road?.width ?? 40;
        if (!pts || pts.length < 2) return;
        for (let i = 0; i < pts.length - 1; i++) {
            const x1 = pts[i].x, y1 = pts[i].y, x2 = pts[i + 1].x, y2 = pts[i + 1].y;
            const len = Math.hypot(x2 - x1, y2 - y1) || 1;
            segs.push({ x1, y1, x2, y2, len, width: w });
        }
    });
    return segs;
}

// Distance from point (px,py) to segment (x1,y1,x2,y2)
function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const nx = x1 + t * dx, ny = y1 + t * dy;
    return Math.hypot(px - nx, py - ny);
}

// Center of road network (used to position camera at map center, matching Scenario Builder view)
function getRoadNetworkCenter(roads) {
    if (!roads?.length) return { x: 0, y: 0 };
    let sumX = 0, sumY = 0, n = 0;
    roads.forEach((road) => {
        const pts = road?.points;
        if (!pts?.length) return;
        pts.forEach((p) => {
            sumX += p.x;
            sumY += p.y;
            n++;
        });
    });
    return n ? { x: sumX / n, y: sumY / n } : { x: 0, y: 0 };
}

function isOnRoad(px, py, roads) {
    if (!roads?.length) return false;
    for (const road of roads) {
        const pts = road?.points;
        const halfW = (road?.width ?? 40) / 2;
        if (!pts || pts.length < 2) continue;
        for (let i = 0; i < pts.length - 1; i++) {
            const d = distToSegment(px, py, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
            if (d <= halfW) return true;
        }
    }
    return false;
}

// Car dimensions scaled to fit road width ~40: same proportions as old project (30x16)
const CAR_WIDTH = 24;
const CAR_HEIGHT = 12;

const SCENE_SIM_STORAGE_KEY = 'aumovio_scene_simulation_state';

const SceneSimulation = () => {
    const canvasRef = useRef(null);
    const [scenarios, setScenarios] = useState([]);
    const [selectedScenario, setSelectedScenario] = useState(null);
    const [simulationType, setSimulationType] = useState('ai_simulation');
    const [isRunning, setIsRunning] = useState(false);
    const hasRestoredState = useRef(false);
    const skipCenterOnRestore = useRef(false);
    const [vehicles, setVehicles] = useState([]);
    const [hudSpeed, setHudSpeed] = useState(0);

    const keysPressed = useRef({});
    const animationFrameId = useRef(null);
    const frameCount = useRef(0);
    const roadSegmentsRef = useRef([]); // AI: flat list of segments

    // AI mode: camera pan/zoom (user-controlled; ref so loop reads current value)
    const aiCameraRef = useRef({ x: 0, y: 0, zoom: 1 });
    const isPanning = useRef(false);
    const [isDraggingMap, setIsDraggingMap] = useState(false);
    const lastMouse = useRef({ x: 0, y: 0 });

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

    // AI Simulation: traffic light states (cycle every 3s to match backend)
    const trafficLightStatesRef = useRef([]);
    const lastTrafficLightToggleRef = useRef(0);

    // Manual Driving: metrics tracking
    const currentJobIdRef = useRef(null);
    const metricsRef = useRef({
        startTime: 0,
        offRoadCount: 0,
        wasOnRoad: true,  // Track transitions to only count once per exit
        redLightViolations: 0,
        yellowLightViolations: 0,
        steeringAngles: [],  // For smoothness calculation
        maxSpeed: 0,
        speedSamples: [],
        lastPosition: null,
        distanceTraveled: 0,
        passedLights: new Set(),  // Track which lights we've passed to avoid double-counting
    });

    useEffect(() => {
        loadScenarios();
    }, []);

    // Save full simulation state (car position, vehicles, cameras) for restore when navigating back
    const saveStateRef = useRef(null);
    saveStateRef.current = () => {
        try {
            const p = playerPhysics.current;
            const state = {
                selectedScenarioId: selectedScenario ? String(selectedScenario.id) : null,
                simulationType,
                isRunning,
                playerPhysics: { ...p },
                camera: { ...cameraRef.current },
                vehicles: vehiclesRef.current.map((v) => ({ ...v })),
                aiCamera: { ...aiCameraRef.current },
            };
            localStorage.setItem(SCENE_SIM_STORAGE_KEY, JSON.stringify(state));
        } catch (_) {
            /* ignore */
        }
    };

    // Save on unmount (navigate away) and periodically when running
    useEffect(() => {
        const save = () => saveStateRef.current?.();
        if (isRunning) {
            const interval = setInterval(save, 1500);
            return () => {
                clearInterval(interval);
                save();
            };
        }
        return () => save();
    }, [isRunning, selectedScenario, simulationType]);

    // Restore full simulation state when scenarios have loaded (e.g. after navigating back)
    useEffect(() => {
        if (scenarios.length === 0 || hasRestoredState.current) return;
        try {
            const raw = localStorage.getItem(SCENE_SIM_STORAGE_KEY);
            if (!raw) return;
            const saved = JSON.parse(raw);
            const id = saved?.selectedScenarioId;
            const mode = saved?.simulationType;
            const running = Boolean(saved?.isRunning);

            let scenario = null;
            if (id) {
                scenario = scenarios.find((s) => String(s.id) === id);
            }

            if (scenario) setSelectedScenario(scenario);
            if (mode === 'ai_simulation' || mode === 'manual_driving') setSimulationType(mode);

            // Restore refs so car/vehicles resume at saved positions
            if (saved.playerPhysics && typeof saved.playerPhysics.x === 'number') {
                playerPhysics.current = { ...saved.playerPhysics };
            }
            if (saved.camera && typeof saved.camera.zoom === 'number') {
                cameraRef.current = { ...saved.camera };
            }
            if (saved.aiCamera && typeof saved.aiCamera.zoom === 'number') {
                aiCameraRef.current = { ...saved.aiCamera };
                skipCenterOnRestore.current = true;
            }
            if (Array.isArray(saved.vehicles) && saved.vehicles.length) {
                vehiclesRef.current = saved.vehicles.map((v) => ({ ...v }));
                setVehicles(vehiclesRef.current);
            }
            if (scenario && mode === 'ai_simulation' && scenario.roads?.length) {
                roadSegmentsRef.current = buildRoadSegments(scenario.roads);
            }
            if (saved.playerPhysics && typeof saved.playerPhysics.speed === 'number') {
                setHudSpeed(Math.abs(saved.playerPhysics.speed * 10).toFixed(0));
            }

            setIsRunning(running && !!scenario);
        } catch (_) {
            /* ignore parse errors */
        }
        hasRestoredState.current = true;
    }, [scenarios]);

    // Center camera on road network when scenario is selected (matches Scenario Builder layout)
    useEffect(() => {
        if (!selectedScenario?.roads?.length) return;
        if (skipCenterOnRestore.current) {
            skipCenterOnRestore.current = false;
            return;
        }
        const center = getRoadNetworkCenter(selectedScenario.roads);
        aiCameraRef.current = { x: -center.x, y: -center.y, zoom: 1 };
    }, [selectedScenario]);

    // Clear canvas when no scenario is selected
    useEffect(() => {
        if (selectedScenario) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, [selectedScenario]);

    // Prevent page scroll when zooming canvas in AI mode
    const canvasContainerRef = useRef(null);
    useEffect(() => {
        const el = canvasContainerRef.current;
        if (!el || simulationType !== 'ai_simulation' || !selectedScenario) return;
        const onWheel = (e) => {
            if (el.contains(e.target)) e.preventDefault();
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [simulationType, selectedScenario]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowUp' || e.key === 'w') keysPressed.current.up = true;
            if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'Shift') keysPressed.current.down = true;
            if (e.key === 'ArrowLeft' || e.key === 'a') keysPressed.current.left = true;
            if (e.key === 'ArrowRight' || e.key === 'd') keysPressed.current.right = true;
            if (e.code === 'Space') keysPressed.current.boost = true;
        };
        const handleKeyUp = (e) => {
            if (e.key === 'ArrowUp' || e.key === 'w') keysPressed.current.up = false;
            if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'Shift') keysPressed.current.down = false;
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
        if (!selectedScenario) return;
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

            // Traffic lights (use cycled state in AI sim when running, else stored state)
            if (scenario?.traffic_lights?.length) {
                const lightStates = trafficLightStatesRef.current;
                scenario.traffic_lights.forEach((light, i) => {
                    const state = lightStates[i] ?? light.state ?? 'red';
                    ctx.fillStyle = '#1f2937';
                    ctx.fillRect(light.x - 5, light.y - 20, 10, 40);
                    ctx.fillStyle =
                        state === 'red'
                            ? '#ef4444'
                            : state === 'yellow'
                                ? '#eab308'
                                : '#10b981';
                    ctx.beginPath();
                    ctx.arc(light.x, light.y - 10, 4, 0, Math.PI * 2);
                    ctx.fill();
                });
            }

            // Traffic light cycling: red → green → yellow → red (works in both AI and Manual modes)
            if (isRunning && scenario?.traffic_lights?.length) {
                const now = performance.now();
                const CYCLE = { red: 3000, green: 3000, yellow: 500 };
                const NEXT = { red: 'green', green: 'yellow', yellow: 'red' };
                if (trafficLightStatesRef.current.length !== scenario.traffic_lights.length) {
                    trafficLightStatesRef.current = scenario.traffic_lights.map((l) => l.state || 'red');
                    lastTrafficLightToggleRef.current = now;
                } else {
                    const elapsed = now - lastTrafficLightToggleRef.current;
                    const currentState = trafficLightStatesRef.current[0] || 'red';
                    const dur = CYCLE[currentState];
                    if (elapsed >= dur) {
                        const nextState = NEXT[currentState];
                        trafficLightStatesRef.current = trafficLightStatesRef.current.map(() => nextState);
                        lastTrafficLightToggleRef.current = now;
                    }
                }
            }

            // AI vehicles: follow road segments only (only when running)
            const segs = roadSegmentsRef.current;
            if (isRunning && !isManual && vehiclesRef.current.length && segs.length) {
                vehiclesRef.current.forEach((v) => {
                    const seg = segs[v.segmentIdx];
                    if (!seg) return;
                    v.progress += (v.speed / seg.len) * 0.1;
                    if (v.progress >= 1) {
                        v.segmentIdx = (v.segmentIdx + 1) % segs.length;
                        v.progress = 0;
                    }
                    const seg2 = segs[v.segmentIdx];
                    const sx = seg2.x1 + (seg2.x2 - seg2.x1) * v.progress;
                    const sy = seg2.y1 + (seg2.y2 - seg2.y1) * v.progress;
                    v.x = sx;
                    v.y = sy;
                    v.angle = Math.atan2(seg2.y2 - seg2.y1, seg2.x2 - seg2.x1);
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

            // Player car (manual) – red car from old project, scaled to road (only when running)
            if (isRunning && isManual) {
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

            if (isRunning && isManual) {
                const p = playerPhysics.current;
                const inp = keysPressed.current;
                const cfg = DRIVING_CONFIG;
                const onRoad = scenario?.roads && isOnRoad(p.x, p.y, scenario.roads);
                p.friction = onRoad ? cfg.FRICTION_ROAD : cfg.FRICTION_GRASS;
                const maxSpeed = onRoad ? cfg.MAX_SPEED : cfg.MAX_SPEED_GRASS;

                if (inp.up) p.speed += cfg.ACCEL;
                if (inp.down) p.speed -= cfg.BRAKE;
                if (inp.boost) p.speed += cfg.ACCEL * 2;

                p.speed *= p.friction;
                if (Math.abs(p.speed) > maxSpeed) {
                    p.speed = Math.sign(p.speed) * maxSpeed;
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

                // === METRICS TRACKING (Manual Driving only) ===
                const m = metricsRef.current;

                // Off-road detection: count transitions from on-road to off-road
                if (!onRoad && m.wasOnRoad) {
                    m.offRoadCount++;
                }
                m.wasOnRoad = onRoad;

                // Traffic light violation detection
                if (scenario?.traffic_lights?.length) {
                    const lightStates = trafficLightStatesRef.current;
                    scenario.traffic_lights.forEach((light, i) => {
                        const dist = Math.hypot(p.x - light.x, p.y - light.y);
                        const lightKey = `light_${i}`;
                        // If within 25px of light center and haven't passed this light yet
                        if (dist < 25 && !m.passedLights.has(lightKey)) {
                            const state = lightStates[i] ?? light.state ?? 'red';
                            if (state === 'red') {
                                m.redLightViolations++;
                            } else if (state === 'yellow') {
                                m.yellowLightViolations++;
                            }
                            m.passedLights.add(lightKey);
                        }
                        // Reset when far from light so it can be counted again if approached again
                        if (dist > 60) {
                            m.passedLights.delete(lightKey);
                        }
                    });
                }

                // Steering tracking for smoothness
                m.steeringAngles.push(p.angle);
                if (m.steeringAngles.length > 100) m.steeringAngles.shift();  // Keep last 100

                // Speed tracking
                const speedKmh = Math.abs(p.speed * 10);
                m.speedSamples.push(speedKmh);
                if (speedKmh > m.maxSpeed) m.maxSpeed = speedKmh;

                // Distance tracking
                if (m.lastPosition) {
                    const dx = p.x - m.lastPosition.x;
                    const dy = p.y - m.lastPosition.y;
                    m.distanceTraveled += Math.hypot(dx, dy);
                }
                m.lastPosition = { x: p.x, y: p.y };

                frameCount.current++;
                if (frameCount.current % 10 === 0) {
                    setHudSpeed(Math.abs(p.speed * 10).toFixed(0));
                }
            }

            const cam = isRunning && isManual ? cameraRef.current : aiCameraRef.current;
            drawScene(cam);

            // HUD (screen space) – read speed from ref so it updates every frame
            if (isRunning && isManual) {
                const p = playerPhysics.current;
                const speedDisplay = Math.abs(p.speed * 10).toFixed(0);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(10, 10, 200, 80);
                ctx.fillStyle = '#fff';
                ctx.font = '14px monospace';
                ctx.fillText(`Speed: ${speedDisplay} km/h`, 20, 30);
                ctx.fillText(`Position: (${p.x.toFixed(0)}, ${p.y.toFixed(0)})`, 20, 50);
                ctx.fillText('WASD / Arrows • Space = boost • Shift = brake', 20, 70);
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

    const handleDeleteScenario = async () => {
        if (!selectedScenario) return;
        if (!window.confirm(`Delete scenario "${selectedScenario.name}"? This cannot be undone.`)) return;
        const idToDelete = String(selectedScenario.id);
        try {
            await scenariosAPI.delete(idToDelete);
            setSelectedScenario(null);
            await loadScenarios();
        } catch (error) {
            console.error('Failed to delete scenario:', error);
            const msg = error.response?.data?.detail ?? error.message ?? 'Failed to delete scenario';
            alert(typeof msg === 'string' ? msg : JSON.stringify(msg));
        }
    };

    // AI mode: pan with mouse drag, zoom with wheel (allow when scenario selected, running or not)
    const handleCanvasMouseDown = (e) => {
        if (simulationType === 'ai_simulation' && selectedScenario) {
            isPanning.current = true;
            setIsDraggingMap(true);
            lastMouse.current = { x: e.clientX, y: e.clientY };
        }
    };
    const handleCanvasMouseMove = (e) => {
        if (isPanning.current) {
            const dx = e.clientX - lastMouse.current.x;
            const dy = e.clientY - lastMouse.current.y;
            aiCameraRef.current = {
                ...aiCameraRef.current,
                x: aiCameraRef.current.x + dx,
                y: aiCameraRef.current.y + dy,
            };
            lastMouse.current = { x: e.clientX, y: e.clientY };
        }
    };
    const handleCanvasMouseUp = () => {
        isPanning.current = false;
        setIsDraggingMap(false);
    };
    const handleCanvasWheel = (e) => {
        if (simulationType === 'ai_simulation' && selectedScenario) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            aiCameraRef.current = {
                ...aiCameraRef.current,
                zoom: Math.max(0.2, Math.min(3, aiCameraRef.current.zoom * delta)),
            };
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
        const roads = selectedScenario.roads;

        if (simulationType === 'ai_simulation') {
            const segs = buildRoadSegments(roads);
            roadSegmentsRef.current = segs;
            const spawned = [];
            if (segs.length) {
                for (let i = 0; i < numVehicles; i++) {
                    const segIdx = i % segs.length;
                    const seg = segs[segIdx];
                    spawned.push({
                        segmentIdx: segIdx,
                        progress: 0,
                        speed: 1.2 + Math.random() * 1.5,
                        color: `hsl(${Math.random() * 360}, 70%, 60%)`,
                        x: seg.x1,
                        y: seg.y1,
                        angle: Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1),
                    });
                }
            }
            vehiclesRef.current = spawned;
            setVehicles(spawned);
            aiCameraRef.current = { x: 0, y: 0, zoom: 1 };
        } else {
            roadSegmentsRef.current = [];
            vehiclesRef.current = [];
            setVehicles([]);
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

            // Reset metrics for new Manual Driving session
            metricsRef.current = {
                startTime: Date.now(),
                offRoadCount: 0,
                wasOnRoad: true,
                redLightViolations: 0,
                yellowLightViolations: 0,
                steeringAngles: [],
                maxSpeed: 0,
                speedSamples: [],
                lastPosition: null,
                distanceTraveled: 0,
                passedLights: new Set(),
            };
        }

        setIsRunning(true);

        // Create job and store ID for metrics submission
        jobsAPI.create({
            scenario_id: selectedScenario.id,
            simulation_type: simulationType,
            duration_seconds: 60,
            vehicle_count: numVehicles,
        }).then((res) => {
            currentJobIdRef.current = res.data.id;
        }).catch((err) => console.error('Failed to create job:', err));
    };

    // Calculate turn smoothness score (0-100, higher = smoother)
    const calculateSmoothnessScore = (angles) => {
        if (angles.length < 2) return 100;
        let totalVariation = 0;
        for (let i = 1; i < angles.length; i++) {
            let diff = Math.abs(angles[i] - angles[i - 1]);
            // Normalize angle difference to handle wrapping
            if (diff > Math.PI) diff = 2 * Math.PI - diff;
            totalVariation += diff;
        }
        const avgVariation = totalVariation / (angles.length - 1);
        // Convert to 0-100 score (lower variation = higher score)
        // avgVariation of 0 = 100, avgVariation of 0.1 (harsh steering) = 0
        const score = Math.max(0, Math.min(100, 100 - avgVariation * 1000));
        return score;
    };

    const pauseSimulation = async () => {
        setIsRunning(false);

        // Submit driving stats for Manual Driving mode
        if (simulationType === 'manual_driving' && currentJobIdRef.current && selectedScenario) {
            const m = metricsRef.current;
            const durationSeconds = (Date.now() - m.startTime) / 1000;
            const avgSpeed = m.speedSamples.length > 0
                ? m.speedSamples.reduce((a, b) => a + b, 0) / m.speedSamples.length
                : 0;
            const smoothnessScore = calculateSmoothnessScore(m.steeringAngles);

            try {
                await metricsAPI.submitDrivingStats({
                    job_id: currentJobIdRef.current,
                    scenario_id: selectedScenario.id,
                    off_road_count: m.offRoadCount,
                    red_light_violations: m.redLightViolations,
                    yellow_light_violations: m.yellowLightViolations,
                    turn_smoothness_score: smoothnessScore,
                    duration_seconds: durationSeconds,
                    max_speed: m.maxSpeed,
                    avg_speed: avgSpeed,
                    distance_traveled: m.distanceTraveled,
                });
                console.log('Driving stats submitted successfully');
            } catch (err) {
                console.error('Failed to submit driving stats:', err);
            }
        }
    };

    const resetSimulation = () => {
        setIsRunning(false);
        setVehicles([]);
        vehiclesRef.current = [];
        setHudSpeed(0);
        currentJobIdRef.current = null;
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
                <div ref={canvasContainerRef} className="col-span-2 bg-card rounded-xl overflow-hidden border border-border relative">
                    <canvas
                        ref={canvasRef}
                        width={800}
                        height={600}
                        className="w-full h-auto bg-dark-bg block"
                        onMouseDown={handleCanvasMouseDown}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={handleCanvasMouseUp}
                        onMouseLeave={handleCanvasMouseUp}
                        onWheel={handleCanvasWheel}
                        style={{ cursor: simulationType === 'ai_simulation' && isRunning ? (isDraggingMap ? 'grabbing' : 'grab') : 'default' }}
                    />
                    {simulationType === 'ai_simulation' && isRunning && (
                        <div className="absolute top-2 right-2 flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    aiCameraRef.current = { ...aiCameraRef.current, zoom: Math.min(3, aiCameraRef.current.zoom * 1.2) };
                                }}
                                className="p-2 bg-gray-800/90 hover:bg-gray-700 rounded text-white"
                                title="Zoom in"
                            >
                                <ZoomIn size={20} />
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    aiCameraRef.current = { ...aiCameraRef.current, zoom: Math.max(0.2, aiCameraRef.current.zoom / 1.2) };
                                }}
                                className="p-2 bg-gray-800/90 hover:bg-gray-700 rounded text-white"
                                title="Zoom out"
                            >
                                <ZoomOut size={20} />
                            </button>
                        </div>
                    )}
                    {simulationType === 'ai_simulation' && isRunning && (
                        <div className="absolute top-2 left-2 bg-black/50 backdrop-blur px-2 py-1 rounded text-xs text-gray-300">
                            Drag to pan • Scroll or buttons to zoom
                        </div>
                    )}
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
                            <div className="flex gap-2">
                                <select
                                    value={selectedScenario ? String(selectedScenario.id) : ''}
                                    onChange={(e) => {
                                        const id = e.target.value;
                                        const scenario = scenarios.find((s) => String(s.id) === id) ?? null;
                                        setSelectedScenario(scenario);
                                    }}
                                    className="flex-1 px-3 py-2 bg-dark-bg border border-gray-600 rounded-md text-white focus:outline-none focus:border-blue-500"
                                    disabled={isRunning}
                                >
                                    <option value="">-- Choose Scenario --</option>
                                    {scenarios.map((scenario) => (
                                        <option key={String(scenario.id)} value={String(scenario.id)}>
                                            {scenario.name}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={handleDeleteScenario}
                                    disabled={!selectedScenario || isRunning}
                                    className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-md border border-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Delete scenario"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
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
                                        <span className="font-mono text-blue-400">↓ / S / Shift</span>
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
