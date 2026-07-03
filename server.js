require('dotenv').config();
const express = require('express');
const cors = require('cors');
const refundService = require('./services/refundService');
const { startSlaChecker, runSlaCheckNow } = require('./jobs/slaChecker'); // 1. Import Job

const app = express();
app.use(cors());
app.use(express.json());

// Start the background job on boot
startSlaChecker(); // 2. Start on boot

const asyncHandler = (fn) => (req, res, next) => 
    Promise.resolve(fn(req, res, next)).catch(next);

// Existing routes...
app.get('/api/refunds', asyncHandler(async (req, res) => {
    const refunds = await refundService.listRefunds(req.query.state);
    res.json(refunds);
}));

app.post('/api/refunds', asyncHandler(async (req, res) => {
    const { order_id, customer_id, reason, amount } = req.body;
    const id = await refundService.createRefund(order_id, customer_id, reason, amount);
    res.status(201).json({ id, message: 'Refund Raised' });
}));

app.patch('/api/refunds/:id/status', asyncHandler(async (req, res) => {
    const { to_state, changed_by, note, is_system } = req.body;
    await refundService.transitionRefund(req.params.id, to_state, changed_by, note, is_system);
    res.json({ message: 'Transition successful' });
}));

// 3. New Dev Route for testing the SLA logic immediately
app.post('/api/refunds/dev/run-sla-check', asyncHandler(async (req, res) => {
    const count = await runSlaCheckNow();
    res.json({ message: 'SLA check completed', escalated_count: count });
}));

// Global Error Handler
app.use((err, req, res, next) => {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message });
});
app.use(express.static('public'));


app.listen(process.env.PORT || 3000, () => console.log('🚀 Server & Job running...'));