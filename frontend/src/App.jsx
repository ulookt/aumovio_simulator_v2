import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import Layout from '@/components/layout/Layout';
import ScenarioBuilder from '@/pages/ScenarioBuilder';
import SceneSimulation from '@/pages/SceneSimulation';
import JobsDashboard from '@/pages/JobsDashboard';
import MetricsAnalytics from '@/pages/MetricsAnalytics';
import ChatWidget from '@/components/assistant/ChatWidget';

import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';

function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <Router>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />

                        <Route element={<ProtectedRoute />}>
                            <Route element={<Layout />}>
                                <Route path="/" element={<Navigate to="/scenario-builder" replace />} />
                                <Route path="/scenario-builder" element={<ScenarioBuilder />} />
                                <Route path="/simulation" element={<SceneSimulation />} />
                                <Route path="/jobs" element={<JobsDashboard />} />
                                <Route path="/metrics" element={<MetricsAnalytics />} />
                            </Route>
                        </Route>
                    </Routes>
                    <ChatWidget />
                </Router>
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App;
