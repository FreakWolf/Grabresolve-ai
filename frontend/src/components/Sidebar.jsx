import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
    { path: '/', icon: '📊', label: 'Dashboard' },
    { path: '/tickets', icon: '🎫', label: 'Ticket Queue' },
    { path: '/analytics', icon: '📈', label: 'Analytics' },
    { path: '/demo', icon: '🚀', label: 'Live Demo' },
];

function Sidebar() {
    const location = useLocation();

    return (
        <div className="w-64 bg-grab-dark text-white flex flex-col flex-shrink-0">
            {/* Logo */}
            <div className="p-5 border-b border-gray-700">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-grab-green rounded-full pulse-green"></div>
                    <h1 className="text-lg font-bold text-grab-green">
                        GrabResolve AI
                    </h1>
                </div>
                <p className="text-xs text-gray-400 mt-1 ml-5">
                    Autonomous Investigation Agent
                </p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3">
                {navItems.map(item => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 
                                transition-all duration-200 ${
                                isActive
                                    ? 'bg-grab-green text-white shadow-lg'
                                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                            }`}
                        >
                            <span className="text-lg">{item.icon}</span>
                            <span className="text-sm font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Status */}
            <div className="p-4 border-t border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-grab-green rounded-full"></div>
                    <span className="text-xs text-gray-400">AI Engine Online</span>
                </div>
                <div className="text-xs text-gray-500">
                    Powered by Gemini AI + LangChain
                </div>
                <div className="text-xs text-gray-600 mt-1">
                    Built by Rohit Singh
                </div>
            </div>
        </div>
    );
}

export default Sidebar;