import React, { useState, useEffect } from 'react';
import { scenariosAPI } from '@/services/api';
import {
    MousePointer, Brush, Eraser, TrafficCone, Lightbulb,
    Octagon, Users, Play, Save, Settings, ZoomIn, ZoomOut
} from 'lucide-react';

const ScenarioBuilder = () => {
    const canvasRef = React.useRef(null);
    const [tool, setTool] = React.useState('select');
    const [camera, setCamera] = React.useState({ x: 0, y: 0, zoom: 1 });
    const [isDragging, setIsDragging] = React.useState(false);
    const [lastPos, setLastPos] = React.useState({ x: 0, y: 0 });
    const [isPreviewing, setIsPreviewing] = React.useState(false);

    // Scenario data
    const [scenario, setScenario] = React.useState({
        name: 'New Scenario',
        strokes: [],
        objects: [],
        weather: 'clear',
        weatherIntensity: 0.5
    });

    const [config, setConfig] = React.useState({
        gridSize: 50,
        snap: false,
        showGrid: true
    });

    const currentPath = React.useRef([]);
    const isDrawing = React.useRef(false);
    const agents = React.useRef([]);

    // Render canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let animationFrameId;

        const render = () => {
            // Resize canvas to fill container
            if (canvas.width !== canvas.parentElement.clientWidth ||
                canvas.height !== canvas.parentElement.clientHeight) {
                canvas.width = canvas.parentElement.clientWidth;
                canvas.height = canvas.parentElement.clientHeight;
            }

            const { width, height } = canvas;

            // Clear background
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, width, height);

            ctx.save();
            // Camera transform
            ctx.translate(width / 2, height / 2);
            ctx.scale(camera.zoom, camera.zoom);
            ctx.translate(-width / 2 + camera.x, -height / 2 + camera.y);

            // Draw grid
            if (config.showGrid) {
                ctx.strokeStyle = '#1e293b';
                ctx.lineWidth = 1;
                ctx.beginPath();
                const step = config.gridSize;
                const limit = 2000;
                for (let x = -limit; x <= limit; x += step) {
                    ctx.moveTo(x, -limit);
                    ctx.lineTo(x, limit);
                }
                for (let y = -limit; y <= limit; y += step) {
                    ctx.moveTo(-limit, y);
                    ctx.lineTo(limit, y);
                }
                ctx.stroke();
            }

            // Draw roads
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            scenario.strokes.forEach(road => {
                if (road.points.length < 2) return;
                ctx.beginPath();
                ctx.moveTo(road.points[0].x, road.points[0].y);
                for (let i = 1; i < road.points.length; i++) {
                    ctx.lineTo(road.points[i].x, road.points[i].y);
                }
                ctx.lineWidth = road.width;
                ctx.strokeStyle = '#334155';
                ctx.stroke();

                // Center line
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#fbbf24';
                ctx.setLineDash([10, 10]);
                ctx.stroke();
                ctx.setLineDash([]);
            });

            // Draw current stroke preview
            if (isDrawing.current && currentPath.current.length > 0) {
                ctx.beginPath();
                ctx.moveTo(currentPath.current[0].x, currentPath.current[0].y);
                for (let i = 1; i < currentPath.current.length; i++) {
                    ctx.lineTo(currentPath.current[i].x, currentPath.current[i].y);
                }
                ctx.lineWidth = 40;
                ctx.strokeStyle = '#475569';
                ctx.stroke();
            }

            // Draw objects
            scenario.objects.forEach(obj => {
                ctx.save();
                ctx.translate(obj.x, obj.y);

                if (obj.type === 'light') {
                    ctx.fillStyle = '#1f2937';
                    ctx.fillRect(-5, -20, 10, 40);
                    ctx.fillStyle = obj.state === 'red' ? '#ef4444' : '#10b981';
                    ctx.beginPath();
                    ctx.arc(0, -10, 4, 0, Math.PI * 2);
                    ctx.fill();
                } else if (obj.type === 'stop') {
                    ctx.fillStyle = '#ef4444';
                    ctx.beginPath();
                    for (let i = 0; i < 8; i++) {
                        const ang = i * Math.PI / 4;
                        ctx.lineTo(Math.cos(ang) * 15, Math.sin(ang) * 15);
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.fillStyle = 'white';
                    ctx.font = '8px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('STOP', 0, 3);
                } else if (obj.type === 'ped') {
                    ctx.fillStyle = '#a855f7';
                    ctx.beginPath();
                    ctx.arc(0, 0, 6, 0, Math.PI * 2);
                    ctx.fill();
                } else if (obj.type === 'obs') {
                    ctx.fillStyle = '#f97316';
                    ctx.beginPath();
                    ctx.moveTo(-6, 6);
                    ctx.lineTo(6, 6);
                    ctx.lineTo(0, -10);
                    ctx.closePath();
                    ctx.fill();
                }

                ctx.restore();
            });

            // Preview simulation agents
            if (isPreviewing) {
                if (Math.random() < 0.02 && scenario.strokes.length > 0) {
                    const road = scenario.strokes[Math.floor(Math.random() * scenario.strokes.length)];
                    if (road.points.length > 1) {
                        agents.current.push({
                            x: road.points[0].x,
                            y: road.points[0].y,
                            roadIndex: scenario.strokes.indexOf(road),
                            ptIndex: 0,
                            speed: 2 + Math.random(),
                            progress: 0
                        });
                    }
                }

                agents.current.forEach((agent, i) => {
                    const road = scenario.strokes[agent.roadIndex];
                    if (!road) return;

                    const p1 = road.points[agent.ptIndex];
                    const p2 = road.points[agent.ptIndex + 1];

                    if (p1 && p2) {
                        const dx = p2.x - p1.x;
                        const dy = p2.y - p1.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);

                        agent.progress += agent.speed;
                        const t = agent.progress / dist;

                        agent.x = p1.x + dx * t;
                        agent.y = p1.y + dy * t;

                        if (t >= 1) {
                            agent.ptIndex++;
                            agent.progress = 0;
                            if (agent.ptIndex >= road.points.length - 1) {
                                agents.current[i] = null;
                            }
                        }

                        ctx.fillStyle = '#3b82f6';
                        ctx.fillRect(agent.x - 6, agent.y - 3, 12, 6);
                    }
                });

                agents.current = agents.current.filter(a => a !== null);
            }

            ctx.restore();
            animationFrameId = requestAnimationFrame(render);
        };

        render();
        return () => cancelAnimationFrame(animationFrameId);
    }, [camera, scenario, config, isPreviewing, tool]);

    // Mouse helpers
    const getPos = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) / camera.zoom + rect.width / 2 - camera.x;
        const y = (e.clientY - rect.top - rect.height / 2) / camera.zoom + rect.height / 2 - camera.y;
        return { x, y };
    };

    const handleMouseDown = (e) => {
        if (tool === 'select') {
            setIsDragging(true);
            setLastPos({ x: e.clientX, y: e.clientY });
        } else if (tool === 'road') {
            isDrawing.current = true;
            currentPath.current = [getPos(e)];
        } else if (['light', 'stop', 'ped', 'obs'].includes(tool)) {
            const p = getPos(e);
            setScenario(prev => ({
                ...prev,
                objects: [...prev.objects, {
                    type: tool,
                    x: p.x,
                    y: p.y,
                    state: tool === 'light' ? 'red' : 'active'
                }]
            }));
        } else if (tool === 'eraser') {
            const p = getPos(e);
            setScenario(prev => ({
                ...prev,
                strokes: prev.strokes.filter(r =>
                    r.points.every(pt => Math.hypot(pt.x - p.x, pt.y - p.y) > 30)
                ),
                objects: prev.objects.filter(o =>
                    Math.hypot(o.x - p.x, o.y - p.y) > 30
                )
            }));
        }
    };

    const handleMouseMove = (e) => {
        if (isDragging && tool === 'select') {
            const dx = e.clientX - lastPos.x;
            const dy = e.clientY - lastPos.y;
            setCamera(p => ({ ...p, x: p.x + dx / p.zoom, y: p.y + dy / p.zoom }));
            setLastPos({ x: e.clientX, y: e.clientY });
        } else if (isDrawing.current && tool === 'road') {
            currentPath.current.push(getPos(e));
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        if (isDrawing.current) {
            isDrawing.current = false;
            const pathToSave = [...currentPath.current];
            currentPath.current = [];

            if (pathToSave.length > 1) {
                setScenario(prev => ({
                    ...prev,
                    strokes: [...prev.strokes, { points: pathToSave, width: 40 }]
                }));
            }
        }
    };

    const handleSave = async () => {
        try {
            await scenariosAPI.create({
                name: scenario.name,
                roads: scenario.strokes,
                traffic_lights: scenario.objects.filter(o => o.type === 'light'),
                stop_signs: scenario.objects.filter(o => o.type === 'stop'),
                crosswalks: scenario.objects.filter(o => o.type === 'ped'),
                hazards: scenario.objects.filter(o => o.type === 'obs'),
                weather: scenario.weather,
                weather_intensity: scenario.weatherIntensity
            });
            alert('Scenario saved successfully!');
        } catch (error) {
            console.error('Failed to save:', error);
            alert('Failed to save scenario');
        }
    };

    return (
        <div className="flex h-[calc(100vh-100px)] gap-4">
            {/* Canvas */}
            <div className="flex-1 bg-black rounded-xl overflow-hidden relative shadow-2xl border border-gray-800">
                <canvas
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    className="w-full h-full cursor-crosshair"
                />

                {/* Zoom controls */}
                <div className="absolute top-4 right-4 flex flex-col gap-2">
                    <button
                        onClick={() => setCamera(p => ({ ...p, zoom: p.zoom * 1.2 }))}
                        className="p-2 bg-gray-800 rounded hover:bg-gray-700 text-white"
                    >
                        <ZoomIn size={20} />
                    </button>
                    <button
                        onClick={() => setCamera(p => ({ ...p, zoom: p.zoom / 1.2 }))}
                        className="p-2 bg-gray-800 rounded hover:bg-gray-700 text-white"
                    >
                        <ZoomOut size={20} />
                    </button>
                </div>

                {/* Tool indicator */}
                <div className="absolute top-4 left-4 bg-black/50 backdrop-blur px-3 py-1 rounded text-xs text-gray-300">
                    {tool === 'select' ? 'Pan Mode (Drag to Move)' : `${tool} Tool Active`}
                </div>
            </div>

            {/* Tools Panel */}
            <div className="w-80 bg-card rounded-xl border border-border flex flex-col overflow-hidden">
                <div className="p-4 border-b border-border bg-black/20">
                    <h2 className="font-bold flex items-center gap-2 text-white">
                        <Settings className="w-4 h-4 text-primary" />
                        Scenario Tools
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Scenario Name */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Scenario Name</label>
                        <input
                            type="text"
                            value={scenario.name}
                            onChange={(e) => setScenario(p => ({ ...p, name: e.target.value }))}
                            className="w-full px-3 py-2 bg-dark-bg border border-gray-600 rounded-md text-white focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    {/* Navigation */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Navigation</h3>
                        <button
                            onClick={() => setTool('select')}
                            className={`w-full p-3 rounded-lg border flex items-center justify-center gap-2 transition-all ${tool === 'select'
                                    ? 'bg-blue-500/20 border-blue-500 text-blue-500'
                                    : 'border-gray-700 hover:bg-gray-800 text-gray-300'
                                }`}
                        >
                            <MousePointer size={20} />
                            <span className="text-sm font-medium">Pan / Select Mode</span>
                        </button>
                    </div>

                    {/* Infrastructure */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Infrastructure</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setTool('road')}
                                className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${tool === 'road'
                                        ? 'bg-primary/20 border-primary text-primary'
                                        : 'border-gray-700 hover:bg-gray-800 text-gray-300'
                                    }`}
                            >
                                <Brush size={20} />
                                <span className="text-xs">Draw Road</span>
                            </button>
                            <button
                                onClick={() => setTool('eraser')}
                                className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${tool === 'eraser'
                                        ? 'bg-red-500/20 border-red-500 text-red-500'
                                        : 'border-gray-700 hover:bg-gray-800 text-gray-300'
                                    }`}
                            >
                                <Eraser size={20} />
                                <span className="text-xs">Eraser</span>
                            </button>
                        </div>
                    </div>

                    {/* Traffic Controls */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Traffic Controls</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setTool('light')}
                                className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${tool === 'light'
                                        ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500'
                                        : 'border-gray-700 hover:bg-gray-800 text-gray-300'
                                    }`}
                            >
                                <Lightbulb size={20} />
                                <span className="text-xs">Traffic Light</span>
                            </button>
                            <button
                                onClick={() => setTool('stop')}
                                className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${tool === 'stop'
                                        ? 'bg-red-500/20 border-red-500 text-red-500'
                                        : 'border-gray-700 hover:bg-gray-800 text-gray-300'
                                    }`}
                            >
                                <Octagon size={20} />
                                <span className="text-xs">Stop Sign</span>
                            </button>
                        </div>
                    </div>

                    {/* Hazards */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Hazards</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setTool('ped')}
                                className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${tool === 'ped'
                                        ? 'bg-purple-500/20 border-purple-500 text-purple-500'
                                        : 'border-gray-700 hover:bg-gray-800 text-gray-300'
                                    }`}
                            >
                                <Users size={20} />
                                <span className="text-xs">Pedestrians</span>
                            </button>
                            <button
                                onClick={() => setTool('obs')}
                                className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${tool === 'obs'
                                        ? 'bg-orange-500/20 border-orange-500 text-orange-500'
                                        : 'border-gray-700 hover:bg-gray-800 text-gray-300'
                                    }`}
                            >
                                <TrafficCone size={20} />
                                <span className="text-xs">Obstacles</span>
                            </button>
                        </div>
                    </div>

                    {/* Weather */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Weather</h3>
                        <select
                            value={scenario.weather}
                            onChange={(e) => setScenario(p => ({ ...p, weather: e.target.value }))}
                            className="w-full px-3 py-2 bg-dark-bg border border-gray-600 rounded-md text-white focus:outline-none focus:border-blue-500 mb-2"
                        >
                            <option value="clear">Clear</option>
                            <option value="rain">Rain</option>
                            <option value="fog">Fog</option>
                            <option value="snow">Snow</option>
                        </select>
                        <label className="block text-xs text-gray-400 mb-1">
                            Intensity: {Math.round(scenario.weatherIntensity * 100)}%
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={scenario.weatherIntensity}
                            onChange={(e) => setScenario(p => ({ ...p, weatherIntensity: parseFloat(e.target.value) }))}
                            className="w-full"
                        />
                    </div>

                    {/* Actions */}
                    <div className="pt-4 border-t border-gray-700">
                        <button
                            onClick={() => setIsPreviewing(!isPreviewing)}
                            className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all mb-2 ${isPreviewing
                                    ? 'bg-red-500 text-white hover:bg-red-600'
                                    : 'bg-secondary text-white hover:bg-secondary/90'
                                }`}
                        >
                            <Play size={18} fill="currentColor" />
                            {isPreviewing ? 'Stop Preview' : 'Run Preview'}
                        </button>
                        <button
                            onClick={handleSave}
                            className="w-full py-3 bg-primary hover:bg-primary/90 rounded-lg font-bold flex items-center justify-center gap-2 text-white transition-all"
                        >
                            <Save size={18} />
                            Save Scenario
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScenarioBuilder;
