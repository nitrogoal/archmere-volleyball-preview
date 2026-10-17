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
// Theme nights show as stickers (see Theme-night stickers below); extra = context class
const themeTag = (t, extra = '') => themeSticker(t, extra);
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
let AWARDS = {}, COLLEGE = {}, TEAM = {};
fetch('awards.json', {cache: 'no-cache'}).then(r => r.ok ? r.json() : {}).then(a => {
  AWARDS = a.players || {}; COLLEGE = a.college || {}; TEAM = a.team || {};
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
// College volleyball: one slim row above Honors, kept apart from Archmere honors
const collegeVerb = c => c.status === 'Played' ? 'Played at' : c.status === 'Committed' ? 'Committed to' : 'Signed with';
function playerCollege(name) {
  const c = COLLEGE[name]; if (!c) return '';
  return `<a class="player-college" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer"><span class="pc-label">College</span><span class="h-what"><b>${esc(c.school)}</b><small>${collegeVerb(c).split(' ')[0]}${c.year ? ' ' + esc(c.year) : ''}</small></span><span class="pc-src" aria-hidden="true">↗</span></a>`;
}

/* ---------- Awards page: state titles, every honor by season, then college volleyball ---------- */
// State-title banners hanging from a rafter (Awards page and home); animated by the Rafter banners block below
function rafterBanners() {
  const art = (TEAM.stateTitles || []).filter(t => t.banner).sort((a, b) => a.year - b.year);
  return art.length ? `<div class="rafters" role="list" aria-label="State championship banners">${art.map((t, k) => `<figure class="rafter-banner" role="listitem" style="--k:${k};--amp:${[1, -.8, 1.25][k % 3]};--dur:${[1.5, 1.9, 1.3][k % 3]}s"><img src="${esc(t.banner)}" alt="${esc(t.year)} DIAA girls volleyball state champions banner" width="600" height="915" decoding="async" draggable="false"></figure>`).join('')}</div>` : '';
}
const homeBanners = () => { const r = rafterBanners(); return r ? `<section class="block home-banners"><div class="sec-head"><h2>State champions</h2><a href="#awards">Awards →</a></div>${r}</section>` : ''; };
function stateTitles() {
  const titles = TEAM.stateTitles || []; if (!titles.length) return '';
  const finals = (TEAM.stateFinals || []).map(id => D.games.find(g => g.id === id)).filter(Boolean);
  const row = t => { const g = t.game && D.games.find(x => x.id === t.game), href = g ? route('game', {id: g.id}) : t.url, ext = g ? '' : ' target="_blank" rel="noopener noreferrer"';
    return `<a class="row ms-row" href="${esc(href)}"${ext}><span class="ms-left"><b>${esc(t.year)}</b></span><span class="what"><b>DIAA State Champions</b><small>${esc(t.detail || '')}</small></span><span class="ms-cat">${g ? 'Final' : 'DIAA ↗'}</span></a>`; };
  const finalsRow = finals.length ? `<div class="row ms-row st-finals"><span class="ms-left"><b>${finals.length}</b><span>finals</span></span><span class="what"><b>State runner-up</b><small>${finals.map(g => `<a href="${route('game', {id: g.id})}">${g.season}</a>`).join(' · ')}</small></span></div>` : '';
  const rafters = rafterBanners();
  return `<section class="block state-titles"><div class="sec-head"><h2>State champions</h2></div>${rafters}<div class="list">${titles.map(row).join('')}${finalsRow}</div></section>`;
}
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
  return `<div class="awards-page"><div class="archive-poster"><div><div class="eyebrow">THE AUKS / HONOR ROLL</div><h1>Awards</h1><p>All-State, all-conference and more, earned in an Archmere uniform.<br>Tap a name for each honor and its source.</p></div><span class="archive-stamp"><small>HONORS</small><strong>${all.length}</strong></span></div>${type ? '' : stateTitles()}<div class="tools">${select('Award type', 'type', Object.keys(AWARD_TYPES), type, 'All awards')}</div><p class="count">${all.length} ${all.length === 1 ? 'honor' : 'honors'} · ${players} ${players === 1 ? 'player' : 'players'}</p>${years.map(season).join('')}${!all.length ? '<p class="empty">No honors of this type on file yet.</p>' : ''}${!type && college.length ? `<section class="block"><div class="sec-head"><h2>College volleyball</h2><span class="quiet">${college.length} players</span></div><div class="list">${college.map(([name, c]) => `<a class="row award-row" href="${pLink(name)}"><span class="what"><b>${esc(name)}</b><small>${collegeVerb(c)} ${esc(c.school)}${c.year ? ' · ' + esc(c.year) : ''}</small></span>${classTag(name)}</a>`).join('')}</div></section>` : ''}<p class="record-context">Honors come from Archmere Athletics announcements and Delaware press. Seasons without a published list may be missing honors. <a href="#about">Sources &amp; coverage ↗</a></p></div>`;
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

/* ---------- Match-leader graphic: drawn on a canvas at Instagram portrait size, shown in the dialog and saved as-is ---------- */
const LG = {w: 1080, h: 1350, green: '#0f6b3a', deep: '#0a4a28', ink: '#0d1210', mint: '#d6efdc', fade: '#bfe8c9'};
// Win (and match-leader) graphics are bright kelly green; losses go dark: ink field, deep-green bars, green dots
const LG_THEMES = {
  win: {field: LG.green, bar: LG.ink, dot: '0,0,0', dotMax: 0.24, shadow: LG.ink, fade: LG.fade},
  loss: {field: LG.ink, bar: LG.deep, dot: '15,107,58', dotMax: 0.55, shadow: LG.green, fade: '#9aa69f'}
};
let lgLogo;
// Crisp full-colour Auks A (transparent PNG built from the clean brand mark)
const lgLoadLogo = () => lgLogo ||= new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = 'logo-a-600.webp'; });
async function lgFonts() {
  if (!document.fonts) return;
  await Promise.all(['400 100px Anton', '400 100px Yellowtail', '700 30px Inter', '800 30px Inter', '600 30px Inter'].map(f => document.fonts.load(f).catch(() => {})));
}
// Shrink a font size until the text fits the width
function lgFit(ctx, text, max, size, font) { do { ctx.font = font(size); } while (ctx.measureText(text).width > max && (size -= 2) > 10); return size; }
function lgTracked(ctx, text, x, y, spacing, align = 'left') {
  const w = [...text].reduce((s, c) => s + ctx.measureText(c).width + spacing, -spacing);
  let cx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  for (const c of text) { ctx.fillText(c, cx, y); cx += ctx.measureText(c).width + spacing; }
}
function lgStripe(ctx, y, h) {
  ctx.save(); ctx.beginPath(); ctx.rect(0, y, LG.w, h); ctx.clip();
  ctx.fillStyle = LG.ink; ctx.fillRect(0, y, LG.w, h); ctx.fillStyle = LG.green;
  for (let x = -h; x < LG.w + h; x += 34) { ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + 17, y + h); ctx.lineTo(x + 17 + h, y); ctx.lineTo(x + h, y); ctx.fill(); }
  ctx.restore();
}
function lgRound(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
// d: {value, cat, catShort[], names[], first, last, tie, meta, season, result, score, opponent, away, date, stats|null, lead}
async function leaderGraphic(d) {
  const tres = d.result ? `${d.result === 'W' ? 'WIN' : 'LOSS'} ${d.score}` : d.score || '';
  const tc = await playerTpl({kicker: d.tie ? 'TIED FOR THE MATCH LEAD' : 'MATCH LEADER', first: d.tie ? '' : d.first, last: d.tie ? d.names.join(' & ') : d.last,
    big: String(d.value), bigSize: 300, script: d.cat, sub: d.meta || `${d.season} SEASON`,
    tiles: d.stats ? d.stats.map((v, k) => [v == null ? '–' : String(v), d.catShort[k].toUpperCase()]) : null, hi: d.lead, tilesLabel: 'MATCH LINE',
    linesTitle: 'THE MATCH', lines: [[`${d.away ? '@' : 'VS'} ${d.opponent}`.toUpperCase(), ''], [tres.toUpperCase(), ''], [d.date.toUpperCase(), '']]});
  if (tc) return tc;
  const {c, x, W, M} = await lgFrame(d.tie ? 'TIED FOR THE LEAD' : 'MATCH LEADER', `${d.season} · GIRLS VARSITY`, d.last, 'win', {seed: `${d.names.join('&')}|${d.cat}|${d.date}`, style: 'type', words: [d.cat, d.tie ? 'AUKS' : d.last]});
  // The number, with the stat word in script slashed across its lower right
  const base = 640, nw = lgBig(x, String(d.value), M, base, String(d.value).length > 2 ? 400 : 500);
  const sx = M + nw - 50; lgFit(x, d.cat, W - M - sx + 30, 170, s => `400 ${s}px Yellowtail`);
  x.save(); x.translate(sx, base - 40); x.rotate(-0.14); x.fillStyle = LG.ink; x.fillText(d.cat, 6, 8); x.fillStyle = '#fff'; x.fillText(d.cat, 0, 0); x.restore();
  // Name: first name in mint over a big last name
  let y = d.tie ? 760 : 730;
  if (!d.tie && d.first) { x.font = '400 60px Anton'; x.fillStyle = LG.mint; x.fillText(d.first.toUpperCase(), M, y); y += 128; } else y += 110;
  const line = d.tie ? d.names.join(' & ').toUpperCase() : d.last.toUpperCase();
  const ns = lgFit(x, line, W - 2 * M, d.tie ? 120 : 150, s => `400 ${s}px Anton`); x.fillStyle = '#fff'; x.fillText(line, M, y); y += Math.max(40, ns * .1);
  if (d.meta) { x.font = '700 28px Inter'; x.fillStyle = LG.mint; lgTracked(x, d.meta.toUpperCase(), M, y + 26, 4); }
  // The player's line for the match, leading stat inverted
  if (d.stats) {
    const top = 1018, gap = 16, tw = (W - 2 * M - gap * 4) / 5, th = 130;
    d.stats.forEach((v, k) => {
      const tx = M + k * (tw + gap), lead = k === d.lead;
      lgRound(x, tx, top, tw, th, 18); x.fillStyle = lead ? '#fff' : 'rgba(255,255,255,.10)'; x.fill();
      if (!lead) { x.strokeStyle = 'rgba(255,255,255,.28)'; x.lineWidth = 2; x.stroke(); }
      x.textAlign = 'center'; x.font = '400 66px Anton'; x.fillStyle = lead ? LG.green : '#fff'; x.fillText(v == null ? '–' : String(v), tx + tw / 2, top + 78);
      x.textAlign = 'left'; x.font = '800 20px Inter'; x.fillStyle = lead ? LG.ink : LG.mint; lgTracked(x, d.catShort[k].toUpperCase(), tx + tw / 2, top + 112, 3, 'center');
    });
  }
  // Footer: result, opponent, date
  const res = d.result ? `${d.result === 'W' ? 'WIN' : 'LOSS'} ${d.score}` : d.score || '';
  x.font = '400 56px Anton'; x.fillStyle = '#fff'; x.fillText(res, M, 1282);
  const rw = res ? x.measureText(res).width + 26 : 0, opp = `${d.away ? '@' : 'VS'} ${d.opponent.toUpperCase()}`;
  lgFit(x, opp, W - 2 * M - rw - 200, 34, s => `400 ${s}px Anton`); x.fillStyle = '#8fd4a4'; x.fillText(opp, M + rw, 1282);
  x.font = '600 24px Inter'; x.fillStyle = '#9aa69f'; lgTracked(x, d.date.toUpperCase(), M, 1320, 3);
  return c;
}
// Share sheet on phones (Save Image / Instagram); download elsewhere. The file is prepared ahead so the tap
// still counts as a user gesture when navigator.share runs.
function shareGraphic(file, btn) {
  if (navigator.canShare?.({files: [file]})) { navigator.share({files: [file], title: 'Archmere Volleyball'}).catch(() => {}); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  if (btn) { const t = btn.innerHTML; btn.textContent = 'Saved ✓'; setTimeout(() => btn.innerHTML = t, 1800); }
}

/* ---------- Graphic dialog: one shell for every post-ready graphic (match leader, postgame) ---------- */
// opts: {title, body (html under the image), alt, file, render: () => Promise<canvas>, from}
function showGraphicDialog(opts) {
  let d = $('#leader-modal');
  if (!d) {
    d = document.createElement('dialog'); d.id = 'leader-modal'; d.className = 'leader-modal'; d.setAttribute('aria-labelledby', 'lm-title'); document.body.append(d);
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-lm-close]') || e.target.closest('a')) d.close(); });
    d.addEventListener('close', () => d._from?.focus({preventScroll: true}));
    addEventListener('hashchange', () => d.open && d.close());
  }
  const token = d._token = {}; d._from = opts.from;
  d.innerHTML = `<h2 class="lm-sr" id="lm-title">${esc(opts.title)}</h2><div class="lm-figure"></div><div class="lm-body">${opts.body || ''}<div class="lm-actions"><button type="button" class="lm-save" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m-5-5 5 5 5-5M5 19h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>Save image</button>${opts.links || ''}<button type="button" class="lm-done" data-lm-close>Close</button></div></div>`;
  d.showModal();
  opts.render().then(cv => cv.toBlob(blob => {
    if (d._token !== token || !blob) return;
    const img = new Image(); img.className = 'lm-img'; img.alt = opts.alt; img.src = URL.createObjectURL(blob); d.querySelector('.lm-figure').prepend(img);
    const file = new File([blob], opts.file, {type: 'image/png'}), btn = d.querySelector('.lm-save'); btn.disabled = false; btn.onclick = () => shareGraphic(file, btn);
  }, 'image/png'));
}
const fileSlug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ---------- Postgame graphic (schedule result cards) ---------- */
// Shared canvas frame: green field + dots, ink header with the lockup, stripes, ink footer
/* ---------- Drawing helpers for share-graphic backdrops (seeded random, Delaware outline, star, volleyball, auk) ---------- */
const lgRand = seed => { let h = 1779033703 ^ String(seed).length; for (const ch of String(seed)) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = h << 13 | h >>> 19; }
  return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; };
// Stylised Delaware outline (unit box, y down): twelve-mile arc at the top, straight western line, bay coast to the east
const DE_PATH = [[.40, 0], [.50, .01], [.58, .05], [.62, .11], [.60, .18], [.63, .27], [.70, .36], [.74, .44], [.80, .52], [.86, .60], [.95, .68], [1, .76], [.97, .84], [.98, 1], [.08, 1], [.06, .6], [.04, .3], [.03, .1], [.1, .06], [.22, .02]];
function lgDelaware(x, cx, cy, h, fill, star) {
  const w = h * .45; x.beginPath(); DE_PATH.forEach(([px, py], i) => x[i ? 'lineTo' : 'moveTo'](cx - w / 2 + px * w, cy - h / 2 + py * h)); x.closePath(); x.fillStyle = fill; x.fill();
  if (star) lgStar(x, cx - w / 2 + .52 * w, cy - h / 2 + .09 * h, h * .07, star);   // Claymont, at the northern tip
}
function lgStar(x, cx, cy, r, fill) { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.fillStyle = fill; x.fill(); }
function lgBall(x, cx, cy, r, ink, lw) {
  // Classic volleyball icon: outline plus three seams curving out from the centre, each with a parallel panel line
  x.save(); x.strokeStyle = ink; x.lineWidth = lw; x.lineCap = 'round'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke(); x.clip();
  for (let k = 0; k < 3; k++) {
    const t = -Math.PI / 2 + k * 2 * Math.PI / 3, ex = cx + Math.cos(t) * r * 1.05, ey = cy + Math.sin(t) * r * 1.05, c = t + .9;
    for (const off of [0, .32]) { const ox = Math.cos(t + Math.PI / 2) * r * off, oy = Math.sin(t + Math.PI / 2) * r * off;
      x.beginPath(); x.moveTo(cx + ox * .4, cy + oy * .4); x.quadraticCurveTo(cx + Math.cos(c) * r * .62 + ox, cy + Math.sin(c) * r * .62 + oy, ex + ox, ey + oy); x.stroke(); }
  }
  x.restore();
}
// A standing auk in profile: dark back and head, white breast, white eye patch, heavy grooved bill
function lgAuk(x, cx, cy, h, dark, light) {
  const s = h / 100; x.save(); x.translate(cx, cy); x.scale(s, s);
  x.fillStyle = dark;
  x.beginPath(); x.moveTo(-6, -48); x.bezierCurveTo(14, -52, 22, -38, 18, -26); x.bezierCurveTo(30, -10, 30, 30, 14, 46); x.lineTo(-14, 46); x.bezierCurveTo(-30, 26, -28, -12, -14, -26); x.bezierCurveTo(-20, -40, -16, -48, -6, -48); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(14, -42); x.lineTo(42, -36); x.quadraticCurveTo(44, -30, 36, -28); x.lineTo(14, -30); x.closePath(); x.fill();
  x.fillRect(-12, 44, 8, 6); x.fillRect(4, 44, 8, 6);
  x.fillStyle = light;
  x.beginPath(); x.moveTo(10, -24); x.bezierCurveTo(24, -6, 22, 30, 10, 42); x.bezierCurveTo(0, 30, -2, -4, 10, -24); x.closePath(); x.fill();
  x.beginPath(); x.ellipse(6, -38, 6, 4, -.2, 0, 7); x.fill();
  x.fillRect(26, -38, 2.5, 8); x.fillRect(31, -37, 2.5, 7);
  x.restore();
}
/* ---------- Share-graphic backdrops: original, code-drawn, tone-on-tone; seeded per card so a card always looks the same ----------
   type  : the card's own words as a tilted typographic wallpaper (match leader, player card)
   river : flowing contour lines of the river, a cropped Delaware outline, a star at Claymont (game day, losses)
   seams : sweeping volleyball panel bands, a dot fade and a big faint auk (postgame wins) */
function lgBackdrop(x, W, H, o) {
  const r = lgRand(o.seed), loss = o.mode === 'loss', L = loss ? '47,160,95' : '255,255,255';
  // Base field with soft light from the upper left
  const base = x.createRadialGradient(W * .2, 260, 60, W * .3, 520, 1100);
  if (loss) { base.addColorStop(0, '#18241f'); base.addColorStop(1, '#0b0f0d'); } else { base.addColorStop(0, '#16864c'); base.addColorStop(.55, '#0f6b3a'); base.addColorStop(1, '#0a4a28'); }
  x.fillStyle = base; x.fillRect(0, 0, W, H);
  x.save(); x.beginPath(); x.rect(0, 150, W, H - 150); x.clip();
  if (o.style === 'type') {
    const words = (o.words || ['AUKS']).filter(Boolean).map(w => String(w).toUpperCase()), size = 168, hot = 2 + Math.floor(r() * 5);
    x.translate(W / 2, 760); x.rotate(-.2 + (r() - .5) * .08); x.font = `400 ${size}px Anton`;
    for (let i = -7, row = 0; i <= 7; i++, row++) {
      const unit = words[row % words.length] + '  ·  ', uw = x.measureText(unit).width, y = i * size * .98;
      for (let sx = -1200 - r() * uw; sx < 1200; sx += uw) {
        if (row === hot) { x.fillStyle = 'rgba(214,239,220,.15)'; x.fillText(unit, sx, y); }
        else if (row % 2) { x.strokeStyle = `rgba(${L},.15)`; x.lineWidth = 2; x.strokeText(unit, sx, y); }
        else { x.fillStyle = `rgba(${L},.06)`; x.fillText(unit, sx, y); }
      }
    }
  } else if (o.style === 'river') {
    // Contour-like flow lines, every fifth one a little stronger
    x.lineWidth = 2; const n = 36;
    for (let i = 0; i < n; i++) {
      const y0 = 160 + i * (1060 / n), a = 16 + r() * 16, f = .0035 + r() * .003, p = r() * 6.3;
      x.strokeStyle = `rgba(${L},${i % 5 ? .1 : .22})`; x.beginPath();
      for (let px = -20; px <= W + 20; px += 10) { const y = y0 + Math.sin(px * f + p) * a + Math.sin(px * .012 + i * .7) * 7; px === -20 ? x.moveTo(px, y) : x.lineTo(px, y); }
      x.stroke();
    }
    // Delaware, cropped off the right edge, with Claymont marked
    const h = 1150, cx = W * .86, cy = 790, w = h * .45, sx = cx - w / 2 + .52 * w, sy = cy - h / 2 + .09 * h;
    lgDelaware(x, cx, cy, h, `rgba(${L},.1)`, null);
    x.strokeStyle = 'rgba(214,239,220,.35)'; x.lineWidth = 2; x.beginPath(); x.arc(sx, sy, 34, 0, 7); x.stroke();
    lgStar(x, sx, sy, 18, 'rgba(214,239,220,.6)');
    x.font = '700 19px Inter'; x.fillStyle = 'rgba(214,239,220,.5)'; lgTracked(x, 'CLAYMONT, DE', sx - 48, sy - 4, 4, 'right'); lgTracked(x, '39.80°N  75.46°W', sx - 48, sy + 22, 3, 'right');
  } else {
    // Volleyball panels: broad curved bands sweeping across, each edged with a fine highlight
    for (let i = 0; i < 6; i++) {
      const y1 = 120 + i * 230 + r() * 60, y2 = 520 + i * 210 + r() * 80, mid = 40 + i * 250 + r() * 60;
      x.beginPath(); x.moveTo(-120, y1); x.quadraticCurveTo(W * .5, mid, W + 120, y2);
      x.lineWidth = 92; x.strokeStyle = i % 2 ? 'rgba(0,0,0,.14)' : `rgba(${L},.08)`; x.stroke();
      x.lineWidth = 3; x.strokeStyle = `rgba(${L},.2)`; x.stroke();
    }
    // Dot fade toward the lower right
    for (let py = 170; py < H; py += 22) for (let px = 0; px < W; px += 22) {
      const t = (.9 * px / W + .45 * py / H) / 1.35, al = Math.max(0, Math.min(1, (t - .45) / .45)) * .2;
      if (al > 0) { x.fillStyle = `rgba(0,0,0,${al.toFixed(3)})`; x.beginPath(); x.arc(px, py, 4, 0, 7); x.fill(); }
    }
    lgAuk(x, W * .8, 820, 760, `rgba(${L},.1)`, 'rgba(0,0,0,.08)');
  }
  x.restore();
}
async function lgFrame(kicker, sub, watermark, mode = 'win', bg = {}) {
  const T = LG_THEMES[mode];
  await Promise.all([lgFonts(), lgLoadLogo()]);
  const c = document.createElement('canvas'); c.width = LG.w; c.height = LG.h;
  const x = c.getContext('2d'), W = LG.w, M = 64;
  // Backdrop, then a light scrim that deepens toward the stats
  lgBackdrop(x, W, LG.h, {seed: kicker + sub, style: 'type', ...bg, mode});
  const tint = mode === 'loss' ? '8,12,10' : '7,52,29', g = x.createLinearGradient(0, 170, 0, 1186);
  g.addColorStop(0, `rgba(${tint},0)`); g.addColorStop(.45, `rgba(${tint},.22)`); g.addColorStop(1, `rgba(${tint},.5)`);
  x.fillStyle = g; x.fillRect(0, 150, W, 1036);
  x.fillStyle = T.bar; x.fillRect(0, 0, W, 150);
  const logo = await lgLogo; if (logo) x.drawImage(logo, M - 6, 25, 140, 100);
  x.font = '400 46px Anton'; x.fillStyle = '#fff'; x.fillText('ARCHMERE', M + 156, 74);
  x.fillStyle = '#8fd4a4'; x.fillText('VOLLEYBALL', M + 156, 122);
  x.font = '800 24px Inter'; x.fillStyle = LG.mint; lgTracked(x, kicker, W - M, 80, 5, 'right');
  x.font = '600 24px Inter'; x.fillStyle = '#9aa69f'; lgTracked(x, sub, W - M, 116, 3, 'right');
  lgStripe(x, 150, 22); lgStripe(x, 1186, 22);
  x.fillStyle = mode === 'loss' ? 'rgba(10,74,40,.92)' : 'rgba(15,107,58,.9)'; x.fillRect(0, 1208, W, LG.h - 1208);
  x.font = '400 30px Anton'; x.fillStyle = LG.mint; lgTracked(x, 'AUKSVB.COM', W - M, 1320, 4, 'right');
  return {c, x, W, M, T};
}
// Gradient display number/word with the hard ink shadow
function lgBig(x, text, px, base, size, T = LG_THEMES.win) {
  x.font = `400 ${size}px Anton`; x.fillStyle = T.shadow; x.fillText(text, px + 16, base + 16);
  const g = x.createLinearGradient(0, base - size * .78, 0, base); g.addColorStop(0, '#fff'); g.addColorStop(.55, '#fff'); g.addColorStop(1, T.fade);
  x.fillStyle = g; x.fillText(text, px, base); return x.measureText(text).width;
}
// d: {win, loss, score, opponent, away, sets[[a,b]], record, date, place, season, phase, leaders[{cat, name, value}]}
async function postgameGraphic(d) {
  const tc = await finalTpl(d); if (tc) return tc;
  const mode = d.loss ? 'loss' : 'win', {c, x, W, M, T} = await lgFrame('FINAL', `${d.season} · GIRLS VARSITY`, d.win ? 'WIN' : 'FINAL', mode, {seed: `${d.opponent}|${d.date}`, style: d.loss ? 'river' : 'seams'});
  // Center the content block between the stripes when there are no sets/performers to fill it
  const nL = Math.min(3, d.leaders.length), need = 470 + (d.sets.length ? 180 : 30) + (nL ? 18 + nL * 84 : 0), off = Math.max(0, (1000 - need) / 2 - 10);
  x.save(); x.translate(0, off);
  // Opponent line
  x.font = '800 26px Inter'; x.fillStyle = LG.mint; lgTracked(x, (d.phase === 'Postseason' ? 'POSTSEASON' : 'REGULAR SEASON'), M, 236, 6);
  const opp = `${d.away ? '@' : 'VS'} ${d.opponent.toUpperCase()}`;
  lgFit(x, opp, W - 2 * M, 64, s => `400 ${s}px Anton`); x.fillStyle = '#fff'; x.fillText(opp, M, 312);
  // The score, with the script word slashed across it
  const score = d.score.replace('-', '–'), sw = lgBig(x, score, M, 640, 330, T);
  const word = d.win ? 'Auks win' : d.loss ? 'On to the next' : 'Final';
  const sx = Math.min(M + sw - 40, W - M - 300); lgFit(x, word, W - M - sx + 20, 130, s => `400 ${s}px Yellowtail`);
  x.save(); x.translate(sx, 610); x.rotate(-0.14); x.fillStyle = T.shadow; x.fillText(word, 6, 8); x.fillStyle = d.loss ? LG.mint : '#fff'; x.fillText(word, 0, 0); x.restore();
  // Set scores
  let y = 700;
  if (d.sets.length) {
    const n = d.sets.length, gap = 14, tw = Math.min(200, (W - 2 * M - gap * (n - 1)) / n), th = 120;
    d.sets.forEach(([a, b], k) => {
      const tx = M + k * (tw + gap), won = a > b;
      lgRound(x, tx, y, tw, th, 18); x.fillStyle = won ? (d.loss ? LG.green : '#fff') : 'rgba(255,255,255,.10)'; x.fill();
      if (!won) { x.strokeStyle = 'rgba(255,255,255,.28)'; x.lineWidth = 2; x.stroke(); }
      x.textAlign = 'center'; lgFit(x, `${a}–${b}`, tw - 20, 54, s => `400 ${s}px Anton`); x.fillStyle = won && !d.loss ? LG.green : '#fff'; x.fillText(`${a}–${b}`, tx + tw / 2, y + 70);
      x.textAlign = 'left'; x.font = '800 18px Inter'; x.fillStyle = won && !d.loss ? LG.ink : LG.mint; lgTracked(x, `SET ${k + 1}`, tx + tw / 2, y + 102, 3, 'center');
    });
    y += th + 60;
  } else y += 30;
  // Top performers
  if (d.leaders.length) {
    x.font = '800 22px Inter'; x.fillStyle = LG.mint; lgTracked(x, 'TOP PERFORMERS', M, y, 6); y += 18;
    for (const l of d.leaders.slice(0, 3)) {
      x.fillStyle = 'rgba(255,255,255,.22)'; x.fillRect(M, y, W - 2 * M, 2); y += 70;
      x.font = '800 22px Inter'; x.fillStyle = LG.mint; lgTracked(x, l.cat.toUpperCase(), M, y - 8, 4);
      x.font = '400 64px Anton'; const vw = x.measureText(String(l.value)).width; x.fillStyle = '#fff'; x.fillText(String(l.value), W - M - vw, y + 2);
      lgFit(x, l.name.toUpperCase(), W - 2 * M - 190 - vw - 30, 50, s => `400 ${s}px Anton`); x.fillStyle = '#fff'; x.fillText(l.name.toUpperCase(), M + 190, y);
      y += 14;
    }
  }
  x.restore();
  // Footer: date, place, record
  x.font = '400 50px Anton'; x.fillStyle = '#fff'; x.fillText(d.date.toUpperCase(), M, 1276);
  x.font = '600 24px Inter'; x.fillStyle = '#9aa69f'; lgTracked(x, [d.place, d.record ? 'RECORD ' + d.record : ''].filter(Boolean).join(' · ').toUpperCase(), M, 1320, 3);
  return c;
}
function openPostgame(id, from) {
  const g = D.games.find(x => x.id === id); if (!g || !g.result) return;
  const rows = D.stats.filter(s => s.id === id);
  const sets = (g.sets || []).filter(Boolean).map(v => String(v).split(/[-–:]/).map(Number)).filter(v => v.length === 2 && v.every(n => !isNaN(n)));
  const before = D.games.filter(x => x.season === g.season && x.result && serial(x.date) <= serial(g.date));
  const record = `${before.filter(x => x.result === 'W').length}–${before.filter(x => x.result === 'L').length}`;
  const short = n => { const p = n.replace(/\s*\(.*?\)/, '').trim().split(/\s+/); return p.length > 1 ? p[0][0] + '. ' + p.slice(1).join(' ') : n; };
  const leaders = [0, 3, 4, 2, 1].map(i => {
    const v = rows.map(r => r.values[i]).filter(v => v != null), max = Math.max(0, ...v); if (!max) return null;
    const who = rows.filter(r => r.values[i] === max); return {cat: cats[i], value: max, name: who.length > 2 ? who.length + ' tied' : who.map(r => short(r.name)).join(' & ')};
  }).filter(Boolean).slice(0, 3);
  const opp = g.opponent, title = `${g.result === 'W' ? 'Win' : 'Final'} ${g.score} ${g.homeAway === 'A' ? 'at' : 'vs'} ${opp}`;
  showGraphicDialog({
    from, title: 'Postgame: ' + title, alt: `Postgame graphic: ${title}, ${date(g.date)}`,
    file: `archmere-${fileSlug(opp)}-${g.date.replace(/\//g, '-')}.png`,
    links: `<a href="${route('game', {id})}">Box score <span aria-hidden="true">→</span></a>`,
    render: () => postgameGraphic({win: g.result === 'W', loss: g.result === 'L', score: g.score, opponent: opp, away: g.homeAway === 'A', sets, record, date: date(g.date), place: g.homeAway === 'H' ? 'Home' : g.homeAway === 'A' ? 'Away' : 'Neutral site', season: g.season, phase: g.phase, leaders})
  });
}
// Schedule result cards: tap the card (outside its links), or focus it and press Enter/Space
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-postgame]'), card = !btn && e.target.closest('article.game[data-game]');
  if (btn) { openPostgame(btn.dataset.postgame, btn); return; }
  if (card && !e.target.closest('a,button,summary,details')) openPostgame(card.dataset.game, card);
});
document.addEventListener('keydown', e => {
  const card = (e.key === 'Enter' || e.key === ' ') && e.target.matches?.('article.game[data-game]') && e.target;
  if (card) { e.preventDefault(); openPostgame(card.dataset.game, card); }
});

/* ---------- Schedule calendar view (#schedule?view=calendar): month grids for games, results and team dates ---------- */
const calShort = n => { const w = n.replace(/\b(HS|High School|School|Academy|of)\b/gi, '').trim().split(/\s+/); return (/^(St\.?|Saint|DE|Wilm\.?|Del\.?)$/i.test(w[0]) && w[1] ? w[0] + ' ' + w[1] : w[0]) || n; };
function scheduleCalendar(list, isUp, off, today) {
  if (!list.length) return '';
  const day = s => { const d = new Date(serial(s.date)); return {y: d.getFullYear(), m: d.getMonth(), d: d.getDate()}; };
  const byDay = {};
  for (const s of list) { const k = day(s); (byDay[`${k.y}-${k.m}-${k.d}`] ||= []).push(s); }
  const matches = list.filter(s => s.kind === 'Match'); if (matches.length) list = list.filter(s => serial(s.date) >= Math.min(...matches.map(m => serial(m.date))) && serial(s.date) <= Math.max(...matches.map(m => serial(m.date))) + 864e5 * 14);
  const ds = list.map(s => serial(s.date)), first = new Date(Math.min(...ds)), last = new Date(Math.max(...ds));
  const td = new Date(today), months = [];
  for (let y = first.getFullYear(), m = first.getMonth(); y < last.getFullYear() || (y === last.getFullYear() && m <= last.getMonth()); m === 11 ? (y++, m = 0) : m++) months.push([y, m]);
  const chip = s => {
    const g = s.game, team = s.kind !== 'Match', where = s.homeAway === 'H' ? 'vs' : s.homeAway === 'A' ? '@' : 'vs';
    if (team) return `<span class="cal-ev team" title="${esc(s.opponent)}"><small><span class="cal-long">${esc(s.kind)}</span><span class="cal-short" aria-hidden="true">${esc(s.kind==='Scrimmage'?'Scrim':s.kind.split(' ')[0])}</span></small><b>${esc(calShort(s.opponent))}</b></span>`;
    if (g && g.result) return `<button type="button" class="cal-ev res ${g.result === 'L' ? 'loss' : 'win'}" data-postgame="${esc(g.id)}" aria-haspopup="dialog" aria-label="${g.result === 'W' ? 'Win' : 'Loss'} ${esc(g.score)} ${where === '@' ? 'at' : 'vs'} ${esc(s.opponent)}, open postgame graphic">${crest(s.opponent)}<span class="cal-txt"><b>${g.result} ${esc(g.score)}</b><small>${where} ${esc(calShort(s.opponent))}</small></span></button>`;
    if (off(s)) return `<span class="cal-ev off" title="${esc(s.opponent)}: ${esc(s.status)}">${crest(s.opponent)}<span class="cal-txt"><b>${esc(s.status)}</b><small>${where} ${esc(calShort(s.opponent))}</small></span></span>`;
    return isUp(s) ? `<button type="button" class="cal-ev up ${s.homeAway === 'H' ? 'home' : ''}" data-gameday="${esc(s.date)}" data-opp="${esc(s.opponent)}" aria-haspopup="dialog" aria-label="${where === '@' ? 'At' : 'Versus'} ${esc(s.opponent)}, ${esc(s.time || 'time TBD')}, open game-day graphic">${crest(s.opponent)}<span class="cal-txt"><b>${esc((s.time || 'TBD').replace(/\s*(AM|PM)$/i, m => m.trim()[0].toLowerCase()))}</b><small>${where} ${esc(calShort(s.opponent))}</small></span></button>` : `<a class="cal-ev pending ${s.homeAway === 'H' ? 'home' : ''}" href="${route('opponent', {name: s.opponent})}" aria-label="${where === '@' ? 'At' : 'Versus'} ${esc(s.opponent)}, ${esc(s.time || 'time TBD')}">${crest(s.opponent)}<span class="cal-txt"><b>${esc((s.time || 'TBD').replace(/\s*(AM|PM)$/i, m => m.trim()[0].toLowerCase()))}</b><small>${where} ${esc(calShort(s.opponent))}</small></span></a>`;
  };
  return months.map(([y, m]) => {
    const lead = new Date(y, m, 1).getDay(), n = new Date(y, m + 1, 0).getDate(), label = new Date(y, m, 1).toLocaleDateString('en-US', {month: 'long', year: 'numeric'});
    const inMonth = list.filter(s => { const k = day(s); return k.y === y && k.m === m; }), w = inMonth.filter(s => s.game?.result === 'W').length, l = inMonth.filter(s => s.game?.result === 'L').length;
    const cells = Array.from({length: lead}, () => '<div class="cal-day blank" aria-hidden="true"></div>').join('') + Array.from({length: n}, (_, i) => {
      const evs = byDay[`${y}-${m}-${i + 1}`] || [], isToday = td.getFullYear() === y && td.getMonth() === m && td.getDate() === i + 1;
      return `<div class="cal-day${evs.length ? ' has' : ''}${isToday ? ' today' : ''}"><span class="cal-n">${i + 1}</span>${evs.map(chip).join('')}</div>`;
    }).join('');
    return `<h2 class="month">${label}<span>${inMonth.filter(s => s.kind === 'Match').length} matches${w + l ? ` · ${w}–${l}` : ''}</span></h2><div class="cal" role="group" aria-label="${label}"><div class="cal-head" aria-hidden="true">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<span><b>${d}</b><i>${d[0]}</i></span>`).join('')}</div><div class="cal-grid">${cells}</div></div>`;
  }).join('') + '<p class="cal-key"><span class="k win">W</span><span class="k loss">L</span> Tap any game for a shareable graphic</p>';
}

/* ---------- Rafter banners: drop and swing in when scrolled into view; each then swings on its own ---------- */
(() => {
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const live = new Set(), show = el => { if (!el.classList.contains('is-in')) setTimeout(() => el.classList.add('settled'), 3400); el.classList.add('is-in'); live.add(el); };
  // In view = at least a quarter of the rafter row on screen. Checked directly too: on first load the observer's
  // initial report can arrive before layout and never repeat.
  const inView = el => { const b = el.getBoundingClientRect(), h = Math.max(1, b.height); return b.bottom - h * .25 > 0 && b.top + h * .25 < innerHeight; };
  const io = 'IntersectionObserver' in window && new IntersectionObserver(entries => {
    for (const e of entries) e.isIntersecting ? show(e.target) : live.delete(e.target);
  }, {threshold: 0.25});
  const check = () => document.querySelectorAll('.rafters.will-drop:not(.is-in)').forEach(el => inView(el) && show(el));
  // One damped pendulum per banner; different stiffness, damping and weight so they swing out of step.
  // Scroll speed is read once per frame and smoothed, then applied as a steady force, so the motion is the same
  // whether the device fires a few scroll events (mouse wheel) or dozens (trackpad, phone).
  const FEEL = [{k: 34, c: 3.4, g: 1}, {k: 24, c: 2.8, g: 1.2}, {k: 46, c: 4.2, g: .85}];
  const MAX = 3, PUSH = 80, STEP = 1 / 120; // degrees; force per unit of scroll speed; physics step (s)
  const bodies = new Map();
  let frame = 0, last = 0, lastY = scrollY, speed = 0;
  const body = img => { if (!bodies.has(img)) bodies.set(img, {a: 0, v: 0, ...FEEL[(+img.closest('.rafter-banner')?.style.getPropertyValue('--k') || 0) % FEEL.length]}); return bodies.get(img); };
  const imgs = () => [...live].flatMap(r => r.classList.contains('settled') ? [...r.querySelectorAll('img')] : []);
  const step = t => {
    const dt = Math.min(.05, Math.max(.001, (t - last) / 1000)); last = t;
    const y = scrollY, now = (y - lastY) / dt; lastY = y;
    speed += (now - speed) * Math.min(1, dt * 10);                    // smoothed px/s
    const drive = Math.max(-1, Math.min(1, speed / 1600));            // -1..1
    for (const img of imgs()) body(img);
    let moving = Math.abs(speed) > 4;
    for (const [img, b] of bodies) {
      if (!img.isConnected) { bodies.delete(img); continue; }
      for (let n = Math.ceil(dt / STEP), h = dt / n; n--;) { b.v += (-b.k * b.a - b.c * b.v + drive * PUSH * b.g) * h; b.a += b.v * h; }
      if (Math.abs(b.a) > .01 || Math.abs(b.v) > .03) moving = true;
      img.style.transform = `rotate(${(MAX * Math.tanh(b.a / MAX)).toFixed(3)}deg)`;   // soft limit at ±3°
    }
    frame = moving && live.size ? requestAnimationFrame(step) : 0;
    if (!frame) speed = 0;
  };
  const run = () => { if (!frame && !still.matches && live.size) { last = performance.now(); lastY = scrollY; frame = requestAnimationFrame(step); } };
  addEventListener('scroll', () => { check(); run(); }, {passive: true});
  // Hands on: brushing the mouse (or a sliding finger) across a banner pushes it the way you move; a tap pokes it
  // away from the finger. Listeners are passive, so scrolling is never blocked. Clockwise (+) swings the bottom left.
  const banner = e => !still.matches && e.target.closest?.('.rafters.settled .rafter-banner img');
  const lastX = new Map();
  addEventListener('pointermove', e => {
    const img = banner(e); if (!img) { lastX.delete(e.pointerId); return; }
    const px = lastX.get(e.pointerId); lastX.set(e.pointerId, e.clientX); if (px == null || px === e.clientX) return;
    const b = body(img); b.v = Math.max(-14, Math.min(14, b.v + Math.max(-2.5, Math.min(2.5, (px - e.clientX) * .15)))); run();
  }, {passive: true});
  addEventListener('pointerdown', e => {
    const img = e.pointerType !== 'mouse' && banner(e); if (!img) return;
    const r = img.getBoundingClientRect(), off = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const b = body(img); b.v = Math.max(-16, Math.min(16, b.v + (off >= 0 ? 1 : -1) * (10 + Math.min(1, Math.abs(off)) * 6))); run();
  }, {passive: true});
  addEventListener('pointerup', e => lastX.delete(e.pointerId), {passive: true});
  addEventListener('pointercancel', e => lastX.delete(e.pointerId), {passive: true});
  // A light breeze: now and then one banner gets a small nudge (under 1°)
  setInterval(() => { if (still.matches || document.hidden) return; const list = imgs(); if (!list.length || Math.random() < .5) return; const b = body(list[Math.floor(Math.random() * list.length)]); b.v += (Math.random() < .5 ? -1 : 1) * (3 + Math.random() * 2); run(); }, 2800);
  const arm = () => document.querySelectorAll('.rafters:not(.armed)').forEach(r => {
    r.classList.add('armed');
    if (!io || still.matches) { r.classList.add('is-in', 'settled'); return; }
    r.classList.add('will-drop'); io.observe(r); requestAnimationFrame(() => requestAnimationFrame(check)); setTimeout(check, 400);
    // Physics takes over once the last banner has finished its drop
    r.addEventListener('animationend', () => { if ([...r.querySelectorAll('.rafter-banner')].every(fb => !fb.getAnimations().some(an => an.playState === 'running'))) r.classList.add('settled'); });
  });
  new MutationObserver(arm).observe(document.getElementById('main'), {childList: true, subtree: true});
  arm();
})();

/* ---------- Game-day graphic (upcoming games on the schedule) ---------- */
let lgImgs = {};
const lgLoadImg = src => lgImgs[src] ||= new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
// A logo centred in a white rounded tile
function lgTile(x, img, cx, cy, size) {
  lgRound(x, cx - size / 2, cy - size / 2, size, size, 30); x.fillStyle = '#fff'; x.fill();
  if (!img) return;
  const pad = size * .14, w = size - pad * 2, r = Math.min(w / img.width, w / img.height);
  x.drawImage(img, cx - img.width * r / 2, cy - img.height * r / 2, img.width * r, img.height * r);
}
// d: {days, opponent, oppLogo, away, neutral, date (long), time, place, theme, record, season}
async function gamedayGraphic(d) {
  const tc = await gamedayTpl(d); if (tc) return tc;
  const today = d.days === 0, {c, x, W, M, T} = await lgFrame(today ? 'GAME DAY' : 'NEXT UP', `${d.season} · GIRLS VARSITY`, today ? 'GAMEDAY' : 'AUKS', 'win', {seed: `${d.opponent}|${d.date}`, style: 'river'});
  const [ours, theirs] = await Promise.all([lgLoadLogo(), d.oppLogo ? lgLoadImg(d.oppLogo) : null]);
  // The count: GAME DAY today, otherwise days to go, with the script word slashed across
  if (today) {
    lgBig(x, 'GAME', M, 470, 250, T); lgBig(x, 'DAY', M, 710, 250, T);
    lgFit(x, "let's go Auks", 520, 110, s => `400 ${s}px Yellowtail`);
    x.save(); x.translate(M + 430, 690); x.rotate(-0.14); x.fillStyle = LG.ink; x.fillText("let's go Auks", 6, 8); x.fillStyle = '#fff'; x.fillText("let's go Auks", 0, 0); x.restore();
  } else {
    const n = String(d.days), nw = lgBig(x, n, M, 600, n.length > 1 ? 380 : 420, T), word = d.days === 1 ? 'day to go' : 'days to go';
    const sx = M + nw - 30; lgFit(x, word, W - M - sx + 20, 130, s => `400 ${s}px Yellowtail`);
    x.save(); x.translate(sx, 560); x.rotate(-0.14); x.fillStyle = LG.ink; x.fillText(word, 6, 8); x.fillStyle = '#fff'; x.fillText(word, 0, 0); x.restore();
  }
  // Matchup: our A and their mark in white tiles
  const ty = 800, ts = 170;
  lgTile(x, ours, M + ts / 2, ty, ts); lgTile(x, theirs, M + ts * 1.5 + 90, ty, ts);
  x.textAlign = 'center'; x.font = '400 54px Anton'; x.fillStyle = LG.mint; x.fillText(d.away ? '@' : 'VS', M + ts + 45, ty + 18); x.textAlign = 'left';
  const nx = M + ts * 2 + 130;
  const words = d.opponent.toUpperCase().split(' '), lines = [];
  // Opponent name on up to two lines, as large as fits
  let size = 66; const fits = (txt, s) => { x.font = `400 ${s}px Anton`; return x.measureText(txt).width <= W - M - nx; };
  for (; size > 34; size -= 2) { lines.length = 0; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (fits(t, size)) cur = t; else { if (cur) lines.push(cur); cur = w; } } if (cur) lines.push(cur); if (lines.length <= 2 && lines.every(l => fits(l, size))) break; }
  x.font = `400 ${size}px Anton`; x.fillStyle = '#fff'; lines.forEach((l, i) => x.fillText(l, nx, ty - (lines.length - 1) * size * .5 + i * size * 1.02 + size * .35));
  // When and where, plus the theme night
  let y = 990;
  x.font = '400 54px Anton'; x.fillStyle = '#fff'; const when = `${d.date}`.toUpperCase(); x.fillText(when, M, y);
  if (d.time) { const ww = x.measureText(when).width; x.fillStyle = '#8fd4a4'; x.fillText(' · ' + d.time.toUpperCase(), M + ww, y); }
  y += 50; x.font = '600 28px Inter'; x.fillStyle = LG.mint; lgFit(x, d.place, W - 2 * M, 28, s => `600 ${s}px Inter`); x.fillText(d.place, M, y);
  if (d.theme) {
    const label = (d.theme + ' night').toUpperCase(); x.font = '800 24px Inter'; const tw = [...label].reduce((s, ch) => s + x.measureText(ch).width + 4, 0) + 40;
    lgRound(x, W - M - tw, 1072, tw, 52, 26); x.fillStyle = '#fff'; x.fill(); x.fillStyle = LG.green; lgTracked(x, label, W - M - tw / 2, 1107, 4, 'center');
  }
  // Footer
  x.font = '400 50px Anton'; x.fillStyle = '#fff'; x.fillText(d.away ? 'AWAY' : d.neutral ? 'NEUTRAL SITE' : 'HOME', M, 1276);
  x.font = '600 24px Inter'; x.fillStyle = '#9aa69f'; lgTracked(x, d.record ? `RECORD ${d.record} · LET'S GO AUKS` : "LET'S GO AUKS", M, 1320, 3);
  return c;
}
function openGameday(date, opponent, from) {
  const s = [...(D.currentSchedule || []), ...(D.scheduleOnly || [])].find(x => x.date === date && x.opponent === opponent); if (!s) return;
  const played = D.games.filter(g => g.season === s.season && g.result), record = played.length ? `${played.filter(g => g.result === 'W').length}–${played.filter(g => g.result === 'L').length}` : '';
  const logo = (opponentMark(opponent).match(/src="([^"]+)"/) || [])[1] || '';
  const when = new Date(serial(s.date)).toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric'});
  const time = (s.time || '').replace(/\s*(am|pm)$/i, m => ' ' + m.trim().toUpperCase());
  const days = Math.max(0, daysTo(s)), title = `${s.homeAway === 'A' ? 'At' : 'Versus'} ${opponent}, ${when}`;
  showGraphicDialog({
    from, title: 'Game day: ' + title, alt: `Game-day graphic: Archmere ${s.homeAway === 'A' ? 'at' : 'vs'} ${opponent}, ${when}${time ? ' ' + time : ''}`,
    file: `archmere-gameday-${fileSlug(opponent)}-${s.date.replace(/\//g, '-')}.png`,
    links: `<a href="${route('opponent', {name: opponent})}">Head-to-head <span aria-hidden="true">→</span></a>`,
    render: () => gamedayGraphic({days, opponent, oppLogo: logo, away: s.homeAway === 'A', neutral: s.homeAway === 'N', date: when, time, place: s.location || '', theme: themeFor(s), senior: isSenior(s), record, season: s.season})
  });
}
document.addEventListener('click', e => {
  const card = e.target.closest('[data-gameday]');
  if (card && (!e.target.closest('a,button,summary,details') || e.target.closest('a,button,summary,details') === card)) openGameday(card.dataset.gameday, card.dataset.opp, card);
});
document.addEventListener('keydown', e => {
  const card = (e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-gameday]') && e.target;
  if (card) { e.preventDefault(); openGameday(card.dataset.gameday, card.dataset.opp, card); }
});

/* ---------- Player share card (button in the player hero) ---------- */
// d: {first, last, mark (jersey or initials), jersey, cls, seasons, totals[5], honors[], college}
async function playerCardGraphic(d) {
  const tc = await playerTpl({kicker: d.cls ? `PLAYER CARD  ·  CLASS OF ${d.cls}` : 'PLAYER CARD', first: d.first, last: d.last, big: d.mark, sub: d.seasons,
    tiles: d.totals.map((v, k) => [v == null ? '–' : Number(v).toLocaleString('en-US'), BOX_SHORT[k].toUpperCase()]), hi: -1, tilesLabel: 'CAREER TOTALS',
    linesTitle: 'HONORS', lines: [...d.honors.slice(0, d.college ? 2 : 3).map(h => [h.award.toUpperCase(), String(h.year || '')]), ...(d.college ? [[d.college.toUpperCase(), 'COLLEGE']] : [])]});
  if (tc) return tc;
  const {c, x, W, M, T} = await lgFrame('PLAYER CARD', d.cls ? `CLASS OF ${d.cls}` : 'ARCHMERE VOLLEYBALL', d.last, 'win', {seed: `${d.first} ${d.last}`, style: 'type', words: [d.last, d.jersey ? '#' + d.jersey : d.mark]});
  // Jersey number (or initials) huge, with the name beside it
  const mw = lgBig(x, d.mark, M, 560, d.mark.length > 2 ? 300 : 380, T);
  const nx = M + mw + 50, room = W - M - nx;
  if (d.jersey) { x.font = '800 22px Inter'; x.fillStyle = LG.mint; lgTracked(x, 'NO.', nx, 300, 5); }
  if (d.first) { lgFit(x, d.first.toUpperCase(), room, 64, s => `400 ${s}px Anton`); x.fillStyle = LG.mint; x.fillText(d.first.toUpperCase(), nx, 400); }
  const ls = lgFit(x, d.last.toUpperCase(), room, 120, s => `400 ${s}px Anton`); x.fillStyle = '#fff'; x.fillText(d.last.toUpperCase(), nx, 400 + ls * .95);
  x.font = '600 24px Inter'; x.fillStyle = '#c9d2cc'; lgFit(x, d.seasons, room, 24, s => `600 ${s}px Inter`); x.fillText(d.seasons, nx, 400 + ls * .95 + 50);
  // Career totals
  let y = 660; x.font = '800 22px Inter'; x.fillStyle = LG.mint; lgTracked(x, 'CAREER', M, y, 6);
  const top = y + 22, gap = 16, tw = (W - 2 * M - gap * 4) / 5, th = 140;
  d.totals.forEach((v, k) => {
    const tx = M + k * (tw + gap);
    lgRound(x, tx, top, tw, th, 18); x.fillStyle = 'rgba(255,255,255,.10)'; x.fill(); x.strokeStyle = 'rgba(255,255,255,.28)'; x.lineWidth = 2; x.stroke();
    x.textAlign = 'center'; lgFit(x, v == null ? '–' : Number(v).toLocaleString('en-US'), tw - 16, 70, s => `400 ${s}px Anton`); x.fillStyle = '#fff'; x.fillText(v == null ? '–' : Number(v).toLocaleString('en-US'), tx + tw / 2, top + 84);
    x.textAlign = 'left'; x.font = '800 20px Inter'; x.fillStyle = LG.mint; lgTracked(x, BOX_SHORT[k].toUpperCase(), tx + tw / 2, top + 120, 3, 'center');
  });
  // Honors (top three) and college
  y = top + th + 60;
  const lines = [...d.honors.slice(0, d.college ? 2 : 3).map(h => [h.award.toUpperCase(), String(h.year || '')]), ...(d.college ? [[d.college.toUpperCase(), 'COLLEGE']] : [])];
  if (lines.length) {
    x.font = '800 22px Inter'; x.fillStyle = LG.mint; lgTracked(x, 'HONORS', M, y, 6); y += 14;
    for (const [what, when] of lines) {
      x.fillStyle = 'rgba(255,255,255,.22)'; x.fillRect(M, y, W - 2 * M, 2); y += 58;
      x.font = '400 34px Anton'; const ww = x.measureText(when).width; x.fillStyle = LG.mint; x.fillText(when, W - M - ww, y - 6);
      lgFit(x, what, W - 2 * M - ww - 30, 40, s => `400 ${s}px Anton`); x.fillStyle = '#fff'; x.fillText(what, M, y - 6);
      y += 6;
    }
  }
  // Footer
  x.font = '400 50px Anton'; x.fillStyle = '#fff'; x.fillText(d.cls ? `CLASS OF ${d.cls}` : 'ARCHMERE', M, 1276);
  x.font = '600 24px Inter'; x.fillStyle = '#9aa69f'; lgTracked(x, 'GIRLS VARSITY VOLLEYBALL', M, 1320, 3);
  return c;
}
const playerShareButton = p => `<button type="button" class="hero-share" data-player-card="${esc(p.id)}" aria-haspopup="dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4m-4 4 4-4 4 4M5 13v6h14v-6" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>Share card</button>`;
function openPlayerCard(id, from) {
  const p = D.players.find(x => x.id === id); if (!p) return;
  const clean = p.name.replace(/\s*\(.*?\)/, '').trim(), parts = clean.split(/\s+/), last = parts.pop(), first = parts.join(' ');
  const jersey = currentJersey(p.name), seasons = [...new Set([...D.stats.filter(s => s.name === p.name).map(s => s.season), ...D.roster.filter(r => r.name === p.name).map(r => r.season)])].sort((a, b) => a - b);
  const honors = (AWARDS[p.name] || []).slice().sort((a, b) => honorRank(a) - honorRank(b) || (b.year || 0) - (a.year || 0));
  const col = COLLEGE[p.name], cls = p.year === 'Unknown' ? '' : p.year;
  showGraphicDialog({
    from, title: 'Player card: ' + p.name, alt: `Player card graphic for ${p.name}${cls ? ', class of ' + cls : ''}`,
    file: `archmere-${fileSlug(p.name)}-card.png`,
    render: () => playerCardGraphic({first, last, mark: jersey || (first[0] || '') + last[0], jersey, cls, seasons: seasons.length ? seasons.join(' · ') + (seasons.length === 1 ? ' SEASON' : ' SEASONS') : '', totals: p.values, honors, college: col ? col.school : ''})
  });
}
document.addEventListener('click', e => { const b = e.target.closest('[data-player-card]'); if (b) openPlayerCard(b.dataset.playerCard, b); });

/* ---------- Share cues: one icon wherever a share graphic opens, plus a one-time tip on the schedule ---------- */
const SHARE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 14v5h14v-5"/></svg>';
// Schedule cards: a quiet action line, styled like the card's Box score / Official links
const shareLine = () => `<span class="share-line" aria-hidden="true">${SHARE_ICON}<span class="sl-long">Share graphic</span><span class="sl-short">Share</span></span>`;
const shareCue = (cls = '') => `<span class="share-cue ${cls}" aria-hidden="true">${SHARE_ICON}</span>`;
const TIP_KEY = 'auksvb-tip-share-v1';
const tipSeen = () => { try { return localStorage.getItem(TIP_KEY) === '1'; } catch { return false; } };
const shareTip = () => tipSeen() ? '' : `<div class="share-tip" role="note">${shareCue()}<p><b>New: share graphics.</b> Tap any game for a post-ready graphic you can save or post.</p><button type="button" class="share-tip-x" aria-label="Dismiss tip">×</button></div>`;
document.addEventListener('click', e => {
  const x = e.target.closest('.share-tip-x'); if (!x) return;
  try { localStorage.setItem(TIP_KEY, '1'); } catch {}
  x.closest('.share-tip')?.remove();
});

/* ---------- Template share graphics: Astra-made torn-paper collage art (blank panels) + live text drawn here ----------
   Zones measured from the 1080x1350 templates (brand/tpl-*-v1.webp):
   gameday/final: top paper 113-493, dark centre 498-986, paper 993-1126, green strip 1132-1152, paper 1157-1332
   player:        top paper 113-353, dark centre 359-980, paper 988-1335.  Paper spans about x 150-940. */
const TPL = {gameday: 'brand/tpl-gameday-v1.webp', final: 'brand/tpl-final-v1.webp', player: 'brand/tpl-player-v1.webp'};
const TP = {cx: 545, w: 700, ink: '#15191a', green: '#0f6b3a', cream: '#f3ead9'};
async function tplCanvas(name) {
  const [img] = await Promise.all([lgLoadImg(TPL[name]), lgFonts(), lgLoadLogo(), tpPaper()]);
  if (!img) return null;
  const c = document.createElement('canvas'); c.width = LG.w; c.height = LG.h; const x = c.getContext('2d');
  x.drawImage(img, 0, 0, LG.w, LG.h); return {c, x};
}
// Largest size (<= max) at which text fits the width
function tpSize(x, text, width, max, font = 'Anton', weight = 400) { let s = max; do { x.font = `${weight} ${s}px ${font}`; } while (x.measureText(text).width > width && (s -= 2) > 10); return s; }
// Distressed print: text on its own layer, speckle-erased and scuffed, laid on the paper slightly translucent
function tpPrint(x, text, px, base, size, color, o = {}) {
  const font = o.font || 'Anton', weight = o.weight || 400, spacing = o.spacing || 0;
  x.font = `${weight} ${size}px ${font}`;
  const tw = [...text].reduce((s, ch) => s + x.measureText(ch).width + spacing, -spacing), pad = 12;
  const w = Math.ceil(tw + pad * 2), h = Math.ceil(size * 1.25), L = document.createElement('canvas'); L.width = w; L.height = h;
  const g = L.getContext('2d'); g.font = x.font; g.fillStyle = color;
  let cx = pad; for (const ch of text) { g.fillText(ch, cx, size); cx += g.measureText(ch).width + spacing; }
  if (o.distress !== false) {
    const r = lgRand(text + size); g.globalCompositeOperation = 'destination-out';
    for (let i = 0, n = Math.round(w * h * .0035); i < n; i++) { g.globalAlpha = .35 + r() * .65; g.beginPath(); g.arc(r() * w, r() * h, .5 + r() * (size > 100 ? 2.4 : 1.2), 0, 7); g.fill(); }
    for (let i = 0; i < (size > 100 ? 7 : 2); i++) { g.globalAlpha = .45; g.fillRect(r() * w, r() * h, 12 + r() * size * .5, 1 + r() * 2); }
  }
  const dx = o.align === 'left' ? px - pad : o.align === 'right' ? px - w + pad : px - w / 2;
  x.save(); x.globalAlpha = o.alpha ?? .94; x.drawImage(L, dx, base - size); x.restore();
  return tw;
}
// Green tape tag with white type (e.g. "VS", "IN 3 DAYS")
function tpTag(x, text, cx, cy, size, rot = -.05) {
  x.font = `400 ${size}px Anton`; const tw = x.measureText(text).width, w = tw + size * .9, h = size * 1.25;
  tpStamp(x, w + 8, h + 10, cx, cy, rot, g => {
    g.fillStyle = TP.green; g.beginPath();
    g.moveTo(-w / 2, -h / 2); for (let i = 0; i <= 8; i++) g.lineTo(-w / 2 + w * i / 8, -h / 2 + (i % 2 ? 3 : -2)); g.lineTo(w / 2, h / 2); for (let i = 8; i >= 0; i--) g.lineTo(-w / 2 + w * i / 8, h / 2 + (i % 2 ? -3 : 2)); g.closePath(); g.fill();
    g.font = `400 ${size}px Anton`; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(text, 0, size * .36);
  }, text, {grain: 1.6});
}
const tpHeader = (x, y, line = 'ARCHMERE ACADEMY') => {
  const s = tpSize(x, line, 520, 40); tpPrint(x, line, TP.cx, y, s, TP.green, {spacing: 4, distress: false, alpha: 1});
  tpPrint(x, 'GIRLS VARSITY VOLLEYBALL', TP.cx, y + 32, 22, TP.ink, {font: 'Inter', weight: 800, spacing: 6, distress: false, alpha: .85});
  x.fillStyle = TP.green; x.fillRect(TP.cx - 360, y - 14, 70, 3); x.fillRect(TP.cx + 290, y - 14, 70, 3);
};
// Dark-centre tiles (sets, stats): cream for the highlighted one, outlined otherwise
function tpTiles(x, items, top, th, hi) {
  const n = items.length, gap = 14, tw = Math.min(150, (TP.w + 40 - gap * (n - 1)) / n), left = TP.cx - (tw * n + gap * (n - 1)) / 2;
  items.forEach(([big, small], k) => {
    const tx = left + k * (tw + gap), on = hi(k);
    lgRound(x, tx, top, tw, th, 14); x.fillStyle = on ? TP.cream : 'rgba(255,255,255,.08)'; x.fill(); if (!on) { x.strokeStyle = 'rgba(255,255,255,.3)'; x.lineWidth = 2; x.stroke(); }
    x.textAlign = 'center'; const s = tpSize(x, big, tw - 16, th * .48); x.fillStyle = on ? TP.green : '#fff'; x.fillText(big, tx + tw / 2, top + th * .58);
    x.textAlign = 'left'; x.font = '800 16px Inter'; x.fillStyle = on ? TP.ink : LG.mint; lgTracked(x, small, tx + tw / 2, top + th * .85, 3, 'center');
  });
}

async function gamedayTpl(d) {
  const t = await tplCanvas('gameday'); if (!t) return null; const {c, x} = t;
  const theirs = d.oppLogo ? await lgLoadImg(d.oppLogo) : null, ours = await lgLoadLogo();
  tpHeader(x, 178);
  const head = d.days === 0 ? 'GAME DAY' : d.days === 1 ? 'TOMORROW' : 'NEXT UP';
  tpPrint(x, head, TP.cx, 430, tpSize(x, head, TP.w, 230), TP.ink);
  if (d.days > 0) tpTag(x, d.days === 1 ? '1 DAY TO GO' : `${d.days} DAYS TO GO`, TP.cx - 150, 472, 30, -.05);
  if (ours) { const w = 150, h = w * ours.height / ours.width; tpStamp(x, w, h, 820 + w / 2, 380 + h / 2, 0, g => g.drawImage(ours, -w / 2, -h / 2, w, h), 'corner', {grain: 1.4}); }
  // Centre: the matchup
  const tagged = d.theme || d.senior, ty = tagged ? 640 : 690, ts = tagged ? 180 : 200, paper = await tpPaper();
  for (const [img, cx, rot] of [[ours, TP.cx - 170, -.04], [theirs, TP.cx + 170, .035]]) {
    tpChip(x, paper, cx, ty, ts, ts, rot, d.opponent + cx, null);
    if (img) { const pad = ts * .16, w = ts - pad * 2, k = Math.min(w / img.width, w / img.height), iw = img.width * k, ih = img.height * k; tpStamp(x, iw, ih, cx, ty, rot, g => g.drawImage(img, -iw / 2, -ih / 2, iw, ih), d.opponent + cx, {grain: 0, blend: 'multiply'}); }
  }
  tpStamp(x, 110, 80, TP.cx, ty, 0, g => { g.textAlign = 'center'; g.font = '400 64px Anton'; g.fillStyle = LG.mint; g.fillText(d.away ? '@' : 'VS', 0, 22); }, 'vs', {grain: 1.6});
  // Theme and Senior Night stickers, side by side when a game has both
  const stks = (await Promise.all([d.theme && stickerSrc(d.theme), d.senior && stickerSrc('Senior Night')].filter(Boolean).map(lgLoadImg))).filter(Boolean);
  stks.forEach((stk, i) => tpStamp(x, 160, 160, TP.cx + (stks.length > 1 ? (i ? 92 : -92) : 0), 895, i ? .06 : -.07, g => g.drawImage(stk, -80, -80, 160, 160), 'stk' + i, {grain: 1.3, shadow: true}));
  if (!stks.length) { x.font = '800 22px Inter'; x.fillStyle = 'rgba(214,239,220,.75)'; lgTracked(x, d.away ? 'ON THE ROAD' : 'AT ARCHMERE', TP.cx, 880, 6, 'center'); }
  // Opponent, the green strip, then when and where
  const opp = d.opponent.toUpperCase(); tpPrint(x, opp, TP.cx + 30, 1092, tpSize(x, opp, TP.w - 110, 92), TP.ink);
  tpTag(x, d.away ? '@' : 'VS', TP.cx - Math.min(TP.w, x.measureText(opp).width) / 2 - 30, 1058, 34, -.08);
  x.font = '800 18px Inter'; x.fillStyle = '#fff'; lgTracked(x, d.record ? `${d.away ? 'AWAY' : 'HOME'} · RECORD ${d.record}` : (d.away ? 'AWAY' : 'HOME'), TP.cx, 1149, 5, 'center');
  const when = `${d.date}${d.time ? ' • ' + d.time : ''}`.toUpperCase(); tpPrint(x, when, TP.cx, 1222, tpSize(x, when, TP.w, 56), TP.green, {spacing: 2});
  if (d.place) tpPrint(x, d.place.toUpperCase(), TP.cx, 1264, tpSize(x, d.place.toUpperCase(), TP.w, 26, 'Inter', 800), TP.ink, {font: 'Inter', weight: 800, spacing: 3, distress: false, alpha: .85});
  tpPrint(x, "CLAYMONT, DE  ·  GO AUKS  ·  AUKSVB.COM", TP.cx, 1302, 16, TP.green, {font: 'Inter', weight: 800, spacing: 3, distress: false, alpha: .9});
  return c;
}

async function finalTpl(d) {
  const t = await tplCanvas('final'); if (!t) return null; const {c, x} = t;
  tpHeader(x, 178);
  const head = d.win ? 'AUKS WIN' : 'FINAL'; tpPrint(x, head, TP.cx, 430, tpSize(x, head, TP.w, 230), TP.ink);
  tpTag(x, d.phase === 'Postseason' ? 'POSTSEASON' : 'REGULAR SEASON', TP.cx - 170, 474, 26, -.05);
  const paper = await tpPaper();
  // Centre: score and sets
  tpCutout(x, paper, d.score.replace('-', '–'), TP.cx, 800, 300, d.opponent + d.date);
  if (d.sets.length) tpChips(x, paper, d.sets.map(([a, b], k) => [`${a}–${b}`, `SET ${k + 1}`]), 900, 96, k => d.sets[k][0] > d.sets[k][1] ? 'white' : 'green', d.opponent + d.date);
  // Opponent, strip, top performers
  const opp = `${d.away ? '@' : 'VS'} ${d.opponent}`.toUpperCase(); tpPrint(x, opp, TP.cx, 1092, tpSize(x, opp, TP.w, 92), TP.ink);
  x.font = '800 18px Inter'; x.fillStyle = '#fff'; lgTracked(x, `${d.date} · ${d.place}${d.record ? ' · RECORD ' + d.record : ''}`.toUpperCase(), TP.cx, 1149, 4, 'center');
  const L = d.leaders.slice(0, 3);
  if (L.length) {
    const PW = 590, colW = PW / L.length;   // the lower paper narrows toward its torn bottom edge
    L.forEach((l, k) => {
      const cx = TP.cx - PW / 2 + colW * (k + .5);
      tpPrint(x, l.cat.toUpperCase(), cx, 1196, 18, TP.green, {font: 'Inter', weight: 800, spacing: 4, distress: false, alpha: 1});
      tpPrint(x, String(l.value), cx, 1262, 64, TP.ink);
      tpPrint(x, l.name.toUpperCase(), cx, 1298, tpSize(x, l.name.toUpperCase(), colW - 26, 26), TP.ink, {distress: false, alpha: .9});
    });
  }
  tpPrint(x, 'AUKSVB.COM', TP.cx, 1324, 14, TP.green, {font: 'Inter', weight: 800, spacing: 5, distress: false, alpha: .8});
  return c;
}

async function playerTpl(d) {
  const t = await tplCanvas('player'); if (!t) return null; const {c, x} = t;
  tpPrint(x, d.kicker || 'ARCHMERE VOLLEYBALL', TP.cx, 168, 24, TP.green, {font: 'Inter', weight: 800, spacing: 6, distress: false, alpha: 1});
  if (d.first) tpPrint(x, d.first.toUpperCase(), TP.cx, 228, tpSize(x, d.first.toUpperCase(), TP.w, 56), TP.green);
  const last = d.last.toUpperCase(); tpPrint(x, last, TP.cx, d.first ? 335 : 320, tpSize(x, last, TP.w, d.first ? 112 : 150), TP.ink);
  // Centre: the big number (jersey / initials, or the stat for a match leader), a line under it, then tiles
  const paper = await tpPaper(); x.font = `400 ${d.bigSize || 330}px Anton`; const bw = x.measureText(d.big).width;
  tpCutout(x, paper, d.big, TP.cx - (d.script ? 70 : 0), 690, d.bigSize || 330, d.last + d.big);
  if (d.script) { lgFit(x, d.script, 340, 110, s => `400 ${s}px Yellowtail`); const sf = x.font, sw = x.measureText(d.script).width + 30; tpStamp(x, sw, 170, TP.cx + bw / 2 - 110 + sw / 2 - 15, 650, -.14, g => { g.font = sf; g.fillStyle = LG.ink; g.fillText(d.script, -sw / 2 + 20, 27); g.fillStyle = '#fff'; g.fillText(d.script, -sw / 2 + 15, 20); }, d.script, {grain: 1.6}); }
  x.font = '800 22px Inter'; x.fillStyle = LG.mint; lgTracked(x, d.sub.toUpperCase(), TP.cx, 752, 5, 'center');
  if (d.tiles && d.tiles.length) { tpChips(x, paper, d.tiles, 862, 108, k => k === d.hi ? 'green' : 'white', d.last); x.font = '800 15px Inter'; x.fillStyle = 'rgba(214,239,220,.7)'; lgTracked(x, d.tilesLabel, TP.cx, 952, 6, 'center'); }
  // Bottom paper: honors or the game line
  let y = 1040;
  if (d.lines.length) {
    tpPrint(x, d.linesTitle, TP.cx, y, 20, TP.green, {font: 'Inter', weight: 800, spacing: 6, distress: false, alpha: 1}); y += 22;
    for (const [what, when] of d.lines.slice(0, 3)) {
      x.fillStyle = 'rgba(21,25,26,.25)'; x.fillRect(TP.cx - TP.w / 2, y, TP.w, 2); y += 60;
      x.font = '400 34px Anton'; const ww = when ? x.measureText(when).width : 0;
      tpPrint(x, what, TP.cx - TP.w / 2, y - 12, tpSize(x, what, TP.w - ww - 30, 44), TP.ink, {align: 'left'});
      if (when) tpPrint(x, when, TP.cx + TP.w / 2, y - 12, 34, TP.green, {align: 'right'});
    }
  } else tpPrint(x, 'ARCHMERE VOLLEYBALL', TP.cx, 1150, tpSize(x, 'ARCHMERE VOLLEYBALL', TP.w, 80), TP.ink);
  tpPrint(x, 'CLAYMONT, DE  ·  AUKSVB.COM', TP.cx, 1306, 16, TP.green, {font: 'Inter', weight: 800, spacing: 3, distress: false, alpha: .9});
  return c;
}

/* ---------- Theme-night stickers: Astra art where we have it, otherwise drawn here in the same die-cut style ---------- */
const STICKER_ART = {Blackout: 'brand/sticker-blackout-v1.webp', Neon: 'brand/sticker-neon-v1.webp', USA: 'brand/sticker-usa-v1.webp', 'Senior Night': 'brand/sticker-senior-v1.webp'};
// Code-drawn stickers: [two text lines, interior colour, ink colour, pattern]
const STICKER_STYLE = {
  Camo: [['CAMO', 'NIGHT'], '#4b5320', '#fff', 'camo'], Hawaiian: [['HAWAIIAN', 'NIGHT'], '#0b8f8f', '#ffd23f', 'flowers'],
  Orange: [['ORANGE', 'OUT'], '#f26b1d', '#fff', ''], Jersey: [['JERSEY', 'NIGHT'], '#0f6b3a', '#fff', 'stripes'],
  'Country Club': [['COUNTRY', 'CLUB'], '#f4efe1', '#0f6b3a', 'argyle'], 'Green Out': [['GREEN', 'OUT'], '#0f6b3a', '#fff', ''],
  'Dig Pink': [['DIG', 'PINK'], '#e83e8c', '#fff', '']
};
let stickerDrawn = {};
function drawSticker(theme) {
  const [lines, bg, ink, pat] = STICKER_STYLE[theme] || [[theme.toUpperCase(), 'NIGHT'], '#0f6b3a', '#fff', ''];
  const c = document.createElement('canvas'); c.width = c.height = 320; const x = c.getContext('2d'), R = 156, C = 160, r = lgRand(theme);
  x.beginPath(); x.arc(C, C, R, 0, 7); x.fillStyle = '#fff'; x.fill(); x.lineWidth = 3; x.strokeStyle = '#1b1f1d'; x.stroke();
  x.save(); x.beginPath(); x.arc(C, C, R - 15, 0, 7); x.clip(); x.fillStyle = bg; x.fillRect(0, 0, 320, 320);
  if (pat === 'camo') for (let i = 0; i < 26; i++) { x.fillStyle = ['#6b7a3a', '#2f3518', '#8a7f55'][i % 3]; x.beginPath(); x.ellipse(r() * 320, r() * 320, 18 + r() * 30, 10 + r() * 18, r() * 3, 0, 7); x.fill(); }
  if (pat === 'flowers') for (let i = 0; i < 9; i++) { const fx = r() * 320, fy = r() * 320, s = 10 + r() * 10; x.fillStyle = 'rgba(255,255,255,.22)'; for (let k = 0; k < 5; k++) { x.beginPath(); x.ellipse(fx + Math.cos(k * 1.26) * s, fy + Math.sin(k * 1.26) * s, s * .8, s * .45, k * 1.26, 0, 7); x.fill(); } }
  if (pat === 'stripes') { x.fillStyle = 'rgba(255,255,255,.12)'; for (let i = -320; i < 640; i += 46) { x.save(); x.translate(i, 0); x.rotate(.5); x.fillRect(0, -100, 16, 600); x.restore(); } }
  if (pat === 'argyle') { x.fillStyle = 'rgba(15,107,58,.10)'; for (let yy = 0; yy < 320; yy += 70) for (let xx = (yy / 70 % 2) * 35; xx < 320; xx += 70) { x.beginPath(); x.moveTo(xx, yy - 35); x.lineTo(xx + 35, yy); x.lineTo(xx, yy + 35); x.lineTo(xx - 35, yy); x.fill(); } }
  // Print grain inside only
  for (let i = 0; i < 900; i++) { x.fillStyle = r() < .5 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.07)'; x.fillRect(r() * 320, r() * 320, 2, 2); }
  x.restore();
  lgBall(x, C, 86, 34, ink, 5);
  x.fillStyle = ink; x.textAlign = 'center';
  lines.forEach((t, i) => { const s = tpSize(x, t, i ? 190 : 210, i ? 70 : 78); x.font = `400 ${s}px Anton`; x.fillText(t, C, i ? 262 : 186); });
  return c.toDataURL('image/png');
}
const stickerSrc = t => STICKER_ART[t] || (stickerDrawn[t] ||= drawSticker(t));
// Redraw code stickers once the display font has loaded, so their lettering is Anton
document.fonts?.load('400 60px Anton').then(() => { stickerDrawn = {}; if (D) render(false); }).catch(() => {});
const themeSticker = (t, cls = '') => t ? `<img class="theme-sticker ${cls}" src="${stickerSrc(t)}" alt="${esc(t)} night" title="${esc(t)} night" width="64" height="64" decoding="async">` : '';

/* ---------- White paper pieces for the template graphics: torn chips and cut-out numerals ----------
   The paper is the template's own texture, desaturated and lifted to white, so it matches the collage. */
let tpPaperC;
async function tpPaper() {
  if (tpPaperC) return tpPaperC;
  const src = await lgLoadImg(TPL.gameday); if (!src) return null;
  const c = document.createElement('canvas'); c.width = 760; c.height = 360; const g = c.getContext('2d');
  g.filter = 'grayscale(1) brightness(1.13) contrast(1.08)'; g.drawImage(src, 180, 130, 760, 360, 0, 0, 760, 360);   // top paper panel
  return tpPaperC = c;
}
// Torn chip: evenly spaced tear on every side (fixed by seed), square corners, paper fully covering the shape
function tpChip(x, paper, cx, cy, w, h, rot, seed, tint) {
  const r = lgRand(seed), step = 9, amp = 2.6, pts = [];
  const side = (ax, ay, bx, by, nx, ny) => { const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / step)); for (let i = 0; i < n; i++) { const t = i / n, j = i ? (r() - .5) * 2 * amp : 0; pts.push([ax + (bx - ax) * t + nx * j, ay + (by - ay) * t + ny * j]); } };
  side(-w / 2, -h / 2, w / 2, -h / 2, 0, 1); side(w / 2, -h / 2, w / 2, h / 2, -1, 0); side(w / 2, h / 2, -w / 2, h / 2, 0, -1); side(-w / 2, h / 2, -w / 2, -h / 2, 1, 0);
  x.save(); x.translate(cx, cy); x.rotate(rot);
  x.beginPath(); pts.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); x.closePath();
  x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 14; x.shadowOffsetY = 6; x.fillStyle = '#f6f6f3'; x.fill(); x.shadowColor = 'transparent';
  x.clip();
  if (paper) { const sx = r() * (paper.width - w * 1.4), sy = r() * (paper.height - h * 1.4); x.drawImage(paper, Math.max(0, sx), Math.max(0, sy), w * 1.4, h * 1.4, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8); }
  if (tint) { x.globalCompositeOperation = 'multiply'; x.fillStyle = tint; x.fillRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8); x.globalCompositeOperation = 'source-over'; }
  x.restore();
}
// Cut-out numerals: glyphs filled with white paper, scuffed, over a hard ink shadow
function tpCutout(x, paper, text, cx, base, size, seed) {
  x.font = `400 ${size}px Anton`; const tw = x.measureText(text).width, pad = 20, w = Math.ceil(tw + pad * 2), h = Math.ceil(size * 1.15);
  const L = document.createElement('canvas'); L.width = w; L.height = h; const g = L.getContext('2d'); g.font = x.font; g.fillStyle = '#f6f6f3'; g.fillText(text, pad, size);
  if (paper) { g.globalCompositeOperation = 'source-in'; g.drawImage(paper, 0, 0, paper.width, paper.height, 0, 0, w, h); }
  g.globalCompositeOperation = 'destination-out'; const r = lgRand(seed);
  for (let i = 0, n = Math.round(w * h * .0026); i < n; i++) { g.globalAlpha = .3 + r() * .7; g.beginPath(); g.arc(r() * w, r() * h, .6 + r() * 2.4, 0, 7); g.fill(); }
  for (let i = 0; i < 8; i++) { g.globalAlpha = .55; g.fillRect(r() * w, r() * h, 20 + r() * size * .55, 1.5 + r() * 2.5); }
  const S = document.createElement('canvas'); S.width = w; S.height = h; const s = S.getContext('2d'); s.drawImage(L, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = '#060908'; s.fillRect(0, 0, w, h);
  x.drawImage(S, cx - w / 2 + 14, base - size + 14); x.drawImage(L, cx - w / 2, base - size);
  return tw;
}
// A row of chips: [big, small] each; mode(k) -> 'white' | 'green'
function tpChips(x, paper, items, cy, ch, mode, seed) {
  const n = items.length, gap = 18, cw = Math.min(140, (TP.w + 20 - gap * (n - 1)) / n), left = TP.cx - (cw * n + gap * (n - 1)) / 2;
  items.forEach(([big, small], k) => {
    const green = mode(k) === 'green', cx = left + k * (cw + gap) + cw / 2, rot = (k % 2 ? 1 : -1) * (.025 + (k % 3) * .008);
    tpChip(x, paper, cx, cy, cw, ch, rot, seed + k, green ? '#0f6b3a' : null);
    x.save(); x.translate(cx, cy); x.rotate(rot);
    tpPrint(x, big, 0, ch * .16, tpSize(x, big, cw - 18, ch * .5), green ? '#ffffff' : TP.ink);
    tpPrint(x, small, 0, ch * .4, 15, green ? '#d6efdc' : TP.green, {font: 'Inter', weight: 800, spacing: 3, distress: false, alpha: 1});
    x.restore();
  });
}

// Senior Night is an event noted on the game, not a theme: its sticker stands in for the note's text pill
const isSenior = s => /senior night/i.test(s.notes || '');
// textOnly: the sticker is shown elsewhere (after the opponent name), so only leftover note text becomes a pill
function notePill(s, textOnly) {
  if (!s.notes) return '';
  if (!isSenior(s)) return `<span class="pill">${esc(s.notes)}</span>`;
  const rest = s.notes.replace(/(archmere\s+)?senior night/i, '').replace(/^[\s·,;:-]+|[\s·,;:-]+$/g, '');
  if (textOnly) return rest ? `<span class="pill">${esc(rest)}</span>` : '';
  return `<img class="theme-sticker event" src="${stickerSrc('Senior Night')}" alt="Senior Night" title="Senior Night" width="64" height="64" decoding="async">${rest ? `<span class="pill">${esc(rest)}</span>` : ''}`;
}
// Stickers that sit inline after the opponent name on schedule and Next up cards
const cardStickers = s => { const h = (isSenior(s) ? `<img class="theme-sticker inline event" src="${stickerSrc('Senior Night')}" alt="Senior Night" title="Senior Night" width="64" height="64" decoding="async">` : '') + themeSticker(themeFor(s), 'inline'); return h ? `<span class="stk">${h}</span>` : ''; };

// Stamp: draw an element on its own layer (origin at its centre), wear it like the collage print, then lay it down.
// Wear = the template's paper grain multiplied in (grain > 1 pushes the grain contrast), light speckle and a few scuffs.
function tpStamp(x, w, h, cx, cy, rot, draw, seed, o = {}) {
  const pad = 4, L = document.createElement('canvas'); L.width = Math.ceil(w + pad * 2); L.height = Math.ceil(h + pad * 2);
  const g = L.getContext('2d'); g.save(); g.translate(L.width / 2, L.height / 2); draw(g); g.restore();
  tpWear(L, tpPaperC, String(seed), o);
  x.save(); x.translate(cx, cy); x.rotate(rot);
  if (o.blend) x.globalCompositeOperation = o.blend;
  if (o.shadow) { x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 18; x.shadowOffsetY = 8; }
  x.drawImage(L, -L.width / 2, -L.height / 2); x.restore();
}
function tpWear(L, paper, seed, o = {}) {
  const w = L.width, h = L.height, g = L.getContext('2d'), r = lgRand(seed);
  if (paper && o.grain !== 0) {
    const M = document.createElement('canvas'); M.width = w; M.height = h; M.getContext('2d').drawImage(L, 0, 0);
    const sw = Math.min(w, paper.width), sh = Math.min(h, paper.height);
    g.save(); g.globalCompositeOperation = 'multiply'; g.filter = `contrast(${(o.grain || 1) * 2.2}) brightness(.97)`;
    g.drawImage(paper, r() * (paper.width - sw), r() * (paper.height - sh), sw, sh, 0, 0, w, h); g.restore();
    g.globalCompositeOperation = 'destination-in'; g.drawImage(M, 0, 0);
  }
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0, n = Math.round(w * h * (o.speckle ?? .0032)); i < n; i++) { g.globalAlpha = .25 + r() * .6; g.beginPath(); g.arc(r() * w, r() * h, .5 + r() * 2, 0, 7); g.fill(); }
  for (let i = 0, n = o.scuffs ?? Math.max(1, Math.round(w * h / 9000)); i < n; i++) { g.globalAlpha = .4; g.fillRect(r() * w, r() * h, 8 + r() * w * .25, 1 + r() * 1.5); }
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; return L;
}
