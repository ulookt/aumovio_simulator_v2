import React, { useState } from 'react';
import { assistantAPI } from '@/services/api';

const ChatWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    const sendMessage = async () => {
        if (!input.trim()) return;

        const userMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            const response = await assistantAPI.chat({
                message: input,
                context_type: 'general'
            });

            const assistantMessage = { role: 'assistant', content: response.data.reply };
            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Failed to send message:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.'
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50">
            {!isOpen ? (
                <button
                    onClick={() => setIsOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all hover:scale-110"
                    title="AI Assistant"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                </button>
            ) : (
                <div className="bg-dark-card rounded-lg shadow-2xl" style={{ width: '380px', height: '550px' }}>
                    {/* Header */}
                    <div className="bg-blue-600 p-4 rounded-t-lg flex justify-between items-center">
                        <h3 className="font-semibold">AI Assistant</h3>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-white hover:text-gray-200"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="h-96 overflow-y-auto p-4 space-y-4">
                        {messages.length === 0 ? (
                            <div className="text-center text-gray-400 mt-8">
                                <p>👋 Hi! I'm your automotive AI assistant.</p>
                                <p className="text-sm mt-2">Ask me anything about vehicle mechanics, driving techniques, or simulation results!</p>
                            </div>
                        ) : (
                            messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-xs px-4 py-2 rounded-lg ${msg.role === 'user'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-dark-bg text-gray-200'
                                        }`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))
                        )}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-dark-bg px-4 py-2 rounded-lg text-gray-400">
                                    Typing...
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t border-gray-700">
                        <div className="flex space-x-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Ask a question..."
                                className="flex-1 px-3 py-2 bg-dark-bg border border-gray-600 rounded-md text-white focus:outline-none focus:border-blue-500 text-sm"
                            />
                            <button
                                onClick={sendMessage}
                                disabled={loading || !input.trim()}
                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatWidget;
