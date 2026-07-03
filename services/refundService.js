const transitionRefund = async (refundId, newState, changedBy, note, isSystemCall = false) => {
    // 1. Get current state and version WITHOUT 'FOR UPDATE'
    // This allows two requests to read the same 'stale' version at the same time
    const [refunds] = await db.query(
        'SELECT current_state, version FROM refunds WHERE id = ?', 
        [refundId]
    );

    if (refunds.length === 0) throw new NotFoundError('Refund not found');
    
    const { current_state: fromState, version: currentVersion } = refunds[0];

    // 2. Validate transition
    if (!isValidTransition(fromState, newState, isSystemCall)) {
        throw new InvalidTransitionError(`Cannot move from ${fromState} to ${newState}`);
    }

    // 3. Attempt the Update with the version check
    // If another request finished between step 1 and step 3, 
    // the version in the DB will be different, and affectedRows will be 0.
    const [updateResult] = await db.query(
        `UPDATE refunds 
         SET current_state = ?, version = version + 1, updated_at = NOW() 
         WHERE id = ? AND version = ?`,
        [newState, refundId, currentVersion]
    );

    if (updateResult.affectedRows === 0) {
        // THIS is where the 409 happens now!
        throw new ConflictError('Version mismatch: This record was updated by someone else.');
    }

    // 4. Log History (This can be a separate insert)
    await db.query(
        'INSERT INTO refund_transitions (refund_id, from_state, to_state, changed_by, note) VALUES (?, ?, ?, ?, ?)',
        [refundId, fromState, newState, changedBy, note]
    );

    return { success: true };
};