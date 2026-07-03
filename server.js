require('dotenv').config();
console.log("My Port is:", process.env.PORT);
const express = require('express');
const cors = require('cors');
const db = require('./config/db');

require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Get all refunds
app.get('/api/refunds', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM refunds');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create refund
app.post('/api/refunds', async (req, res) => {
    const { order_id, customer_id, reason, amount } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO refunds (order_id, customer_id, reason, amount) VALUES (?, ?, ?, ?)',
            [order_id, customer_id, reason, amount]
        );
        res.status(201).json({ id: result.insertId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update State (with Optimistic Locking)
app.patch('/api/refunds/:id/status', async (req, res) => {
    const { id } = req.params;
    const { to_state, current_version, changed_by, note } = req.body;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [upd] = await conn.query(
            'UPDATE refunds SET current_state = ?, version = version + 1 WHERE id = ? AND version = ?',
            [to_state, id, current_version]
        );
        if (upd.affectedRows === 0) throw new Error('Update failed: Stale data');
        
        await conn.query(
            'INSERT INTO refund_transitions (refund_id, to_state, changed_by, note) VALUES (?, ?, ?, ?)',
            [id, to_state, changed_by, note]
        );
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(400).json({ error: err.message });
    } finally { conn.release(); }
});

app.listen(process.env.PORT, () => console.log(`Server on ${process.env.PORT}`));
