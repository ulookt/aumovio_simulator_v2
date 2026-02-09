import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const ProtectedRoute = () => {
    const { user, loading } = useAuth();
    console.log("ProtectedRoute: State", { user: !!user, loading });

    if (loading) {
        // You could return a loading spinner here
        return <div className="min-h-screen bg-theme-primary flex items-center justify-center text-theme-secondary">Loading...</div>;
    }

    if (!user) {
        console.log("ProtectedRoute: No user, redirecting...");
        return <Navigate to="/login" replace />;
    }

    console.log("ProtectedRoute: Access granted");

    return <Outlet />;
};

export default ProtectedRoute;
