import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Lock, Mail, AlertCircle, UserPlus } from 'lucide-react';

const Register = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            return setError('Password must be at least 6 characters long.');
        }

        setLoading(true);
        try {
            await register(email, password);
            navigate('/');
        } catch (err) {
            if (err.response?.status === 400) {
                setError('Email is already registered. Please login.');
            } else {
                setError('Failed to create an account. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-theme-primary px-4">
            <div className="max-w-md w-full bg-theme-card p-8 rounded-lg shadow-lg border border-theme">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-theme-primary">Create Account</h2>
                    <p className="text-theme-secondary mt-2">Join Aumovio Simulator today</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-md mb-6 flex items-center gap-2">
                        <AlertCircle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-theme-secondary mb-1">Email</label>
                        <div className="relative">
                            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-theme-hover border border-theme rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-theme-primary"
                                placeholder="you@example.com"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-theme-secondary mb-1">Password</label>
                        <div className="relative">
                            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-theme-hover border border-theme rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-theme-primary"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? 'Creating Account...' : (
                            <>
                                <UserPlus size={18} />
                                Create Account
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-theme-secondary">
                    Already have an account?{' '}
                    <Link to="/login" className="text-blue-500 hover:text-blue-400 font-medium">
                        Log In
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Register;
