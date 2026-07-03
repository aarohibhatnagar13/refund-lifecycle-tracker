const db = require('../config/db');
const { isValidTransition } = require('../utils/stateMachine');
const { InvalidTransitionError, NotFoundError, ConflictError } = require('../utils/errors');

const createRefund = async (orderId, customerId, reason, amount) => {
    const [result] = await db.query(
        'INSERT INTO refunds (order_id, customer_id, reason, amount, current_state, version) VALUES (?, ?, ?, ?, "RAISED", 0)',
        [orderId, customerId, reason, amount]
    );
    return result.insertId;
};

const listRefunds = async (filterState = null) => {
    let sql = 'SELECT * FROM refunds';
    const params = [];
    if (filterState) {
        sql += ' WHERE current_state = ?';
        params.push(filterState);
    }
    const [rows] = await db.query(sql, params);
    return rows;
};

const getRefundWithHistory = async (refundId) => {
    const [refunds] = await db.query('SELECT * FROM refunds WHERE id = ?', [refundId]);
    if (refunds.length === 0) throw new NotFoundError('Refund not found');

    const [history] = await db.query(
        'SELECT * FROM refund_transitions WHERE refund_id = ? ORDER BY changed_at ASC',
        [refundId]
    );
    
    return { ...refunds[0], history };
};

const transitionRefund = async (refundId, newState, changedBy, note, isSystemCall = false) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Get current state and version
        const [refunds] = await connection.query(
            'SELECT current_state, version FROM refunds WHERE id = ? FOR UPDATE', 
            [refundId]
        );
        if (refunds.length === 0) throw new NotFoundError('Refund not found');
        
        const { current_state: fromState, version: currentVersion } = refunds[0];

        // 2. Validate transition
        if (!isValidTransition(fromState, newState, isSystemCall)) {
            throw new InvalidTransitionError(`Cannot move from ${fromState} to ${newState}`);
        }

        // 3. Update with Optimistic Locking
        const [updateResult] = await connection.query(
            'UPDATE refunds SET current_state = ?, version = version + 1, updated_at = NOW() WHERE id = ? AND version = ?',
            [newState, refundId, currentVersion]
        );

        if (updateResult.affectedRows === 0) {
            throw new ConflictError('Version mismatch: Refresh and try again');
        }

        // 4. Log History
        await connection.query(
            'INSERT INTO refund_transitions (refund_id, from_state, to_state, changed_by, note) VALUES (?, ?, ?, ?, ?)',
            [refundId, fromState, newState, changedBy, note]
        );

        await connection.commit();
        return { success: true };
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
};

module.exports = { createRefund, listRefunds, getRefundWithHistory, transitionRefund };