import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
    const location = useLocation();

    const navItems = [
        { path: '/scenario-builder', label: 'Scenario Builder', icon: '🗺️' },
        { path: '/simulation', label: 'Scene Simulation', icon: '🚗' },
        { path: '/jobs', label: 'Jobs Dashboard', icon: '📊' },
        { path: '/metrics', label: 'Metrics & Analytics', icon: '📈' },
    ];

    return (
        <div className="w-64 bg-dark-card h-screen fixed left-0 top-0 border-r border-gray-700">
            <div className="p-6">
                <h1 className="text-2xl font-bold text-blue-400">Aumovio Simulator</h1>
                <p className="text-sm text-gray-400 mt-1">v2.0.0</p>
            </div>

            <nav className="mt-6">
                {navItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center px-6 py-3 text-gray-300 hover:bg-dark-hover hover:text-white transition-colors ${location.pathname === item.path ? 'bg-dark-hover text-white border-l-4 border-blue-500' : ''
                            }`}
                    >
                        <span className="text-2xl mr-3">{item.icon}</span>
                        <span>{item.label}</span>
                    </Link>
                ))}
            </nav>

            <div className="absolute bottom-0 w-full p-6 border-t border-gray-700">
                <p className="text-xs text-gray-500">© 2026 Aumovio Simulator</p>
            </div>
        </div>
    );
};

export default Sidebar;
