import React, { useState } from 'react';
import api from '../services/api';
import ConfidenceMeter from '../components/ConfidenceMeter';
import EvidenceTrail from '../components/EvidenceTrail';

const sampleScenarios = [
    {
        label: "🚗 Fare Dispute — Route Deviation",
        ticket: {
            ticket_id: "DEMO-001",
            subject: "Overcharged for GrabCar ride — driver took longer route",
            description: "I took a GrabCar from Orchard to Jurong. Estimated fare was SGD 25 but charged SGD 42. Driver went through a completely different route. GPS should show this. Please refund the difference.",
            customer_id: "RIDER-DEMO-1",
            driver_id: "DRIVER-4432",
            trip_id: "TRIP-99281",
            category: "ride",
            channel: "app",
            country: "Singapore"
        }
    },
    {
        label: "💳 Double Charge — Payment Issue",
        ticket: {
            ticket_id: "DEMO-002",
            subject: "Charged twice for the same GrabCar ride",
            description: "Two charges of SGD 25.60 appeared on my GrabPay wallet for a single ride from Orchard to Bugis on May 15. Transaction IDs: TXN-88442-A and TXN-88442-B. Please refund one immediately.",
            customer_id: "RIDER-DEMO-2",
            driver_id: "DRIVER-5521",
            trip_id: "TRIP-88442",
            category: "payment",
            channel: "app",
            country: "Singapore"
        }
    },
    {
        label: "🍔 Missing GrabFood Item",
        ticket: {
            ticket_id: "DEMO-003",
            subject: "Missing items in my GrabFood order",
            description: "Ordered 3 items from McDonald's but only received 2. The McChicken burger worth SGD 6.50 was missing. Order ID: ORDER-55123. Please refund the missing item.",
            customer_id: "RIDER-DEMO-3",
            merchant_id: "MERCHANT-2291",
            order_id: "ORDER-55123",
            category: "food_delivery",
            channel: "app",
            country: "Singapore"
        }
    },
    {
        label: "🚫 Unfair Cancellation Fee",
        ticket: {
            ticket_id: "DEMO-004",
            subject: "Charged cancellation fee but driver was 15 min late",
            description: "Driver accepted my ride but did not move for 15 minutes. I had to cancel and was charged SGD 5 cancellation fee. The driver was at fault, not me. Please waive the fee.",
            customer_id: "RIDER-DEMO-4",
            driver_id: "DRIVER-8876",
            trip_id: "TRIP-44098",
            category: "ride",
            channel: "app",
            country: "Singapore"
        }
    },
    {
        label: "⏰ Refund Delay — 5 Days Overdue",
        ticket: {
            ticket_id: "DEMO-005",
            subject: "Approved refund not received after 5 days",
            description: "My refund of SGD 15.30 was approved on May 11 with reference REF-44521 but I still haven't received it. It's been 5 days and the money is not in my GrabPay wallet.",
            customer_id: "RIDER-DEMO-5",
            trip_id: "TRIP-66112",
            category: "payment",
            channel: "app",
            country: "Malaysia"
        }
    },
    {
        label: "✍️ Custom Ticket (Type Your Own)",
        ticket: null
    }
];

function LiveDemo() {
    const [selectedScenario, setSelectedScenario] = useState(null);
    const [customTicket, setCustomTicket] = useState({
        ticket_id: "DEMO-CUSTOM",
        subject: "",
        description: "",
        customer_id: "RIDER-CUSTOM",
        driver_id: "",
        merchant_id: "",
        trip_id: "",
        order_id: "",
        category: "",
        channel: "app",
        country: "Singapore"
    });
    const [investigating, setInvestigating] = useState(false);
    const [result, setResult] = useState(null);
    const [stepMessages, setStepMessages] = useState([]);

    const simulateSteps = (callback) => {
        const steps = [
            { msg: "🧠 Step 1: Classifying ticket...", delay: 500 },
            { msg: "🔍 Step 2: Querying data sources...", delay: 1500 },
            { msg: "📊 Step 2: Analyzing trip data, GPS records, driver profile...", delay: 2500 },
            { msg: "🎯 Step 3: Running root cause analysis...", delay: 3500 },
            { msg: "⚡ Step 4: Generating resolution...", delay: 5000 },
            { msg: "📈 Step 5: Predicting SLA risk...", delay: 6000 },
        ];

        steps.forEach(({ msg, delay }) => {
            setTimeout(() => {
                setStepMessages(prev => [...prev, msg]);
            }, delay);
        });

        setTimeout(callback, 7000);
    };

    const handleInvestigate = async (ticketData) => {
        setInvestigating(true);
        setResult(null);
        setStepMessages([]);

        try {
            // First create the ticket
            await api.createTicket(ticketData).catch(() => {});

            // Start step simulation
            simulateSteps(async () => {
                try {
                    const res = await api.investigate(ticketData.ticket_id);
                    setResult(res.data);
                } catch (err) {
                    // If backend fails, show error
                    setStepMessages(prev => [
                        ...prev,
                        `❌ Error: ${err.message}. Make sure AI Engine (port 8000) and Backend (port 5000) are running.`
                    ]);
                } finally {
                    setInvestigating(false);
                }
            });
        } catch (err) {
            setInvestigating(false);
            alert('Failed: ' + err.message);
        }
    };

    const handleScenarioSelect = (scenario) => {
        setSelectedScenario(scenario);
        setResult(null);
        setStepMessages([]);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800">
                    🚀 Live Demo — GrabResolve AI
                </h1>
                <p className="text-gray-500 mt-1">
                    Watch the AI investigate and resolve a support ticket in real-time
                </p>
            </div>

            {/* Scenario Selection */}
            <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
                <h2 className="font-bold text-gray-800 mb-4">
                    Choose a Demo Scenario:
                </h2>
                <div className="grid grid-cols-3 gap-3">
                    {sampleScenarios.map((scenario, i) => (
                        <button
                            key={i}
                            onClick={() => handleScenarioSelect(scenario)}
                            className={`p-4 rounded-lg text-left transition-all border-2 ${
                                selectedScenario === scenario
                                    ? 'border-grab-green bg-green-50 shadow-md'
                                    : 'border-gray-200 hover:border-grab-green hover:bg-gray-50'
                            }`}
                        >
                            <div className="text-sm font-semibold text-gray-800">
                                {scenario.label}
                            </div>
                            {scenario.ticket && (
                                <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                                    {scenario.ticket.description}
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Custom Ticket Form */}
            {selectedScenario && !selectedScenario.ticket && (
                <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
                    <h3 className="font-bold text-gray-800 mb-4">
                        ✍️ Enter Custom Ticket
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm text-gray-600 font-medium">Subject</label>
                            <input
                                type="text"
                                value={customTicket.subject}
                                onChange={e => setCustomTicket({
                                    ...customTicket, subject: e.target.value
                                })}
                                className="w-full border rounded-lg p-3 mt-1 text-sm"
                                placeholder="e.g., Overcharged for GrabCar ride"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-600 font-medium">Country</label>
                            <select
                                value={customTicket.country}
                                onChange={e => setCustomTicket({
                                    ...customTicket, country: e.target.value
                                })}
                                className="w-full border rounded-lg p-3 mt-1 text-sm"
                            >
                                <option>Singapore</option>
                                <option>Malaysia</option>
                                <option>Indonesia</option>
                                <option>Thailand</option>
                                <option>Philippines</option>
                                <option>Vietnam</option>
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="text-sm text-gray-600 font-medium">Description</label>
                            <textarea
                                value={customTicket.description}
                                onChange={e => setCustomTicket({
                                    ...customTicket, description: e.target.value
                                })}
                                className="w-full border rounded-lg p-3 mt-1 text-sm"
                                rows={3}
                                placeholder="Describe the issue in detail..."
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-600 font-medium">
                                Trip ID (optional)
                            </label>
                            <input
                                type="text"
                                value={customTicket.trip_id}
                                onChange={e => setCustomTicket({
                                    ...customTicket, trip_id: e.target.value
                                })}
                                className="w-full border rounded-lg p-3 mt-1 text-sm"
                                placeholder="e.g., TRIP-99281"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-600 font-medium">
                                Driver ID (optional)
                            </label>
                            <input
                                type="text"
                                value={customTicket.driver_id}
                                onChange={e => setCustomTicket({
                                    ...customTicket, driver_id: e.target.value
                                })}
                                className="w-full border rounded-lg p-3 mt-1 text-sm"
                                placeholder="e.g., DRIVER-4432"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Selected Ticket Preview + Investigate Button */}
            {selectedScenario && (
                <div className="bg-gradient-to-r from-grab-dark to-gray-800 rounded-xl p-6 
                                shadow-sm mb-6 text-white">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="font-bold text-grab-green mb-2">
                                Selected Ticket Preview:
                            </h3>
                            <div className="text-sm font-semibold mb-1">
                                {selectedScenario.ticket
                                    ? selectedScenario.ticket.subject
                                    : customTicket.subject || 'Enter details above'
                                }
                            </div>
                            <div className="text-xs text-gray-400">
                                {selectedScenario.ticket
                                    ? selectedScenario.ticket.description
                                    : customTicket.description || 'Enter description above'
                                }
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                const ticketData = selectedScenario.ticket || customTicket;
                                if (!ticketData.subject || !ticketData.description) {
                                    alert('Please fill in subject and description');
                                    return;
                                }
                                handleInvestigate(ticketData);
                            }}
                            disabled={investigating}
                            className="bg-grab-green text-white px-8 py-4 rounded-xl 
                                       font-bold text-lg hover:bg-green-600 transition 
                                       disabled:opacity-50 flex-shrink-0 pulse-green"
                        >
                            {investigating
                                ? '🔍 AI Investigating...'
                                : '🚀 Run AI Investigation'
                            }
                        </button>
                    </div>
                </div>
            )}

            {/* Live Investigation Steps */}
            {stepMessages.length > 0 && (
                <div className="bg-gray-900 rounded-xl p-6 shadow-sm mb-6 font-mono">
                    <h3 className="text-grab-green font-bold mb-3 text-sm">
                        🖥️ Live Investigation Console:
                    </h3>
                    <div className="space-y-2">
                        {stepMessages.map((msg, i) => (
                            <div
                                key={i}
                                className="text-sm text-gray-300 fade-in"
                                style={{ animationDelay: `${i * 0.1}s` }}
                            >
                                <span className="text-gray-500 mr-2">
                                    [{new Date().toLocaleTimeString()}]
                                </span>
                                {msg}
                            </div>
                        ))}
                        {investigating && (
                            <div className="text-yellow-400 text-sm mt-2">
                                ⏳ Waiting for AI response...
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Investigation Result */}
            {result && result.investigation && (
                <div className="space-y-6 fade-in">
                    {/* Success Banner */}
                    <div className={`rounded-xl p-6 shadow-sm ${
                        result.investigation.auto_resolved
                            ? 'bg-green-50 border-2 border-green-200'
                            : result.investigation.status === 'human_review'
                            ? 'bg-yellow-50 border-2 border-yellow-200'
                            : 'bg-red-50 border-2 border-red-200'
                    }`}>
                        <div className="flex items-center gap-4">
                            <div className="text-5xl">
                                {result.investigation.auto_resolved ? '✅' :
                                 result.investigation.status === 'human_review' ? '🟡' : '🔴'}
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">
                                    {result.investigation.auto_resolved
                                        ? 'Ticket Auto-Resolved by AI!'
                                        : result.investigation.status === 'human_review'
                                        ? 'AI Recommends — Needs Human Review'
                                        : 'Escalated to Senior Agent'
                                    }
                                </h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    Processed in {result.investigation.processing_time_seconds}s | 
                                    Confidence: {(result.investigation.confidence_score * 100).toFixed(0)}% | 
                                    Sources queried: {result.investigation.investigation?.total_sources || 0}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Confidence */}
                    <div className="bg-white rounded-xl p-6 shadow-sm">
                        <ConfidenceMeter score={result.investigation.confidence_score || 0} />
                    </div>

                    {/* Results Grid */}
                    <div className="grid grid-cols-2 gap-6">
                        {/* Classification */}
                        {result.investigation.classification && (
                            <div className="bg-white rounded-xl p-6 shadow-sm">
                                <h3 className="font-bold text-gray-800 mb-4">
                                    🧠 AI Classification
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {Object.entries(result.investigation.classification).map(([key, value]) => (
                                        <div key={key} className="bg-gray-50 rounded-lg p-3">
                                            <div className="text-xs text-gray-500 capitalize">
                                                {key.replace(/_/g, ' ')}
                                            </div>
                                            <div className="text-sm font-semibold text-gray-700 mt-1">
                                                {typeof value === 'boolean'
                                                    ? (value ? '✅ Yes' : '❌ No')
                                                    : String(value)
                                                }
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Root Cause */}
                        {result.investigation.root_cause && (
                            <div className="bg-white rounded-xl p-6 shadow-sm">
                                <h3 className="font-bold text-gray-800 mb-4">
                                    🎯 Root Cause
                                </h3>
                                <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded mb-3">
                                    <div className="text-sm font-bold text-red-700">
                                        {result.investigation.root_cause.primary_cause}
                                    </div>
                                </div>
                                {result.investigation.root_cause.evidence_summary && (
                                    <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                                        {result.investigation.root_cause.evidence_summary}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Resolution */}
                        {result.investigation.resolution && (
                            <div className="bg-white rounded-xl p-6 shadow-sm">
                                <h3 className="font-bold text-gray-800 mb-4">
                                    ⚡ AI Resolution
                                </h3>
                                <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded mb-3">
                                    <div className="text-sm font-bold text-green-700">
                                        {result.investigation.resolution.action}
                                    </div>
                                </div>
                                {result.investigation.resolution.refund_amount && (
                                    <div className="bg-orange-50 p-3 rounded mb-3">
                                        <span className="text-xs text-orange-500">Refund: </span>
                                        <span className="text-lg font-bold text-orange-600">
                                            {result.investigation.resolution.currency || 'SGD'}{' '}
                                            {result.investigation.resolution.refund_amount}
                                        </span>
                                    </div>
                                )}
                                {result.investigation.resolution.customer_message && (
                                    <div className="bg-blue-50 p-3 rounded">
                                        <div className="text-xs text-blue-500 font-semibold mb-1">
                                            📧 Customer Message:
                                        </div>
                                        <div className="text-sm text-blue-700 italic">
                                            "{result.investigation.resolution.customer_message}"
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Findings */}
                        {result.investigation.investigation?.findings && (
                            <div className="bg-white rounded-xl p-6 shadow-sm">
                                <h3 className="font-bold text-gray-800 mb-4">
                                    🔍 Key Findings
                                </h3>
                                <div className="space-y-2">
                                    {result.investigation.investigation.findings.map((f, i) => (
                                        <div
                                            key={i}
                                            className="bg-blue-50 border-l-4 border-blue-400 
                                                       p-3 rounded text-sm text-blue-700"
                                        >
                                            {f}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Evidence Trail */}
                    {result.investigation.evidence_trail && (
                        <div className="bg-white rounded-xl p-6 shadow-sm">
                            <EvidenceTrail evidence={result.investigation.evidence_trail} />
                        </div>
                    )}
                </div>
            )}

            {/* Instructions when no scenario selected */}
            {!selectedScenario && (
                <div className="bg-white rounded-xl p-10 text-center shadow-sm">
                    <div className="text-6xl mb-4">👆</div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                        Select a Scenario Above
                    </h3>
                    <p className="text-gray-500">
                        Choose a demo ticket to watch GrabResolve AI investigate 
                        and resolve it in real-time
                    </p>
                </div>
            )}
        </div>
    );
}

export default LiveDemo;