const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 5000;
const AI_ENGINE = 'http://localhost:8000';

// Middleware
app.use(cors());
app.use(express.json());

// ============================================================
// IN-MEMORY DATABASE (No MongoDB needed!)
// ============================================================

let ticketsDB = [];
let investigationsDB = [];

// ============================================================
// ROUTES
// ============================================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'GrabResolve Backend',
        tickets_count: ticketsDB.length,
        investigations_count: investigationsDB.length
    });
});

// Get all tickets
app.get('/api/tickets', (req, res) => {
    const sorted = [...ticketsDB].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
    res.json(sorted);
});

// Get single ticket
app.get('/api/tickets/:id', (req, res) => {
    const ticket = ticketsDB.find(t => t.ticket_id === req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const investigation = investigationsDB.find(
        i => i.ticket_id === req.params.id
    );

    res.json({ ticket, investigation: investigation || null });
});

// Create new ticket
app.post('/api/tickets', (req, res) => {
    // Check if ticket already exists
    const existing = ticketsDB.find(t => t.ticket_id === req.body.ticket_id);
    if (existing) {
        return res.json(existing);
    }

    const ticket = {
        ...req.body,
        ticket_id: req.body.ticket_id || `TKT-${Date.now()}`,
        status: 'open',
        created_at: new Date().toISOString()
    };
    ticketsDB.push(ticket);
    res.status(201).json(ticket);
});

// 🔥 INVESTIGATE — Main AI Pipeline
app.post('/api/tickets/:id/investigate', async (req, res) => {
    try {
        let ticket = ticketsDB.find(t => t.ticket_id === req.params.id);
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        ticket.status = 'investigating';
        console.log(`\n🔍 Sending ${ticket.ticket_id} to AI Engine...`);

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
            { timeout: 60000 }
        );

        const result = aiResponse.data;

        // Update ticket
        ticket.status = result.status || 'investigated';
        ticket.confidence_score = result.confidence_score;
        ticket.auto_resolved = result.auto_resolved;
        ticket.processing_time = result.processing_time_seconds;
        ticket.resolved_at = new Date().toISOString();

        // Store investigation
        investigationsDB = investigationsDB.filter(
            i => i.ticket_id !== ticket.ticket_id
        );
        investigationsDB.push({
            ticket_id: ticket.ticket_id,
            ...result,
            investigated_at: new Date().toISOString()
        });

        console.log(`✅ ${ticket.ticket_id} → ${ticket.status}`);

        res.json({
            message: 'Investigation complete',
            ticket,
            investigation: result
        });

    } catch (err) {
        console.error(`❌ Error:`, err.message);
        const ticket = ticketsDB.find(t => t.ticket_id === req.params.id);
        if (ticket) ticket.status = 'error';

        res.status(500).json({
            error: 'Investigation failed',
            details: err.message,
            tip: 'Make sure AI Engine is running on port 8000'
        });
    }
});

// Approve resolution
app.post('/api/tickets/:id/approve', (req, res) => {
    const ticket = ticketsDB.find(t => t.ticket_id === req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Not found' });

    ticket.status = 'resolved';
    ticket.approved_by = req.body.agent_name || 'Senior Agent';
    ticket.approved_at = new Date().toISOString();

    res.json({ message: 'Approved', ticket });
});

// Escalate
app.post('/api/tickets/:id/escalate', (req, res) => {
    const ticket = ticketsDB.find(t => t.ticket_id === req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Not found' });

    ticket.status = 'escalated';
    ticket.escalation_reason = req.body.reason || 'Manual escalation';

    res.json({ message: 'Escalated', ticket });
});

// Seed sample tickets
app.post('/api/seed', async (req, res) => {
    try {
        const response = await axios.get(`${AI_ENGINE}/api/sample-tickets`);
        const sampleTickets = response.data;

        ticketsDB = [];
        investigationsDB = [];

        sampleTickets.forEach(t => {
            ticketsDB.push({
                ...t,
                status: 'open',
                created_at: t.timestamp || new Date().toISOString()
            });
        });

        console.log(`📦 Seeded ${ticketsDB.length} tickets`);
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

// Investigate all open tickets
app.post('/api/investigate-all', async (req, res) => {
    const openTickets = ticketsDB.filter(t => t.status === 'open');
    const results = [];

    console.log(`\n🚀 Batch: ${openTickets.length} tickets...\n`);

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
                { timeout: 60000 }
            );

            const result = aiResponse.data;
            ticket.status = result.status || 'investigated';
            ticket.confidence_score = result.confidence_score;
            ticket.auto_resolved = result.auto_resolved;
            ticket.processing_time = result.processing_time_seconds;
            ticket.resolved_at = new Date().toISOString();

            investigationsDB = investigationsDB.filter(
                i => i.ticket_id !== ticket.ticket_id
            );
            investigationsDB.push({
                ticket_id: ticket.ticket_id,
                ...result,
                investigated_at: new Date().toISOString()
            });

            results.push({
                ticket_id: ticket.ticket_id,
                status: ticket.status,
                confidence: result.confidence_score,
                success: true
            });
            console.log(`   ✅ ${ticket.ticket_id} → ${ticket.status}`);

        } catch (err) {
            results.push({
                ticket_id: ticket.ticket_id,
                status: 'error',
                error: err.message,
                success: false
            });
            console.log(`   ❌ ${ticket.ticket_id} → error`);
        }
    }

    res.json({
        message: `Processed ${openTickets.length} tickets`,
        succeeded: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
    });
});

// Analytics
app.get('/api/analytics/overview', async (req, res) => {
    try {
        const total = ticketsDB.length;
        const autoResolved = ticketsDB.filter(t => t.status === 'auto_resolved').length;
        const humanReview = ticketsDB.filter(t => t.status === 'human_review').length;
        const escalated = ticketsDB.filter(t => t.status === 'escalated').length;
        const open = ticketsDB.filter(t => t.status === 'open').length;

        let aiAnalytics = {};
        try {
            const aiResp = await axios.get(`${AI_ENGINE}/api/analytics`);
            aiAnalytics = aiResp.data;
        } catch (e) {}

        res.json({
            local_stats: {
                total_tickets: total,
                open,
                auto_resolved: autoResolved,
                human_review: humanReview,
                escalated,
                auto_resolve_rate: total > 0
                    ? ((autoResolved / total) * 100).toFixed(1) : 0
            },
            ai_analytics: aiAnalytics
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/analytics/systemic', async (req, res) => {
    try {
        const response = await axios.get(`${AI_ENGINE}/api/systemic-issues`);
        res.json(response.data);
    } catch (err) {
        res.json({ issues: [] });
    }
});

// ============================================================
// START
// ============================================================

app.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(50));
    console.log('🟢 GrabResolve Backend Started (No MongoDB!)');
    console.log('='.repeat(50));
    console.log(`📡 Server: http://localhost:${PORT}`);
    console.log(`🤖 AI Engine: ${AI_ENGINE}`);
    console.log('='.repeat(50));
    console.log('');
});