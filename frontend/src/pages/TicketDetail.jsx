import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import ConfidenceMeter from '../components/ConfidenceMeter';
import EvidenceTrail from '../components/EvidenceTrail';

function TicketDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [investigating, setInvestigating] = useState(false);
    const [approving, setApproving] = useState(false);

    const fetchTicket = useCallback(async () => {
        try {
            const res = await api.getTicket(id);
            setData(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchTicket();
    }, [fetchTicket]);

    const handleInvestigate = async () => {
        setInvestigating(true);
        try {
            await api.investigate(id);
            await fetchTicket();
        } catch (err) {
            alert('Investigation failed: ' + err.message);
        } finally {
            setInvestigating(false);
        }
    };

    const handleApprove = async () => {
        setApproving(true);
        try {
            await api.approve(id, 'Senior Agent');
            await fetchTicket();
        } catch (err) {
            alert('Approval failed');
        } finally {
            setApproving(false);
        }
    };

    const handleEscalate = async () => {
        try {
            await api.escalate(id, 'Manual escalation by agent');
            await fetchTicket();
        } catch (err) {
            alert('Escalation failed');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-xl text-gray-500">Loading ticket...</div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="p-6">
                <p className="text-red-500">Ticket not found</p>
                <button onClick={() => navigate('/tickets')} className="mt-4 text-grab-green">
                    ← Back to Queue
                </button>
            </div>
        );
    }

    const { ticket, investigation } = data;
    const inv = investigation;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Back Button */}
            <button
                onClick={() => navigate('/tickets')}
                className="text-sm text-gray-500 hover:text-grab-green mb-4 
                           flex items-center gap-1"
            >
                ← Back to Ticket Queue
            </button>

            {/* Header */}
            <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-2xl font-bold text-gray-800">
                                {ticket.ticket_id}
                            </h1>
                            <StatusBadge status={ticket.status} />
                        </div>
                        <h2 className="text-lg text-gray-700 mb-2">{ticket.subject}</h2>
                        <p className="text-gray-500 text-sm">{ticket.description}</p>
                        <div className="flex gap-4 mt-3 text-xs text-gray-400">
                            <span>👤 {ticket.customer_id || 'N/A'}</span>
                            <span>📍 {ticket.country || 'N/A'}, {ticket.city || ''}</span>
                            <span>📂 {ticket.category || 'Unclassified'}</span>
                            <span>📱 {ticket.channel || 'app'}</span>
                            {ticket.trip_id && <span>🚗 {ticket.trip_id}</span>}
                            {ticket.driver_id && <span>🧑‍✈️ {ticket.driver_id}</span>}
                            {ticket.merchant_id && <span>🏪 {ticket.merchant_id}</span>}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {ticket.status === 'open' && (
                            <button
                                onClick={handleInvestigate}
                                disabled={investigating}
                                className="bg-grab-green text-white px-6 py-3 rounded-lg 
                                           font-medium hover:bg-green-600 transition 
                                           disabled:opacity-50 pulse-green"
                            >
                                {investigating ? '🔍 Investigating...' : '🤖 Investigate with AI'}
                            </button>
                        )}
                        {ticket.status === 'human_review' && (
                            <>
                                <button
                                    onClick={handleApprove}
                                    disabled={approving}
                                    className="bg-grab-green text-white px-4 py-2 rounded-lg 
                                               font-medium hover:bg-green-600"
                                >
                                    ✅ Approve Resolution
                                </button>
                                <button
                                    onClick={handleEscalate}
                                    className="bg-red-500 text-white px-4 py-2 rounded-lg 
                                               font-medium hover:bg-red-600"
                                >
                                    🔴 Escalate
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Investigation Results */}
            {inv && (
                <div className="grid grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-6">
                        {/* Confidence */}
                        <div className="bg-white rounded-xl p-6 shadow-sm">
                            <ConfidenceMeter score={inv.confidence_score || 0} />
                            <div className="mt-3 text-xs text-gray-500">
                                Processing time: {inv.processing_time_seconds}s | 
                                Sources: {inv.investigation?.total_sources || 0} | 
                                Findings: {inv.investigation?.total_findings || 0}
                            </div>
                        </div>

                        {/* Classification */}
                        {inv.classification && (
                            <div className="bg-white rounded-xl p-6 shadow-sm">
                                <h3 className="font-bold text-gray-800 mb-4">
                                    🧠 AI Classification
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {Object.entries(inv.classification).map(([key, value]) => (
                                        <div key={key} className="bg-gray-50 rounded-lg p-3">
                                            <div className="text-xs text-gray-500 capitalize">
                                                {key.replace(/_/g, ' ')}
                                            </div>
                                            <div className="text-sm font-semibold text-gray-700 mt-1">
                                                {typeof value === 'boolean' ? (value ? '✅ Yes' : '❌ No') : String(value)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Root Cause */}
                        {inv.root_cause && (
                            <div className="bg-white rounded-xl p-6 shadow-sm">
                                <h3 className="font-bold text-gray-800 mb-4">
                                    🎯 Root Cause Analysis
                                </h3>
                                <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded mb-4">
                                    <div className="text-sm font-bold text-red-700">Primary Cause:</div>
                                    <div className="text-sm text-red-600 mt-1">
                                        {inv.root_cause.primary_cause}
                                    </div>
                                </div>
                                {inv.root_cause.evidence_summary && (
                                    <div className="bg-gray-50 p-4 rounded mb-3">
                                        <div className="text-xs text-gray-500 font-semibold mb-1">Evidence Summary:</div>
                                        <div className="text-sm text-gray-700">{inv.root_cause.evidence_summary}</div>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-3 mt-3">
                                    <div className="bg-gray-50 p-3 rounded">
                                        <div className="text-xs text-gray-500">Responsible Party</div>
                                        <div className="text-sm font-semibold">{inv.root_cause.responsible_party}</div>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded">
                                        <div className="text-xs text-gray-500">Severity</div>
                                        <div className="text-sm font-semibold">{inv.root_cause.severity}</div>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded">
                                        <div className="text-xs text-gray-500">Systemic Issue?</div>
                                        <div className="text-sm font-semibold">
                                            {inv.root_cause.is_systemic ? '⚠️ Yes' : '✅ No'}
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded">
                                        <div className="text-xs text-gray-500">Confidence</div>
                                        <div className="text-sm font-semibold">
                                            {(inv.root_cause.confidence * 100).toFixed(0)}%
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        {/* Resolution */}
                        {inv.resolution && (
                            <div className="bg-white rounded-xl p-6 shadow-sm">
                                <h3 className="font-bold text-gray-800 mb-4">
                                    ⚡ AI Resolution
                                </h3>
                                <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded mb-4">
                                    <div className="text-sm font-bold text-green-700">Action:</div>
                                    <div className="text-sm text-green-600 mt-1">
                                        {inv.resolution.action}
                                    </div>
                                </div>

                                {(inv.resolution.refund_amount || inv.resolution.credit_amount) && (
                                    <div className="flex gap-4 mb-4">
                                        {inv.resolution.refund_amount && (
                                            <div className="bg-orange-50 p-3 rounded flex-1">
                                                <div className="text-xs text-orange-500">Refund Amount</div>
                                                <div className="text-lg font-bold text-orange-600">
                                                    {inv.resolution.currency || 'SGD'} {inv.resolution.refund_amount}
                                                </div>
                                            </div>
                                        )}
                                        {inv.resolution.credit_amount && (
                                            <div className="bg-blue-50 p-3 rounded flex-1">
                                                <div className="text-xs text-blue-500">Credit Amount</div>
                                                <div className="text-lg font-bold text-blue-600">
                                                    {inv.resolution.currency || 'SGD'} {inv.resolution.credit_amount}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {inv.resolution.customer_message && (
                                    <div className="bg-blue-50 p-4 rounded mb-4">
                                        <div className="text-xs text-blue-500 font-semibold mb-1">
                                            📧 Customer Message:
                                        </div>
                                        <div className="text-sm text-blue-700 italic">
                                            "{inv.resolution.customer_message}"
                                        </div>
                                    </div>
                                )}

                                {inv.resolution.internal_notes && (
                                    <div className="bg-gray-50 p-4 rounded mb-3">
                                        <div className="text-xs text-gray-500 font-semibold mb-1">
                                            📝 Internal Notes:
                                        </div>
                                        <div className="text-sm text-gray-700">
                                            {inv.resolution.internal_notes}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3 mt-3">
                                    <div className="bg-gray-50 p-3 rounded">
                                        <div className="text-xs text-gray-500">Resolution Time</div>
                                        <div className="text-sm font-semibold">
                                            {inv.resolution.resolution_time || 'N/A'}
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded">
                                        <div className="text-xs text-gray-500">Action Type</div>
                                        <div className="text-sm font-semibold">
                                            {inv.resolution.action_type || 'N/A'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Investigation Findings */}
                        {inv.investigation?.findings && inv.investigation.findings.length > 0 && (
                            <div className="bg-white rounded-xl p-6 shadow-sm">
                                <h3 className="font-bold text-gray-800 mb-4">
                                    🔍 Investigation Findings
                                </h3>
                                <div className="space-y-2">
                                    {inv.investigation.findings.map((finding, i) => (
                                        <div key={i} className="bg-blue-50 border-l-4 border-blue-400 
                                                                p-3 rounded text-sm text-blue-700">
                                            {finding}
                                        </div>
                                    ))}
                                </div>
                                {inv.investigation.llm_insights && (
                                    <div className="bg-purple-50 p-4 rounded mt-4">
                                        <div className="text-xs text-purple-500 font-semibold mb-1">
                                            🧠 AI Deep Analysis:
                                        </div>
                                        <div className="text-sm text-purple-700">
                                            {inv.investigation.llm_insights}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Evidence Trail */}
                        {inv.evidence_trail && inv.evidence_trail.length > 0 && (
                            <div className="bg-white rounded-xl p-6 shadow-sm">
                                <EvidenceTrail evidence={inv.evidence_trail} />
                            </div>
                        )}

                        {/* SLA Prediction */}
                        {inv.sla_prediction && (
                            <div className="bg-white rounded-xl p-6 shadow-sm">
                                <h3 className="font-bold text-gray-800 mb-4">
                                    📊 SLA Prediction
                                </h3>
                                <div className={`p-4 rounded-lg ${
                                    inv.sla_prediction.risk_level === 'critical' ? 'bg-red-50 border border-red-200' :
                                    inv.sla_prediction.risk_level === 'high' ? 'bg-orange-50 border border-orange-200' :
                                    inv.sla_prediction.risk_level === 'medium' ? 'bg-yellow-50 border border-yellow-200' :
                                    'bg-green-50 border border-green-200'
                                }`}>
                                    <div className="text-sm font-bold">
                                        Risk Level: {inv.sla_prediction.risk_level.toUpperCase()}
                                    </div>
                                    <div className="text-sm mt-1">
                                        Breach Probability: {(inv.sla_prediction.sla_breach_probability * 100).toFixed(0)}%
                                    </div>
                                    <div className="text-sm mt-1">
                                        {inv.sla_prediction.recommended_action}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Show investigate button if no investigation yet */}
            {!inv && ticket.status === 'open' && (
                <div className="bg-white rounded-xl p-10 text-center shadow-sm">
                    <div className="text-5xl mb-4">🤖</div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                        Ready to Investigate
                    </h3>
                    <p className="text-gray-500 mb-6">
                        Click below to run the full AI investigation pipeline
                    </p>
                    <button
                        onClick={handleInvestigate}
                        disabled={investigating}
                        className="bg-grab-green text-white px-8 py-4 rounded-xl text-lg 
                                   font-bold hover:bg-green-600 transition pulse-green 
                                   disabled:opacity-50"
                    >
                        {investigating
                            ? '🔍 AI is investigating... Please wait'
                            : '🚀 Start AI Investigation'
                        }
                    </button>
                </div>
            )}
        </div>
    );
}

export default TicketDetail;