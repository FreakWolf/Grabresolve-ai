import React from 'react';

function ConfidenceMeter({ score }) {
    const percentage = Math.round(score * 100);

    let color = 'bg-red-500';
    let label = 'Low';
    if (percentage >= 85) { color = 'bg-green-500'; label = 'High'; }
    else if (percentage >= 50) { color = 'bg-yellow-500'; label = 'Medium'; }

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-semibold text-gray-600">
                    Confidence Score
                </span>
                <span className={`text-lg font-bold ${
                    percentage >= 85 ? 'text-green-600' :
                    percentage >= 50 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                    {percentage}% ({label})
                </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                    className={`${color} h-3 rounded-full transition-all duration-1000 ease-out`}
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
        </div>
    );
}

export default ConfidenceMeter;