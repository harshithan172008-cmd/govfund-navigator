// ---- NAVIGATION ----
function showPage(page) {
  document.getElementById('page-home').classList.toggle('hidden', page !== 'home');
  document.getElementById('page-history').classList.toggle('hidden', page !== 'history');
  document.getElementById('nav-home').classList.toggle('active', page === 'home');
  document.getElementById('nav-history').classList.toggle('active', page === 'history');
  if (page === 'history') loadHistory();
}

// ---- MAIN FLOW ----
async function runAnalysis() {
  const biz = {
    name: document.getElementById('biz-name').value.trim(),
    type: document.getElementById('biz-type').value,
    state: document.getElementById('biz-state').value,
    revenue: document.getElementById('biz-revenue').value,
    age: document.getElementById('biz-age').value,
    sector: document.getElementById('biz-sector').value,
    desc: document.getElementById('biz-desc').value.trim()
  };

  if (!biz.type || !biz.state || !biz.sector) {
    alert('Please fill in Business Type, State, and Sector at minimum.');
    return;
  }

  show('step-loading');
  hide('step-form');
  hide('step-results');

  const p1 = document.getElementById('p1');
  const p2 = document.getElementById('p2');
  const s1 = document.getElementById('s1');
  const s2 = document.getElementById('s2');
  const msg = document.getElementById('loading-msg');

  p1.classList.add('active');
  s1.textContent = 'Running...';
  msg.textContent = 'Agent 1 is scoring your eligibility...';

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(biz)
    });

    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    p1.classList.remove('active');
    p1.classList.add('done');
    s1.textContent = `Score: ${data.agent1.score}/100 ✓`;
    p2.classList.add('active');
    s2.textContent = 'Running...';
    msg.textContent = 'Agent 2 found your top schemes!';

    await new Promise(r => setTimeout(r, 600));

    p2.classList.remove('active');
    p2.classList.add('done');
    s2.textContent = `${data.agent2.schemes.length} schemes found ✓`;

    await new Promise(r => setTimeout(r, 400));

    renderResults(data.agent1, data.agent2);
    hide('step-loading');
    show('step-results');

  } catch (err) {
    alert('Error: ' + err.message);
    show('step-form');
    hide('step-loading');
    p1.className = 'pipeline-step';
    p2.className = 'pipeline-step';
    s1.textContent = 'Waiting...';
    s2.textContent = 'Waiting...';
  }
}

// ---- RENDER RESULTS ----
function renderResults(a1, a2) {
  // Score ring animation
  const circle = document.getElementById('score-circle');
  const circumference = 314;
  const offset = circumference - (a1.score / 100) * circumference;
  document.getElementById('score-num').textContent = a1.score;
  document.getElementById('score-summary').textContent = a1.summary;

  setTimeout(() => {
    circle.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)';
    circle.style.strokeDashoffset = offset;
  }, 100);

  // Strengths & gaps
  const sr = document.getElementById('strengths-row');
  const gr = document.getElementById('gaps-row');
  sr.innerHTML = (a1.strengths || []).map(s => `<span class="tag">✓ ${s}</span>`).join('');
  gr.innerHTML = (a1.gaps || []).map(g => `<span class="tag">⚠ ${g}</span>`).join('');

  // Schemes
  const list = document.getElementById('schemes-list');
  document.getElementById('schemes-count').textContent = `${a2.schemes.length} schemes found`;
  list.innerHTML = '';

  a2.schemes.forEach((scheme, i) => {
    const card = document.createElement('div');
    card.className = 'scheme-card' + (i === 0 ? ' open' : '');
    card.innerHTML = `
      <div class="scheme-header" onclick="toggleScheme(this)">
        <div class="scheme-left">
          <div class="scheme-name">${scheme.name}</div>
          <div class="scheme-meta">${scheme.ministry} · <strong style="color:var(--green)">${scheme.benefit}</strong></div>
        </div>
        <div class="scheme-right">
          <span class="match-badge">${scheme.matchScore}% match</span>
          <span class="chevron">▼</span>
        </div>
      </div>
      <div class="scheme-body">
        <p class="scheme-desc">${scheme.description}</p>
        <div class="docs-header">
          <span class="docs-title">📄 Documents Required</span>
          <button class="copy-btn" onclick="copyDocs(this, ${i})">Copy List</button>
        </div>
        <ul class="checklist" id="docs-${i}">
          ${scheme.documents.map(d => `<li>${d}</li>`).join('')}
        </ul>
        <div class="scheme-footer">
          <span class="deadline-tag">🗓 ${scheme.deadline || 'Ongoing'}</span>
          ${scheme.applyUrl ? `<a class="apply-link" href="${scheme.applyUrl}" target="_blank">Apply Now →</a>` : ''}
        </div>
      </div>
    `;
    list.appendChild(card);
  });

  // Store schemes for copy function
  window._schemes = a2.schemes;
}

function toggleScheme(header) {
  header.parentElement.classList.toggle('open');
}

function copyDocs(btn, i) {
  const docs = window._schemes[i].documents;
  const text = docs.map((d, j) => `${j + 1}. ${d}`).join('\n');
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Copied ✓';
    setTimeout(() => btn.textContent = 'Copy List', 2000);
  });
}

// ---- HISTORY ----
async function loadHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = '<p style="color:var(--muted2);text-align:center;padding:2rem">Loading...</p>';
  try {
    const res = await fetch('/api/history');
    const data = await res.json();
    if (!data.length) {
      list.innerHTML = '<div class="empty-state"><p style="font-size:2rem">📭</p><p>No searches yet. Go analyze a business!</p></div>';
      return;
    }
    list.innerHTML = data.map(row => `
      <div class="history-card">
        <div>
          <div class="history-name">${row.business_name || 'Unnamed Business'}</div>
          <div class="history-meta">${row.business_type} · ${row.state} · ${row.sector} · ${new Date(row.created_at).toLocaleDateString('en-IN')}</div>
        </div>
        <div class="history-score">${row.score}</div>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = '<p style="color:var(--muted2);text-align:center">Could not load history.</p>';
  }
}

// ---- UTILS ----
function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }

function resetApp() {
  hide('step-results');
  show('step-form');
  document.getElementById('score-circle').style.strokeDashoffset = '314';
  document.getElementById('p1').className = 'pipeline-step';
  document.getElementById('p2').className = 'pipeline-step';
  document.getElementById('s1').textContent = 'Waiting...';
  document.getElementById('s2').textContent = 'Waiting...';
}