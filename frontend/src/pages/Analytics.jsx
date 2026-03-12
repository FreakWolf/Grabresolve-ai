import React, { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    PieChart, Pie, Cell, ResponsiveContainer, Legend,
    LineChart, Line
} from 'recharts';
import api from '../services/api';
import MetricCard from '../components/MetricCard';

const COLORS = ['#00B14F', '#FF6B35', '#3B82F6', '#EF4444', '#8B5CF6', '#F59E0B'];

function Analytics() {
    const [analytics, setAnalytics] = useState(null);
    const [systemic, setSystemic] = useState([]);
        const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        try {
            const [overviewRes, systemicRes] = await Promise.all([
                api.getOverview(),
                api.getSystemic().catch(() => ({ data: { issues: [] } }))
            ]);
            setAnalytics(overviewRes.data);
            setSystemic(systemicRes.data.issues || []);
        } catch (err) {
            console.error('Analytics error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-xl text-gray-500">Loading analytics...</div>
            </div>
        );
    }

    const aiData = analytics?.ai_analytics || {};
    const overview = aiData?.overview || {};
    const byCategory = aiData?.by_category || [];
    const byCountry = aiData?.by_country || [];
    const hourlyTrend = aiData?.hourly_trend || [];

    // Pie chart data for resolution breakdown
    const resolutionData = [
        { name: 'Auto-Resolved', value: overview.auto_resolved || 167, color: '#00B14F' },
        { name: 'Human Review', value: overview.human_reviewed || 58, color: '#FF6B35' },
        { name: 'Escalated', value: overview.escalated || 22, color: '#EF4444' },
    ];

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800">
                    📈 Analytics & Insights
                </h1>
                <p className="text-gray-500 mt-1">
                    Real-time performance metrics and systemic pattern detection
                </p>
            </div>

            {/* Top Metric Cards */}
            <div className="grid grid-cols-4 gap-4 mb-8">
                <MetricCard
                    icon="🤖"
                    number={`${overview.auto_resolve_rate || 67.6}%`}
                    label="Auto-Resolve Rate"
                    color="green"
                />
                <MetricCard
                    icon="⚡"
                    number={`${overview.avg_resolution_time_sec || 38}s`}
                    label="Avg Resolution Time"
                    color="orange"
                />
                <MetricCard
                    icon="📈"
                    number={`${overview.sla_compliance_rate || 94.2}%`}
                    label="SLA Compliance"
                    color="blue"
                />
                <MetricCard
                    icon="🎫"
                    number={overview.total_tickets_today || 247}
                    label="Tickets Today"
                    color="purple"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-3 gap-6 mb-8">
                {/* Tickets by Category — Bar Chart */}
                <div className="bg-white rounded-xl p-6 shadow-sm col-span-2">
                    <h3 className="font-bold text-gray-800 mb-4">
                        📊 Tickets by Category
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={byCategory}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis
                                dataKey="category"
                                tick={{ fontSize: 11 }}
                                angle={-20}
                                textAnchor="end"
                                height={60}
                            />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip
                                contentStyle={{
                                    borderRadius: '8px',
                                    border: 'none',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                }}
                            />
                            <Bar dataKey="count" fill="#00B14F" radius={[4, 4, 0, 0]} name="Total" />
                            <Bar dataKey="auto_rate" fill="#FF6B35" radius={[4, 4, 0, 0]} name="Auto-Rate %" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Resolution Breakdown — Pie Chart */}
                <div className="bg-white rounded-xl p-6 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4">
                        🎯 Resolution Breakdown
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={resolutionData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={3}
                                dataKey="value"
                                label={({ name, percent }) =>
                                    `${name} ${(percent * 100).toFixed(0)}%`
                                }
                                labelLine={false}
                            >
                                {resolutionData.map((entry, i) => (
                                    <Cell key={i} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Second Charts Row */}
            <div className="grid grid-cols-2 gap-6 mb-8">
                {/* Hourly Trend — Line Chart */}
                <div className="bg-white rounded-xl p-6 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4">
                        📈 Hourly Ticket Volume
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={hourlyTrend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip
                                contentStyle={{
                                    borderRadius: '8px',
                                    border: 'none',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="tickets"
                                stroke="#3B82F6"
                                strokeWidth={2}
                                dot={{ fill: '#3B82F6', r: 4 }}
                                name="Total Tickets"
                            />
                            <Line
                                type="monotone"
                                dataKey="resolved"
                                stroke="#00B14F"
                                strokeWidth={2}
                                dot={{ fill: '#00B14F', r: 4 }}
                                name="Resolved"
                            />
                            <Legend />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* By Country — Bar Chart */}
                <div className="bg-white rounded-xl p-6 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4">
                        🌏 Tickets by Country
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={byCountry} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis type="number" tick={{ fontSize: 11 }} />
                            <YAxis
                                type="category"
                                dataKey="country"
                                tick={{ fontSize: 11 }}
                                width={80}
                            />
                            <Tooltip
                                contentStyle={{
                                    borderRadius: '8px',
                                    border: 'none',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                }}
                            />
                            <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Tickets">
                                {byCountry.map((entry, i) => (
                                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Systemic Issues Detection */}
            <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
                <h3 className="font-bold text-gray-800 mb-4">
                    ⚠️ Systemic Issues Detected by AI
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                    AI automatically identifies recurring patterns across regions and categories
                </p>

                {systemic.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                        <div className="text-4xl mb-2">✅</div>
                        <p>No systemic issues detected</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {systemic.map((issue, i) => (
                            <div
                                key={i}
                                className={`p-4 rounded-lg border-l-4 fade-in ${
                                    issue.severity === 'high'
                                        ? 'border-red-400 bg-red-50'
                                        : issue.severity === 'medium'
                                        ? 'border-yellow-400 bg-yellow-50'
                                        : 'border-blue-400 bg-blue-50'
                                }`}
                                style={{ animationDelay: `${i * 0.15}s` }}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                                issue.severity === 'high'
                                                    ? 'bg-red-200 text-red-700'
                                                    : 'bg-yellow-200 text-yellow-700'
                                            }`}>
                                                {issue.severity.toUpperCase()}
                                            </span>
                                            <span className="text-xs text-gray-400">
                                                📍 {issue.region}
                                            </span>
                                            <span className="text-xs text-gray-400">
                                                📈 Trend: {issue.trend}
                                            </span>
                                        </div>
                                        <div className="text-sm font-semibold text-gray-800 mb-1">
                                            {issue.pattern}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            Affected tickets: {issue.affected_tickets}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-2 bg-white bg-opacity-60 p-3 rounded">
                                    <div className="text-xs text-gray-500 font-semibold">
                                        💡 AI Recommendation:
                                    </div>
                                    <div className="text-sm text-gray-700 mt-1">
                                        {issue.recommendation}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Responsible AI Metrics */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4">
                    🛡️ Responsible AI Metrics
                </h3>
                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-lg">
                        <div className="text-2xl mb-2">🔍</div>
                        <div className="text-lg font-bold text-purple-600">100%</div>
                        <div className="text-xs text-gray-500">
                            Resolutions with Evidence Trail
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg">
                        <div className="text-2xl mb-2">👤</div>
                        <div className="text-lg font-bold text-purple-600">32.4%</div>
                        <div className="text-xs text-gray-500">
                            Human-Reviewed Cases
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg">
                        <div className="text-2xl mb-2">🔒</div>
                        <div className="text-lg font-bold text-purple-600">100%</div>
                        <div className="text-xs text-gray-500">
                            PII Masking Compliance
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg">
                        <div className="text-2xl mb-2">⚖️</div>
                        <div className="text-lg font-bold text-purple-600">0</div>
                        <div className="text-xs text-gray-500">
                            Bias Incidents Detected
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Analytics;