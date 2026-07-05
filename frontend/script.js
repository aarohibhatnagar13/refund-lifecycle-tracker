const API_BASE = import.meta.env.VITE_API_URL + '/api/refunds';

const VALID_TRANSITIONS = {
    'RAISED': ['UNDER_REVIEW'],
    'UNDER_REVIEW': ['APPROVED', 'DENIED'],
    'APPROVED': ['PROCESSING'],
    'PROCESSING': ['CREDITED'],
    'DENIED': [],
    'CREDITED': [],
    'ESCALATED': ['UNDER_REVIEW'] // <--- THIS IS THE FIX. Now the button will show!
};

// --- DOM HELPERS ---
function createBadge(state) {
    const span = document.createElement('span');
    span.className = `badge state-${state}`;
    span.textContent = state;
    return span;
}

// --- API FUNCTIONS ---
async function fetchRefunds(stateFilter = '') {
    const url = stateFilter ? `${API_BASE}?state=${stateFilter}` : API_BASE;
    const res = await fetch(url);
    return res.json();
}

async function fetchRefundDetail(id) {
    const res = await fetch(`${API_BASE}/${id}`);
    if (!res.ok) throw new Error('Not Found');
    return res.json();
}

async function updateRefundState(id, newState, changedBy, note) {
    return fetch(`${API_BASE}/${id}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newState, changedBy, note })
    });
}

// --- PAGE LOGIC ---
function toggleForm() {
    document.getElementById('refundForm').classList.toggle('hidden');
}

async function initIndex() {
    const data = await fetchRefunds();
    const tbody = document.getElementById('refundTableBody');
    tbody.innerHTML = ''; 

    data.forEach(r => {
        const tr = document.createElement('tr');
        tr.className = 'clickable';
        tr.onclick = () => window.location.href = `detail.html?id=${r.id}`;

        const tdOrder = document.createElement('td');
        tdOrder.textContent = r.order_id;
        
        const tdStatus = document.createElement('td');
        tdStatus.appendChild(createBadge(r.current_state));

        const tdAmount = document.createElement('td');
        tdAmount.textContent = `$${r.amount}`;

        const tdDate = document.createElement('td');
        tdDate.textContent = new Date(r.updated_at).toLocaleString();

        tr.append(tdOrder, tdStatus, tdAmount, tdDate);
        tbody.appendChild(tr);
    });
}

async function submitRefund() {
    try {
        const body = {
            orderId: document.getElementById('orderId').value,
            customerId: document.getElementById('customerId').value,
            reason: document.getElementById('reason').value,
            amount: document.getElementById('amount').value
        };
        
        // 1. Make the request
        const res = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        // 2. Check if the backend returned an error (like 500 or 400)
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
        }

        // 3. Reload on success
        location.reload();
        
    } catch (error) {
        // 4. Show the error to the user!
        console.error("Submission Error:", error);
        alert("Failed to create refund: " + error.message);
    }
}

async function initDetail() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const refund = await fetchRefundDetail(id);

    document.getElementById('detOrderId').textContent = `Order ${refund.order_id}`;
    document.getElementById('detStatus').innerHTML = '';
    document.getElementById('detStatus').appendChild(createBadge(refund.current_state));
    document.getElementById('detAmount').textContent = `$${refund.amount}`;
    document.getElementById('detCustomer').textContent = refund.customer_id;

    // Timeline
    const timeline = document.getElementById('timeline');
    refund.history.forEach(h => {
        const div = document.createElement('div');
        div.className = 'timeline-item';
        
        const b = document.createElement('b');
        b.textContent = `${h.from_state || 'START'} → ${h.to_state}`;
        
        const p = document.createElement('p');
        p.style.fontSize = '12px';
        p.textContent = `${new Date(h.changed_at).toLocaleString()} by ${h.changed_by || 'System'}: ${h.note || ''}`;
        
        div.append(b, p);
        timeline.appendChild(div);
    });

    // Action Buttons
    const btnContainer = document.getElementById('actionButtons');
    const nextStates = VALID_TRANSITIONS[refund.current_state] || [];
    nextStates.forEach(state => {
        const btn = document.createElement('button');
        btn.textContent = `Move to ${state}`;
        btn.onclick = async () => {
            await updateRefundState(id, state, 'Arohi', 'Manual transition');
            location.reload();
        };
        btnContainer.appendChild(btn);
    });
}

async function runSlaCheckNow() {
    const res = await fetch(`${API_BASE}/dev/run-sla-check`, { method: 'POST' });
    const data = await res.json();
    alert(`SLA Check Complete! Escalated: ${data.escalated_count}`);
    location.reload();
}

async function simulateRaceCondition() {
    const id = new URLSearchParams(window.location.search).get('id');
    const statusText = document.getElementById('raceResult');
    statusText.textContent = "Sending two updates at the same time...";

    // Fire two requests instantly without awaiting the first
    const req1 = updateRefundState(id, 'UNDER_REVIEW', 'UserA', 'Race 1');
    const req2 = updateRefundState(id, 'UNDER_REVIEW', 'UserB', 'Race 2');

    const [res1, res2] = await Promise.all([req1, req2]);
    
    statusText.innerHTML = `Req 1: ${res1.status} (${res1.statusText})<br>Req 2: ${res2.status} (${res2.statusText})`;
}
async function simulateStripeWebhook() {
    const id = new URLSearchParams(window.location.search).get('id');
    
    // We are pretending to be Stripe's server making a POST request to your API
    const res = await fetch(`${API_BASE}/webhook/stripe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            refundId: id, 
            stripeStatus: 'succeeded' 
        })
    });

    if (res.ok) {
        alert("Stripe Webhook received successfully! The bank transferred the money.");
        location.reload();
    } else {
        const err = await res.json();
        alert("Webhook Failed: " + err.error);
    }
}

// Don't forget to expose it to the HTML window!
window.simulateStripeWebhook = simulateStripeWebhook;


// Expose functions to window for HTML inline event handlers
window.toggleForm = toggleForm;
window.submitRefund = submitRefund;
window.runSlaCheckNow = runSlaCheckNow;
window.simulateRaceCondition = simulateRaceCondition;
window.initIndex = initIndex;
window.initDetail = initDetail;

// Auto-initialize based on current page
if (window.location.pathname.includes('detail.html')) {
    initDetail();
} else if (window.location.pathname.endsWith('/') || window.location.pathname.includes('index.html')) {
    initIndex();
}