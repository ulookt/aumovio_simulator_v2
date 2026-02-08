import React, { useState, useEffect } from 'react';
import { jobsAPI, metricsAPI } from '@/services/api';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const MetricsAnalytics = () => {
    const [jobs, setJobs] = useState([]);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [telemetry, setTelemetry] = useState([]);
    const [safetyData, setSafetyData] = useState(null);
    const [insights, setInsights] = useState('');
    const [activeTab, setActiveTab] = useState('telemetry');

    useEffect(() => {
        loadJobs();
    }, []);

    useEffect(() => {
        if (selectedJobId) {
            loadMetrics(selectedJobId);
        }
    }, [selectedJobId]);

    const loadJobs = async () => {
        try {
            const response = await jobsAPI.list('completed');
            setJobs(response.data);
        } catch (error) {
            console.error('Failed to load jobs:', error);
        }
    };

    const loadMetrics = async (jobId) => {
        try {
            const [telemetryRes, safetyRes, insightsRes] = await Promise.all([
                metricsAPI.getTelemetry(jobId),
                metricsAPI.getSafety(jobId).catch(() => null),
                metricsAPI.getInsights(jobId).catch(() => null)
            ]);

            setTelemetry(telemetryRes.data);
            setSafetyData(safetyRes?.data);
            setInsights(insightsRes?.data?.content || 'No AI insights available');
        } catch (error) {
            console.error('Failed to load metrics:', error);
        }
    };

    const chartData = telemetry.map((t) => ({
        time: (t.timestamp / 1000).toFixed(1),
        speed: (t.speed * 3.6).toFixed(1), // Convert m/s to km/h
        brake: t.brake_intensity,
        steering: Math.abs(t.steering_angle)
    }));

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Metrics & Analytics</h1>

            <div className="mb-6 bg-dark-card p-4 rounded-lg">
                <label className="block text-sm font-medium mb-2">Select Completed Job</label>
                <select
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    className="w-full max-w-md px-3 py-2 bg-dark-bg border border-gray-600 rounded-md text-white focus:outline-none focus:border-blue-500"
                >
                    <option value="">-- Choose Job --</option>
                    {jobs.map((job) => (
                        <option key={job.id} value={job.id}>
                            {job.id.substring(0, 18)}... - {job.simulation_type}
                        </option>
                    ))}
                </select>
            </div>

            {selectedJobId && (
                <>
                    <div className="flex space-x-2 mb-6">
                        <button
                            onClick={() => setActiveTab('telemetry')}
                            className={`px-4 py-2 rounded-md font-medium ${activeTab === 'telemetry' ? 'bg-blue-600 text-white' : 'bg-dark-card text-gray-300'}`}
                        >
                            Telemetry
                        </button>
                        <button
                            onClick={() => setActiveTab('safety')}
                            className={`px-4 py-2 rounded-md font-medium ${activeTab === 'safety' ? 'bg-blue-600 text-white' : 'bg-dark-card text-gray-300'}`}
                        >
                            Safety
                        </button>
                        <button
                            onClick={() => setActiveTab('insights')}
                            className={`px-4 py-2 rounded-md font-medium ${activeTab === 'insights' ? 'bg-blue-600 text-white' : 'bg-dark-card text-gray-300'}`}
                        >
                            AI Insights
                        </button>
                    </div>

                    {activeTab === 'telemetry' && (
                        <div className="space-y-6">
                            <div className="bg-dark-card p-6 rounded-lg">
                                <h3 className="text-lg font-semibold mb-4">Speed Over Time</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis dataKey="time" label={{ value: 'Time (s)', position: 'insideBottom', offset: -5 }} stroke="#9CA3AF" />
                                        <YAxis label={{ value: 'Speed (km/h)', angle: -90, position: 'insideLeft' }} stroke="#9CA3AF" />
                                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                                        <Legend />
                                        <Line type="monotone" dataKey="speed" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="bg-dark-card p-6 rounded-lg">
                                <h3 className="text-lg font-semibold mb-4">Brake Intensity</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <AreaChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis dataKey="time" stroke="#9CA3AF" />
                                        <YAxis stroke="#9CA3AF" />
                                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                                        <Area type="monotone" dataKey="brake" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {activeTab === 'safety' && safetyData && (
                        <div className="bg-dark-card p-6 rounded-lg">
                            <h3 className="text-lg font-semibold mb-4">Safety Metrics</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-dark-bg p-4 rounded-md">
                                    <div className="text-3xl font-bold text-green-400">
                                        {safetyData.overall_safety_score?.toFixed(1) || 0}/100
                                    </div>
                                    <div className="text-sm text-gray-400 mt-1">Overall Safety Score</div>
                                </div>
                                <div className="bg-dark-bg p-4 rounded-md">
                                    <div className="text-3xl font-bold text-yellow-400">
                                        {safetyData.near_miss_count || 0}
                                    </div>
                                    <div className="text-sm text-gray-400 mt-1">Near Misses</div>
                                </div>
                                <div className="bg-dark-bg p-4 rounded-md">
                                    <div className="text-3xl font-bold text-orange-400">
                                        {safetyData.hazard_exposure_score?.toFixed(1) || 0}
                                    </div>
                                    <div className="text-sm text-gray-400 mt-1">Hazard Exposure</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'insights' && (
                        <div className="bg-dark-card p-6 rounded-lg">
                            <h3 className="text-lg font-semibold mb-4">AI-Generated Insights</h3>
                            <div className="prose prose-invert max-w-none">
                                <p className="text-gray-300 whitespace-pre-wrap">{insights}</p>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default MetricsAnalytics;
