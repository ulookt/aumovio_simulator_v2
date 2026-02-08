import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MapPin, LayoutDashboard, Cpu, BarChart3, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import logo from '@/assets/logo.png';

const Sidebar = () => {
    const location = useLocation();
    const { isDarkMode, toggleTheme } = useTheme();

    const navItems = [
        { path: '/scenario-builder', label: 'Scenario Builder', icon: MapPin },
        { path: '/simulation', label: 'Scene Simulation', icon: LayoutDashboard },
        { path: '/metrics', label: 'Metrics & Analytics', icon: BarChart3 },
        { path: '/jobs', label: 'Jobs Dashboard', icon: Cpu },
    ];

    return (
        <div className="w-64 bg-theme-card h-screen fixed left-0 top-0 border-r border-theme transition-colors duration-300">
            <div className="p-6">
                <div className="flex items-center gap-3 mb-1">
                    <img src={logo} alt="Aumovio Logo" className="w-10 h-10 object-contain" />
                    <h1 className="text-xl font-bold text-blue-500 dark:text-blue-400">Aumovio Simulator</h1>
                </div>
                <p className="text-sm text-theme-muted ml-13">v2.0.0</p>
            </div>

            <nav className="mt-6">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-6 py-3 text-theme-secondary hover:bg-theme-hover transition-colors ${isActive ? 'bg-theme-hover text-blue-500 dark:text-white border-l-4 border-blue-500' : ''
                                }`}
                        >
                            <Icon className="w-5 h-5 flex-shrink-0" />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Theme Toggle */}
            <div className="absolute bottom-16 w-full px-6">
                <button
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-theme-hover rounded-lg text-theme-secondary hover:text-theme-primary transition-colors"
                >
                    {isDarkMode ? (
                        <>
                            <Sun size={18} />
                            <span>Light Mode</span>
                        </>
                    ) : (
                        <>
                            <Moon size={18} />
                            <span>Dark Mode</span>
                        </>
                    )}
                </button>
            </div>

            <div className="absolute bottom-0 w-full p-6 border-t border-theme">
                <p className="text-xs text-theme-muted">© 2026 Aumovio Simulator</p>
            </div>
        </div>
    );
};

export default Sidebar;
