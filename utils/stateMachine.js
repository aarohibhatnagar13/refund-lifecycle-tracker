const VALID_TRANSITIONS = {
    'RAISED': ['UNDER_REVIEW'],
    'UNDER_REVIEW': ['APPROVED', 'DENIED', 'ESCALATED'],
    'APPROVED': ['PROCESSING', 'ESCALATED'],
    'PROCESSING': ['CREDITED', 'ESCALATED'],
    'DENIED': [],
    'CREDITED': [],
    'ESCALATED': []
};

function isValidTransition(fromState, toState, isSystemCall = false) {
    const allowed = VALID_TRANSITIONS[fromState] || [];
    
    // Check if the state itself is in the allowed list
    if (!allowed.includes(toState)) return false;

    // Restriction: Only System Calls can trigger ESCALATED
    if (toState === 'ESCALATED' && !isSystemCall) return false;

    return true;
}

module.exports = { isValidTransition };