import React from 'react';

function MetricCard({ icon, number, label, color = 'green', subtitle }) {
    const colorMap = {
        green: 'border-grab-green text-grab-green',
        orange: 'border-grab-orange text-grab-orange',
        blue: 'border-blue-500 text-blue-500',
        red: 'border-red-500 text-red-500',
        purple: 'border-purple-500 text-purple-500',
    };

    return (
        <div className={`bg-white rounded-xl p-5 shadow-sm border-t-4 ${colorMap[color]} 
                         hover:shadow-md transition-shadow fade-in`}>
            <div className="text-2xl mb-2">{icon}</div>
            <div className={`text-3xl font-bold ${colorMap[color].split(' ')[1]}`}>
                {number}
            </div>
            <div className="text-sm text-gray-500 mt-1">{label}</div>
            {subtitle && (
                <div className="text-xs text-gray-400 mt-1">{subtitle}</div>
            )}
        </div>
    );
}

export default MetricCard;