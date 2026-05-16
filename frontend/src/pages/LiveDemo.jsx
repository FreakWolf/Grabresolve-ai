import React, { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import ConfidenceMeter from '../components/ConfidenceMeter';
import EvidenceTrail from '../components/EvidenceTrail';

// ============================================================
// SCENARIO CATEGORIES
// ============================================================

const scenarioCategories = [
    { id: 'original', label: '🎯 Original Demos', description: 'Your original demo scenarios' },
    { id: 'delivery', label: '📸 Delivery + Image Evidence', description: 'GrabFood / GrabMart / GrabExpress with vision validation' },
    { id: 'fraud', label: '🚨 Fraud Detection', description: 'Test the fraud agent' },
    { id: 'policy', label: '📜 Policy Enforcement', description: 'Test policy engine' },
    { id: 'edge', label: '🛡️ Edge Cases', description: 'Driver protection, prohibited actions' },
    { id: 'custom', label: '✍️ Custom', description: 'Type your own ticket' }
];

const sampleScenarios = [
    // ============================================================
    // ORIGINAL DEMOS (5 scenarios)
    // ============================================================
    {
        category: 'original',
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
        category: 'original',
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
        category: 'original',
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
        category: 'original',
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
        category: 'original',
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

    // ============================================================
    // 📸 DELIVERY + IMAGE EVIDENCE (5 scenarios — NEW)
    // ============================================================
    {
        category: 'delivery',
        label: "🍔 Missing Burgers — Vision Validation",
        expectedOutcome: "Vision counts items, validates against receipt → APPROVE refund",
        ticket: {
            ticket_id: "DEMO-1-MISSING-BURGERS",
            subject: "Missing 1 burger from my order",
            description: "I ordered 3 cheeseburgers from Burger Express but only received 2. Order ID ORD-MB-2024. Total paid was $24 for 3 burgers.",
            customer_id: "CUST-LEGIT-001",
            merchant_id: "MERCH-BURGER-001",
            order_id: "ORD-MB-2024",
            category: "missing_items",
            channel: "app",
            country: "Singapore",
            priority: "medium",
            evidence: [
                {
                    id: "EV-MB-001", type: "image", filename: "delivery_bag_photo.jpg",
                    url: "https://i.insider.com/6616e1243f923f7dab066c8f?width=600&format=jpeg&auto=webp",
                    description: "Photo of delivery bag with received burgers",
                    claimed_content: "Bag opened showing exactly 2 burger boxes, no third burger visible",
                    metadata: { uploaded_at: "2025-01-16T18:30:00Z", size_kb: 412 }
                },
                {
                    id: "EV-MB-002", type: "document", filename: "order_receipt.pdf",
                    url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTulUNINdrl1MMevqvYyHqXWRjFzWND2HtOag&s",
                    description: "Original order receipt",
                    claimed_content: "Receipt: 3x Cheeseburger @ $8 each = $24.00, Order ORD-MB-2024",
                    metadata: { uploaded_at: "2025-01-16T18:31:00Z", size_kb: 98 }
                }
            ]
        }
    },
    {
        category: 'delivery',
        label: "🥚 Damaged Groceries — Multi-Image",
        expectedOutcome: "Vision detects broken eggs + leak → APPROVE full refund",
        ticket: {
            ticket_id: "DEMO-2-DAMAGED-GROCERIES",
            subject: "Eggs broken and milk leaked - GrabMart",
            description: "My GrabMart grocery delivery arrived with 6 of 12 eggs broken and the milk carton is leaking. Order ID ORD-GM-5567.",
            customer_id: "CUST-LEGIT-002",
            merchant_id: "MERCH-GROCER-001",
            driver_id: "DRV-CARELESS-001",
            order_id: "ORD-GM-5567",
            category: "damaged_delivery",
            channel: "app",
            country: "Malaysia",
            priority: "high",
            evidence: [
                {
                    id: "EV-GM-001", type: "image", filename: "broken_eggs.jpg",
                    url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRFYbBaiu_v4ony9DCsmiuy6yjoOQXhvCEkpg&s",
                    description: "Photo of egg carton with broken eggs",
                    claimed_content: "Egg carton with 6 of 12 eggs visibly cracked, yolks leaking",
                    metadata: { uploaded_at: "2025-01-16T14:00:00Z", size_kb: 523 }
                },
                {
                    id: "EV-GM-002", type: "image", filename: "leaking_milk.jpg",
                    url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQgfIJ9YeNeU41EiHc8ElZoQrr7Kf4Bh3zYcg&s",
                    description: "Photo of leaking milk carton",
                    claimed_content: "Milk carton with split at bottom, milk pooled in bag",
                    metadata: { uploaded_at: "2025-01-16T14:01:00Z", size_kb: 478 }
                }
            ]
        }
    },
    {
        category: 'delivery',
        label: "💻 Damaged MacBook — High Value",
        expectedOutcome: "Vision confirms damage + invoice → ESCALATE ($2400 > hard cap)",
        ticket: {
            ticket_id: "DEMO-3-EXPRESS-LAPTOP",
            subject: "Laptop arrived damaged via GrabExpress",
            description: "I sent a brand new MacBook Pro (declared value $2400) via GrabExpress with FRAGILE labels. Package arrived with severe dent on corner. Laptop screen is now cracked.",
            customer_id: "CUST-LEGIT-003",
            driver_id: "DRV-CARELESS-001",
            category: "package_damaged",
            channel: "app",
            country: "Malaysia",
            priority: "critical",
            evidence: [
                {
                    id: "EV-EX-001", type: "image", filename: "damaged_box.jpg",
                    url: "https://techcareplus.co.nz/wp-content/uploads/2021/09/1632131359macbook_repair-1200x800.jpg",
                    description: "Photo of damaged shipping box",
                    claimed_content: "Box with severe dent on top-right corner, FRAGILE stickers visible",
                    metadata: { uploaded_at: "2025-01-16T10:00:00Z", size_kb: 645 }
                },
                {
                    id: "EV-EX-002", type: "image", filename: "cracked_laptop.jpg",
                    url: "https://images.unsplash.com/photo-1580927752452-89d86da3fa0a?w=600&q=80",
                    description: "Photo of cracked laptop screen",
                    claimed_content: "MacBook Pro with visible crack across screen",
                    metadata: { uploaded_at: "2025-01-16T10:02:00Z", size_kb: 712 }
                }
            ]
        }
    },
    {
        category: 'delivery',
        label: "🚨 Fake Delivery Proof — Forensics",
        expectedOutcome: "Vision detects location mismatch → BLOCK driver, refund customer",
        ticket: {
            ticket_id: "DEMO-4-FAKE-POD",
            subject: "Driver claimed delivery but I never received package",
            description: "GrabExpress driver marked my package as delivered with a photo, but I have been home all day. The photo doesn't even look like my doorstep.",
            customer_id: "CUST-LEGIT-004",
            driver_id: "DRV-FRAUD-001",
            category: "wrong_delivery",
            channel: "app",
            country: "Singapore",
            priority: "high",
            evidence: [
                {
                    id: "EV-FP-001", type: "image", filename: "drivers_fake_pod_image.jpg",
                    url: "https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=600&q=80",
                    description: "Driver's submitted POD photo (suspicious)",
                    claimed_content: "Generic doorstep - claimed as customer's address but appears different",
                    metadata: { uploaded_at: "2025-01-16T15:30:00Z", size_kb: 89, gps_coordinates: "MISMATCH", edited: true }
                },
                {
                    id: "EV-FP-002", type: "image", filename: "actual_doorstep.jpg",
                    url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80",
                    description: "Customer's actual doorstep for comparison",
                    claimed_content: "Customer's real front door — different background, color, mat",
                    metadata: { uploaded_at: "2025-01-16T16:00:00Z", size_kb: 423 }
                }
            ]
        }
    },
    {
        category: 'delivery',
        label: "⚠️ Spoiled Food — Safety Critical",
        expectedOutcome: "Vision detects mold + ER report → ESCALATE to safety team",
        ticket: {
            ticket_id: "DEMO-5-FOOD-SAFETY",
            subject: "Spoiled food delivered - made me sick",
            description: "Ordered chicken biryani from Spice Garden. Food smelled rotten. Currently in ER getting treatment.",
            customer_id: "CUST-LEGIT-005",
            merchant_id: "MERCH-SPICE-001",
            order_id: "ORD-SP-9988",
            category: "safety_critical",
            channel: "app",
            country: "Singapore",
            priority: "critical",
            evidence: [
                {
                    id: "EV-FS-001", type: "image", filename: "spoiled_biryani.jpg",
                    url: "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=600&q=80",
                    description: "Photo of spoiled biryani with mold",
                    claimed_content: "Biryani with green/black mold spots, discolored chicken",
                    metadata: { uploaded_at: "2025-01-16T20:00:00Z", size_kb: 534 }
                },
                {
                    id: "EV-FS-002", type: "document", filename: "ER_admission_report.pdf",
                    url: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&q=80",
                    description: "Hospital ER admission report",
                    claimed_content: "ER report: Acute gastroenteritis, suspected food poisoning",
                    metadata: { uploaded_at: "2025-01-16T22:00:00Z", size_kb: 1240 }
                },
                {
                    id: "EV-FS-003", type: "image", filename: "container_label.jpg",
                    url: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600&q=80",
                    description: "Food container showing prep time",
                    claimed_content: "Label showing prep time of 14:30 - 5+ hours before delivery",
                    metadata: { uploaded_at: "2025-01-16T20:01:00Z", size_kb: 287 }
                }
            ]
        }
    },

    // ============================================================
    // FRAUD DETECTION (5 scenarios — all preserved)
    // ============================================================
    {
        category: 'fraud',
        label: "🚨 New Account + Big Refund",
        ticket: {
            ticket_id: "DEMO-NEW-FRAUD-001",
            subject: "Refund needed urgently for $80 trip",
            description: "The driver was rude and the trip was bad. I want a full refund for the $80 I paid.",
            customer_id: "CUST-NEW-FRAUD-001",
            trip_id: "TRIP-FAKE-001",
            category: "refund_delay",
            channel: "app",
            country: "Singapore"
        }
    },
    {
        category: 'fraud',
        label: "🚨 High Velocity (7 tickets/24h)",
        ticket: {
            ticket_id: "DEMO-VELOCITY-001",
            subject: "Another fare problem today",
            description: "Same as my other tickets today, fare was wrong again.",
            customer_id: "CUST-VELOCITY-001",
            trip_id: "TRIP-004",
            category: "fare_dispute",
            channel: "app",
            country: "Malaysia"
        }
    },
    {
        category: 'fraud',
        label: "🚨 Repeat Pattern (4th same complaint)",
        ticket: {
            ticket_id: "DEMO-REPEAT-001",
            subject: "Fare dispute again",
            description: "Driver took a longer route, I want a refund.",
            customer_id: "CUST-REPEAT-001",
            trip_id: "TRIP-005",
            driver_id: "DRV-003",
            category: "fare_dispute",
            channel: "app",
            country: "Singapore"
        }
    },
    {
        category: 'fraud',
        label: "🚨 CRITICAL — All Red Flags",
        ticket: {
            ticket_id: "DEMO-CRITICAL-FRAUD-001",
            subject: "URGENT - need refund of $300 NOW",
            description: "Driver scammed me, refund $300 immediately or I will report Grab to authorities!",
            customer_id: "CUST-FRAUD-CRITICAL-001",
            trip_id: "TRIP-FAKE-002",
            category: "refund_delay",
            channel: "app",
            country: "Singapore"
        }
    },
    {
        category: 'fraud',
        label: "🟡 Previously Flagged (Recovered)",
        ticket: {
            ticket_id: "DEMO-FLAGGED-RECOVERY-001",
            subject: "Payment didn't go through",
            description: "My GrabPay shows payment pending for over an hour for trip yesterday.",
            customer_id: "CUST-FLAGGED-001",
            trip_id: "TRIP-008",
            category: "payment_issue",
            channel: "app",
            country: "Singapore"
        }
    },

    // ============================================================
    // POLICY ENFORCEMENT (6 scenarios — all preserved)
    // ============================================================
    {
        category: 'policy',
        label: "📜 Refund > Auto-Cap ($250 SGD)",
        ticket: {
            ticket_id: "DEMO-LARGE-REFUND-001",
            subject: "Major double-charge issue - $250",
            description: "GrabPay charged me twice for the same trip. I see two transactions of $125 each on my statement for the same ride.",
            customer_id: "CUST-LARGE-REFUND-001",
            trip_id: "TRIP-009",
            category: "payment_issue",
            channel: "app",
            country: "Singapore"
        }
    },
    {
        category: 'policy',
        label: "📜 Refund > Hard Cap ($800 SGD)",
        ticket: {
            ticket_id: "DEMO-HUGE-REFUND-001",
            subject: "Need $800 refund - mistakenly charged",
            description: "I was charged $800 for what should have been a $20 trip. System glitch.",
            customer_id: "CUST-LEGIT-001",
            trip_id: "TRIP-010",
            category: "payment_issue",
            channel: "app",
            country: "Singapore"
        }
    },
    {
        category: 'policy',
        label: "📜 Cooldown Violation (3h ago)",
        ticket: {
            ticket_id: "DEMO-COOLDOWN-001",
            subject: "Need another refund",
            description: "I had another bad trip just now, please refund $20.",
            customer_id: "CUST-COOLDOWN-001",
            trip_id: "TRIP-006",
            category: "refund_delay",
            channel: "app",
            country: "Singapore"
        }
    },
    {
        category: 'policy',
        label: "📜 Monthly Refund Limit (5/month)",
        ticket: {
            ticket_id: "DEMO-MONTHLY-MAX-001",
            subject: "Sixth refund this month",
            description: "I had another payment issue, please refund $35.",
            customer_id: "CUST-MONTHLY-MAX-001",
            trip_id: "TRIP-007",
            category: "payment_issue",
            channel: "app",
            country: "Indonesia"
        }
    },
    {
        category: 'policy',
        label: "📜 Missing Required Data",
        ticket: {
            ticket_id: "DEMO-MISSING-DATA-001",
            subject: "Refund for trip yesterday",
            description: "Need refund for my trip but I don't remember the trip ID.",
            customer_id: "CUST-LEGIT-001",
            category: "fare_dispute",
            channel: "app",
            country: "Singapore"
        }
    },
    {
        category: 'policy',
        label: "📜 Account Issue — Never Auto",
        ticket: {
            ticket_id: "DEMO-ACCOUNT-001",
            subject: "Someone is using my account",
            description: "I see trips on my account that I didn't take. My account may be hacked.",
            customer_id: "CUST-LEGIT-001",
            category: "account_issue",
            channel: "app",
            country: "Singapore"
        }
    },

    // ============================================================
    // EDGE CASES (4 scenarios — all preserved)
    // ============================================================
    {
        category: 'edge',
        label: "🛡️ Driver Behavior — Always Human",
        ticket: {
            ticket_id: "DEMO-DRIVER-COMPLAINT-001",
            subject: "Driver was extremely rude",
            description: "The driver yelled at me when I asked him to use the AC. Very unprofessional behavior.",
            customer_id: "CUST-DRIVER-COMPLAINT-001",
            trip_id: "TRIP-011",
            driver_id: "DRV-LOW-RATING-001",
            category: "driver_behavior",
            channel: "app",
            country: "Singapore"
        }
    },
    {
        category: 'edge',
        label: "🛡️ Protect 4.8★ Driver",
        ticket: {
            ticket_id: "DEMO-DRIVER-PROTECTED-001",
            subject: "Driver complaint - want him suspended",
            description: "This driver is the worst, please suspend him from the platform!",
            customer_id: "CUST-LEGIT-001",
            trip_id: "TRIP-012",
            driver_id: "DRV-PROTECTED-001",
            category: "driver_behavior",
            channel: "app",
            country: "Singapore"
        }
    },
    {
        category: 'edge',
        label: "🚫 Prohibited Action (Police Report)",
        ticket: {
            ticket_id: "DEMO-PROHIBITED-001",
            subject: "I want a permanent ban for this driver",
            description: "Please permanently ban this driver and file a police report against them.",
            customer_id: "CUST-LEGIT-001",
            trip_id: "TRIP-013",
            driver_id: "DRV-002",
            category: "driver_behavior",
            channel: "app",
            country: "Singapore"
        }
    },
    {
        category: 'edge',
        label: "✅ VIP — Fast Auto-Resolve",
        ticket: {
            ticket_id: "DEMO-VIP-SMALL-001",
            subject: "Minor fare discrepancy",
            description: "Trip cost slightly more than estimate. Charged $12 instead of $10.",
            customer_id: "CUST-VIP-001",
            trip_id: "TRIP-002",
            driver_id: "DRV-002",
            category: "fare_dispute",
            channel: "app",
            country: "Singapore"
        }
    },

    // ============================================================
    // CUSTOM
    // ============================================================
    {
        category: 'custom',
        label: "✍️ Custom Ticket (Type Your Own)",
        ticket: null
    }
];

const STEP_SEQUENCE = [
    { msg: "🧠 Step 1: Classifying ticket...", delay: 500 },
    { msg: "🔍 Step 2: Querying data sources + fraud check...", delay: 1500 },
    { msg: "📊 Step 2: Analyzing trip data, driver profile, customer history...", delay: 2500 },
    { msg: "🛡️ Step 2: Running fraud detection algorithms...", delay: 3500 },
    { msg: "👁️  Step 2.5: Vision-based evidence validation...", delay: 4500 },
    { msg: "🎯 Step 3: Running root cause analysis...", delay: 6000 },
    { msg: "⚡ Step 4: Generating resolution proposal...", delay: 7000 },
    { msg: "📜 Step 5: Validating against strict policies...", delay: 8000 },
    { msg: "✅ Finalizing decision...", delay: 9000 }
];

function statusPresentation(status, blockedByPolicy) {
    if (blockedByPolicy) {
        return { icon: '🚫', title: 'BLOCKED BY POLICY', bannerClass: 'bg-red-100 border-2 border-red-300' };
    }
    switch (status) {
        case 'auto_resolved':
            return { icon: '✅', title: 'Ticket Auto-Resolved by AI!', bannerClass: 'bg-green-50 border-2 border-green-200' };
        case 'human_review':
            return { icon: '🟡', title: 'AI Recommends — Needs Human Review', bannerClass: 'bg-yellow-50 border-2 border-yellow-200' };
        case 'escalated':
            return { icon: '🔴', title: 'Escalated to Senior Agent', bannerClass: 'bg-red-50 border-2 border-red-200' };
        case 'blocked':
            return { icon: '🚫', title: 'BLOCKED — Policy Violation', bannerClass: 'bg-red-100 border-2 border-red-300' };
        default:
            return { icon: '🔵', title: 'Investigation Completed', bannerClass: 'bg-blue-50 border-2 border-blue-200' };
    }
}

function fraudPresentation(score) {
    if (score >= 0.80) return { color: 'text-red-700', bg: 'bg-red-100', icon: '🚨' };
    if (score >= 0.60) return { color: 'text-red-600', bg: 'bg-red-50', icon: '⚠️' };
    if (score >= 0.40) return { color: 'text-orange-600', bg: 'bg-orange-50', icon: '⚠️' };
    if (score >= 0.20) return { color: 'text-yellow-600', bg: 'bg-yellow-50', icon: '⚡' };
    return { color: 'text-green-600', bg: 'bg-green-50', icon: '✅' };
}

function evidencePresentation(supportsClaim, credibility) {
    if (supportsClaim === 'contradicts' || credibility === 'suspicious') {
        return { color: 'text-red-700', bg: 'bg-red-50 border-red-300', icon: '🚨', label: 'Evidence Contradicts Claim' };
    }
    if (supportsClaim === 'supports' && credibility === 'high') {
        return { color: 'text-green-700', bg: 'bg-green-50 border-green-300', icon: '✅', label: 'Evidence Supports Claim' };
    }
    if (supportsClaim === 'partial') {
        return { color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-300', icon: '⚠️', label: 'Partially Supported' };
    }
    if (supportsClaim === 'no_evidence') {
        return { color: 'text-gray-600', bg: 'bg-gray-50 border-gray-300', icon: '📭', label: 'No Evidence Provided' };
    }
    return { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-300', icon: '🔍', label: 'Inconclusive' };
}

function credibilityColor(credibility) {
    const map = {
        high: 'bg-green-100 text-green-700',
        medium: 'bg-yellow-100 text-yellow-700',
        low: 'bg-orange-100 text-orange-700',
        suspicious: 'bg-red-100 text-red-700',
        could_not_verify: 'bg-gray-100 text-gray-600'
    };
    return map[credibility] || 'bg-gray-100 text-gray-600';
}

// ============================================================
// EVIDENCE THUMBNAIL GRID
// ============================================================
function EvidenceThumbnailGrid({ evidence, highlightIndex = -1, compact = false }) {
    if (!evidence || evidence.length === 0) return null;
    const sizeClass = compact ? 'h-16 w-16' : 'h-24 w-24';

    return (
        <div className="flex flex-wrap gap-2 mt-2">
            {evidence.map((ev, i) => (
                <div
                    key={ev.id || i}
                    className={`relative ${sizeClass} rounded-lg overflow-hidden border-2 transition-all ${
                        highlightIndex === i
                            ? 'border-grab-green ring-2 ring-grab-green animate-pulse'
                            : 'border-gray-200'
                    }`}
                    title={`${ev.filename}: ${ev.description}`}
                >
                    <img
                        src={ev.url}
                        alt={ev.filename}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate">
                        {ev.type === 'document' ? '📄' : '📷'} {ev.filename.slice(0, 12)}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ============================================================
// EVIDENCE VALIDATION CARD
// ============================================================
function EvidenceValidationCard({ evidenceValidation, originalEvidence }) {
    if (!evidenceValidation) return null;
    const presentation = evidencePresentation(
        evidenceValidation.supports_claim,
        evidenceValidation.overall_credibility
    );
    const validations = evidenceValidation.validations || [];
    const originalById = {};
    (originalEvidence || []).forEach(ev => { originalById[ev.id] = ev; });

    return (
        <div className={`rounded-xl p-6 shadow-sm border-2 ${presentation.bg}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    👁️ Vision Evidence Validation
                </h3>
                <div className={`text-lg font-bold ${presentation.color} flex items-center gap-2`}>
                    {presentation.icon} {presentation.label}
                </div>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-white/60 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500">Evidence Items</div>
                    <div className="text-2xl font-bold text-gray-800">{evidenceValidation.evidence_count || 0}</div>
                </div>
                <div className="bg-white/60 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500">Credibility</div>
                    <div className="text-2xl font-bold text-gray-800">
                        {((evidenceValidation.credibility_score || 0) * 100).toFixed(0)}%
                    </div>
                </div>
                <div className="bg-white/60 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500">Suspicious</div>
                    <div className={`text-2xl font-bold ${
                        evidenceValidation.suspicious_count > 0 ? 'text-red-600' : 'text-gray-800'
                    }`}>
                        {evidenceValidation.suspicious_count || 0}
                    </div>
                </div>
                <div className="bg-white/60 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500">Red Flags</div>
                    <div className={`text-2xl font-bold ${
                        (evidenceValidation.red_flags || []).length > 0 ? 'text-orange-600' : 'text-gray-800'
                    }`}>
                        {(evidenceValidation.red_flags || []).length}
                    </div>
                </div>
            </div>

            {evidenceValidation.ai_summary && (
                <div className="bg-white/80 rounded-lg p-3 mb-4 text-sm text-gray-700">
                    <span className="font-semibold">🤖 AI Vision Analysis:</span> {evidenceValidation.ai_summary}
                </div>
            )}

            {validations.length > 0 && (
                <div className="space-y-3">
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Per-Image Vision Analysis:
                    </div>
                    {validations.map((v, i) => {
                        const url = v.url || originalById[v.evidence_id]?.url;
                        return (
                            <div key={i} className="bg-white rounded-lg p-3 border border-gray-200">
                                <div className="flex gap-3">
                                    {url && (
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                                            <img
                                                src={url}
                                                alt={v.filename}
                                                className="h-24 w-24 object-cover rounded-lg border border-gray-200 hover:border-grab-green transition"
                                                onError={(e) => { e.target.style.display = 'none'; }}
                                            />
                                        </a>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <div className="text-sm font-semibold text-gray-800 truncate">
                                                {v.type === 'document' ? '📄' : '📷'} {v.filename}
                                            </div>
                                            <span className={`text-xs px-2 py-0.5 rounded font-semibold ${credibilityColor(v.credibility)}`}>
                                                {v.credibility}
                                            </span>
                                        </div>
                                        {v.image_describes && (
                                            <div className="text-xs text-gray-600 mb-2 italic">
                                                <span className="font-semibold not-italic">AI sees:</span> "{v.image_describes}"
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 mb-2 text-xs">
                                            <span className="text-gray-500">Supports claim:</span>
                                            <span className={`font-semibold ${
                                                v.supports_claim === 'yes' ? 'text-green-600' :
                                                v.supports_claim === 'no' ? 'text-red-600' :
                                                v.supports_claim === 'partial' ? 'text-yellow-600' : 'text-gray-600'
                                            }`}>
                                                {v.supports_claim?.toUpperCase()}
                                            </span>
                                            <span className="text-gray-400">•</span>
                                            <span className="text-gray-500">Confidence:</span>
                                            <span className="font-semibold text-gray-700">
                                                {((v.confidence || 0) * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                        {v.key_observations && v.key_observations.length > 0 && (
                                            <div className="text-xs text-gray-700 mb-1">
                                                <span className="font-semibold">Observations:</span>{' '}
                                                {v.key_observations.slice(0, 2).join(' • ')}
                                            </div>
                                        )}
                                        {v.red_flags && v.red_flags.length > 0 && (
                                            <div className="text-xs text-red-600 mt-1">
                                                <span className="font-semibold">⚠️ Red flags:</span>{' '}
                                                {v.red_flags.slice(0, 2).join(' • ')}
                                            </div>
                                        )}
                                        {v.verdict && (
                                            <div className="text-xs text-gray-800 mt-1 bg-gray-50 rounded p-1.5">
                                                <span className="font-semibold">Verdict:</span> {v.verdict}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {evidenceValidation.red_flags && evidenceValidation.red_flags.length > 0 && (
                <div className="mt-4 bg-orange-50 border-l-4 border-orange-400 p-3 rounded">
                    <div className="text-xs font-semibold text-orange-700 mb-1">⚠️ Critical Red Flags</div>
                    <ul className="text-xs text-orange-800 space-y-1">
                        {evidenceValidation.red_flags.slice(0, 5).map((flag, i) => (
                            <li key={i}>• {flag}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
function LiveDemo() {
    const [activeCategory, setActiveCategory] = useState('original');
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
    const [activeImageIndex, setActiveImageIndex] = useState(-1);
    const timeoutRefs = useRef([]);
    const imageCarouselRef = useRef(null);

    useEffect(() => {
        return () => {
            timeoutRefs.current.forEach(timeoutId => window.clearTimeout(timeoutId));
            if (imageCarouselRef.current) clearInterval(imageCarouselRef.current);
        };
    }, []);

    const resetTimers = () => {
        timeoutRefs.current.forEach(timeoutId => window.clearTimeout(timeoutId));
        timeoutRefs.current = [];
        if (imageCarouselRef.current) {
            clearInterval(imageCarouselRef.current);
            imageCarouselRef.current = null;
        }
    };

    const queueSteps = (evidence) => {
        resetTimers();
        STEP_SEQUENCE.forEach(({ msg, delay }) => {
            const timeoutId = window.setTimeout(() => {
                setStepMessages(prev => [...prev, msg]);
            }, delay);
            timeoutRefs.current.push(timeoutId);
        });

        if (evidence && evidence.length > 0) {
            const carouselStart = window.setTimeout(() => {
                let idx = 0;
                setActiveImageIndex(0);
                imageCarouselRef.current = setInterval(() => {
                    idx = (idx + 1) % evidence.length;
                    setActiveImageIndex(idx);
                }, 800);
            }, 4500);
            timeoutRefs.current.push(carouselStart);

            const carouselStop = window.setTimeout(() => {
                if (imageCarouselRef.current) {
                    clearInterval(imageCarouselRef.current);
                    imageCarouselRef.current = null;
                }
                setActiveImageIndex(-1);
            }, 6500);
            timeoutRefs.current.push(carouselStop);
        }
    };

    const handleInvestigate = async (ticketData) => {
        setInvestigating(true);
        setResult(null);
        setStepMessages([]);
        setActiveImageIndex(-1);
        queueSteps(ticketData.evidence);

        try {
            await api.createTicket(ticketData).catch(() => {});
            const res = await api.investigate(ticketData.ticket_id, ticketData);
            setResult(res.data);
        } catch (err) {
            setStepMessages(prev => [
                ...prev,
                `❌ Error: ${err.message}. Make sure AI Engine (port 8000) and Backend (port 5000) are running.`
            ]);
        } finally {
            setInvestigating(false);
            setActiveImageIndex(-1);
            if (imageCarouselRef.current) {
                clearInterval(imageCarouselRef.current);
                imageCarouselRef.current = null;
            }
        }
    };

    const handleScenarioSelect = (scenario) => {
        resetTimers();
        setSelectedScenario(scenario);
        setResult(null);
        setStepMessages([]);
        setActiveImageIndex(-1);
    };

    const handleCategoryChange = (categoryId) => {
        setActiveCategory(categoryId);
        setSelectedScenario(null);
        setResult(null);
        setStepMessages([]);
    };

    const filteredScenarios = sampleScenarios.filter(s => s.category === activeCategory);

    const investigation = result?.investigation;
    const evidenceValidation = result?.evidence_validation || investigation?.evidence_validation;
    const fraudAssessment = result?.fraud_assessment || investigation?.fraud_assessment;
    const policyEvaluation = result?.policy_evaluation || investigation?.policy_evaluation;
    const blockedByPolicy = result?.blocked_by_policy || investigation?.blocked_by_policy;
    const finalStatus = result?.ticket?.status || investigation?.resolution?.status || 'completed';
    const presentation = statusPresentation(finalStatus, blockedByPolicy);
    const sourceCount = investigation?.investigation?.data_sources?.length || 0;
    const findings = investigation?.investigation?.findings || [];
    const refundCurrency = investigation?.resolution?.refund_currency || 'SGD';

    const currentTicket = selectedScenario?.ticket || customTicket;
    const currentEvidence = currentTicket?.evidence || [];

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800">
                    🚀 Live Demo — GrabResolve AI v2.3
                </h1>
                <p className="text-gray-500 mt-1">
                    Watch AI investigate, validate images with vision, detect fraud, enforce policies
                </p>
            </div>

            {/* Category Tabs */}
            <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
                <div className="flex flex-wrap gap-2">
                    {scenarioCategories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => handleCategoryChange(cat.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                                activeCategory === cat.id
                                    ? 'bg-grab-green text-white shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    {scenarioCategories.find(c => c.id === activeCategory)?.description}
                </p>
            </div>

            {/* Scenario Cards */}
            <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
                <h2 className="font-bold text-gray-800 mb-4">Choose a Scenario:</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredScenarios.map((scenario, i) => (
                        <button
                            key={i}
                            onClick={() => handleScenarioSelect(scenario)}
                            className={`p-4 rounded-lg text-left transition-all border-2 ${
                                selectedScenario === scenario
                                    ? 'border-grab-green bg-green-50 shadow-md'
                                    : 'border-gray-200 hover:border-grab-green hover:bg-gray-50'
                            }`}
                        >
                            <div className="text-sm font-semibold text-gray-800">{scenario.label}</div>
                            {scenario.expectedOutcome && (
                                <div className="text-xs text-gray-600 mt-1 font-medium">
                                    Expected: {scenario.expectedOutcome}
                                </div>
                            )}
                            {scenario.ticket && (
                                <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                                    {scenario.ticket.description}
                                </div>
                            )}
                            {scenario.ticket?.evidence && scenario.ticket.evidence.length > 0 && (
                                <div className="mt-2">
                                    <div className="text-[10px] text-purple-600 font-semibold mb-1">
                                        📸 {scenario.ticket.evidence.length} evidence items
                                    </div>
                                    <EvidenceThumbnailGrid evidence={scenario.ticket.evidence} compact={true} />
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Custom Ticket Form */}
            {selectedScenario && !selectedScenario.ticket && (
                <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
                    <h3 className="font-bold text-gray-800 mb-4">✍️ Enter Custom Ticket</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm text-gray-600 font-medium">Subject</label>
                            <input
                                type="text"
                                value={customTicket.subject}
                                onChange={e => setCustomTicket({ ...customTicket, subject: e.target.value })}
                                className="w-full border rounded-lg p-3 mt-1 text-sm"
                                placeholder="e.g., Overcharged for GrabCar ride"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-600 font-medium">Country</label>
                            <select
                                value={customTicket.country}
                                onChange={e => setCustomTicket({ ...customTicket, country: e.target.value })}
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
                                onChange={e => setCustomTicket({ ...customTicket, description: e.target.value })}
                                className="w-full border rounded-lg p-3 mt-1 text-sm"
                                rows={3}
                                placeholder="Describe the issue in detail..."
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-600 font-medium">Customer ID</label>
                            <input
                                type="text"
                                value={customTicket.customer_id}
                                onChange={e => setCustomTicket({ ...customTicket, customer_id: e.target.value })}
                                className="w-full border rounded-lg p-3 mt-1 text-sm"
                                placeholder="e.g., CUST-LEGIT-001"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-600 font-medium">Trip ID (optional)</label>
                            <input
                                type="text"
                                value={customTicket.trip_id}
                                onChange={e => setCustomTicket({ ...customTicket, trip_id: e.target.value })}
                                className="w-full border rounded-lg p-3 mt-1 text-sm"
                                placeholder="e.g., TRIP-99281"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-600 font-medium">Driver ID (optional)</label>
                            <input
                                type="text"
                                value={customTicket.driver_id}
                                onChange={e => setCustomTicket({ ...customTicket, driver_id: e.target.value })}
                                className="w-full border rounded-lg p-3 mt-1 text-sm"
                                placeholder="e.g., DRIVER-4432"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-600 font-medium">Category</label>
                            <select
                                value={customTicket.category}
                                onChange={e => setCustomTicket({ ...customTicket, category: e.target.value })}
                                className="w-full border rounded-lg p-3 mt-1 text-sm"
                            >
                                <option value="">Auto-detect</option>
                                <option value="fare_dispute">Fare Dispute</option>
                                <option value="payment_issue">Payment Issue</option>
                                <option value="missing_items">Missing Items</option>
                                <option value="damaged_delivery">Damaged Delivery</option>
                                <option value="package_damaged">Package Damaged</option>
                                <option value="wrong_delivery">Wrong Delivery</option>
                                <option value="safety_critical">Safety Critical</option>
                                <option value="refund_delay">Refund Delay</option>
                                <option value="driver_behavior">Driver Behavior</option>
                                <option value="account_issue">Account Issue</option>
                                <option value="delivery_issue">Delivery Issue</option>
                                <option value="cancellation_fee">Cancellation Fee</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* Selected Ticket Preview */}
            {selectedScenario && (
                <div className="bg-gradient-to-r from-grab-dark to-gray-800 rounded-xl p-6 shadow-sm mb-6 text-white">
                    <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                            <h3 className="font-bold text-grab-green mb-2">Selected Ticket Preview:</h3>
                            <div className="text-sm font-semibold mb-1">
                                {selectedScenario.ticket
                                    ? selectedScenario.ticket.subject
                                    : customTicket.subject || 'Enter details above'}
                            </div>
                            <div className="text-xs text-gray-400 mb-2">
                                {selectedScenario.ticket
                                    ? selectedScenario.ticket.description
                                    : customTicket.description || 'Enter description above'}
                            </div>
                            {selectedScenario.expectedOutcome && (
                                <div className="text-xs bg-yellow-900/40 text-yellow-200 px-3 py-1 rounded inline-block mb-2">
                                    Expected: {selectedScenario.expectedOutcome}
                                </div>
                            )}
                            {currentEvidence.length > 0 && (
                                <div className="mt-3 bg-black/30 rounded-lg p-3">
                                    <div className="text-xs text-purple-300 font-semibold mb-2">
                                        📸 Attached Evidence ({currentEvidence.length} items) — will be analyzed by Vision AI:
                                    </div>
                                    <EvidenceThumbnailGrid evidence={currentEvidence} />
                                </div>
                            )}
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
                            className="bg-grab-green text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-green-600 transition disabled:opacity-50 flex-shrink-0 pulse-green"
                        >
                            {investigating ? '🔍 Investigating...' : '🚀 Run AI Investigation'}
                        </button>
                    </div>
                </div>
            )}

            {/* Console Output WITH LIVE IMAGE CAROUSEL */}
            {stepMessages.length > 0 && (
                <div className="bg-gray-900 rounded-xl p-6 shadow-sm mb-6 font-mono">
                    <div className="flex justify-between items-start gap-4 mb-3">
                        <h3 className="text-grab-green font-bold text-sm">
                            🖥️ Live Investigation Console:
                        </h3>
                        {currentEvidence.length > 0 && activeImageIndex >= 0 && (
                            <div className="bg-purple-900/40 border border-purple-500 rounded-lg p-2">
                                <div className="text-xs text-purple-300 font-semibold mb-1">
                                    👁️ Vision AI is analyzing:
                                </div>
                                <EvidenceThumbnailGrid
                                    evidence={currentEvidence}
                                    highlightIndex={activeImageIndex}
                                    compact={true}
                                />
                                <div className="text-xs text-purple-200 mt-1">
                                    {currentEvidence[activeImageIndex]?.filename}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="space-y-2">
                        {stepMessages.map((msg, i) => (
                            <div key={i} className="text-sm text-gray-300 fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
                                <span className="text-gray-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
                                {msg}
                            </div>
                        ))}
                        {investigating && (
                            <div className="text-yellow-400 text-sm mt-2">⏳ Waiting for AI response...</div>
                        )}
                    </div>
                </div>
            )}

            {/* Results */}
            {result && investigation && (
                <div className="space-y-6 fade-in">
                    <div className={`rounded-xl p-6 shadow-sm ${presentation.bannerClass}`}>
                        <div className="flex items-center gap-4">
                            <div className="text-5xl">{presentation.icon}</div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">{presentation.title}</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    Processed in {investigation.processing_time_seconds}s |
                                    Confidence: {((investigation.confidence_score || 0) * 100).toFixed(0)}% |
                                    Sources: {sourceCount}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm">
                        <ConfidenceMeter score={investigation.confidence_score || 0} />
                    </div>

                    {evidenceValidation && (
                        <EvidenceValidationCard
                            evidenceValidation={evidenceValidation}
                            originalEvidence={currentEvidence}
                        />
                    )}

                    {fraudAssessment && (
                        <div className={`rounded-xl p-6 shadow-sm ${fraudPresentation(fraudAssessment.fraud_score).bg}`}>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-gray-800">🛡️ Fraud Assessment</h3>
                                <div className={`text-2xl font-bold ${fraudPresentation(fraudAssessment.fraud_score).color}`}>
                                    {fraudPresentation(fraudAssessment.fraud_score).icon} {(fraudAssessment.fraud_score * 100).toFixed(0)}%
                                </div>
                            </div>
                            <div className="text-sm text-gray-700 mb-2">
                                <span className="font-semibold">Risk Level:</span> {fraudAssessment.risk_level?.toUpperCase()}
                            </div>
                            {fraudAssessment.risk_factors && fraudAssessment.risk_factors.length > 0 && (
                                <div className="mt-3">
                                    <div className="text-xs font-semibold text-gray-600 mb-2">Risk Factors:</div>
                                    <div className="space-y-1">
                                        {fraudAssessment.risk_factors.map((factor, i) => (
                                            <div key={i} className="text-xs bg-white/60 rounded p-2">
                                                <span className="font-semibold">{factor.factor}:</span> {factor.detail}
                                                <span className="ml-2 text-gray-500">(weight: {factor.weight})</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {fraudAssessment.recommendation && (
                                <div className="mt-3 text-sm font-semibold text-gray-800 bg-white/60 rounded p-3">
                                    💡 {fraudAssessment.recommendation}
                                </div>
                            )}
                        </div>
                    )}

                    {policyEvaluation && (
                        <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-purple-200">
                            <h3 className="font-bold text-gray-800 mb-3">📜 Policy Engine Evaluation</h3>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div className="bg-purple-50 rounded-lg p-3">
                                    <div className="text-xs text-purple-500">Decision</div>
                                    <div className="text-lg font-bold text-purple-700 uppercase">
                                        {policyEvaluation.decision || 'unknown'}
                                    </div>
                                </div>
                                <div className="bg-purple-50 rounded-lg p-3">
                                    <div className="text-xs text-purple-500">Violations</div>
                                    <div className="text-lg font-bold text-purple-700">
                                        {policyEvaluation.violations_count || 0}
                                    </div>
                                </div>
                            </div>
                            {policyEvaluation.violations && policyEvaluation.violations.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-xs font-semibold text-gray-600">Policy Violations:</div>
                                    {policyEvaluation.violations.map((v, i) => (
                                        <div
                                            key={i}
                                            className={`p-3 rounded text-sm ${
                                                v.severity === 'critical' ? 'bg-red-50 border-l-4 border-red-400' :
                                                v.severity === 'high' ? 'bg-orange-50 border-l-4 border-orange-400' :
                                                v.severity === 'medium' ? 'bg-yellow-50 border-l-4 border-yellow-400' :
                                                'bg-blue-50 border-l-4 border-blue-400'
                                            }`}
                                        >
                                            <div className="font-semibold text-gray-800">{v.rule}</div>
                                            <div className="text-xs text-gray-600 mt-1">{v.message}</div>
                                            <div className="text-xs text-gray-700 mt-1 italic">→ {v.suggested_action}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {policyEvaluation.final_action && (
                                <div className="mt-3 text-sm font-semibold text-gray-800 bg-gray-50 rounded p-3">
                                    🎯 Final action: {policyEvaluation.final_action}
                                </div>
                            )}
                        </div>
                    )}

                    {result.token_usage && (
                        <div className="bg-white rounded-xl p-6 shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-3">💰 Token Usage</h3>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-blue-50 rounded-lg p-3">
                                    <div className="text-xs text-blue-500">Total Tokens</div>
                                    <div className="text-lg font-bold text-blue-700">
                                        {result.token_usage.total_tokens?.toLocaleString() || 0}
                                    </div>
                                </div>
                                <div className="bg-green-50 rounded-lg p-3">
                                    <div className="text-xs text-green-500">Input</div>
                                    <div className="text-lg font-bold text-green-700">
                                        {result.token_usage.input_tokens?.toLocaleString() || 0}
                                    </div>
                                </div>
                                <div className="bg-orange-50 rounded-lg p-3">
                                    <div className="text-xs text-orange-500">Output</div>
                                    <div className="text-lg font-bold text-orange-700">
                                        {result.token_usage.output_tokens?.toLocaleString() || 0}
                                    </div>
                                </div>
                            </div>
                            {result.token_usage.breakdown_by_agent && (
                                <div className="mt-3 space-y-1">
                                    {result.token_usage.breakdown_by_agent.map((call, i) => (
                                        <div key={i} className="text-xs text-gray-600 flex justify-between bg-gray-50 rounded p-2">
                                            <span className="font-mono">{call.agent}</span>
                                            <span>{call.prompt_tokens} in / {call.completion_tokens} out</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {investigation.classification && (
                            <div className="bg-white rounded-xl p-6 shadow-sm">
                                <h3 className="font-bold text-gray-800 mb-4">🧠 AI Classification</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {Object.entries(investigation.classification).map(([key, value]) => (
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

                        {investigation.root_cause && (
                            <div className="bg-white rounded-xl p-6 shadow-sm">
                                <h3 className="font-bold text-gray-800 mb-4">🎯 Root Cause</h3>
                                <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded mb-3">
                                    <div className="text-sm font-bold text-red-700">
                                        {investigation.root_cause.primary_cause}
                                    </div>
                                </div>
                                {investigation.root_cause.evidence_summary && (
                                    <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                                        {investigation.root_cause.evidence_summary}
                                    </div>
                                )}
                            </div>
                        )}

                        {investigation.resolution && (
                            <div className="bg-white rounded-xl p-6 shadow-sm">
                                <h3 className="font-bold text-gray-800 mb-4">⚡ AI Resolution</h3>
                                <div className={`border-l-4 p-4 rounded mb-3 ${
                                    blockedByPolicy ? 'bg-red-50 border-red-400' : 'bg-green-50 border-green-400'
                                }`}>
                                    <div className={`text-sm font-bold ${
                                        blockedByPolicy ? 'text-red-700' : 'text-green-700'
                                    }`}>
                                        {investigation.resolution.action}
                                    </div>
                                </div>
                                {investigation.resolution.refund_amount && (
                                    <div className="bg-orange-50 p-3 rounded mb-3">
                                        <span className="text-xs text-orange-500">Refund: </span>
                                        <span className="text-lg font-bold text-orange-600">
                                            {refundCurrency} {investigation.resolution.refund_amount}
                                        </span>
                                    </div>
                                )}
                                {investigation.resolution.customer_message && (
                                    <div className="bg-blue-50 p-3 rounded">
                                        <div className="text-xs text-blue-500 font-semibold mb-1">📧 Customer Message:</div>
                                        <div className="text-sm text-blue-700 italic">
                                            "{investigation.resolution.customer_message}"
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="bg-white rounded-xl p-6 shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-4">🔍 Key Findings</h3>
                            {findings.length === 0 ? (
                                <div className="text-sm text-gray-500 bg-gray-50 rounded p-3">
                                    No structured findings detected.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {findings.map((finding, i) => (
                                        <div key={i} className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded text-sm text-blue-700">
                                            {finding}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {investigation.evidence_trail && (
                        <div className="bg-white rounded-xl p-6 shadow-sm">
                            <EvidenceTrail evidence={investigation.evidence_trail} />
                        </div>
                    )}
                </div>
            )}

            {!selectedScenario && (
                <div className="bg-white rounded-xl p-10 text-center shadow-sm">
                    <div className="text-6xl mb-4">👆</div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Select a Scenario Above</h3>
                    <p className="text-gray-500">
                        Choose a scenario category and ticket to watch GrabResolve AI investigate
                    </p>
                </div>
            )}
        </div>
    );
}

export default LiveDemo;