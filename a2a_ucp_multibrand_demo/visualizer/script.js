/**
 * A2A × UCP Visualizer — Animated Marketing Demo
 * ═══════════════════════════════════════════════
 * Shows the complete flow:
 *   User → Orchestrator → Discovery Agent (A2A) → Serper + Gemini
 *                       → Checkout Agent  (A2A) → L'Oréal UCP + Sephora UCP
 *                       → Plan → Confirm → Receipts
 */

document.addEventListener('DOMContentLoaded', () => {

  // ──────────────────────────────────────────────────────────────────
  // DOM REFS
  // ──────────────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const qsa = sel => document.querySelectorAll(sel);

  const runBtn    = $('run-btn');
  const autoBtn   = $('auto-btn');
  const clearBtn  = $('clear-btn');
  const logBox    = $('log-box');
  const mockMode  = $('mock-mode');
  const reqInput  = $('request-input');
  const speedRange = $('speed-range');
  const speedVal  = $('speed-val');
  const planModal = $('plan-modal');
  const modalClose = $('modal-close');
  const cancelBtn  = $('cancel-btn');
  const confirmBtn = $('confirm-btn');
  const successBg  = $('success-bg');
  const restartBtn = $('restart-btn');
  const svgLayer   = $('svg-layer');
  const stepBanner = $('step-banner');
  const tooltip    = $('tooltip');
  const vizArea    = $('viz-area');

  const nodeEls = {
    user:         $('node-user'),
    orchestrator: $('node-orchestrator'),
    discovery:    $('node-discovery'),
    checkout:     $('node-checkout'),
    loreal:       $('node-loreal'),
    sephora:      $('node-sephora'),
  };

  // ──────────────────────────────────────────────────────────────────
  // STATE
  // ──────────────────────────────────────────────────────────────────
  let speed       = 1;
  let running     = false;
  let planData    = null;
  let connPaths   = {};   // key: "from-to" → { path, d, color }
  let confettiAF  = null;

  // ──────────────────────────────────────────────────────────────────
  // PARTICLE CANVAS BACKGROUND
  // ──────────────────────────────────────────────────────────────────
  (function initBgCanvas() {
    const canvas = $('bg-canvas');
    const ctx    = canvas.getContext('2d');
    let particles = [];

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#06b6d4','#ec4899'];

    for (let i = 0; i < 55; i++) {
      particles.push({
        x:  Math.random() * window.innerWidth,
        y:  Math.random() * window.innerHeight,
        r:  0.5 + Math.random() * 1.5,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -0.2 - Math.random() * 0.4,
        a:  0.1 + Math.random() * 0.35,
        c:  COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.c;
        ctx.globalAlpha = p.a;
        ctx.fill();
        p.x += p.vx; p.y += p.vy;
        if (p.y < -10) { p.y = canvas.height + 5; p.x = Math.random() * canvas.width; }
        if (p.x < -10) p.x = canvas.width + 5;
        if (p.x > canvas.width + 10) p.x = -5;
      });
      ctx.globalAlpha = 1;
      requestAnimationFrame(draw);
    }
    draw();
  })();

  // ──────────────────────────────────────────────────────────────────
  // SPEED CONTROL
  // ──────────────────────────────────────────────────────────────────
  speedRange.addEventListener('input', () => {
    speed = parseFloat(speedRange.value);
    speedVal.textContent = `${speed}×`;
  });

  // ──────────────────────────────────────────────────────────────────
  // LIVE METRICS
  // ──────────────────────────────────────────────────────────────────
  const metrics = { calls: 0, ai: 0, ucp: 0 };
  let flowStart = null;
  let elapsedTimer = null;

  function setMetricStatus(txt, cls = 'green') {
    const el = $('m-status');
    el.textContent = txt;
    el.className = `metric-val ${cls}`;
  }

  function bumpMetric(key, amount = 1) {
    metrics[key] += amount;
    const el = $(`m-${key}`);
    if (el) {
      el.textContent = metrics[key];
      el.style.transform = 'scale(1.3)';
      setTimeout(() => el.style.transform = '', 300);
    }
  }

  function resetMetrics() {
    metrics.calls = 0; metrics.ai = 0; metrics.ucp = 0;
    ['calls','ai','ucp'].forEach(k => { const e = $(`m-${k}`); if(e) e.textContent = '0'; });
    setMetricStatus('Idle', 'green');
    ['c-flowid','c-loreal','c-sephora','c-elapsed','c-state'].forEach(id => {
      const e = $(id); if(e) e.textContent = '—';
    });
    if (elapsedTimer) clearInterval(elapsedTimer);
    flowStart = null;
  }

  function startFlowTimer() {
    flowStart = Date.now();
    $('c-flowid').textContent = 'FLW-' + Math.random().toString(36).slice(2,7).toUpperCase();
    $('c-state').textContent = 'Running';
    if (elapsedTimer) clearInterval(elapsedTimer);
    elapsedTimer = setInterval(() => {
      if (!flowStart) return;
      const s = ((Date.now() - flowStart) / 1000).toFixed(1);
      const e = $('c-elapsed'); if(e) e.textContent = `${s}s`;
    }, 100);
  }

  function stopFlowTimer(label = 'Complete') {
    if (elapsedTimer) clearInterval(elapsedTimer);
    const e = $('c-state'); if(e) e.textContent = label;
  }

  // ──────────────────────────────────────────────────────────────────
  // TOOLTIP
  // ──────────────────────────────────────────────────────────────────
  Object.values(nodeEls).forEach(el => {
    if (!el) return;
    el.addEventListener('mouseenter', e => {
      const tip = el.dataset.tip;
      if (!tip) return;
      tooltip.textContent = tip;
      tooltip.classList.add('on');
    });
    el.addEventListener('mousemove', e => {
      tooltip.style.left = (e.clientX + 14) + 'px';
      tooltip.style.top  = (e.clientY - 14) + 'px';
    });
    el.addEventListener('mouseleave', () => tooltip.classList.remove('on'));
  });

  // ──────────────────────────────────────────────────────────────────
  // SVG CONNECTIONS
  // ──────────────────────────────────────────────────────────────────
  const CONNS = [
    { from: 'user',         to: 'orchestrator', proto: 'a2a', color: '#60a5fa' },
    { from: 'orchestrator', to: 'discovery',    proto: 'a2a', color: '#3b82f6' },
    { from: 'orchestrator', to: 'checkout',     proto: 'a2a', color: '#3b82f6' },
    { from: 'checkout',     to: 'loreal',       proto: 'ucp', color: '#10b981' },
    { from: 'checkout',     to: 'sephora',      proto: 'ucp', color: '#10b981' },
  ];

  function nodeCenter(id) {
    const el  = nodeEls[id];
    const sr  = svgLayer.getBoundingClientRect();
    const er  = el.getBoundingClientRect();
    return { x: er.left + er.width / 2 - sr.left, y: er.top + er.height / 2 - sr.top };
  }

  function cubicPath(p1, p2) {
    const dy  = p2.y - p1.y;
    const cp1y = p1.y + dy * 0.55;
    const cp2y = p2.y - dy * 0.55;
    return `M ${p1.x} ${p1.y} C ${p1.x} ${cp1y}, ${p2.x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  function reverseCubicPath(d) {
    const m = d.match(/M ([\d.]+) ([\d.]+) C ([\d.]+) ([\d.]+), ([\d.]+) ([\d.]+), ([\d.]+) ([\d.]+)/);
    if (!m) return d;
    return `M ${m[7]} ${m[8]} C ${m[5]} ${m[6]}, ${m[3]} ${m[4]}, ${m[1]} ${m[2]}`;
  }

  function drawConnections() {
    // Clear previous paths
    svgLayer.querySelectorAll('.conn-path, .conn-glow, .conn-anim').forEach(e => e.remove());
    $('proto-labels').innerHTML = '';
    connPaths = {};

    const vizRect = vizArea.getBoundingClientRect();

    CONNS.forEach(cfg => {
      const p1 = nodeCenter(cfg.from);
      const p2 = nodeCenter(cfg.to);
      const d  = cubicPath(p1, p2);
      const key = `${cfg.from}-${cfg.to}`;

      // Glow path
      const glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      glow.setAttribute('d', d);
      glow.setAttribute('stroke', cfg.color);
      glow.setAttribute('stroke-width', '8');
      glow.setAttribute('fill', 'none');
      glow.setAttribute('opacity', '0.06');
      glow.setAttribute('filter', 'url(#glow-md)');
      glow.classList.add('conn-glow');
      glow.id = `glow-${key}`;
      svgLayer.appendChild(glow);

      // Main dashed path
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', cfg.color);
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('fill', 'none');
      path.setAttribute('opacity', '0.22');
      path.setAttribute('stroke-dasharray', '7 5');
      path.id = `path-${key}`;
      path.classList.add('conn-path');

      // Animated dash flow
      const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
      animate.setAttribute('attributeName', 'stroke-dashoffset');
      animate.setAttribute('values', '0;-24');
      animate.setAttribute('dur', '1.2s');
      animate.setAttribute('repeatCount', 'indefinite');
      path.appendChild(animate);

      if (cfg.proto === 'a2a') path.setAttribute('marker-end', 'url(#arr-blue)');
      else                     path.setAttribute('marker-end', 'url(#arr-green)');

      svgLayer.appendChild(path);

      connPaths[key] = { path, glow, d, color: cfg.color, proto: cfg.proto };

      // Protocol label
      const svgRect = svgLayer.getBoundingClientRect();
      const mx = svgRect.left + p1.x + (p2.x - p1.x) * 0.45 - vizRect.left;
      const my = svgRect.top  + p1.y + (p2.y - p1.y) * 0.42 - vizRect.top;

      const label = document.createElement('div');
      label.className = `p-label ${cfg.proto}`;
      label.id = `lbl-${key}`;
      label.textContent = cfg.proto.toUpperCase();
      label.style.left = mx + 'px';
      label.style.top  = my + 'px';
      $('proto-labels').appendChild(label);
    });
  }

  function setConnActive(fromId, toId, on = true) {
    const key  = `${fromId}-${toId}`;
    const conn = connPaths[key];
    if (!conn) return;
    conn.path.setAttribute('opacity', on ? '0.85' : '0.22');
    conn.path.setAttribute('stroke-width', on ? '2.5' : '1.5');
    conn.glow.setAttribute('opacity', on ? '0.25' : '0.06');
    const lbl = $(`lbl-${key}`);
    if (lbl) {
      lbl.style.opacity   = on ? '1' : '0.5';
      lbl.style.transform = on ? 'translate(-50%,-50%) scale(1.15)' : 'translate(-50%,-50%) scale(1)';
      lbl.classList.toggle('lit', on);
    }
  }

  function firePacket(fromId, toId, count = 1, stagger = 220) {
    // Resolve path direction
    const fwdKey = `${fromId}-${toId}`;
    const revKey = `${toId}-${fromId}`;
    let d, color;

    if (connPaths[fwdKey]) {
      d     = connPaths[fwdKey].d;
      color = connPaths[fwdKey].color;
    } else if (connPaths[revKey]) {
      d     = reverseCubicPath(connPaths[revKey].d);
      color = connPaths[revKey].color;
    } else {
      return; // no connection
    }

    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const dur = Math.round(750 / speed);
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('r', '5.5');
        dot.setAttribute('fill', color);
        dot.style.filter = `drop-shadow(0 0 7px ${color})`;
        dot.style.cssText += `
          offset-path: path('${d}');
          offset-distance: 0%;
          animation: move-packet ${dur}ms ease-in-out forwards;
        `;
        svgLayer.appendChild(dot);
        setTimeout(() => dot.remove(), dur + 120);
      }, Math.round(i * stagger / speed));
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // NODE STATE
  // ──────────────────────────────────────────────────────────────────
  function setNode(id, status, state = 'idle') {
    const el  = nodeEls[id];
    const ns  = $(`ns-${id}`);
    if (ns) ns.textContent = status;
    el.classList.remove('active', 'busy');
    if (state === 'active')     el.classList.add('active');
    if (state === 'processing') el.classList.add('active', 'busy');
  }

  function resetAllNodes() {
    setNode('user',         'Ready',           'idle');
    setNode('orchestrator', 'Awaiting Request','idle');
    setNode('discovery',    'Standby',         'idle');
    setNode('checkout',     'Standby',         'idle');
    setNode('loreal',       'Standby',         'idle');
    setNode('sephora',      'Standby',         'idle');
    CONNS.forEach(c => setConnActive(c.from, c.to, false));
    setStep(0);
    stepBanner.classList.add('hidden');
    resetMetrics();
  }

  // ──────────────────────────────────────────────────────────────────
  // STEP TRACKER
  // ──────────────────────────────────────────────────────────────────
  function setStep(n) {
    qsa('#steps-list .step').forEach(el => {
      const sn = parseInt(el.dataset.n);
      el.classList.remove('active','done');
      if      (sn < n) el.classList.add('done');
      else if (sn === n) el.classList.add('active');
    });
  }

  function showBanner(icon, text) {
    $('step-banner-icon').textContent = icon;
    $('step-banner-text').textContent = text;
    stepBanner.classList.remove('hidden');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(() => stepBanner.classList.add('hidden'), Math.round(2200 / speed));
  }

  // ──────────────────────────────────────────────────────────────────
  // LOGGING
  // ──────────────────────────────────────────────────────────────────
  const LOG_ICONS = {
    system:'◈', orchestrator:'🧠', discovery:'🔍', checkout:'🛒',
    ucp:'◈', ai:'✦', success:'✓', error:'⚠',
  };

  function log(msg, type = 'system') {
    const d   = new Date();
    const ts  = [d.getHours(), d.getMinutes(), d.getSeconds()]
                  .map(n => String(n).padStart(2,'0')).join(':');
    const el  = document.createElement('div');
    el.className = `log-line ${type}`;
    el.innerHTML = `<span class="log-ts">${ts}</span><span class="log-msg">${LOG_ICONS[type] || '·'} ${msg}</span>`;
    logBox.appendChild(el);
    logBox.scrollTop = logBox.scrollHeight;
  }

  // ──────────────────────────────────────────────────────────────────
  // UTILS
  // ──────────────────────────────────────────────────────────────────
  const sleep = ms => new Promise(r => setTimeout(r, Math.round(ms / speed)));

  function disableControls(dis = true) {
    runBtn.disabled  = dis;
    autoBtn.disabled = dis;
  }

  // ──────────────────────────────────────────────────────────────────
  // MAIN ANIMATED FLOW
  // ──────────────────────────────────────────────────────────────────
  async function runFlow() {
    if (running) return;
    running = true;
    disableControls(true);
    resetAllNodes();

    const request = reqInput.value.trim() || 'Find vitamin C serum from L\'Oreal and matte lipstick from Sephora';

    // ── STEP 1: User Request ─────────────────────────────────────────
    startFlowTimer();
    setMetricStatus('Running', 'amber');
    setStep(1);
    showBanner('👤', 'User sends natural language request');
    log(`User request: "${request}"`, 'system');
    setNode('user', 'Sending Request...', 'processing');
    setConnActive('user', 'orchestrator', true);
    firePacket('user', 'orchestrator', 2, 280);
    setNode('orchestrator', 'Receiving...', 'processing');
    await sleep(900);
    setNode('user', 'Request Sent ✓', 'active');
    setNode('orchestrator', 'Parsing Intent...', 'processing');
    log('Orchestrator received request — parsing user intent', 'orchestrator');
    await sleep(1000);

    // ── STEP 2: A2A → Discovery for L'Oréal ─────────────────────────
    setStep(2);
    showBanner('🔍', 'A2A: Invoking Discovery Agent — L\'Oréal');
    log('→ A2A invoke: web_search_ranked — L\'Oréal vitamin C serum', 'orchestrator');
    bumpMetric('calls');
    setConnActive('orchestrator', 'discovery', true);
    setConnActive('user', 'orchestrator', false);
    firePacket('orchestrator', 'discovery', 3, 240);
    setNode('orchestrator', 'Awaiting Discovery...', 'active');
    setNode('discovery', 'Searching Web...', 'processing');
    await sleep(750);
    log('Querying Serper API: "L\'Oreal vitamin C serum under $60"', 'discovery');
    await sleep(1000);
    log('✦ Gemini 2.5 Flash ranking 8 organic results...', 'ai');
    bumpMetric('ai');
    await sleep(1400);
    log('✓ Chosen: L\'Oréal Vitamin C Brightening Serum — loreal.com', 'discovery');
    firePacket('discovery', 'orchestrator', 2, 260);
    setNode('discovery', 'Result Returned ✓', 'active');
    await sleep(600);

    // ── STEP 3: A2A → Discovery for Sephora ─────────────────────────
    setStep(3);
    showBanner('🔍', 'A2A: Invoking Discovery Agent — Sephora');
    log('→ A2A invoke: web_search_ranked — Sephora matte lipstick', 'orchestrator');
    bumpMetric('calls');
    setNode('orchestrator', 'Second Discovery...', 'processing');
    firePacket('orchestrator', 'discovery', 3, 240);
    setNode('discovery', 'Searching Web...', 'processing');
    await sleep(750);
    log('Querying Serper API: "Sephora matte lipstick under $60"', 'discovery');
    await sleep(1100);
    log('✦ Gemini 2.5 Flash ranking 8 organic results...', 'ai');
    bumpMetric('ai');
    await sleep(1400);
    log('✓ Chosen: Sephora Collection Matte Lipstick — sephora.com', 'discovery');
    firePacket('discovery', 'orchestrator', 2, 260);
    setNode('discovery', 'Both Results Ready ✓', 'active');
    setNode('orchestrator', 'Items Collected', 'active');
    setConnActive('orchestrator', 'discovery', false);
    await sleep(800);

    // ── STEP 4: A2A → Checkout Agent ────────────────────────────────
    setStep(4);
    showBanner('🛒', 'A2A: Delegating to Checkout Agent');
    log('→ A2A invoke: create_split_checkout {LOreal, Sephora}', 'orchestrator');
    bumpMetric('calls');
    setConnActive('orchestrator', 'checkout', true);
    firePacket('orchestrator', 'checkout', 3, 240);
    setNode('orchestrator', 'Delegating Checkout...', 'active');
    setNode('checkout', 'Initializing Split...', 'processing');
    await sleep(900);

    // ── STEP 5: UCP → L'Oréal ───────────────────────────────────────
    setStep(5);
    showBanner('💄', 'UCP: Creating L\'Oréal checkout session');
    log('UCP /discover → L\'Oréal :8282 (probing capabilities)', 'checkout');
    setConnActive('checkout', 'loreal', true);
    firePacket('checkout', 'loreal', 2, 300);
    setNode('loreal', 'Capabilities Probed', 'processing');
    await sleep(900);
    log('UCP /checkout → L\'Oréal: creating session for Vitamin C Serum', 'ucp');
    firePacket('checkout', 'loreal', 2, 250);
    await sleep(1000);
    const lorealId = 'LOR-' + Math.random().toString(36).slice(2,8).toUpperCase();
    log(`✓ L\'Oréal session created: ${lorealId}`, 'ucp');
    bumpMetric('calls', 2); bumpMetric('ucp');
    const cl = $('c-loreal'); if(cl) cl.textContent = lorealId;
    firePacket('loreal', 'checkout', 2, 280);
    setNode('loreal', `Session ${lorealId}`, 'active');
    await sleep(700);

    // ── STEP 6: UCP → Sephora ───────────────────────────────────────
    setStep(6);
    showBanner('✨', 'UCP: Creating Sephora checkout session');
    log('UCP /discover → Sephora :8182 (probing capabilities)', 'checkout');
    setConnActive('checkout', 'sephora', true);
    firePacket('checkout', 'sephora', 2, 300);
    setNode('sephora', 'Capabilities Probed', 'processing');
    await sleep(900);
    log('UCP /checkout → Sephora: creating session for Matte Lipstick', 'ucp');
    firePacket('checkout', 'sephora', 2, 250);
    await sleep(1000);
    const sephoraId = 'SEP-' + Math.random().toString(36).slice(2,8).toUpperCase();
    log(`✓ Sephora session created: ${sephoraId}`, 'ucp');
    bumpMetric('calls', 2); bumpMetric('ucp');
    const cs = $('c-sephora'); if(cs) cs.textContent = sephoraId;
    firePacket('sephora', 'checkout', 2, 280);
    setNode('sephora', `Session ${sephoraId}`, 'active');
    await sleep(700);

    // ── STEP 7: Gemini writes plan ───────────────────────────────────
    setStep(7);
    showBanner('✦', 'Gemini 2.5 Flash generating purchase plan');
    log('✦ Gemini 2.5 Flash — crafting split-checkout plan...', 'ai');
    bumpMetric('ai');
    setNode('checkout', 'AI Writing Plan...', 'processing');
    await sleep(1800);
    log('✓ Plan generated — 2 brands, 2 items, 2 UCP sessions', 'checkout');
    firePacket('checkout', 'orchestrator', 2, 300);
    setNode('checkout', 'Plan Ready ✓', 'active');
    setNode('orchestrator', 'Plan Received ✓', 'active');
    setConnActive('orchestrator', 'checkout', false);
    await sleep(600);

    // ── STEP 8: Show Plan Modal ──────────────────────────────────────
    setStep(8);
    showBanner('📋', 'Awaiting user confirmation');
    log('Presenting execution plan to user for confirmation', 'orchestrator');

    planData = {
      items: [
        { brand: 'LOreal',  label: "L'Oréal",  icon: '💄', title: "L'Oréal Vitamin C Brightening Serum",  link: 'https://loreal.com' },
        { brand: 'Sephora', label: 'Sephora',  icon: '✨', title: 'Sephora Collection Matte Lipstick',     link: 'https://sephora.com' },
      ],
      plan: `Split-Checkout Plan\n${'─'.repeat(32)}\n\n💄 L'Oréal — Vitamin C Brightening Serum\n   Session: ${lorealId}\n   Protocol: UCP :8282\n\n✨ Sephora — Matte Lipstick\n   Session: ${sephoraId}\n   Protocol: UCP :8182\n\nType CONFIRM to complete checkout.`,
      sessions: [
        { brand: "L'Oréal", id: lorealId },
        { brand: 'Sephora', id: sephoraId },
      ],
    };

    showModal(planData);
    running = false;
    disableControls(false);
  }

  // ──────────────────────────────────────────────────────────────────
  // CONFIRM PURCHASE
  // ──────────────────────────────────────────────────────────────────
  async function completePurchase() {
    closeModal();
    if (running) return;
    running = true;
    disableControls(true);

    // ── STEP 9: Complete payments ────────────────────────────────────
    setStep(9);
    showBanner('💳', 'Processing payments via UCP');
    log('User confirmed! Executing complete_split_checkout...', 'system');
    setMetricStatus('Finalizing', 'amber');
    bumpMetric('calls');
    setNode('orchestrator', 'Finalizing...', 'processing');
    setConnActive('orchestrator', 'checkout', true);
    firePacket('orchestrator', 'checkout', 3, 200);
    setNode('checkout', 'Processing Payments...', 'processing');
    await sleep(900);

    log('UCP /complete → L\'Oréal — processing payment...', 'ucp');
    log('UCP /complete → Sephora — processing payment...', 'ucp');
    setConnActive('checkout', 'loreal',  true);
    setConnActive('checkout', 'sephora', true);
    firePacket('checkout', 'loreal',  3, 170);
    firePacket('checkout', 'sephora', 3, 210);
    setNode('loreal',  'Payment Processing...', 'processing');
    setNode('sephora', 'Payment Processing...', 'processing');
    await sleep(1800);

    // Receipts
    log('✓ Receipt: L\'Oréal — order_id #' + Math.floor(Math.random()*90000+10000), 'success');
    log('✓ Receipt: Sephora — order_id #'  + Math.floor(Math.random()*90000+10000), 'success');
    firePacket('loreal',  'checkout', 2, 280);
    firePacket('sephora', 'checkout', 2, 280);
    setNode('loreal',  'Order Complete ✓', 'active');
    setNode('sephora', 'Order Complete ✓', 'active');
    await sleep(800);

    firePacket('checkout', 'orchestrator', 2, 260);
    setNode('checkout',     'Receipts Sent ✓', 'active');
    setNode('orchestrator', 'Purchase Complete!', 'active');
    await sleep(700);

    // ── STEP 10: Done! ───────────────────────────────────────────────
    setStep(10);
    showBanner('🎉', 'A2A Multi-Brand Flow — Complete!');
    log('🎉 A2A × UCP multi-brand purchase flow completed successfully!', 'success');
    setMetricStatus('Complete ✓', 'green');
    stopFlowTimer('Complete ✓');
    await sleep(900);

    showSuccess();
    running = false;
    disableControls(false);
  }

  // ──────────────────────────────────────────────────────────────────
  // PLAN MODAL
  // ──────────────────────────────────────────────────────────────────
  function showModal(data) {
    // Items
    const itemsEl = $('modal-items');
    itemsEl.innerHTML = data.items.map(item => `
      <div class="modal-item">
        <span class="brand-pill brand-${item.brand.toLowerCase()}">${item.label}</span>
        <span class="item-title">${item.title}</span>
        <a class="item-link" href="${item.link}" target="_blank" rel="noopener">↗</a>
      </div>
    `).join('');

    // Plan text
    $('modal-plan').textContent = data.plan;

    // Sessions
    $('modal-sessions').innerHTML = data.sessions.map(s => `
      <div class="session-row">
        <span class="session-brand">${s.brand}</span>
        <span class="session-id">${s.id}</span>
      </div>
    `).join('');

    planModal.classList.add('open');
  }

  function closeModal() {
    planModal.classList.remove('open');
  }

  // ──────────────────────────────────────────────────────────────────
  // SUCCESS + CONFETTI
  // ──────────────────────────────────────────────────────────────────
  function showSuccess() {
    const rr = $('receipt-row');
    rr.innerHTML = [
      { brand: "L'Oréal",  icon: '💄', color: '#f59e0b' },
      { brand: 'Sephora',  icon: '✨', color: '#06b6d4' },
    ].map(r => `
      <div class="receipt-card">
        <span class="rc-emoji">${r.icon}</span>
        <div class="rc-brand">${r.brand}</div>
        <div class="rc-status">✓ Order Placed</div>
      </div>
    `).join('');

    successBg.classList.remove('hidden');
    launchConfetti();
  }

  function launchConfetti() {
    const canvas = $('confetti-canvas');
    const ctx    = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const COLS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ec4899','#06b6d4','#f43f5e','#a3e635'];
    const pieces = Array.from({length: 120}, () => ({
      x:  Math.random() * canvas.width,
      y:  -10 - Math.random() * canvas.height * 0.5,
      r:  2 + Math.random() * 6,
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 8,
      c:  COLS[Math.floor(Math.random() * COLS.length)],
      shape: Math.random() > 0.4 ? 'rect' : 'circle',
    }));

    function drawConfetti() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      pieces.forEach(p => {
        if (p.y > canvas.height + 20) return;
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * Math.PI / 180);
        ctx.fillStyle = p.c;
        ctx.globalAlpha = Math.max(0, 1 - p.y / canvas.height);
        if (p.shape === 'rect') ctx.fillRect(-p.r, -p.r/2, p.r*2, p.r);
        else { ctx.beginPath(); ctx.arc(0,0,p.r,0,Math.PI*2); ctx.fill(); }
        ctx.restore();
        p.x  += p.vx; p.y  += p.vy;
        p.rot += p.vr; p.vy += 0.05;
      });
      if (alive) confettiAF = requestAnimationFrame(drawConfetti);
      else       ctx.clearRect(0,0,canvas.width,canvas.height);
    }
    if (confettiAF) cancelAnimationFrame(confettiAF);
    drawConfetti();
  }

  // ──────────────────────────────────────────────────────────────────
  // REAL API FLOW (non-mock)
  // ──────────────────────────────────────────────────────────────────
  async function runRealFlow() {
    if (running) return;
    running = true;
    disableControls(true);
    resetAllNodes();
    const request = reqInput.value.trim() || "Find vitamin C serum from L'Oreal and matte lipstick from Sephora";

    try {
      log('Connecting to Orchestrator at localhost:7000...', 'orchestrator');
      setNode('orchestrator', 'Calling API...', 'processing');

      // Run the simulated animation in parallel with the real API call
      const simPromise = runFlow_sim(request);

      const resp = await fetch('/demo/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request, confirm: false }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      await simPromise;
      showModal({
        items: Object.entries(data.itemsByBrand || {}).map(([brand, item]) => ({
          brand, label: brand, icon: brand === 'LOreal' ? '💄' : '✨',
          title: item?.title || brand,
          link:  item?.link  || '#',
        })),
        plan: data.plan_text || 'Plan ready.',
        sessions: Object.entries(data.created || {}).map(([brand, v]) => ({
          brand, id: v?.checkout?.id || 'N/A',
        })),
      });
    } catch (err) {
      log(`Error: ${err.message}`, 'error');
      setNode('orchestrator', 'Error', 'idle');
    } finally {
      running = false;
      disableControls(false);
    }
  }

  // Parallel simulation for the real mode (visual only)
  async function runFlow_sim(request) {
    // Just a trimmed version of the animation without the modal
    setNode('orchestrator','Parsing..','processing');
    setConnActive('user','orchestrator',true);
    firePacket('user','orchestrator',2,300);
    await sleep(800);
    setConnActive('orchestrator','discovery',true);
    firePacket('orchestrator','discovery',3,250);
    setNode('discovery','Searching..','processing');
    await sleep(2000);
    firePacket('discovery','orchestrator',2,280);
    setNode('discovery','Returned','active');
    await sleep(500);
    firePacket('orchestrator','discovery',3,250);
    setNode('discovery','Searching..','processing');
    await sleep(2000);
    firePacket('discovery','orchestrator',2,280);
    setNode('discovery','Done','active');
    setConnActive('orchestrator','discovery',false);
    setConnActive('orchestrator','checkout',true);
    firePacket('orchestrator','checkout',3,250);
    setNode('checkout','Creating UCP..','processing');
    await sleep(800);
    setConnActive('checkout','loreal',true);
    setConnActive('checkout','sephora',true);
    firePacket('checkout','loreal',2,300);
    firePacket('checkout','sephora',2,350);
    await sleep(1500);
    setNode('loreal','Session Ready','active');
    setNode('sephora','Session Ready','active');
    await sleep(800);
    firePacket('checkout','orchestrator',2,280);
    setNode('checkout','Plan Ready','active');
    setNode('orchestrator','Plan Ready','active');
  }

  // ──────────────────────────────────────────────────────────────────
  // AUTO-PLAY
  // ──────────────────────────────────────────────────────────────────
  autoBtn.addEventListener('click', async () => {
    if (running) return;
    await runFlow();
    // Wait for the modal then auto-confirm
    await sleep(2500);
    if (planModal.classList.contains('open')) {
      await completePurchase();
    }
  });

  // ──────────────────────────────────────────────────────────────────
  // EVENTS
  // ──────────────────────────────────────────────────────────────────
  runBtn.addEventListener('click', () => {
    if (mockMode.checked) runFlow();
    else                  runRealFlow();
  });

  clearBtn.addEventListener('click', () => {
    logBox.innerHTML = '<div class="log-line system"><span class="log-ts">--:--:--</span><span class="log-msg">◈ Log cleared.</span></div>';
  });

  confirmBtn.addEventListener('click', completePurchase);
  cancelBtn.addEventListener('click',  closeModal);
  modalClose.addEventListener('click', closeModal);

  restartBtn.addEventListener('click', () => {
    successBg.classList.add('hidden');
    if (confettiAF) cancelAnimationFrame(confettiAF);
    resetAllNodes();
  });

  // Close modal on backdrop click
  planModal.addEventListener('click', e => {
    if (e.target === planModal) closeModal();
  });

  // ──────────────────────────────────────────────────────────────────
  // RESIZE + INIT
  // ──────────────────────────────────────────────────────────────────
  window.addEventListener('resize', () => drawConnections());

  // Initial draw after layout settles
  setTimeout(() => drawConnections(), 400);
  setTimeout(() => drawConnections(), 1000); // redraw after fonts load
});
