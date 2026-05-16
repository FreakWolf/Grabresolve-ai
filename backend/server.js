const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 5000;
const AI_ENGINE = 'http://localhost:8000';
const LIVE_ANALYTICS_WINDOW_MS = 24 * 60 * 60 * 1000;

// ⬇️ ADDED: Centralized timeout config (3 minutes)
const AI_REQUEST_TIMEOUT_MS = 180000;

const RESOLVED_STATUSES = new Set([
    'auto_resolved',
    'human_review',
    'resolved',
    'escalated'
]);

app.use(cors());
app.use(express.json());

let ticketsDB = [];
let investigationsDB = [];

function asNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
}

function round(value, digits = 1) {
    return Number(value.toFixed(digits));
}

function ticketStatus(ticket) {
    if (ticket.status === 'resolved' && ticket.auto_resolved) {
        return 'auto_resolved';
    }
    return ticket.status || 'open';
}

function investigationFor(ticketId) {
    return investigationsDB.find(i => i.ticket_id === ticketId);
}

function resolutionStatus(ticket, investigation) {
    return (
        investigation?.resolution?.status ||
        investigation?.status ||
        ticketStatus(ticket)
    );
}

function safeDate(raw) {
    const date = raw ? new Date(raw) : new Date();
    return Number.isNaN(date.getTime()) ? new Date() : date;
}

function analyticsFromState() {
    const statusCounts = {
        open: 0, investigating: 0, auto_resolved: 0,
        human_review: 0, escalated: 0, resolved: 0, error: 0
    };
    const categoryMap = new Map();
    const countryMap = new Map();
    const hourlyMap = new Map();
    const resolutionBreakdown = {
        auto_resolved: 0, human_reviewed: 0, escalated: 0
    };

    let processed = 0;
    let evidenceTrailCount = 0;
    let totalResolutionSeconds = 0;
    let totalTokensUsed = 0;  // ⬅️ ADDED
    let ticketsWithTokens = 0; // ⬅️ ADDED

    ticketsDB.forEach(ticket => {
        const status = ticketStatus(ticket);
        statusCounts[status] = (statusCounts[status] || 0) + 1;

        const category = ticket.category || 'Uncategorized';
        const country = ticket.country || 'Unknown';
        const investigation = investigationFor(ticket.ticket_id);
        const resolvedStatus = resolutionStatus(ticket, investigation);
        const timestamp = safeDate(ticket.resolved_at || ticket.created_at);
        const hour = `${String(timestamp.getHours()).padStart(2, '0')}:00`;

        if (!hourlyMap.has(hour)) {
            hourlyMap.set(hour, { hour, tickets: 0, resolved: 0 });
        }
        const hourlyRow = hourlyMap.get(hour);
        hourlyRow.tickets += 1;
        if (RESOLVED_STATUSES.has(status)) hourlyRow.resolved += 1;

        if (!categoryMap.has(category)) {
            categoryMap.set(category, { category, count: 0, autoResolvedCount: 0 });
        }
        const categoryRow = categoryMap.get(category);
        categoryRow.count += 1;
        if (resolvedStatus === 'auto_resolved' || status === 'resolved') {
            categoryRow.autoResolvedCount += 1;
        }

        if (!countryMap.has(country)) countryMap.set(country, { country, count: 0 });
        countryMap.get(country).count += 1;

        if (RESOLVED_STATUSES.has(status)) processed += 1;

        if (resolvedStatus === 'auto_resolved' || status === 'resolved') {
            resolutionBreakdown.auto_resolved += 1;
        } else if (resolvedStatus === 'human_review') {
            resolutionBreakdown.human_reviewed += 1;
        } else if (resolvedStatus === 'escalated' || status === 'escalated') {
            resolutionBreakdown.escalated += 1;
        }

        if (investigation?.evidence?.length) evidenceTrailCount += 1;
        if (ticket.processing_time) totalResolutionSeconds += asNumber(ticket.processing_time);

        // ⬇️ ADDED: Aggregate token usage
        if (investigation?.token_usage?.total_tokens) {
            totalTokensUsed += investigation.token_usage.total_tokens;
            ticketsWithTokens += 1;
        }
    });

    const totalTickets = ticketsDB.length;
    const autoResolvedCount = resolutionBreakdown.auto_resolved;
    const humanReviewedCount = resolutionBreakdown.human_reviewed;
    const escalatedCount = resolutionBreakdown.escalated;

    return {
        local_stats: {
            total_tickets: totalTickets,
            open: statusCounts.open,
            investigating: statusCounts.investigating,
            auto_resolved: autoResolvedCount,
            human_review: humanReviewedCount,
            escalated: escalatedCount,
            resolved: statusCounts.resolved,
            error: statusCounts.error,
            processed
        },
        ai_analytics: {
            overview: {
                auto_resolve_rate: totalTickets > 0
                    ? round((autoResolvedCount / totalTickets) * 100, 1) : 0,
                avg_resolution_time_sec: processed > 0
                    ? round(totalResolutionSeconds / processed, 1) : 0,
                sla_compliance_rate: processed > 0
                    ? round(((processed - escalatedCount) / processed) * 100, 1) : 0,
                total_tickets_today: totalTickets,
                processed_tickets: processed,
                auto_resolved: autoResolvedCount,
                human_reviewed: humanReviewedCount,
                escalated: escalatedCount,
                investigating: statusCounts.investigating,
                open: statusCounts.open,
                // ⬇️ ADDED: Token metrics
                total_tokens_used: totalTokensUsed,
                avg_tokens_per_ticket: ticketsWithTokens > 0
                    ? Math.round(totalTokensUsed / ticketsWithTokens) : 0
            },
            by_category: Array.from(categoryMap.values())
                .map(row => ({
                    category: row.category,
                    count: row.count,
                    auto_rate: row.count > 0
                        ? round((row.autoResolvedCount / row.count) * 100, 1) : 0
                }))
                .sort((a, b) => b.count - a.count),
            by_country: Array.from(countryMap.values()).sort((a, b) => b.count - a.count),
            hourly_trend: Array.from(hourlyMap.values()).sort((a, b) => a.hour.localeCompare(b.hour)),
            resolution_breakdown: resolutionBreakdown,
            responsible_ai: {
                evidence_trail_rate: processed > 0
                    ? round((evidenceTrailCount / processed) * 100, 1) : 0,
                human_review_rate: processed > 0
                    ? round((humanReviewedCount / processed) * 100, 1) : 0,
                pii_masking_compliance: 100,
                bias_incidents_detected: 0
            }
        },
        generated_at: new Date().toISOString()
    };
}

function systemicIssuesFromState() {
    const grouped = investigationsDB.reduce((acc, investigation) => {
        const ticket = ticketsDB.find(t => t.ticket_id === investigation.ticket_id) || {};
        const region = ticket.country || 'Unknown';
        const category = ticket.category || investigation.classification?.category || 'General';
        const key = `${region}::${category}`;

        if (!acc[key]) {
            acc[key] = { region, category, affected_tickets: 0 };
        }
        acc[key].affected_tickets += 1;
        return acc;
    }, {});

    return Object.values(grouped)
        .filter(issue => issue.affected_tickets >= 2)
        .sort((a, b) => b.affected_tickets - a.affected_tickets)
        .slice(0, 5)
        .map(issue => ({
            severity: issue.affected_tickets >= 4 ? 'high' : 'medium',
            region: issue.region,
            trend: issue.affected_tickets >= 4 ? 'spiking' : 'watch',
            pattern: `Recurring ${issue.category.toLowerCase()} cases in ${issue.region}`,
            affected_tickets: issue.affected_tickets,
            recommendation: `Review ${issue.category} workflows in ${issue.region} and prioritize an operational fix.`
        }));
}

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'GrabResolve Backend',
        tickets_count: ticketsDB.length,
        investigations_count: investigationsDB.length
    });
});

app.get('/api/tickets', (req, res) => {
    const sorted = [...ticketsDB].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
    res.json(sorted);
});

app.get('/api/tickets/:id', (req, res) => {
    const ticket = ticketsDB.find(t => t.ticket_id === req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    res.json({
        ticket,
        investigation: investigationFor(req.params.id) || null
    });
});

app.post('/api/tickets', (req, res) => {
    const existing = ticketsDB.find(t => t.ticket_id === req.body.ticket_id);
    if (existing) return res.json(existing);

    const ticket = {
        ...req.body,
        ticket_id: req.body.ticket_id || `TKT-${Date.now()}`,
        status: 'open',
        created_at: new Date().toISOString()
    };

    ticketsDB.push(ticket);
    res.status(201).json(ticket);
});

app.post('/api/tickets/:id/investigate', async (req, res) => {
    try {
        const ticket = ticketsDB.find(t => t.ticket_id === req.params.id);
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        ticket.status = 'investigating';
        console.log(`\nSending ${ticket.ticket_id} to AI Engine...`);

        const aiResponse = await axios.post(
            `${AI_ENGINE}/api/investigate`,
            {
                ticket_id: ticket.ticket_id,
                subject: ticket.subject,
                description: ticket.description,
                customer_id: ticket.customer_id,
                driver_id: ticket.driver_id,
                merchant_id: ticket.merchant_id,
                trip_id: ticket.trip_id,
                order_id: ticket.order_id,
                category: ticket.category,
                subcategory: ticket.subcategory,
                channel: ticket.channel,
                country: ticket.country,
                city: ticket.city,
                priority: ticket.priority
            },
            { timeout: AI_REQUEST_TIMEOUT_MS }  // ⬅️ CHANGED: 60000 → 180000
        );

        const result = aiResponse.data;
        ticket.status = result.resolution?.status || result.status || 'human_review';
        ticket.confidence_score = result.confidence_score;
        ticket.auto_resolved = ticket.status === 'auto_resolved';
        ticket.processing_time = result.processing_time_seconds;
        ticket.token_usage = result.token_usage;  // ⬅️ ADDED
        ticket.resolved_at = new Date().toISOString();

        investigationsDB = investigationsDB.filter(i => i.ticket_id !== ticket.ticket_id);
        investigationsDB.push({
            ticket_id: ticket.ticket_id,
            ...result,
            investigated_at: new Date().toISOString()
        });

        console.log(`${ticket.ticket_id} -> ${ticket.status}`);
        if (result.token_usage) {
            console.log(`   💰 Tokens: ${result.token_usage.total_tokens} ` +
                        `(${result.token_usage.calls_made} calls)`);
        }

        res.json({
            message: 'Investigation complete',
            ticket,
            investigation: result
        });
    } catch (err) {
        console.error('Investigation error:', err.message);
        const ticket = ticketsDB.find(t => t.ticket_id === req.params.id);
        if (ticket) ticket.status = 'error';

        res.status(500).json({
            error: 'Investigation failed',
            details: err.message,
            tip: 'Make sure AI Engine is running on port 8000'
        });
    }
});

app.post('/api/tickets/:id/approve', (req, res) => {
    const ticket = ticketsDB.find(t => t.ticket_id === req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Not found' });

    ticket.status = 'resolved';
    ticket.approved_by = req.body.agent_name || 'Senior Agent';
    ticket.approved_at = new Date().toISOString();

    res.json({ message: 'Approved', ticket });
});

app.post('/api/tickets/:id/escalate', (req, res) => {
    const ticket = ticketsDB.find(t => t.ticket_id === req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Not found' });

    ticket.status = 'escalated';
    ticket.escalation_reason = req.body.reason || 'Manual escalation';

    res.json({ message: 'Escalated', ticket });
});

app.post('/api/seed', async (req, res) => {
    try {
        const response = await axios.get(`${AI_ENGINE}/api/sample-tickets`, {
            timeout: 10000  // ⬅️ ADDED
        });
        const sampleTickets = response.data;

        ticketsDB = [];
        investigationsDB = [];

        sampleTickets.forEach(ticket => {
            ticketsDB.push({
                ...ticket,
                status: 'open',
                created_at: ticket.timestamp || new Date().toISOString()
            });
        });

        console.log(`Seeded ${ticketsDB.length} tickets`);
        res.json({
            message: `Seeded ${ticketsDB.length} tickets`,
            tickets: ticketsDB
        });
    } catch (err) {
        console.error('Seed error:', err.message);
        res.status(500).json({
            error: 'Failed to seed. Is AI Engine running on port 8000?'
        });
    }
});

app.post('/api/investigate-all', async (req, res) => {
    const openTickets = ticketsDB.filter(t => t.status === 'open');
    const results = [];

    console.log(`\nBatch run: ${openTickets.length} tickets\n`);

    for (const ticket of openTickets) {
        try {
            const aiResponse = await axios.post(
                `${AI_ENGINE}/api/investigate`,
                {
                    ticket_id: ticket.ticket_id,
                    subject: ticket.subject,
                    description: ticket.description,
                    customer_id: ticket.customer_id,
                    driver_id: ticket.driver_id,
                    merchant_id: ticket.merchant_id,
                    trip_id: ticket.trip_id,
                    order_id: ticket.order_id,
                    category: ticket.category,
                    subcategory: ticket.subcategory,
                    channel: ticket.channel,
                    country: ticket.country,
                    city: ticket.city,
                    priority: ticket.priority
                },
                { timeout: AI_REQUEST_TIMEOUT_MS }  // ⬅️ CHANGED
            );

            const result = aiResponse.data;
            ticket.status = result.resolution?.status || result.status || 'human_review';
            ticket.confidence_score = result.confidence_score;
            ticket.auto_resolved = ticket.status === 'auto_resolved';
            ticket.processing_time = result.processing_time_seconds;
            ticket.token_usage = result.token_usage;  // ⬅️ ADDED
            ticket.resolved_at = new Date().toISOString();

            investigationsDB = investigationsDB.filter(i => i.ticket_id !== ticket.ticket_id);
            investigationsDB.push({
                ticket_id: ticket.ticket_id,
                ...result,
                investigated_at: new Date().toISOString()
            });

            results.push({
                ticket_id: ticket.ticket_id,
                status: ticket.status,
                confidence: result.confidence_score,
                tokens_used: result.token_usage?.total_tokens || 0,  // ⬅️ ADDED
                success: true
            });
        } catch (err) {
            ticket.status = 'error';
            results.push({
                ticket_id: ticket.ticket_id,
                status: 'error',
                error: err.message,
                success: false
            });
        }
    }

    // ⬇️ ADDED: Batch token summary
    const totalTokens = results.reduce((sum, r) => sum + (r.tokens_used || 0), 0);

    res.json({
        message: `Processed ${openTickets.length} tickets`,
        succeeded: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        total_tokens_used: totalTokens,  // ⬅️ ADDED
        results
    });
});

app.get('/api/analytics/overview', (req, res) => {
    try {
        res.json(analyticsFromState());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/analytics/systemic', (req, res) => {
    try {
        res.json({
            issues: systemicIssuesFromState(),
            generated_at: new Date().toISOString()
        });
    } catch (err) {
        res.json({ issues: [] });
    }
});

// ⬇️ ADDED: New endpoint for per-ticket token lookup
app.get('/api/tickets/:id/tokens', (req, res) => {
    const investigation = investigationFor(req.params.id);
    if (!investigation || !investigation.token_usage) {
        return res.status(404).json({ error: 'No token data for this ticket' });
    }
    res.json(investigation.token_usage);
});

// ⬇️ CHANGED: Capture server reference to set timeouts
const server = app.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(50));
    console.log('GrabResolve Backend Started (No MongoDB!)');
    console.log('='.repeat(50));
    console.log(`Server: http://localhost:${PORT}`);
    console.log(`AI Engine: ${AI_ENGINE}`);
    console.log(`AI Request Timeout: ${AI_REQUEST_TIMEOUT_MS / 1000}s`);
    console.log('='.repeat(50));
    console.log('');
});

// ⬇️ ADDED: Express server-level timeouts
server.timeout = 200000;          // 200s overall
server.keepAliveTimeout = 200000;
server.headersTimeout = 210000;   // must exceed keepAliveTimeout