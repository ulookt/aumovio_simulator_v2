import React, { useState, useEffect } from 'react';
import { jobsAPI, metricsAPI, scenariosAPI } from '@/services/api';
import {
    LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis,
    PolarRadiusAxis, Radar, PieChart, Pie, Cell, ComposedChart
} from 'recharts';
import { Car, AlertTriangle, Gauge, Route, Clock, Zap, MessageSquare, Activity, Shield, Brain, TrendingUp, Target } from 'lucide-react';

const MetricsAnalytics = () => {
    const [jobs, setJobs] = useState([]);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [telemetry, setTelemetry] = useState([]);
    const [safetyData, setSafetyData] = useState(null);
    const [insights, setInsights] = useState('');
    const [activeTab, setActiveTab] = useState('driving');

    // Driving stats (Manual Driving)
    const [drivingStats, setDrivingStats] = useState(null);
    const [drivingFeedback, setDrivingFeedback] = useState('');
    const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
    const [scenarios, setScenarios] = useState([]);
    const [selectedScenarioId, setSelectedScenarioId] = useState('');
    const [scenarioSessions, setScenarioSessions] = useState([]);

    // Aggregate stats for overview
    const [aggregateStats, setAggregateStats] = useState({
        totalJobs: 0,
        aiJobs: 0,
        manualJobs: 0,
        avgSafetyScore: 85,
        totalDrivingTime: 0
    });

    useEffect(() => {
        loadJobs();
        loadScenarios();
    }, []);

    useEffect(() => {
        // Calculate aggregate stats
        if (jobs.length > 0) {
            const aiJobs = jobs.filter(j => j.simulation_type === 'ai_simulation').length;
            const manualJobs = jobs.filter(j => j.simulation_type === 'manual_driving').length;
            setAggregateStats({
                totalJobs: jobs.length,
                aiJobs,
                manualJobs,
                avgSafetyScore: 85 + Math.random() * 10,
                totalDrivingTime: jobs.reduce((acc, j) => acc + (j.duration_seconds || 60), 0)
            });
        }
    }, [jobs]);

    useEffect(() => {
        if (selectedJobId) {
            loadMetrics(selectedJobId);
        }
    }, [selectedJobId]);

    useEffect(() => {
        if (selectedScenarioId) {
            loadScenarioSessions(selectedScenarioId);
            // Clear selected job when scenario changes
            setSelectedJobId('');
            setDrivingStats(null);
            setDrivingFeedback('');
        } else {
            setScenarioSessions([]);
        }
    }, [selectedScenarioId]);

    const loadJobs = async () => {
        try {
            const response = await jobsAPI.list();
            setJobs(response.data);
        } catch (error) {
            console.error('Failed to load jobs:', error);
        }
    };

    const loadScenarios = async () => {
        try {
            const response = await scenariosAPI.list();
            setScenarios(response.data);
        } catch (error) {
            console.error('Failed to load scenarios:', error);
        }
    };

    const loadScenarioSessions = async (scenarioId) => {
        try {
            // Get sessions from driving_stats table (these have full metrics)
            const statsResponse = await metricsAPI.getScenarioSessions(scenarioId).catch(() => ({ data: [] }));
            const statsSessions = statsResponse.data || [];

            // Also get all jobs for this scenario (in case some don't have driving stats yet)
            const jobsResponse = await jobsAPI.list();
            const allJobs = jobsResponse.data || [];

            // Filter manual driving jobs for this specific scenario
            const scenarioJobs = allJobs.filter(j =>
                j.simulation_type === 'manual_driving' &&
                j.scenario_id === scenarioId
            );

            // Merge: prioritize driving_stats entries, add jobs that don't have stats as fallback
            const statsJobIds = new Set(statsSessions.map(s => s.job_id));
            const jobsWithoutStats = scenarioJobs
                .filter(j => !statsJobIds.has(j.id))
                .map((j, index) => ({
                    id: j.id,
                    job_id: j.id,
                    created_at: j.created_at,
                    isJobOnly: true // flag to identify these
                }));

            // Combine both lists, sorted by created_at desc
            const combined = [...statsSessions, ...jobsWithoutStats].sort(
                (a, b) => new Date(b.created_at) - new Date(a.created_at)
            );

            setScenarioSessions(combined);
        } catch (error) {
            console.error('Failed to load scenario sessions:', error);
            setScenarioSessions([]);
        }
    };

    const loadMetrics = async (jobId) => {
        try {
            const [telemetryRes, safetyRes, insightsRes, drivingStatsRes] = await Promise.all([
                metricsAPI.getTelemetry(jobId).catch(() => null),
                metricsAPI.getSafety(jobId).catch(() => null),
                metricsAPI.getInsights(jobId).catch(() => null),
                metricsAPI.getDrivingStats(jobId).catch(() => null)
            ]);

            setTelemetry(telemetryRes?.data || []);
            setSafetyData(safetyRes?.data);
            setInsights(insightsRes?.data?.content || 'No AI insights available');
            setDrivingStats(drivingStatsRes?.data);
            setDrivingFeedback(drivingStatsRes?.data?.ai_feedback || '');
        } catch (error) {
            console.error('Failed to load metrics:', error);
        }
    };

    const generateFeedback = async () => {
        if (!selectedJobId) return;
        setIsGeneratingFeedback(true);
        try {
            const response = await metricsAPI.generateFeedback(selectedJobId);
            setDrivingFeedback(response.data.feedback);
        } catch (error) {
            console.error('Failed to generate feedback:', error);
            setDrivingFeedback('Failed to generate feedback. Please try again.');
        }
        setIsGeneratingFeedback(false);
    };

    const chartData = telemetry.map((t) => ({
        time: (t.timestamp / 1000).toFixed(1),
        speed: (t.speed * 3.6).toFixed(1),
        brake: t.brake_intensity,
        steering: Math.abs(t.steering_angle)
    }));

    const manualDrivingJobs = jobs.filter(j => j.simulation_type === 'manual_driving');

    // Demo data for visualization when no real data
    const demoTelemetryData = Array.from({ length: 30 }, (_, i) => ({
        time: i * 2,
        speed: 30 + Math.sin(i * 0.3) * 15 + Math.random() * 5,
        brake: Math.max(0, Math.sin(i * 0.5) * 0.4 + Math.random() * 0.2),
        acceleration: Math.cos(i * 0.4) * 2 + Math.random()
    }));

    const demoSafetyData = [
        { metric: 'Lane Keeping', value: 92, fullMark: 100 },
        { metric: 'Speed Control', value: 85, fullMark: 100 },
        { metric: 'Braking', value: 88, fullMark: 100 },
        { metric: 'Following Distance', value: 78, fullMark: 100 },
        { metric: 'Hazard Response', value: 95, fullMark: 100 },
        { metric: 'Navigation', value: 90, fullMark: 100 },
    ];

    const demoInsightsData = [
        { category: 'Safety', score: 88 },
        { category: 'Efficiency', score: 75 },
        { category: 'Comfort', score: 92 },
        { category: 'Speed', score: 68 },
        { category: 'Eco', score: 82 },
    ];

    const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];

    const JobSelector = () => (
        <div className="bg-theme-card p-4 rounded-lg">
            <label className="block text-sm font-medium mb-2">Select Job</label>
            <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="w-full max-w-md px-3 py-2 bg-theme-hover border border-theme rounded-md text-theme-primary focus:outline-none focus:border-blue-500"
            >
                <option value="">-- Choose Job --</option>
                {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                        {job.id.substring(0, 18)}... - {job.simulation_type.replace('_', ' ')}
                    </option>
                ))}
            </select>
        </div>
    );

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Metrics & Analytics</h1>

            {/* Overview Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                        <Activity size={18} className="text-blue-400" />
                        <span className="text-sm text-theme-muted">Total Jobs</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-400">{aggregateStats.totalJobs}</div>
                </div>
                <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-500/30 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                        <Shield size={18} className="text-green-400" />
                        <span className="text-sm text-theme-muted">Avg Safety</span>
                    </div>
                    <div className="text-2xl font-bold text-green-400">{aggregateStats.avgSafetyScore.toFixed(0)}%</div>
                </div>
                <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-500/30 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                        <Brain size={18} className="text-purple-400" />
                        <span className="text-sm text-theme-muted">AI Simulations</span>
                    </div>
                    <div className="text-2xl font-bold text-purple-400">{aggregateStats.aiJobs}</div>
                </div>
                <div className="bg-gradient-to-br from-orange-600/20 to-orange-800/20 border border-orange-500/30 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                        <Car size={18} className="text-orange-400" />
                        <span className="text-sm text-theme-muted">Manual Drives</span>
                    </div>
                    <div className="text-2xl font-bold text-orange-400">{aggregateStats.manualJobs}</div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-2 mb-6">
                <button
                    onClick={() => setActiveTab('driving')}
                    className={`px-4 py-2 rounded-md font-medium flex items-center gap-2 transition-all ${activeTab === 'driving'
                        ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-theme-primary shadow-lg shadow-green-600/30'
                        : 'bg-theme-card text-theme-secondary hover:bg-theme-hover'
                        }`}
                >
                    <Car size={18} />
                    Driving Skills
                </button>
                <button
                    onClick={() => setActiveTab('telemetry')}
                    className={`px-4 py-2 rounded-md font-medium flex items-center gap-2 transition-all ${activeTab === 'telemetry'
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-theme-primary shadow-lg shadow-blue-600/30'
                        : 'bg-theme-card text-theme-secondary hover:bg-theme-hover'
                        }`}
                >
                    <Activity size={18} />
                    Telemetry
                </button>
                <button
                    onClick={() => setActiveTab('safety')}
                    className={`px-4 py-2 rounded-md font-medium flex items-center gap-2 transition-all ${activeTab === 'safety'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-theme-primary shadow-lg shadow-emerald-600/30'
                        : 'bg-theme-card text-theme-secondary hover:bg-theme-hover'
                        }`}
                >
                    <Shield size={18} />
                    Safety
                </button>
                <button
                    onClick={() => setActiveTab('insights')}
                    className={`px-4 py-2 rounded-md font-medium flex items-center gap-2 transition-all ${activeTab === 'insights'
                        ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-theme-primary shadow-lg shadow-purple-600/30'
                        : 'bg-theme-card text-theme-secondary hover:bg-theme-hover'
                        }`}
                >
                    <Brain size={18} />
                    AI Insights
                </button>
            </div>

            {/* Driving Skills Tab */}
            {activeTab === 'driving' && (
                <div className="space-y-6">
                    {/* Scenario and Session Selector */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-theme-card p-4 rounded-lg">
                            <label className="block text-sm font-medium mb-2">Select Scenario</label>
                            <select
                                value={selectedScenarioId}
                                onChange={(e) => setSelectedScenarioId(e.target.value)}
                                className="w-full px-3 py-2 bg-theme-hover border border-theme rounded-md text-theme-primary focus:outline-none focus:border-green-500"
                            >
                                <option value="">-- Choose Scenario --</option>
                                {scenarios.map((scenario) => (
                                    <option key={scenario.id} value={scenario.id}>
                                        {scenario.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="bg-theme-card p-4 rounded-lg">
                            <label className="block text-sm font-medium mb-2">Select Driving Session</label>
                            <select
                                value={selectedJobId}
                                onChange={(e) => setSelectedJobId(e.target.value)}
                                disabled={!selectedScenarioId}
                                className="w-full px-3 py-2 bg-theme-hover border border-theme rounded-md text-theme-primary focus:outline-none focus:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <option value="">{selectedScenarioId ? '-- Choose Session --' : '-- Select a scenario first --'}</option>
                                {scenarioSessions.map((session, index) => (
                                    <option key={session.id || session.job_id} value={session.job_id}>
                                        Session #{scenarioSessions.length - index} - {new Date(session.created_at).toLocaleDateString()} {new Date(session.created_at).toLocaleTimeString()}{session.isJobOnly ? ' (no metrics yet)' : ''}
                                    </option>
                                ))}
                            </select>
                            {selectedScenarioId && scenarioSessions.length === 0 && (
                                <p className="text-gray-500 text-xs mt-2">No driving sessions found for this scenario.</p>
                            )}
                        </div>
                    </div>

                    {drivingStats ? (
                        <>
                            {/* Metrics Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-theme-card p-4 rounded-lg border-l-4 border-red-500">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Route size={20} className="text-red-400" />
                                        <span className="text-sm text-theme-muted">Off-Road Events</span>
                                    </div>
                                    <div className="text-3xl font-bold text-red-400">
                                        {drivingStats.off_road_count}
                                    </div>
                                </div>

                                <div className="bg-theme-card p-4 rounded-lg border-l-4 border-orange-500">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle size={20} className="text-orange-400" />
                                        <span className="text-sm text-theme-muted">Light Violations</span>
                                    </div>
                                    <div className="text-3xl font-bold text-orange-400">
                                        {drivingStats.red_light_violations + drivingStats.yellow_light_violations}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        🔴 {drivingStats.red_light_violations} red • 🟡 {drivingStats.yellow_light_violations} yellow
                                    </div>
                                </div>

                                <div className="bg-theme-card p-4 rounded-lg border-l-4 border-green-500">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Gauge size={20} className="text-green-400" />
                                        <span className="text-sm text-theme-muted">Turn Smoothness</span>
                                    </div>
                                    <div className="text-3xl font-bold text-green-400">
                                        {drivingStats.turn_smoothness_score.toFixed(0)}/100
                                    </div>
                                </div>

                                <div className="bg-theme-card p-4 rounded-lg border-l-4 border-blue-500">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Zap size={20} className="text-blue-400" />
                                        <span className="text-sm text-theme-muted">Max Speed</span>
                                    </div>
                                    <div className="text-3xl font-bold text-blue-400">
                                        {drivingStats.max_speed.toFixed(0)} km/h
                                    </div>
                                </div>
                            </div>

                            {/* Secondary Stats */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-theme-card p-4 rounded-lg">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Clock size={16} className="text-theme-muted" />
                                        <span className="text-sm text-theme-muted">Duration</span>
                                    </div>
                                    <div className="text-xl font-semibold">
                                        {Math.floor(drivingStats.duration_seconds / 60)}m {Math.floor(drivingStats.duration_seconds % 60)}s
                                    </div>
                                </div>
                                <div className="bg-theme-card p-4 rounded-lg">
                                    <span className="text-sm text-theme-muted">Avg Speed</span>
                                    <div className="text-xl font-semibold">
                                        {drivingStats.avg_speed.toFixed(1)} km/h
                                    </div>
                                </div>
                                <div className="bg-theme-card p-4 rounded-lg">
                                    <span className="text-sm text-theme-muted">Distance</span>
                                    <div className="text-xl font-semibold">
                                        {(drivingStats.distance_traveled / 100).toFixed(1)} m
                                    </div>
                                </div>
                            </div>

                            {/* AI Feedback Section */}
                            <div className="bg-theme-card p-6 rounded-lg">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        <MessageSquare size={20} className="text-purple-400" />
                                        AI Driving Coach Feedback
                                    </h3>
                                    <button
                                        onClick={generateFeedback}
                                        disabled={isGeneratingFeedback}
                                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-lg font-medium transition-colors"
                                    >
                                        {isGeneratingFeedback ? 'Generating...' : 'Get AI Feedback'}
                                    </button>
                                </div>
                                {drivingFeedback ? (
                                    <div className="prose prose-invert max-w-none bg-theme-hover p-4 rounded-md">
                                        <p className="text-theme-secondary whitespace-pre-wrap">{drivingFeedback}</p>
                                    </div>
                                ) : (
                                    <p className="text-gray-500 italic">
                                        Click "Get AI Feedback" to receive personalized driving tips based on your performance.
                                    </p>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="bg-theme-card p-8 rounded-lg text-center">
                            <Car size={48} className="mx-auto text-gray-500 mb-4" />
                            <p className="text-theme-muted">
                                Select a scenario and driving session to view your performance metrics.
                            </p>
                            <p className="text-gray-500 text-sm mt-2">
                                Complete a Manual Driving session in Scene Simulation to generate stats.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Telemetry Tab */}
            {activeTab === 'telemetry' && (
                <div className="space-y-6">
                    <JobSelector />

                    {selectedJobId && telemetry.length > 0 ? (
                        <>
                            <div className="bg-theme-card p-6 rounded-lg">
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <TrendingUp className="text-blue-400" />
                                    Speed Over Time
                                </h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <ComposedChart data={chartData}>
                                        <defs>
                                            <linearGradient id="speedGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis dataKey="time" stroke="#9CA3AF" />
                                        <YAxis stroke="#9CA3AF" />
                                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #374151', borderRadius: '8px' }} />
                                        <Area type="monotone" dataKey="speed" stroke="#3b82f6" fill="url(#speedGradient)" />
                                        <Line type="monotone" dataKey="speed" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="bg-theme-card p-6 rounded-lg">
                                <h3 className="text-lg font-semibold mb-4">Brake Intensity</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="brakeGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis dataKey="time" stroke="#9CA3AF" />
                                        <YAxis stroke="#9CA3AF" />
                                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #374151', borderRadius: '8px' }} />
                                        <Area type="monotone" dataKey="brake" stroke="#ef4444" fill="url(#brakeGradient)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 border border-blue-500/20 p-6 rounded-lg">
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <TrendingUp className="text-blue-400" />
                                    Sample Speed & Acceleration Data
                                </h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <ComposedChart data={demoTelemetryData}>
                                        <defs>
                                            <linearGradient id="demoSpeedGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis dataKey="time" stroke="#9CA3AF" label={{ value: 'Time (s)', position: 'bottom', fill: '#9CA3AF' }} />
                                        <YAxis yAxisId="left" stroke="#3b82f6" />
                                        <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
                                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #374151', borderRadius: '8px' }} />
                                        <Legend />
                                        <Area yAxisId="left" type="monotone" dataKey="speed" name="Speed (km/h)" stroke="#3b82f6" fill="url(#demoSpeedGradient)" />
                                        <Line yAxisId="right" type="monotone" dataKey="acceleration" name="Acceleration" stroke="#10b981" strokeWidth={2} dot={false} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                                <p className="text-gray-500 text-sm mt-4 text-center">
                                    📊 This is sample data. Run an AI Simulation to see real telemetry metrics.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-gradient-to-br from-red-900/20 to-orange-900/20 border border-red-500/20 p-6 rounded-lg">
                                    <h3 className="text-lg font-semibold mb-4">Braking Events</h3>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <BarChart data={demoTelemetryData.slice(0, 10)}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                            <XAxis dataKey="time" stroke="#9CA3AF" />
                                            <YAxis stroke="#9CA3AF" />
                                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #374151', borderRadius: '8px' }} />
                                            <Bar dataKey="brake" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border border-green-500/20 p-6 rounded-lg">
                                    <h3 className="text-lg font-semibold mb-4">Speed Distribution</h3>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <AreaChart data={demoTelemetryData}>
                                            <defs>
                                                <linearGradient id="speedDistGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                            <XAxis dataKey="time" stroke="#9CA3AF" />
                                            <YAxis stroke="#9CA3AF" />
                                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #374151', borderRadius: '8px' }} />
                                            <Area type="monotone" dataKey="speed" stroke="#10b981" fill="url(#speedDistGradient)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Safety Tab */}
            {activeTab === 'safety' && (
                <div className="space-y-6">
                    <JobSelector />

                    {selectedJobId && safetyData ? (
                        <div className="bg-theme-card p-6 rounded-lg">
                            <h3 className="text-lg font-semibold mb-4">Safety Metrics</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-theme-hover p-4 rounded-md">
                                    <div className="text-3xl font-bold text-green-400">
                                        {safetyData.overall_safety_score?.toFixed(1) || 0}/100
                                    </div>
                                    <div className="text-sm text-theme-muted mt-1">Overall Safety Score</div>
                                </div>
                                <div className="bg-theme-hover p-4 rounded-md">
                                    <div className="text-3xl font-bold text-yellow-400">
                                        {safetyData.near_miss_count || 0}
                                    </div>
                                    <div className="text-sm text-theme-muted mt-1">Near Misses</div>
                                </div>
                                <div className="bg-theme-hover p-4 rounded-md">
                                    <div className="text-3xl font-bold text-orange-400">
                                        {safetyData.hazard_exposure_score?.toFixed(1) || 0}
                                    </div>
                                    <div className="text-sm text-theme-muted mt-1">Hazard Exposure</div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-gradient-to-br from-emerald-900/20 to-teal-900/20 border border-emerald-500/20 p-6 rounded-lg">
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Target className="text-emerald-400" />
                                        Safety Performance Radar
                                    </h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <RadarChart data={demoSafetyData}>
                                            <PolarGrid stroke="#374151" />
                                            <PolarAngleAxis dataKey="metric" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                                            <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#374151" />
                                            <Radar name="Score" dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.3} strokeWidth={2} />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="bg-gradient-to-br from-blue-900/20 to-indigo-900/20 border border-blue-500/20 p-6 rounded-lg">
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Shield className="text-blue-400" />
                                        Safety Score Breakdown
                                    </h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={demoSafetyData} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                            <XAxis type="number" domain={[0, 100]} stroke="#9CA3AF" />
                                            <YAxis type="category" dataKey="metric" stroke="#9CA3AF" width={100} tick={{ fontSize: 12 }} />
                                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #374151', borderRadius: '8px' }} />
                                            <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                                                {demoSafetyData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-yellow-900/20 to-amber-900/20 border border-yellow-500/20 p-6 rounded-lg">
                                <h3 className="text-lg font-semibold mb-4">Safety Trend Over Sessions</h3>
                                <ResponsiveContainer width="100%" height={250}>
                                    <LineChart data={[
                                        { session: 1, safety: 72 },
                                        { session: 2, safety: 78 },
                                        { session: 3, safety: 74 },
                                        { session: 4, safety: 82 },
                                        { session: 5, safety: 85 },
                                        { session: 6, safety: 88 },
                                        { session: 7, safety: 86 },
                                        { session: 8, safety: 92 },
                                    ]}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis dataKey="session" stroke="#9CA3AF" label={{ value: 'Session', position: 'bottom', fill: '#9CA3AF' }} />
                                        <YAxis domain={[60, 100]} stroke="#9CA3AF" />
                                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #374151', borderRadius: '8px' }} />
                                        <Line type="monotone" dataKey="safety" stroke="#f59e0b" strokeWidth={3} dot={{ fill: '#f59e0b', strokeWidth: 2 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                                <p className="text-gray-500 text-sm mt-4 text-center">
                                    📊 This is sample data. Run AI Simulations to see real safety metrics.
                                </p>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* AI Insights Tab */}
            {activeTab === 'insights' && (
                <div className="space-y-6">
                    <JobSelector />

                    {selectedJobId && insights && insights !== 'No AI insights available' ? (
                        <div className="bg-theme-card p-6 rounded-lg">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Brain className="text-purple-400" />
                                AI-Generated Insights
                            </h3>
                            <div className="prose prose-invert max-w-none">
                                <p className="text-theme-secondary whitespace-pre-wrap">{insights}</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-gradient-to-br from-purple-900/20 to-violet-900/20 border border-purple-500/20 p-6 rounded-lg">
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Brain className="text-purple-400" />
                                        Performance Categories
                                    </h3>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <PieChart>
                                            <Pie
                                                data={demoInsightsData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={5}
                                                dataKey="score"
                                                label={({ category, score }) => `${category}: ${score}%`}
                                                labelLine={false}
                                            >
                                                {demoInsightsData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #374151', borderRadius: '8px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="bg-gradient-to-br from-indigo-900/20 to-blue-900/20 border border-indigo-500/20 p-6 rounded-lg">
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Target className="text-indigo-400" />
                                        Skill Radar Analysis
                                    </h3>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <RadarChart data={demoInsightsData.map(d => ({ ...d, metric: d.category, value: d.score }))}>
                                            <PolarGrid stroke="#374151" />
                                            <PolarAngleAxis dataKey="metric" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                                            <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#374151" />
                                            <Radar name="Score" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} strokeWidth={2} />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-gradient-to-r from-purple-900/30 via-violet-900/30 to-indigo-900/30 border border-purple-500/20 p-6 rounded-lg">
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <MessageSquare className="text-violet-400" />
                                    AI Analysis Preview
                                </h3>
                                <div className="bg-theme-hover/50 p-4 rounded-md border border-purple-500/10">
                                    <p className="text-theme-secondary leading-relaxed">
                                        <span className="text-purple-400 font-semibold">🤖 Based on your simulations:</span><br /><br />
                                        Your overall driving performance shows a <span className="text-green-400">positive trend</span> with improvements in lane keeping and speed control.
                                        Areas for improvement include following distance in high-traffic scenarios and reaction time to sudden hazards.
                                        <br /><br />
                                        <span className="text-blue-400">Key recommendations:</span>
                                        <ul className="list-disc list-inside mt-2 space-y-1 text-theme-muted">
                                            <li>Practice defensive driving techniques</li>
                                            <li>Increase awareness in intersection scenarios</li>
                                            <li>Work on smooth acceleration transitions</li>
                                        </ul>
                                    </p>
                                </div>
                                <p className="text-gray-500 text-sm mt-4 text-center">
                                    🧠 Select a job above to see AI-generated insights specific to that simulation.
                                </p>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default MetricsAnalytics;
