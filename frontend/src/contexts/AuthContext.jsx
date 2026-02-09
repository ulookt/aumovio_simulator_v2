import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '@/services/api';

const AuthContext = createContext();

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    // Verify token and get user info
                    const response = await api.get('/api/auth/me');
                    console.log("AuthContext: User verified", response.data);
                    setUser(response.data);
                } catch (error) {
                    console.error("Session expired or invalid token", error);
                    localStorage.removeItem('token');
                }
            } else {
                console.log("AuthContext: No token found");
            }
            setLoading(false);
        };
        checkAuth();
    }, []);

    const login = async (email, password) => {
        // FastAPI expects form-data for OAuth2 password flow
        const formData = new FormData();
        formData.append('username', email);
        formData.append('password', password);

        const response = await api.post('/api/auth/login', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        const { access_token } = response.data;
        localStorage.setItem('token', access_token);

        // Fetch user details immediately after login
        const userResponse = await api.get('/api/auth/me');
        setUser(userResponse.data);
        return true;
    };

    const register = async (email, password) => {
        await api.post('/api/auth/register', { email, password });
        // Automatically login after register
        return login(email, password);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
    };

    const value = {
        user,
        login,
        register,
        logout,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
