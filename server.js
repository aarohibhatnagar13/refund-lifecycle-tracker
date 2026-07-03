require('dotenv').config();
const express = require('express');
const cors = require('cors');
const refundRoutes = require('./routes/refundRoutes'); // 1. Import Router
const { startSlaChecker, runSlaCheckNow } = require('./jobs/slaChecker');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Start background jobs
startSlaChecker();

// 2. Mount the routes
app.use('/api/refunds', refundRoutes);

// 3. Keep the Dev route for testing (or move to its own file)
app.post('/api/refunds/dev/run-sla-check', async (req, res) => {
    try {
        const count = await runSlaCheckNow();
        res.json({ message: 'SLA check completed', escalated_count: count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});