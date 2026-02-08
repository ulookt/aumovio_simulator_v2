import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import Layout from '@/components/layout/Layout';
import ScenarioBuilder from '@/pages/ScenarioBuilder';
import SceneSimulation from '@/pages/SceneSimulation';
import JobsDashboard from '@/pages/JobsDashboard';
import MetricsAnalytics from '@/pages/MetricsAnalytics';
import ChatWidget from '@/components/assistant/ChatWidget';

function App() {
    return (
        <ThemeProvider>
            <Router>
                <Routes>
                    <Route path="/" element={<Layout />}>
                        <Route index element={<Navigate to="/scenario-builder" replace />} />
                        <Route path="scenario-builder" element={<ScenarioBuilder />} />
                        <Route path="simulation" element={<SceneSimulation />} />
                        <Route path="jobs" element={<JobsDashboard />} />
                        <Route path="metrics" element={<MetricsAnalytics />} />
                    </Route>
                </Routes>
                <ChatWidget />
            </Router>
        </ThemeProvider>
    );
}

export default App;
