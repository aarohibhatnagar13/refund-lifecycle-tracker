const db = require('../config/db');
const { InvalidTransitionError, ConflictError, NotFoundError } = require('../utils/errors');
const { isValidTransition } = require('../utils/stateMachine');

// 1. Create a new Refund (Now with Transactions!)
const createRefund = async (orderId, customerId, reason, amount) => {
    const connection = await db.getConnection(); // Get a dedicated connection from the pool
    try {
        await connection.beginTransaction(); // Start transaction

        const [result] = await connection.query(
            `INSERT INTO refunds (order_id, customer_id, reason, amount, current_state, version) 
             VALUES (?, ?, ?, ?, 'RAISED', 0)`,
            [orderId, customerId, reason, amount]
        );
        
        const newId = result.insertId;

        await connection.query(
            `INSERT INTO refund_transitions (refund_id, from_state, to_state, changed_by, note) 
             VALUES (?, ?, ?, ?, ?)`,
            [newId, null, 'RAISED', 'SYSTEM', 'Initial refund creation']
        );

        await connection.commit(); // Save changes permanently
        return newId;
    } catch (error) {
        await connection.rollback(); // Undo everything if ANY query fails
        throw error;
    } finally {
        connection.release(); // Always release the connection back to the pool
    }
};

// 2. List all refunds
const listRefunds = async (stateFilter) => {
    let query = 'SELECT * FROM refunds';
    const params = [];

    if (stateFilter) {
        query += ' WHERE current_state = ?';
        params.push(stateFilter);
    }

    query += ' ORDER BY updated_at DESC';

    const [rows] = await db.query(query, params);
    return rows;
};

// 3. Get single refund details + timeline history
const getRefundWithHistory = async (id) => {
    const [refunds] = await db.query('SELECT * FROM refunds WHERE id = ?', [id]);
    if (refunds.length === 0) throw new NotFoundError('Refund not found');
    
    const refund = refunds[0];
    const [history] = await db.query(
        'SELECT from_state, to_state, changed_by, changed_at, note FROM refund_transitions WHERE refund_id = ? ORDER BY changed_at ASC',
        [id]
    );

    refund.history = history; 
    return refund;
};

// 4. Transition State (Optimistic Concurrency + Transactions!)
const transitionRefund = async (refundId, newState, changedBy, note, isSystemCall = false) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction(); // Start transaction

        // 1. Get current state and version
        const [refunds] = await connection.query(
            'SELECT current_state, version FROM refunds WHERE id = ?', 
            [refundId]
        );

        if (refunds.length === 0) throw new NotFoundError('Refund not found');
        const { current_state: fromState, version: currentVersion } = refunds[0];

        // 2. Validate transition
        if (!isValidTransition(fromState, newState, isSystemCall)) {
            throw new InvalidTransitionError(`Cannot move from ${fromState} to ${newState}`);
        }

        // 3. Attempt the Update with the version check (OCC)
        const [updateResult] = await connection.query(
            `UPDATE refunds 
             SET current_state = ?, version = version + 1, updated_at = NOW() 
             WHERE id = ? AND version = ?`,
            [newState, refundId, currentVersion]
        );

        if (updateResult.affectedRows === 0) {
            throw new ConflictError('Version mismatch: This record was updated by someone else.');
        }

        // 4. Log History
        await connection.query(
            'INSERT INTO refund_transitions (refund_id, from_state, to_state, changed_by, note) VALUES (?, ?, ?, ?, ?)',
            [refundId, fromState, newState, changedBy, note]
        );

        await connection.commit(); // Save changes permanently
        // --- NEW: MOCK STRIPE API CALL ---
        if (newState === 'PROCESSING') {
            console.log(`💳 [API OUTBOUND] Telling Stripe to transfer money for Refund ID: ${refundId}...`);
            // In real life, we'd do: await axios.post('https://api.stripe.com/refunds', { ... })
        }
        return { success: true };
    } catch (error) {
        await connection.rollback(); // Undo everything if it fails (or if OCC throws 409 Conflict)
        throw error;
    } finally {
        connection.release(); // Release connection
    }
};

// 5. Get Analytics Metrics
const getMetrics = async () => {
    // Query 1: Total money successfully refunded
    const [totalRes] = await db.query(
        "SELECT SUM(amount) as total FROM refunds WHERE current_state = 'CREDITED'"
    );
    const totalRefunded = totalRes[0].total || 0;

    // Query 2: The most common reason for a refund
    const [reasonRes] = await db.query(
        "SELECT reason, COUNT(*) as count FROM refunds GROUP BY reason ORDER BY count DESC LIMIT 1"
    );
    const topIssue = reasonRes.length > 0 ? reasonRes[0].reason : 'N/A';

    // Query 3: Count of refunds that need attention
    const [pendingRes] = await db.query(
        "SELECT COUNT(*) as count FROM refunds WHERE current_state IN ('RAISED', 'UNDER_REVIEW', 'ESCALATED')"
    );
    const pendingCount = pendingRes[0].count || 0;

    return {
        totalRefunded: parseFloat(totalRefunded).toFixed(2), // Format to 2 decimal places
        topIssue,
        pendingCount
    };
};


module.exports = {
    createRefund,
    listRefunds,
    getRefundWithHistory,
    transitionRefund,
    getMetrics
};