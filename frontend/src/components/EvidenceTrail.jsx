import React from 'react';

function EvidenceTrail({ evidence }) {
    if (!evidence || evidence.length === 0) return null;

    const getIcon = (text) => {
        if (text.includes('[CLASSIFY]')) return '🧠';
        if (text.includes('[FINDING]')) return '🔍';
        if (text.includes('[INVESTIGATE]')) return '📋';
        if (text.includes('[ROOT CAUSE]')) return '🎯';
        if (text.includes('[RESOLUTION]')) return '⚡';
        if (text.includes('[SLA]')) return '📊';
        return '📌';
    };

    const getColor = (text) => {
        if (text.includes('AUTO-RESOLVED')) return 'border-green-400 bg-green-50';
        if (text.includes('HUMAN REVIEW')) return 'border-yellow-400 bg-yellow-50';
        if (text.includes('ESCALATED')) return 'border-red-400 bg-red-50';
        if (text.includes('[FINDING]')) return 'border-blue-400 bg-blue-50';
        return 'border-gray-300 bg-gray-50';
    };

    return (
        <div className="space-y-2">
            <h3 className="text-sm font-bold text-gray-700 mb-3">
                📋 Evidence Trail ({evidence.length} entries)
            </h3>
            {evidence.map((item, i) => (
                <div
                    key={i}
                    className={`flex items-start gap-3 p-3 rounded-lg border-l-4 
                               ${getColor(item)} fade-in`}
                    style={{ animationDelay: `${i * 0.1}s` }}
                >
                    <span className="text-lg flex-shrink-0">{getIcon(item)}</span>
                    <span className="text-xs text-gray-700 font-mono leading-relaxed">
                        {item}
                    </span>
                </div>
            ))}
        </div>
    );
}

export default EvidenceTrail;