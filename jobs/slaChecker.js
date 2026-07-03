const db = require('../config/db');
const refundService = require('../services/refundService');

const SLA_RULES = {
    UNDER_REVIEW: 24, // hours
    APPROVED: 12,
    PROCESSING: 48
};

const runSlaCheckNow = async () => {
    console.log('[SLA Job] Checking for breaches...');
    let escalatedCount = 0;

    try {
        // Find refunds that have exceeded their time limit for their current state
        const [breachedRefunds] = await db.query(`
            SELECT id, current_state FROM refunds 
            WHERE 
                (current_state = 'UNDER_REVIEW' AND TIMESTAMPDIFF(HOUR, updated_at, NOW()) >= ?) OR
                (current_state = 'APPROVED' AND TIMESTAMPDIFF(HOUR, updated_at, NOW()) >= ?) OR
                (current_state = 'PROCESSING' AND TIMESTAMPDIFF(HOUR, updated_at, NOW()) >= ?)
        `, [SLA_RULES.UNDER_REVIEW, SLA_RULES.APPROVED, SLA_RULES.PROCESSING]);

        for (const refund of breachedRefunds) {
            try {
                await refundService.transitionRefund(
                    refund.id, 
                    'ESCALATED', 
                    'SYSTEM', 
                    `SLA breach auto-escalation (Stuck in ${refund.current_state})`, 
                    true // isSystemCall = true
                );
                escalatedCount++;
                console.log(`[SLA Job] Escalated refund ID: ${refund.id}`);
            } catch (err) {
                // If the error is a ConflictError (409), it means a human just updated it 
                // while the job was running. We skip it gracefully.
                if (err.statusCode === 409) {
                    console.log(`[SLA Job] Skipped ID ${refund.id} - already transitioned by user.`);
                } else {
                    console.error(`[SLA Job] Error escalating ID ${refund.id}:`, err.message);
                }
            }
        }
    } catch (err) {
        console.error('[SLA Job] Critical failure:', err.message);
    }

    return escalatedCount;
};

const startSlaChecker = () => {
    // Run every 5 minutes
    setInterval(async () => {
        await runSlaCheckNow();
    }, 5 * 60 * 1000);
    
    console.log('🕒 SLA Checker background job initialized (Interval: 5m)');
};

module.exports = { startSlaChecker, runSlaCheckNow };