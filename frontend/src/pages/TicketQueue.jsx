import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

function TicketQueue() {
    const [tickets, setTickets] = useState([]);
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [investigating, setInvestigating] = useState(null);

    useEffect(() => {
        fetchTickets();
    }, []);

    const fetchTickets = async () => {
        try {
            const res = await api.getTickets();
            setTickets(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleInvestigate = async (ticketId) => {
        setInvestigating(ticketId);
        try {
            await api.investigate(ticketId);
            await fetchTickets();
        } catch (err) {
            alert(`Investigation failed: ${err.message}`);
        } finally {
            setInvestigating(null);
        }
    };

    const filtered = filter === 'all'
        ? tickets
        : tickets.filter(t => t.status === filter);

    const statusCounts = {
        all: tickets.length,
        open: tickets.filter(t => t.status === 'open').length,
        auto_resolved: tickets.filter(t => t.status === 'auto_resolved').length,
        human_review: tickets.filter(t => t.status === 'human_review').length,
        escalated: tickets.filter(t => t.status === 'escalated').length,
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-xl text-gray-500">Loading tickets...</div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
                🎫 Ticket Queue
            </h1>
            <p className="text-gray-500 mb-6">
                All support tickets — click to investigate or view details
            </p>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6">
                {Object.entries(statusCounts).map(([key, count]) => (
                    <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                            filter === key
                                ? 'bg-grab-green text-white'
                                : 'bg-white text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        {key === 'all' ? '📋 All' :
                         key === 'open' ? '🔵 Open' :
                         key === 'auto_resolved' ? '✅ Auto-Resolved' :
                         key === 'human_review' ? '🟡 Review' :
                         '🔴 Escalated'}
                        <span className="ml-2 bg-white bg-opacity-30 px-2 py-0.5 rounded-full text-xs">
                            {count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Tickets List */}
            <div className="space-y-3">
                {filtered.length === 0 ? (
                    <div className="bg-white rounded-xl p-10 text-center text-gray-400">
                        <div className="text-4xl mb-3">📭</div>
                        <p>No tickets in this category</p>
                    </div>
                ) : (
                    filtered.map(ticket => (
                        <div
                            key={ticket.ticket_id}
                            className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md 
                                       transition-all border-l-4 fade-in"
                            style={{
                                borderLeftColor:
                                    ticket.status === 'auto_resolved' ? '#00B14F' :
                                    ticket.status === 'human_review' ? '#FF6B35' :
                                    ticket.status === 'escalated' ? '#EF4444' :
                                    '#3B82F6'
                            }}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="font-mono font-bold text-grab-green text-sm">
                                            {ticket.ticket_id}
                                        </span>
                                        <StatusBadge status={ticket.status} />
                                        {ticket.confidence_score && (
                                            <span className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600">
                                                Confidence: {(ticket.confidence_score * 100).toFixed(0)}%
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="font-semibold text-gray-800 mb-1">
                                        {ticket.subject}
                                    </h3>
                                    <p className="text-sm text-gray-500 line-clamp-2">
                                        {ticket.description}
                                    </p>
                                    <div className="flex gap-4 mt-2 text-xs text-gray-400">
                                        <span>📍 {ticket.country || 'N/A'}</span>
                                        <span>📂 {ticket.category || 'Unclassified'}</span>
                                        <span>📱 {ticket.channel || 'app'}</span>
                                        {ticket.processing_time && (
                                            <span>⏱️ {ticket.processing_time}s</span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-2 ml-4">
                                    {ticket.status === 'open' && (
                                        <button
                                            onClick={() => handleInvestigate(ticket.ticket_id)}
                                            disabled={investigating === ticket.ticket_id}
                                            className="bg-grab-green text-white px-4 py-2 rounded-lg 
                                                       text-sm font-medium hover:bg-green-600 
                                                       transition disabled:opacity-50"
                                        >
                                            {investigating === ticket.ticket_id
                                                ? '🔍 Investigating...'
                                                : '🤖 Investigate'
                                            }
                                        </button>
                                    )}
                                    <Link
                                        to={`/tickets/${ticket.ticket_id}`}
                                        className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg 
                                                   text-sm font-medium hover:bg-gray-200 transition"
                                    >
                                        View Details →
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default TicketQueue;