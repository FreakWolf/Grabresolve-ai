import React from 'react';

function StatusBadge({ status }) {
    const config = {
        open: { bg: 'bg-blue-100', text: 'text-blue-700', label: '🔵 Open' },
        investigating: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '🔍 Investigating' },
        auto_resolved: { bg: 'bg-green-100', text: 'text-green-700', label: '✅ Auto-Resolved' },
        human_review: { bg: 'bg-orange-100', text: 'text-orange-700', label: '🟡 Human Review' },
        escalated: { bg: 'bg-red-100', text: 'text-red-700', label: '🔴 Escalated' },
        resolved: { bg: 'bg-green-100', text: 'text-green-700', label: '✅ Resolved' },
        error: { bg: 'bg-gray-100', text: 'text-gray-700', label: '⚠️ Error' },
    };

    const c = config[status] || config.open;

    return (
        <span className={`${c.bg} ${c.text} px-3 py-1 rounded-full text-xs font-semibold`}>
            {c.label}
        </span>
    );
}

export default StatusBadge;