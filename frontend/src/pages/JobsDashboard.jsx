import React, { useState, useEffect } from 'react';
import { jobsAPI } from '@/services/api';

const JobsDashboard = () => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadJobs();
        const interval = setInterval(loadJobs, 3000); // Auto-refresh every 3 seconds
        return () => clearInterval(interval);
    }, []);

    const loadJobs = async () => {
        try {
            setLoading(true);
            const response = await jobsAPI.list();
            setJobs(response.data);
        } catch (error) {
            console.error('Failed to load jobs:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            pending: 'bg-yellow-500',
            running: 'bg-blue-500',
            completed: 'bg-green-500',
            failed: 'bg-red-500'
        };
        return colors[status] || 'bg-gray-500';
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Jobs Dashboard</h1>
                <button
                    onClick={loadJobs}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md"
                >
                    Refresh
                </button>
            </div>

            <div className="bg-dark-card rounded-lg overflow-hidden">
                <table className="w-full">
                    <thead className="bg-dark-bg">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Job ID
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Type
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Duration
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Vehicles
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Weather
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Cost
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Created
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {jobs.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="px-6 py-8 text-center text-gray-400">
                                    No jobs found. Create a simulation to get started!
                                </td>
                            </tr>
                        ) : (
                            jobs.map((job) => (
                                <tr key={job.id} className="hover:bg-dark-hover">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                                        {job.id.substring(0, 8)}...
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`capitalize ${job.simulation_type === 'ai_simulation' ? 'text-blue-400' : 'text-green-400'}`}>
                                            {job.simulation_type.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(job.status)} bg-opacity-20 text-white`}>
                                            {job.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        {job.duration_seconds}s
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        {job.vehicle_count}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm capitalize">
                                        {job.weather || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        ${job.compute_cost_estimate.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                        {new Date(job.created_at).toLocaleString()}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {loading && (
                <div className="mt-4 text-center text-gray-400 text-sm">
                    Refreshing...
                </div>
            )}
        </div>
    );
};

export default JobsDashboard;
