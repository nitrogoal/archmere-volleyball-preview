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
// Each theme night gets its own look (see theme.css .theme-*)
const themeClass = t => 'theme-' + t.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const themeTag = (t, extra = '') => t ? `<span class="theme-pill ${themeClass(t)} ${extra}">${t === 'USA' ? '<i aria-hidden="true">★</i>' : ''}${esc(t)} night</span>` : '';
const themePill = s => themeTag(themeFor(s));

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
  return `<details class="pop subscribe"><summary>Subscribe</summary><div class="pop-menu"><p>Games, times and final scores update in your calendar automatically.</p><a href="webcal://${feed}">Apple / Outlook</a><a href="https://calendar.google.com/calendar/r?cid=${encodeURIComponent('webcal://' + feed)}" target="_blank" rel="noopener noreferrer">Google Calendar ↗</a><button type="button" data-copy="https://${feed}">Copy calendar link</button></div></details>`;
}
document.addEventListener('click', e => {
  // One menu open at a time; tapping outside closes it
  for (const d of document.querySelectorAll('details.pop[open]')) if (!d.contains(e.target)) d.open = false;
  const c = e.target.closest('[data-copy]');
  if (c) { navigator.clipboard?.writeText(c.dataset.copy).then(() => toast('Calendar link copied'), () => prompt('Copy this calendar link:', c.dataset.copy)); c.closest('details').open = false; }
});

/* ---------- Live stream ---------- */
// Prefer the exact broadcast (found by the updater); fall back to the school's NFHS page
const streamHref = s => s.nfhsEventUrl || s.streamUrl || '';
// Verified game recordings (dist/videos.json); free YouTube replays lead, NFHS (subscription) follows
let VIDEOS = {};
fetch('videos.json').then(r => r.ok ? r.json() : []).then(list => {
  for (const v of list) (VIDEOS[`${v.date}|${v.opponent}`] ||= []).push(v);
  if (D) render(false);
}).catch(() => {});
const videosFor = s => VIDEOS[`${s.date}|${s.opponent}`] || [];
const replayLink = s => {
  const v = videosFor(s)[0], n = streamHref(s);
  if (!v && !n) return '';
  const a = (href, label, cls = '') => `<a class="replay-link ${cls}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  return (v ? a(v.url, '▶ Watch replay ↗') : '') + (n ? a(n, v ? 'NFHS replay ↗' : '▶ Watch replay ↗', v ? 'alt' : '') : '');
};
const liveLink = s => streamHref(s) ? `<a class="live-link" href="${esc(streamHref(s))}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">●</span> Watch live ↗</a>` : '';

/* ---------- Milestones ---------- */
const STEPS = [250, 500, 750, 1000];
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

/* ---------- Honors & college (dist/awards.json, kept outside data.json so updater refreshes never drop it) ---------- */
let AWARDS = {}, COLLEGE = {};
fetch('awards.json').then(r => r.ok ? r.json() : {}).then(a => {
  AWARDS = a.players || {}; COLLEGE = a.college || {};
  if (D) render(false);
}).catch(() => {});
// Newest season first; within a season, state honors before all-america, conference, then everything else
const HONOR_ORDER = [/player of the year|hall of fame/i, /all-state/i, /all-america/i, /all-conference/i];
const honorRank = a => { const i = HONOR_ORDER.findIndex(re => re.test(a.award)); return i < 0 ? HONOR_ORDER.length : i; };
const byHonor = (a, b) => (b.year || 0) - (a.year || 0) || honorRank(a) - honorRank(b);
const honorsFor = name => (AWARDS[name] || []).slice().sort(byHonor);
// Hero chips: the headline honors only (Hall of Fame, All-State, All-Conference), counted by season
const HONOR_TIERS = [['Hall of Fame', /hall of fame/i], ['All-State', /all-state/i], ['All-Conference', /all-conference/i]];
const honorCount = (list, re) => { const hits = list.filter(a => re.test(a.award)); return new Set(hits.filter(a => a.year).map(a => a.year)).size + hits.filter(a => !a.year).reduce((n, a) => n + (parseInt(a.award) || 1), 0); };
const honorChips = name => {
  const list = honorsFor(name);
  return HONOR_TIERS.map(([label, re]) => [label, honorCount(list, re)]).filter(([, n]) => n).slice(0, 2)
    .map(([label, n]) => `<span class="ms-chip honor-chip"><i aria-hidden="true">★</i>${n > 1 ? `<b>${n}×</b> ` : ''}${label}</span>`).join('');
};
const srcLink = (url, label) => url ? `<a class="h-src" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="Source for ${esc(label)}"><span>Source</span> ↗</a>` : '';
function playerHonors(name) {
  const list = honorsFor(name); if (!list.length) return '';
  return `<section class="player-honors" aria-label="Honors"><h2>Honors</h2><ul class="honor-list">${list.map((a, i) => `<li><span class="h-year${i && list[i - 1].year === a.year ? ' same' : ''}">${a.year ? esc(a.year) : '—'}</span><span class="h-what"><b>${esc(a.award)}</b><small>${esc(a.org)}</small></span>${srcLink(a.url, a.award)}</li>`).join('')}</ul></section>`;
}
// College volleyball: its own line in the player hero, not an Archmere honor
const collegeVerb = c => c.status === 'Played' ? 'Played at' : c.status === 'Committed' ? 'Committed to' : 'Signed with';
function playerCollege(name) {
  const c = COLLEGE[name]; if (!c) return '';
  return `<a class="hero-college" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer"><span>College volleyball</span><b>${esc(c.school)}</b><small>${collegeVerb(c).split(' ')[0]}${c.year ? ' ' + esc(c.year) : ''} ↗</small></a>`;
}

/* ---------- Awards page: every honor by season, then college volleyball ---------- */
const AWARD_TYPES = {'All-State': a => /all-state/i.test(a.award), 'All-Conference': a => /all-conference/i.test(a.award), 'Other honors': a => !/all-state|all-conference/i.test(a.award)};
function awardsPage(q) {
  const type = AWARD_TYPES[q.get('type')] ? q.get('type') : '';
  const all = Object.entries(AWARDS).flatMap(([name, list]) => list.map(a => ({...a, name}))).filter(a => !type || AWARD_TYPES[type](a));
  const players = new Set(all.map(a => a.name)).size;
  const years = [...new Set(all.map(a => a.year || 0))].sort((a, b) => b - a);
  const classTag = name => { const p = pByName(name); return p && p.year !== 'Unknown' ? `<span class="ms-cat">’${String(p.year).slice(2)}</span>` : ''; };
  const season = y => {
    const rows = all.filter(a => (a.year || 0) === y).sort(byHonor), names = [...new Set(rows.map(a => a.name))];
    return `<section class="block"><div class="sec-head"><h2>${y || 'Year not listed'}</h2>${y && D.games.some(g => g.season === y) ? `<a href="${route('season', {year: y})}">Season →</a>` : ''}</div><div class="list">${names.map(n => `<a class="row award-row" href="${pLink(n)}"><span class="what"><b>${esc(n)}</b><small>${rows.filter(a => a.name === n).map(a => esc(a.award)).join(' · ')}</small></span>${classTag(n)}</a>`).join('')}</div></section>`;
  };
  const college = Object.entries(COLLEGE).sort((a, b) => (b[1].year || 0) - (a[1].year || 0) || a[0].localeCompare(b[0]));
  return `<div class="awards-page"><div class="archive-poster"><div><div class="eyebrow">THE AUKS / HONOR ROLL</div><h1>Awards</h1><p>All-State, all-conference and more, earned in an Archmere uniform.<br>Tap a name for each honor and its source.</p></div><span class="archive-stamp"><small>HONORS</small><strong>${all.length}</strong></span></div><div class="tools">${select('Award type', 'type', Object.keys(AWARD_TYPES), type, 'All awards')}</div><p class="count">${all.length} ${all.length === 1 ? 'honor' : 'honors'} · ${players} ${players === 1 ? 'player' : 'players'}</p>${years.map(season).join('')}${!all.length ? '<p class="empty">No honors of this type on file yet.</p>' : ''}${!type && college.length ? `<section class="block"><div class="sec-head"><h2>College volleyball</h2><span class="quiet">${college.length} players</span></div><div class="list">${college.map(([name, c]) => `<a class="row award-row" href="${pLink(name)}"><span class="what"><b>${esc(name)}</b><small>${collegeVerb(c)} ${esc(c.school)}${c.year ? ' · ' + esc(c.year) : ''}</small></span>${classTag(name)}</a>`).join('')}</div></section>` : ''}<p class="record-context">Honors come from Archmere Athletics announcements and Delaware press. Seasons without a published list may be missing honors. <a href="#about">Sources &amp; coverage ↗</a></p></div>`;
}
pages.awards = awardsPage;

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

/* ---------- Exact "updated" time ----------
   The time of the last commit that changed dist/data.json (the updater's publishes and any manual edit). */
let lastUpdate;
async function lastDataChange() {
  if (lastUpdate !== undefined) return lastUpdate;
  try { const c = JSON.parse(sessionStorage.getItem('auksvb-updated') || 'null'); if (c && Date.now() - c.at < 6e5) return lastUpdate = c.when; } catch {}
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/commits?path=dist/data.json&per_page=1`);
    const when = r.ok ? (await r.json())[0]?.commit?.committer?.date || null : null;
    try { sessionStorage.setItem('auksvb-updated', JSON.stringify({at: Date.now(), when})); } catch {}
    return lastUpdate = when;
  } catch { return lastUpdate = null; }
}
const etStamp = iso => new Date(iso).toLocaleString('en-US', {timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'}) + ' ET';
function fillUpdated() {
  lastDataChange().then(when => {
    if (!when) return; // keep the date-only text already shown
    for (const el of document.querySelectorAll('[data-updated]')) el.textContent = (el.dataset.prefix ?? (el.closest('footer') ? '' : 'Results ')) + (el.closest('footer') ? 'Updated ' : 'updated ') + etStamp(when);
  });
}
fillUpdated();

/* ---------- Next scheduled check ----------
   Mirrors the cron lines in .github/workflows/update-from-source.yml (UTC):
   '7,27,47 20-23,0-5 * * *' and '37 10-19 * * *'. Keep the two in sync. */
const CHECK_SLOTS = [{minutes: [7, 27, 47], hours: [20, 21, 22, 23, 0, 1, 2, 3, 4, 5]}, {minutes: [37], hours: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]}];
function nextCheck(from = new Date()) {
  const t = new Date(from); t.setUTCSeconds(0, 0);
  for (let i = 1; i <= 24 * 60; i++) {
    const c = new Date(t.getTime() + i * 60000);
    if (CHECK_SLOTS.some(s => s.hours.includes(c.getUTCHours()) && s.minutes.includes(c.getUTCMinutes()))) return c;
  }
  return null;
}
function fillNextCheck() {
  const el = document.querySelector('footer [data-next-check]'); if (!el) return;
  const n = nextCheck(); if (!n) { el.textContent = ''; return; }
  const sameDay = n.toLocaleDateString('en-US', {timeZone: 'America/New_York'}) === new Date().toLocaleDateString('en-US', {timeZone: 'America/New_York'});
  el.textContent = ` · Next check ~${sameDay ? '' : 'tomorrow '}${n.toLocaleTimeString('en-US', {timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit'})} ET`;
}
fillNextCheck(); setInterval(fillNextCheck, 60000);
