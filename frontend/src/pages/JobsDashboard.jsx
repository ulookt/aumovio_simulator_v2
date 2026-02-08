import React, { useState, useEffect } from 'react';
import { jobsAPI } from '@/services/api';
import { Trash2, Download } from 'lucide-react';

const JobsDashboard = () => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());

    const jobIdStr = (job) => (typeof job.id === 'string' ? job.id : job.id?.toString?.() ?? String(job.id));

    const handleDelete = async (job) => {
        const id = jobIdStr(job);
        if (!window.confirm('Delete this job? This cannot be undone.')) return;
        try {
            setDeletingId(id);
            await jobsAPI.delete(id);
            setJobs((prev) => prev.filter((j) => jobIdStr(j) !== id));
            setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        } catch (error) {
            console.error('Failed to delete job:', error);
            alert('Failed to delete job');
        } finally {
            setDeletingId(null);
        }
    };

    const toggleSelect = (id) => {
        const s = String(id);
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(s)) next.delete(s);
            else next.add(s);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === jobs.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(jobs.map((j) => jobIdStr(j))));
        }
    };

    const handleBulkDownload = () => {
        if (selectedIds.size === 0) {
            alert('Select at least one job to download.');
            return;
        }
        const selected = jobs.filter((j) => selectedIds.has(jobIdStr(j)));
        const blob = new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jobs-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) {
            alert('Select at least one job to delete.');
            return;
        }
        if (!window.confirm(`Delete ${selectedIds.size} selected job(s)? This cannot be undone.`)) return;
        const ids = Array.from(selectedIds);
        for (const id of ids) {
            try {
                await jobsAPI.delete(id);
                setJobs((prev) => prev.filter((j) => jobIdStr(j) !== id));
            } catch (err) {
                console.error('Failed to delete job', id, err);
                alert(`Failed to delete one or more jobs.`);
                break;
            }
        }
        setSelectedIds(new Set());
    };

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
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                <h1 className="text-3xl font-bold">Jobs Dashboard</h1>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={handleBulkDownload}
                        disabled={selectedIds.size === 0}
                        className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-md"
                        title="Download selected jobs as JSON"
                    >
                        <Download size={18} />
                        Download selected ({selectedIds.size})
                    </button>
                    <button
                        onClick={handleBulkDelete}
                        disabled={selectedIds.size === 0}
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-md"
                        title="Delete selected jobs"
                    >
                        <Trash2 size={18} />
                        Delete selected
                    </button>
                    <button
                        onClick={loadJobs}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            <div className="bg-dark-card rounded-lg overflow-hidden">
                <table className="w-full">
                    <thead className="bg-dark-bg">
                        <tr>
                            <th className="px-4 py-3 text-left">
                                <input
                                    type="checkbox"
                                    checked={jobs.length > 0 && selectedIds.size === jobs.length}
                                    onChange={toggleSelectAll}
                                    className="rounded border-gray-500"
                                />
                            </th>
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
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {jobs.length === 0 ? (
                            <tr>
                                <td colSpan="10" className="px-6 py-8 text-center text-gray-400">
                                    No jobs found. Create a simulation to get started!
                                </td>
                            </tr>
                        ) : (
                            jobs.map((job) => {
                                const id = jobIdStr(job);
                                return (
                                <tr key={id} className="hover:bg-dark-hover">
                                    <td className="px-4 py-4">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(id)}
                                            onChange={() => toggleSelect(id)}
                                            className="rounded border-gray-500"
                                        />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                                        {id.substring(0, 8)}...
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
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <button
                                            onClick={() => handleDelete(job)}
                                            disabled={deletingId === id}
                                            className="p-2 text-red-400 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50"
                                            title="Delete job"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                                );
                            })
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
