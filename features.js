// Team-site extras layered on app.js: theme nights, calendar links, milestones,
// head-to-head pages, live-stream links and quick search.
// app.js globals used here: D, $, esc, route, serial, fmt, cats, pByName, pLink, render, pages, crest, todayET.

/* ---------- Theme nights (dist/themes.json, kept outside data.json so updater refreshes never drop it) ---------- */
let THEMES = {};
const themeFor = s => THEMES[`${s.date}|${s.opponent}`] || '';
fetch('themes.json').then(r => r.ok ? r.json() : []).then(list => {
  THEMES = Object.fromEntries(list.map(t => [`${t.date}|${t.opponent}`, t.theme]));
  if (D) render(false);
}).catch(() => {});
const themePill = s => themeFor(s) ? `<span class="theme-pill">${esc(themeFor(s))} night</span>` : '';

/* ---------- Calendar ---------- */
const calSlug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Same key scheme as scripts/build-ics.mjs: season-kind-opponent-nth meeting (by date)
function calKey(s) {
  const same = (D.currentSchedule || []).filter(x => x.season === s.season && x.kind === s.kind && x.opponent === s.opponent).sort((a, b) => serial(a.date) - serial(b.date));
  return `${s.season}-${s.kind}-${calSlug(s.opponent)}-${same.findIndex(x => x.date === s.date) + 1}`;
}
function googleCalUrl(s) {
  const [m, d, y] = s.date.split('/').map(Number), pad = n => String(n).padStart(2, '0'), day = `${2000 + (y % 100)}${pad(m)}${pad(d)}`;
  const t = /^(\d{1,2})(?::(\d{2}))?\s*([ap])m$/i.exec(s.time || '');
  let dates;
  if (t) { let h = Number(t[1]) % 12 + (t[3].toLowerCase() === 'p' ? 12 : 0); dates = `${day}T${pad(h)}${t[2] || '00'}00/${day}T${pad(Math.min(h + 2, 23))}${t[2] || '00'}00`; }
  else { const n = new Date(Date.UTC(2000 + (y % 100), m - 1, d + 1)); dates = `${day}/${n.getUTCFullYear()}${pad(n.getUTCMonth() + 1)}${pad(n.getUTCDate())}`; }
  const title = s.kind === 'Match' ? `Archmere ${s.homeAway === 'H' ? 'vs' : 'at'} ${s.opponent}` : `Archmere: ${s.kind} – ${s.opponent}`;
  const p = new URLSearchParams({action: 'TEMPLATE', text: title + (themeFor(s) ? ` · ${themeFor(s)}` : ''), dates, ctz: 'America/New_York', location: s.location || '', details: [themeFor(s) ? `Theme: ${themeFor(s)}` : '', s.notes || '', `${location.origin}/#schedule`].filter(Boolean).join('\n')});
  return 'https://calendar.google.com/calendar/render?' + p;
}
const calMenu = s => `<details class="pop"><summary>Add to calendar</summary><div class="pop-menu"><a href="cal/${calKey(s)}.ics" download>Apple / Outlook</a><a href="${googleCalUrl(s)}" target="_blank" rel="noopener noreferrer">Google Calendar ↗</a></div></details>`;
function subscribeMenu() {
  const feed = `${location.host}${location.pathname.replace(/[^/]*$/, '')}schedule.ics`;
  return `<details class="pop subscribe"><summary>Subscribe to the season</summary><div class="pop-menu"><p>Games, times and final scores update in your calendar automatically.</p><a href="webcal://${feed}">Apple / Outlook</a><a href="https://calendar.google.com/calendar/r?cid=${encodeURIComponent('webcal://' + feed)}" target="_blank" rel="noopener noreferrer">Google Calendar ↗</a><button type="button" data-copy="https://${feed}">Copy calendar link</button></div></details>`;
}
document.addEventListener('click', e => {
  // One menu open at a time; tapping outside closes it
  for (const d of document.querySelectorAll('details.pop[open]')) if (!d.contains(e.target)) d.open = false;
  const c = e.target.closest('[data-copy]');
  if (c) { navigator.clipboard?.writeText(c.dataset.copy).then(() => toast('Calendar link copied'), () => prompt('Copy this calendar link:', c.dataset.copy)); c.closest('details').open = false; }
});

/* ---------- Live stream ---------- */
const liveLink = s => s.streamUrl ? `<a class="live-link" href="${esc(s.streamUrl)}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">●</span> Watch live ↗</a>` : '';

/* ---------- Milestones ---------- */
const STEPS = [50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 750, 800, 900, 1000, 1250, 1500, 1750, 2000, 2500];
function careerRank(name, i) {
  const list = D.players.filter(p => p.values[i] != null).sort((a, b) => b.values[i] - a.values[i]);
  const v = pByName(name).values[i];
  return list.filter(p => p.values[i] > v).length + 1;
}
function milestones(onlyName) {
  const year = Math.max(...D.roster.map(r => r.season)), out = [];
  for (const r of D.roster.filter(r => r.season === year && r.role !== 'Manager' && (!onlyName || r.name === onlyName))) {
    const p = pByName(r.name); if (!p) continue;
    p.values.forEach((v, i) => {
      if (v == null) return;
      const next = STEPS.find(x => x > v); if (!next) return;
      const left = next - v;
      if (left <= Math.max(5, Math.round(next * 0.06))) out.push({name: r.name, jersey: r.jersey, cat: cats[i], v, next, left, rank: careerRank(r.name, i), share: left / next});
    });
  }
  return out.sort((a, b) => a.share - b.share);
}
const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
function milestonesBlock() {
  const list = milestones().slice(0, 4); if (!list.length) return '';
  return `<section class="block"><div class="sec-head"><h2>Milestones in reach</h2><a href="#records">Records →</a></div><div class="list">${list.map(m => `<a class="row ms-row" href="${pLink(m.name)}"><span class="ms-left"><b>${fmt(m.left)}</b><span>to go</span></span><span class="what"><b>${esc(m.name)}</b><small>${fmt(m.v)} career ${m.cat.toLowerCase()} · ${fmt(m.next)} is next${m.rank <= 10 ? ` · ${ordinal(m.rank)} all-time` : ''}</small></span><span class="ms-cat">${m.cat}</span></a>`).join('')}</div></section>`;
}
const playerMilestones = name => milestones(name).map(m => `<span class="ms-chip"><b>${fmt(m.left)}</b> ${m.cat.toLowerCase()} from ${fmt(m.next)} career${m.rank <= 10 ? ` · ${ordinal(m.rank)} all-time` : ''}</span>`).join('');

/* ---------- Head-to-head ---------- */
function h2h(name) {
  const gs = D.games.filter(g => g.opponent === name).sort((a, b) => serial(b.date) - serial(a.date));
  return {games: gs, w: gs.filter(g => g.result === 'W').length, l: gs.filter(g => g.result === 'L').length};
}
const h2hLink = name => { const h = h2h(name); return h.games.length ? `<a class="h2h-link" href="${route('opponent', {name})}">All-time ${h.w}–${h.l} →</a>` : ''; };
function opponentPage(q) {
  const name = q.get('name') || '', h = h2h(name);
  if (!h.games.length) return `<section class="pg-head bleed"><div class="wrap"><div><span class="label">Head-to-head</span><h1>No meetings on file</h1></div></div></section><p class="note"><a href="#games">Back to results</a></p>`;
  const year = Math.max(...D.roster.map(r => r.season)), first = h.games[h.games.length - 1], last = h.games[0];
  const upcoming = (D.currentSchedule || []).filter(s => s.season === year && s.kind === 'Match' && s.opponent === name && !s.gameId && serial(s.date) >= todayET());
  const bySeason = {}; for (const g of h.games) (bySeason[g.season] ||= []).push(g);
  const row = g => { const d = new Date(serial(g.date)); return `<a class="row" href="${route('game', {id: g.id})}"><span class="when"><span>${d.toLocaleDateString('en-US', {month: 'short'})}</span><b>${d.getDate()}</b></span><span class="what"><b>${g.homeAway === 'H' ? 'Home' : g.homeAway === 'A' ? 'Away' : 'Neutral'}${g.phase === 'Postseason' ? ' · Postseason' : ''}</b><small>${g.entries ? 'Box score' : 'Score only'}</small></span>${g.result ? `<span class="sc-score">${esc(g.score)} <span class="badge ${g.result === 'L' ? 'loss' : ''}">${g.result}</span></span>` : ''}</a>`; };
  return `<a class="back" href="#games">← Results</a><section class="pg-head bleed opp-head" data-word="${esc(name.split(' ')[0])}"><div class="wrap"><div class="opp-title">${crest(name)}<div><span class="label">Head-to-head · since ${first.season}</span><h1>${esc(name)}</h1></div></div><div class="meta"><b>${h.w}–${h.l}</b>${h.games.length} meetings · last ${esc(last.result)} ${esc(last.score)} (${last.season})</div></div></section><div class="stripe bleed"></div>
  ${upcoming.length ? `<section class="block"><div class="sec-head"><h2>Next meeting</h2><a href="#schedule">Schedule →</a></div>${upcoming.map(s => `<div class="list"><div class="row"><span class="when"><span>${new Date(serial(s.date)).toLocaleDateString('en-US', {month: 'short'})}</span><b>${new Date(serial(s.date)).getDate()}</b></span><span class="what"><b>${s.homeAway === 'H' ? 'Home' : 'Away'} · ${esc(s.time || 'Time TBD')}</b><small>${esc(s.location || '')}</small></span></div></div>`).join('')}</section>` : ''}
  ${Object.keys(bySeason).sort((a, b) => b - a).map(y => { const gs = bySeason[y], w = gs.filter(g => g.result === 'W').length, l = gs.filter(g => g.result === 'L').length; return `<section class="block"><div class="sec-head"><h2>${y}</h2><span class="quiet">${w}–${l}</span></div><div class="list">${gs.map(row).join('')}</div></section>`; }).join('')}`;
}
pages.opponent = opponentPage;

/* ---------- Quick search ---------- */
function openSearch() {
  const box = $('#qs'); if (!box || !D) return;
  box.hidden = false; document.body.classList.add('qs-open');
  const input = $('#qs-input'); input.value = ''; drawSearch(''); input.focus();
}
function closeSearch() { const box = $('#qs'); if (box && !box.hidden) { box.hidden = true; document.body.classList.remove('qs-open'); $('#search-open')?.focus(); } }
function drawSearch(term) {
  const t = term.trim().toLowerCase(), out = $('#qs-results');
  if (!t) { out.innerHTML = '<p class="qs-hint">Search players and opponents</p>'; return; }
  const players = D.players.filter(p => p.name.toLowerCase().includes(t)).sort((a, b) => (b.name.toLowerCase().startsWith(t) - a.name.toLowerCase().startsWith(t)) || a.name.localeCompare(b.name)).slice(0, 7);
  const opps = [...new Set(D.games.map(g => g.opponent))].filter(n => n.toLowerCase().includes(t)).slice(0, 4);
  out.innerHTML = (players.length ? `<h3>Players</h3>${players.map(p => `<a href="${route('player', {id: p.id})}"><b>${esc(p.name)}</b><small>${p.year === 'Unknown' ? 'Class unknown' : 'Class of ' + p.year}</small></a>`).join('')}` : '')
    + (opps.length ? `<h3>Opponents</h3>${opps.map(n => { const h = h2h(n); return `<a href="${route('opponent', {name: n})}"><b>${esc(n)}</b><small>All-time ${h.w}–${h.l}</small></a>`; }).join('')}` : '')
    || `<p class="qs-hint">No players or opponents match “${esc(term)}”.</p>`;
}
document.addEventListener('click', e => {
  if (e.target.closest('#search-open')) { openSearch(); return; }
  if (e.target.closest('#qs-close') || e.target.id === 'qs' || e.target.closest('#qs-results a')) closeSearch();
});
document.addEventListener('input', e => { if (e.target.id === 'qs-input') drawSearch(e.target.value); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeSearch(); for (const d of document.querySelectorAll('details.pop[open]')) d.open = false; }
  if (e.key === '/' && !/input|select|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); }
  if (e.key === 'Enter' && e.target.id === 'qs-input') { const a = $('#qs-results a'); if (a) { location.hash = a.getAttribute('href'); closeSearch(); } }
});
