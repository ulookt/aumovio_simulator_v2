import React, { useState, useEffect } from 'react';
import { scenariosAPI, jobsAPI } from '@/services/api';

const SceneSimulation = () => {
    const [scenarios, setScenarios] = useState([]);
    const [selectedScenario, setSelectedScenario] = useState('');
    const [simulationType, setSimulationType] = useState('ai_simulation');
    const [isRunning, setIsRunning] = useState(false);

    useEffect(() => {
        loadScenarios();
    }, []);

    const loadScenarios = async () => {
        try {
            const response = await scenariosAPI.list();
            setScenarios(response.data);
        } catch (error) {
            console.error('Failed to load scenarios:', error);
        }
    };

    const startSimulation = async () => {
        if (!selectedScenario) {
            alert('Please select a scenario');
            return;
        }

        try {
            setIsRunning(true);
            await jobsAPI.create({
                scenario_id: selectedScenario,
                simulation_type: simulationType,
                duration_seconds: 60,
                vehicle_count: 5
            });

            alert('Simulation started! Check Jobs Dashboard for status.');
        } catch (error) {
            console.error('Failed to start simulation:', error);
            alert('Failed to start simulation');
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Scene Simulation</h1>

            <div className="grid grid-cols-3 gap-6">
                {/* Simulation Canvas */}
                <div className="col-span-2 bg-dark-card p-6 rounded-lg">
                    <div className="bg-gray-800 rounded-lg flex items-center justify-center" style={{ height: '600px' }}>
                        <canvas
                            id="simulation-canvas"
                            width="800"
                            height="600"
                            className="bg-gray-900"
                        />
                    </div>
                    <p className="text-gray-400 text-sm mt-4">
                        Simulation rendering - AI vehicles and physics coming next phase
                    </p>
                </div>

                {/* Control Panel */}
                <div className="bg-dark-card p-6 rounded-lg">
                    <h2 className="text-xl font-semibold mb-4">Control Panel</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Select Scenario</label>
                            <select
                                value={selectedScenario}
                                onChange={(e) => setSelectedScenario(e.target.value)}
                                className="w-full px-3 py-2 bg-dark-bg border border-gray-600 rounded-md text-white focus:outline-none focus:border-blue-500"
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
                            <label className="block text-sm font-medium mb-2">Simulation Mode</label>
                            <div className="space-y-2">
                                <label className="flex items-center">
                                    <input
                                        type="radio"
                                        value="ai_simulation"
                                        checked={simulationType === 'ai_simulation'}
                                        onChange={(e) => setSimulationType(e.target.value)}
                                        className="mr-2"
                                    />
                                    <span>AI Simulation</span>
                                </label>
                                <label className="flex items-center">
                                    <input
                                        type="radio"
                                        value="manual_driving"
                                        checked={simulationType === 'manual_driving'}
                                        onChange={(e) => setSimulationType(e.target.value)}
                                        className="mr-2"
                                    />
                                    <span>Manual Driving</span>
                                </label>
                            </div>
                        </div>

                        <button
                            onClick={startSimulation}
                            disabled={isRunning}
                            className={`w-full font-semibold py-3 px-4 rounded-md transition-colors ${isRunning
                                ? 'bg-gray-600 cursor-not-allowed'
                                : 'bg-green-600 hover:bg-green-700 text-white'
                                }`}
                        >
                            {isRunning ? 'Starting...' : 'Start Simulation'}
                        </button>

                        <div className="mt-6 p-4 bg-dark-bg rounded-md">
                            <h3 className="font-semibold mb-2">Instructions</h3>
                            <ul className="text-sm text-gray-300 space-y-1">
                                <li>• AI Mode: Watch autonomous vehicles navigate</li>
                                <li>• Manual Mode: Drive using arrow keys</li>
                                <li>• Space: Boost</li>
                                <li>• Shift: Brake</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SceneSimulation;
