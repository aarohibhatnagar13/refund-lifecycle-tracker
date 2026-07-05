const express = require('express');
const router = express.Router();
const refundService = require('../services/refundService');
const { InvalidTransitionError, ConflictError, NotFoundError } = require('../utils/errors');

// POST /api/refunds - Create a new refund
router.post('/', async (req, res) => {
    try {
        const { orderId, customerId, reason, amount } = req.body;
        const id = await refundService.createRefund(orderId, customerId, reason, amount);
        res.status(201).json({ id, message: 'Refund created successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/refunds - List all refunds (optional filter by state)
router.get('/', async (req, res) => {
    try {
        const stateFilter = req.query.state;
        const refunds = await refundService.listRefunds(stateFilter);
        res.status(200).json(refunds);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/refunds/metrics - Get dashboard analytics
// MUST be placed before the /:id route!
router.get('/metrics', async (req, res) => {
    try {
        const metrics = await refundService.getMetrics();
        res.status(200).json(metrics);
    } catch (err) {
        console.error("🔥 METRICS ERROR:", err);
        res.status(500).json({ error: err.message });
    }
});


// GET /api/refunds/:id - Get detail + transition history
router.get('/:id', async (req, res) => {
    try {
        const refund = await refundService.getRefundWithHistory(req.params.id);
        res.status(200).json(refund);
    } catch (err) {
        if (err instanceof NotFoundError) {
            return res.status(404).json({ error: err.message });
        }
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/refunds/:id/state - Transition state
router.patch('/:id/state', async (req, res) => {
    try {
        const { newState, changedBy, note } = req.body;
        await refundService.transitionRefund(
            req.params.id, 
            newState, 
            changedBy, 
            note, 
            false // isSystemCall is false for manual transitions
        );
        res.status(200).json({ message: 'State updated successfully' });
    } catch (err) {
        // Map custom errors to specific HTTP status codes
        if (err instanceof InvalidTransitionError) {
            return res.status(400).json({ error: err.message });
        }
        if (err instanceof ConflictError) {
            return res.status(409).json({ error: err.message });
        }
        if (err instanceof NotFoundError) {
            return res.status(404).json({ error: err.message });
        }
        res.status(500).json({ error: err.message });
    }
});
// POST /api/refunds/webhook/stripe - Mock Stripe Webhook
router.post('/webhook/stripe', async (req, res) => {
    try {
        // 1. Stripe sends us a JSON payload. We extract the data.
        const { refundId, stripeStatus } = req.body;

        console.log(`[WEBHOOK RECEIVED] Stripe says Refund ${refundId} is ${stripeStatus}`);

        // 2. Security Check: In a real app, you verify Stripe's cryptographic signature here.
        if (stripeStatus !== 'succeeded') {
            return res.status(400).json({ error: 'Refund failed at bank' });
        }

        // 3. Automate the transition! Notice 'isSystemCall' is true.
        await refundService.transitionRefund(
            refundId, 
            'CREDITED', // The automated state!
            'SYSTEM_STRIPE', // changedBy
            'Webhook received: Payment successfully transferred to bank account.', 
            true // Yes, this is a system call!
        );

        // 4. Always return 200 OK fast so Stripe knows we got the message
        res.status(200).json({ received: true });

    } catch (err) {
        console.error("[WEBHOOK ERROR]:", err.message);
        // If the database fails (e.g. version conflict), tell Stripe to try sending the webhook again later
        res.status(500).json({ error: err.message });
    }
});


module.exports = router;