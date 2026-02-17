/**
 * A2A Visualizer Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    const runBtn = document.getElementById('run-btn');
    const clearBtn = document.getElementById('clear-logs');
    const logContent = document.getElementById('log-content');
    const mockModeToggle = document.getElementById('mock-mode');
    const requestInput = document.getElementById('request-input');
    const planModal = document.getElementById('plan-modal');
    const confirmBtn = document.getElementById('confirm-plan');
    const cancelBtn = document.getElementById('cancel-plan');
    const closeModal = document.querySelector('.close-modal');

    let currentExecutionData = null;

    // --- Nodes Mapping ---
    const nodes = {
        orchestrator: document.getElementById('node-orchestrator'),
        discovery: document.getElementById('node-discovery'),
        checkout: document.getElementById('node-checkout'),
        loreal: document.getElementById('node-loreal'),
        sephora: document.getElementById('node-sephora')
    };

    // --- SVG Connection Logic ---
    const svg = document.getElementById('connection-layer');

    function drawConnections() {
        svg.innerHTML = '';
        const rect = svg.getBoundingClientRect();

        // Orchestrator to Agents
        connectNodes('orchestrator', 'discovery', 'primary');
        connectNodes('orchestrator', 'checkout', 'primary');

        // Discovery to Checkout (Indirect via Orchestrator, but let's show data flow)
        // Checkout to UCP Servers
        connectNodes('checkout', 'loreal', 'tertiary');
        connectNodes('checkout', 'sephora', 'tertiary');
    }

    function connectNodes(id1, id2, type) {
        const el1 = nodes[id1];
        const el2 = nodes[id2];
        const r1 = el1.getBoundingClientRect();
        const r2 = el2.getBoundingClientRect();
        const s = svg.getBoundingClientRect();

        const x1 = (r1.left + r1.width / 2) - s.left;
        const y1 = (r1.top + r1.height / 2) - s.top;
        const x2 = (r2.left + r2.width / 2) - s.left;
        const y2 = (r2.top + r2.height / 2) - s.top;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const color = type === 'primary' ? '#3b82f6' : (type === 'tertiary' ? '#10b981' : '#8b5cf6');

        // Smooth curve
        const cpY = (y1 + y2) / 2;
        path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${cpY}, ${x2} ${cpY}, ${x2} ${y2}`);
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('opacity', '0.2');
        path.setAttribute('id', `path-${id1}-${id2}`);

        svg.appendChild(path);
    }

    function animatePacket(fromId, toId, type) {
        const path = document.getElementById(`path-${fromId}-${toId}`);
        if (!path) return;

        const packet = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        packet.setAttribute('r', '4');
        const color = type === 'primary' ? '#60a5fa' : (type === 'tertiary' ? '#34d399' : '#a78bfa');
        packet.setAttribute('fill', color);
        packet.style.filter = 'drop-shadow(0 0 5px ' + color + ')';

        // Use motion path animation
        packet.style.offsetPath = `path('${path.getAttribute('d')}')`;
        packet.style.animation = 'move-packet 1s ease-in-out forwards';

        svg.appendChild(packet);
        setTimeout(() => packet.remove(), 1000);
    }

    // --- Log Utils ---
    function addLog(msg, type = 'system') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        entry.innerHTML = `<span style="opacity: 0.5">[${time}]</span> ${msg}`;
        logContent.appendChild(entry);
        logContent.scrollTop = logContent.scrollHeight;
    }

    // --- State Management ---
    function setNodeStatus(id, text, state = 'idle') {
        const node = nodes[id];
        const statusText = node.querySelector('.status-text');
        statusText.textContent = text;

        node.classList.remove('active', 'processing');
        if (state === 'active') node.classList.add('active');
        if (state === 'processing') node.classList.add('active', 'processing');
    }

    async function runA2AFlow() {
        const isMock = mockModeToggle.checked;
        const requestText = requestInput.value;

        addLog(`Initiating request: "${requestText}"`, 'orchestrator');
        setNodeStatus('orchestrator', 'Analyzing Request...', 'processing');

        if (isMock) {
            await simulateFlow(requestText);
        } else {
            await executeRealFlow(requestText);
        }
    }

    async function simulateFlow(requestText) {
        await sleep(1500);

        // Discovery Step
        addLog("Orchestrator invoking Discovery Agent (A2A)...", "orchestrator");
        animatePacket('orchestrator', 'discovery', 'primary');
        setNodeStatus('discovery', 'Searching Web...', 'processing');
        setNodeStatus('orchestrator', 'Waiting for Discovery...', 'active');

        await sleep(2000);
        addLog("Discovery Agent: Found L'Oreal Vitamin C Serum ($54.00)", "discovery");
        addLog("Discovery Agent: Found Sephora Matte Lipstick ($22.00)", "discovery");
        animatePacket('discovery', 'orchestrator', 'primary');
        setNodeStatus('discovery', 'Results Returned', 'active');

        await sleep(1000);

        // Checkout Preparation
        addLog("Orchestrator invoking Checkout Agent (A2A)...", "orchestrator");
        animatePacket('orchestrator', 'checkout', 'primary');
        setNodeStatus('checkout', 'Calculating Split...', 'processing');

        await sleep(1500);
        addLog("Checkout Agent: Split determined. UCP 1 (Sephora) & UCP 2 (L'Oreal) required.", "checkout");

        // Call UCP Servers
        animatePacket('checkout', 'loreal', 'tertiary');
        animatePacket('checkout', 'sephora', 'tertiary');
        setNodeStatus('loreal', 'Session Created', 'active');
        setNodeStatus('sephora', 'Session Created', 'active');

        await sleep(1000);
        setNodeStatus('checkout', 'Awaiting Confirmation', 'active');
        setNodeStatus('orchestrator', 'Plan Ready', 'active');

        showPlan({
            ok: true,
            plan_text: "**Sephora**\n* Item: Matte Lipstick ($22)\n**L'Oreal**\n* Item: Vitamin C Serum ($54)",
            created: { checkout_id: "demo-id-123" }
        });
    }

    async function executeRealFlow(requestText) {
        try {
            const response = await fetch('http://localhost:7000/demo/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ request: requestText, confirm: false })
            });

            if (!response.ok) throw new Error("API call failed");

            const data = await response.json();
            currentExecutionData = data;

            // For now, we manually sequence the animation even for real calls to make it look good
            // In a pro app, we'd use WebSockets or stream indices
            await simulateFlow(requestText);

            showPlan(data);

        } catch (err) {
            addLog(`Error: ${err.message}`, 'error');
            setNodeStatus('orchestrator', 'Error', 'idle');
        }
    }

    function showPlan(data) {
        const details = document.getElementById('plan-details');
        details.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
        planModal.classList.add('show');
    }

    async function confirmPurchase() {
        planModal.classList.remove('show');
        addLog("User confirmed purchase. Finalizing...", "system");

        setNodeStatus('orchestrator', 'Finalizing...', 'processing');
        animatePacket('orchestrator', 'checkout', 'primary');
        setNodeStatus('checkout', 'Processing Payments...', 'processing');

        await sleep(2000);

        animatePacket('checkout', 'loreal', 'tertiary');
        animatePacket('checkout', 'sephora', 'tertiary');
        addLog("Receipt received from Sephora (UCP)", "ucp");
        addLog("Receipt received from L'Oreal (UCP)", "ucp");

        setNodeStatus('orchestrator', 'Success', 'active');
        setNodeStatus('checkout', 'Order Complete', 'idle');
        setNodeStatus('discovery', 'Idle', 'idle');

        addLog("A2A Purchase Flow Completed Successfully! 🎉", "system");
    }

    // --- Helpers ---
    function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

    // --- Events ---
    runBtn.addEventListener('click', runA2AFlow);
    clearBtn.addEventListener('click', () => logContent.innerHTML = '');
    confirmBtn.addEventListener('click', confirmPurchase);
    cancelBtn.addEventListener('click', () => planModal.classList.remove('show'));
    closeModal.addEventListener('click', () => planModal.classList.remove('show'));

    window.addEventListener('resize', drawConnections);

    // Initial State
    setTimeout(drawConnections, 500);
});
