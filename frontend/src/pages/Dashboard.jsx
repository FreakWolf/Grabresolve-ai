import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import MetricCard from '../components/MetricCard';
import StatusBadge from '../components/StatusBadge';

const REFRESH_INTERVAL_MS = 4000;

function Dashboard() {
    const [stats, setStats] = useState(null);
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [seeding, setSeeding] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    useEffect(() => {
        fetchData({ showLoader: true });

        const intervalId = window.setInterval(() => {
            fetchData({ silent: true });
        }, REFRESH_INTERVAL_MS);

        return () => window.clearInterval(intervalId);
    }, []);

    const fetchData = async ({ showLoader = false, silent = false } = {}) => {
        if (showLoader) setLoading(true);
        if (silent) setRefreshing(true);

        try {
            const [ticketRes, overviewRes] = await Promise.all([
                api.getTickets(),
                api.getOverview().catch(() => ({ data: {} }))
            ]);

            setTickets(ticketRes.data);
            setStats(overviewRes.data);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Dashboard error:', err);
        } finally {
            if (showLoader) setLoading(false);
            if (silent) setRefreshing(false);
        }
    };

    const handleSeed = async () => {
        setSeeding(true);
        try {
            await api.seed();
            await fetchData({ showLoader: true });
        } catch (err) {
            alert('Failed to seed. Is the AI Engine running on port 8000?');
        } finally {
            setSeeding(false);
        }
    };

    const handleInvestigateAll = async () => {
        if (!window.confirm('Investigate ALL open tickets with AI? This may take a minute.')) return;
        setLoading(true);
        try {
            await api.investigateAll();
            await fetchData({ showLoader: true });
        } catch (err) {
            alert(`Batch investigation failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <div className="text-4xl spin-slow inline-block">🟢</div>
                    <p className="mt-4 text-gray-500">Loading GrabResolve AI...</p>
                </div>
            </div>
        );
    }

    const totalTickets = tickets.length;
    const autoResolved = tickets.filter(ticket => ticket.status === 'auto_resolved').length;
    const humanReview = tickets.filter(ticket => ticket.status === 'human_review').length;
    const escalated = tickets.filter(ticket => ticket.status === 'escalated').length;
    const openTickets = tickets.filter(ticket => ticket.status === 'open').length;
    const autoRate = totalTickets > 0 ? ((autoResolved / totalTickets) * 100).toFixed(1) : '0.0';
    const overview = stats?.ai_analytics?.overview;

    return (
        <div className="p-6">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">
                        📊 GrabResolve AI Dashboard
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Autonomous Investigation & Resolution System
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                        {refreshing ? 'Refreshing live metrics...' : 'Live metrics update every 4 seconds'}
                        {lastUpdated ? ` • Last updated ${lastUpdated.toLocaleTimeString()}` : ''}
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleSeed}
                        disabled={seeding}
                        className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition disabled:opacity-50"
                    >
                        {seeding ? '📦 Seeding...' : '📦 Load Sample Tickets'}
                    </button>
                    {openTickets > 0 && (
                        <button
                            onClick={handleInvestigateAll}
                            className="bg-grab-green text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-600 transition pulse-green"
                        >
                            🤖 Investigate All ({openTickets})
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-5 gap-4 mb-8">
                <MetricCard icon="🎫" number={totalTickets} label="Total Tickets" color="blue" />
                <MetricCard
                    icon="✅"
                    number={autoResolved}
                    label="Auto-Resolved"
                    color="green"
                    subtitle={`${autoRate}% auto-rate`}
                />
                <MetricCard icon="🟡" number={humanReview} label="Human Review" color="orange" />
                <MetricCard icon="🔴" number={escalated} label="Escalated" color="red" />
                <MetricCard icon="🔵" number={openTickets} label="Open / Pending" color="blue" />
            </div>

            {overview && (
                <div className="bg-gradient-to-r from-grab-dark to-gray-800 text-white rounded-xl p-5 mb-8">
                    <h3 className="text-sm font-bold text-grab-green mb-3">
                        📊 Live Performance Metrics
                    </h3>
                    <div className="grid grid-cols-4 gap-6">
                        <div>
                            <div className="text-2xl font-bold text-grab-orange">
                                {overview.auto_resolve_rate}%
                            </div>
                            <div className="text-xs text-gray-400">Auto-Resolve Rate</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-grab-orange">
                                {overview.avg_resolution_time_sec}s
                            </div>
                            <div className="text-xs text-gray-400">Avg Resolution Time</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-grab-orange">
                                {overview.sla_compliance_rate}%
                            </div>
                            <div className="text-xs text-gray-400">SLA Compliance</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-grab-orange">
                                {overview.processed_tickets ?? 0}
                            </div>
                            <div className="text-xs text-gray-400">Processed Tickets</div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm">
                <div className="p-5 border-b flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-800">🎫 Recent Tickets</h2>
                    <Link
                        to="/tickets"
                        className="text-sm text-grab-green font-medium hover:underline"
                    >
                        View All →
                    </Link>
                </div>

                {tickets.length === 0 ? (
                    <div className="p-10 text-center text-gray-400">
                        <div className="text-4xl mb-3">📭</div>
                        <p>No tickets yet. Click "Load Sample Tickets" to get started.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase">ID</th>
                                    <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase">Subject</th>
                                    <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase">Category</th>
                                    <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase">Country</th>
                                    <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                                    <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase">Confidence</th>
                                    <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tickets.slice(0, 10).map(ticket => (
                                    <tr key={ticket.ticket_id} className="border-t hover:bg-gray-50 transition">
                                        <td className="p-4 text-sm font-mono font-semibold text-grab-green">
                                            {ticket.ticket_id}
                                        </td>
                                        <td className="p-4 text-sm text-gray-700 max-w-xs truncate">
                                            {ticket.subject}
                                        </td>
                                        <td className="p-4 text-xs text-gray-500">
                                            {ticket.category || '—'}
                                        </td>
                                        <td className="p-4 text-xs text-gray-500">
                                            {ticket.country || '—'}
                                        </td>
                                        <td className="p-4">
                                            {(() => {
                                                let displayStatus = ticket.status;
                                                const resolutionAction = ticket.resolution?.action_type;

                                                if (resolutionAction === 'escalate') {
                                                    displayStatus = 'human_review';
                                                } else if (
                                                    resolutionAction === 'refund' ||
                                                    resolutionAction === 'partial_refund' ||
                                                    resolutionAction === 'credit' ||
                                                    resolutionAction === 'resolved'
                                                ) {
                                                    displayStatus = 'resolved';
                                                }
                                                return <StatusBadge status={displayStatus} />;
                                            })()}
                                        </td>
                                        <td className="p-4 text-sm font-semibold">
                                            {ticket.confidence_score
                                                ? `${(ticket.confidence_score * 100).toFixed(0)}%`
                                                : '—'}
                                        </td>
                                        <td className="p-4">
                                            <Link
                                                to={`/tickets/${ticket.ticket_id}`}
                                                className="text-grab-green text-sm font-medium hover:underline"
                                            >
                                                View →
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Dashboard;
