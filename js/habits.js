/* ============================================================
   HABITS APP — habits.js
   Live Simple · Habits
   Data model:
     routines[]  — defined once, persist forever
       { id, name, freq ('daily'|'weekly'|'monthly'), color, archived, createdAt }
     checkins[]  — log of completions
       { id, routineId, date (YYYY-MM-DD), week (YYYY-Www), month (YYYY-MM) }
     tasks[]     — one-off tasks per period
       { id, name, freq, date/week/month, done, createdAt }
   ============================================================ */

'use strict';

// ── Constants ─────────────────────────────────────────────────
const H_MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
const H_DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const H_COLORS = ['#ff6b5b','#4a90d9','#3dbf82','#f59e0b','#8b5cf6',
                  '#0097a7','#e85444','#22c55e','#ec4899','#f97316'];

// ── State ─────────────────────────────────────────────────────
let _hView       = 'today';   // today | weekly | monthly | calendar
let _hYear       = new Date().getFullYear();
let _hMonth      = new Date().getMonth();      // 0-based
let _hWeek       = isoWeek(new Date());        // 'YYYY-Www'
let _addFreq     = 'daily';

// ── Storage ───────────────────────────────────────────────────
const H_KEY = 'livesimple_habits_v2';

function hLoad() {
  try {
    const raw = localStorage.getItem(H_KEY);
    return raw ? JSON.parse(raw) : { routines: [], checkins: [], tasks: [] };
  } catch(e) { return { routines: [], checkins: [], tasks: [] }; }
}
function hSave(state) {
  try { localStorage.setItem(H_KEY, JSON.stringify(state)); } catch(e) {}
}
function hGet() { return hLoad(); }

// ── Date utilities ────────────────────────────────────────────
function toDateStr(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth()+1).padStart(2,'0') + '-' +
    String(d.getDate()).padStart(2,'0');
}
function isoWeek(d) {
  // Returns 'YYYY-Www'
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((dt - yearStart) / 86400000) + 1) / 7);
  return dt.getUTCFullYear() + '-W' + String(week).padStart(2,'0');
}
function toMonthStr(y, m) {
  return y + '-' + String(m+1).padStart(2,'0');
}
function daysInMonthH(y, m) { return new Date(y, m+1, 0).getDate(); }
function weekOfMonth(y, m, day) {
  // Which week-of-month (0-4) does this day fall in?
  const firstDow = new Date(y, m, 1).getDay();
  return Math.floor((firstDow + day - 1) / 7);
}
function weeksInMonth(y, m) {
  const days = daysInMonthH(y, m);
  return weekOfMonth(y, m, days) + 1;
}
function isoWeekForDay(y, m, day) {
  return isoWeek(new Date(y, m, day));
}

// ── Migration from old monthly habit format ───────────────────
function migrateOldHabits() {
  const state = hGet();
  if (state.migrated) return; // already done

  try {
    const oldRaw = localStorage.getItem('livesimple_all');
    if (!oldRaw) { state.migrated = true; hSave(state); return; }
    const oldAll = JSON.parse(oldRaw);
    const colorIdx = { daily: 0, weekly: 1, monthly: 2 };

    // Collect unique habit names across all months
    const dailyNames = new Set(), weeklyNames = new Set(), monthlyNames = new Set();
    Object.values(oldAll).forEach(yearData => {
      if (!yearData.habits) return;
      Object.values(yearData.habits).forEach(mData => {
        (mData.dailyHabits   || []).forEach(n => n && dailyNames.add(n));
        (mData.weeklyHabits  || []).forEach(n => n && weeklyNames.add(n));
        (mData.monthlyHabits || []).forEach(n => n && monthlyNames.add(n));
      });
    });

    // Create routines
    const routineMap = {}; // name+freq -> id
    let ci = 0;
    [...dailyNames].forEach(name => {
      const id = 'r_' + Date.now() + '_' + ci++;
      state.routines.push({ id, name, freq: 'daily', color: H_COLORS[state.routines.length % H_COLORS.length], archived: false, createdAt: toDateStr(new Date()) });
      routineMap['daily::' + name] = id;
    });
    [...weeklyNames].forEach(name => {
      const id = 'r_' + Date.now() + '_' + ci++;
      state.routines.push({ id, name, freq: 'weekly', color: H_COLORS[state.routines.length % H_COLORS.length], archived: false, createdAt: toDateStr(new Date()) });
      routineMap['weekly::' + name] = id;
    });
    [...monthlyNames].forEach(name => {
      const id = 'r_' + Date.now() + '_' + ci++;
      state.routines.push({ id, name, freq: 'monthly', color: H_COLORS[state.routines.length % H_COLORS.length], archived: false, createdAt: toDateStr(new Date()) });
      routineMap['monthly::' + name] = id;
    });

    // Migrate checkins
    Object.entries(oldAll).forEach(([yearStr, yearData]) => {
      if (!yearData.habits) return;
      const y = parseInt(yearStr);
      Object.entries(yearData.habits).forEach(([mStr, mData]) => {
        const m = parseInt(mStr);
        // Daily checkins
        (mData.dailyHabits || []).forEach((name, hi) => {
          const rid = routineMap['daily::' + name];
          if (!rid) return;
          Object.entries(mData.dailyChecks || {}).forEach(([key, val]) => {
            if (!val) return;
            const [hiStr, dayStr] = key.split('_');
            if (parseInt(hiStr) !== hi) return;
            const day = parseInt(dayStr);
            const date = toDateStr(new Date(y, m, day));
            const week = isoWeek(new Date(y, m, day));
            const month = toMonthStr(y, m);
            state.checkins.push({ id: 'c_' + Date.now() + '_' + ci++, routineId: rid, date, week, month });
          });
        });
        // Weekly checkins (map to specific week key)
        (mData.weeklyHabits || []).forEach((name, hi) => {
          const rid = routineMap['weekly::' + name];
          if (!rid) return;
          Object.entries(mData.weeklyChecks || {}).forEach(([key, val]) => {
            if (!val) return;
            const [hiStr, wkStr] = key.split('_');
            if (parseInt(hiStr) !== hi) return;
            const wkNum = parseInt(wkStr); // 0-4
            // Find a day in that week of the month
            const day = wkNum * 7 + 1;
            const clampedDay = Math.min(day, daysInMonthH(y, m));
            const week = isoWeek(new Date(y, m, clampedDay));
            const month = toMonthStr(y, m);
            state.checkins.push({ id: 'c_' + Date.now() + '_' + ci++, routineId: rid, date: null, week, month });
          });
        });
        // Monthly checkins
        (mData.monthlyHabits || []).forEach((name, hi) => {
          const rid = routineMap['monthly::' + name];
          if (!rid) return;
          if (mData.monthlyChecks && mData.monthlyChecks[hi]) {
            const month = toMonthStr(y, m);
            state.checkins.push({ id: 'c_' + Date.now() + '_' + ci++, routineId: rid, date: null, week: null, month });
          }
        });
      });
    });

    state.migrated = true;
    hSave(state);
  } catch(e) {
    console.warn('Habit migration failed:', e);
    state.migrated = true;
    hSave(state);
  }
}

// ── Checkin helpers ───────────────────────────────────────────
function isCheckedToday(state, routineId) {
  const today = toDateStr(new Date());
  return state.checkins.some(c => c.routineId === routineId && c.date === today);
}
function isCheckedWeek(state, routineId, week) {
  return state.checkins.some(c => c.routineId === routineId && c.week === week);
}
function isCheckedMonth(state, routineId, monthStr) {
  return state.checkins.some(c => c.routineId === routineId && c.month === monthStr);
}

function toggleCheckin(routineId, freq) {
  const state = hGet();
  const today = toDateStr(new Date());
  const week  = _hWeek;
  const month = toMonthStr(_hYear, _hMonth);

  if (freq === 'daily') {
    const idx = state.checkins.findIndex(c => c.routineId === routineId && c.date === today);
    if (idx >= 0) state.checkins.splice(idx, 1);
    else state.checkins.push({ id: 'c_' + Date.now(), routineId, date: today, week, month });
  } else if (freq === 'weekly') {
    const idx = state.checkins.findIndex(c => c.routineId === routineId && c.week === week);
    if (idx >= 0) state.checkins.splice(idx, 1);
    else state.checkins.push({ id: 'c_' + Date.now(), routineId, date: null, week, month });
  } else {
    const idx = state.checkins.findIndex(c => c.routineId === routineId && c.month === month);
    if (idx >= 0) state.checkins.splice(idx, 1);
    else state.checkins.push({ id: 'c_' + Date.now(), routineId, date: null, week: null, month });
  }
  hSave(state);
  renderHabitsApp();
}

// ── Task helpers ──────────────────────────────────────────────
function toggleTask(taskId) {
  const state = hGet();
  const t = state.tasks.find(t => t.id === taskId);
  if (t) t.done = !t.done;
  hSave(state);
  renderHabitsApp();
}
function deleteTask(taskId) {
  const state = hGet();
  state.tasks = state.tasks.filter(t => t.id !== taskId);
  hSave(state);
  renderHabitsApp();
}

// ── Add task ──────────────────────────────────────────────────
function hAddTask(freq) {
  const inpId = 'hTaskInput_' + freq;
  const inp = document.getElementById(inpId);
  const name = inp ? inp.value.trim() : '';
  if (!name) return;
  const state = hGet();
  const today = toDateStr(new Date());
  state.tasks.push({
    id: 't_' + Date.now(),
    name,
    freq,
    date: freq === 'daily' ? today : null,
    week: freq === 'weekly' ? _hWeek : null,
    month: freq === 'monthly' || freq === 'weekly' ? toMonthStr(_hYear, _hMonth) : null,
    done: false,
    createdAt: today
  });
  hSave(state);
  if (inp) inp.value = '';
  renderHabitsApp();
}

// ── Archive / restore routine ─────────────────────────────────
function hArchiveRoutine(id) {
  const state = hGet();
  const r = state.routines.find(r => r.id === id);
  if (r) r.archived = !r.archived;
  hSave(state);
  renderManageSheet();
  renderHabitsApp();
}
function hDeleteRoutine(id) {
  const state = hGet();
  state.routines = state.routines.filter(r => r.id !== id);
  state.checkins = state.checkins.filter(c => c.routineId !== id);
  hSave(state);
  renderManageSheet();
  renderHabitsApp();
}

// ── Manage sheet ──────────────────────────────────────────────
function openManageSheet() {
  document.getElementById('hManageOverlay').classList.add('open');
  renderManageSheet();
}
function closeManageSheet() {
  document.getElementById('hManageOverlay').classList.remove('open');
}
function renderManageSheet() {
  const state = hGet();
  const el = document.getElementById('hManageList');
  if (!el) return;
  const active   = state.routines.filter(r => !r.archived);
  const archived = state.routines.filter(r =>  r.archived);
  const all = [...active, ...archived];
  if (!all.length) {
    el.innerHTML = '<div class="h-empty">No routines yet — add one below</div>';
    return;
  }
  el.innerHTML = all.map(r => `
    <div class="h-manage-routine-row">
      <div class="h-manage-color-dot" style="background:${r.color}"></div>
      <div class="h-manage-name" style="${r.archived ? 'opacity:0.45;text-decoration:line-through;' : ''}">${r.name}</div>
      <span class="h-manage-freq-badge">${r.freq}</span>
      <button class="h-manage-archive" onclick="hArchiveRoutine('${r.id}')" title="${r.archived ? 'Restore' : 'Archive'}">
        ${r.archived
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-5.51"/></svg>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`}
      </button>
      <button class="h-manage-archive" onclick="hDeleteRoutine('${r.id}')" title="Delete" style="color:var(--red)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>
  `).join('');
}

// ── Rev meter SVG ─────────────────────────────────────────────
function buildRevMeter(pct, size) {
  size = size || 130;
  const r = (size / 2) - 14;
  const cx = size / 2, cy = size / 2 + 8;
  const startAngle = -210, endAngle = 30; // 240° sweep
  const totalDeg = endAngle - startAngle;
  const fillDeg  = totalDeg * Math.clamp01(pct / 100);

  function polarToXY(deg, radius) {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  function arcPath(startDeg, endDeg, radius) {
    const s = polarToXY(startDeg, radius);
    const e = polarToXY(endDeg,   radius);
    const large = (endDeg - startDeg) > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  // Needle
  const needleDeg = startAngle + fillDeg;
  const needleTip = polarToXY(needleDeg, r - 6);
  const needleBase1 = polarToXY(needleDeg + 90, 5);
  const needleBase2 = polarToXY(needleDeg - 90, 5);

  // Color: green > 80%, coral 40-80%, red < 40%
  const trackColor = pct >= 80 ? '#22c55e' : pct >= 40 ? '#ff6b5b' : '#ef4444';

  const valText = Math.round(pct) + '%';

  return `<svg width="${size}" height="${size - 10}" viewBox="0 0 ${size} ${size - 10}" xmlns="http://www.w3.org/2000/svg">
    <!-- Track bg -->
    <path d="${arcPath(startAngle, endAngle, r)}" fill="none" stroke="var(--border)" stroke-width="10" stroke-linecap="round"/>
    <!-- Fill -->
    ${fillDeg > 1 ? `<path d="${arcPath(startAngle, startAngle + fillDeg, r)}" fill="none" stroke="${trackColor}" stroke-width="10" stroke-linecap="round"/>` : ''}
    <!-- Tick marks -->
    ${[0,25,50,75,100].map(t => {
      const deg = startAngle + totalDeg * t / 100;
      const inner = polarToXY(deg, r - 9);
      const outer = polarToXY(deg, r - 3);
      return `<line x1="${inner.x}" y1="${inner.y}" x2="${outer.x}" y2="${outer.y}" stroke="var(--white)" stroke-width="1.5"/>`;
    }).join('')}
    <!-- Needle -->
    <polygon points="${needleTip.x},${needleTip.y} ${needleBase1.x},${needleBase1.y} ${cx},${cy} ${needleBase2.x},${needleBase2.y}"
      fill="${trackColor}" opacity="0.9"/>
    <circle cx="${cx}" cy="${cy}" r="5" fill="var(--dark)" opacity="0.8"/>
    <!-- Value -->
    <text x="${cx}" y="${cy + 24}" text-anchor="middle" font-family="Montserrat,sans-serif" font-weight="900" font-size="16" fill="${trackColor}">${valText}</text>
  </svg>`;
}

Math.clamp01 = v => Math.max(0, Math.min(1, v));

// ── Streak calculator ─────────────────────────────────────────
function calcDailyStreak(state) {
  // Walk back from today, count consecutive days where at least 1 daily routine was checked
  const daily = state.routines.filter(r => r.freq === 'daily' && !r.archived);
  if (!daily.length) return 0;
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 400; i++) {
    const ds = toDateStr(d);
    const done = daily.filter(r => state.checkins.some(c => c.routineId === r.id && c.date === ds));
    if (done.length === 0) {
      // Allow today to be incomplete
      if (i === 0) { d.setDate(d.getDate() - 1); continue; }
      break;
    }
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function calcMonthCompletion(state, y, m) {
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === y && today.getMonth() === m;
  const days = isCurrentMonth ? today.getDate() : daysInMonthH(y, m);
  const daily = state.routines.filter(r => r.freq === 'daily' && !r.archived);
  if (!daily.length) return 0;
  let total = 0, possible = 0;
  for (let d = 1; d <= days; d++) {
    const ds = toDateStr(new Date(y, m, d));
    daily.forEach(r => {
      possible++;
      if (state.checkins.some(c => c.routineId === r.id && c.date === ds)) total++;
    });
  }
  return possible ? Math.round(total / possible * 100) : 0;
}

function calcTodayCompletion(state) {
  const today = toDateStr(new Date());
  const daily = state.routines.filter(r => r.freq === 'daily' && !r.archived);
  if (!daily.length) return 0;
  const done = daily.filter(r => state.checkins.some(c => c.routineId === r.id && c.date === today));
  return Math.round(done.length / daily.length * 100);
}

// ── View switcher ─────────────────────────────────────────────
let _hManageFreq = 'daily';

function hSetView(view, btn) {
  _hView = view;
  // Update nav tabs
  document.querySelectorAll('#habitsNavTabs .nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.view === view);
  });
  renderHabitsApp();
}

// ── Manage sheet add routine ──────────────────────────────────
function hManageSetFreq(freq, el) {
  _hManageFreq = freq;
  document.querySelectorAll('#hManageOverlay .h-freq-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
}
function hManageAddRoutine() {
  const inp = document.getElementById('hManageNewName');
  const name = inp ? inp.value.trim() : '';
  if (!name) return;
  const state = hGet();
  const color = H_COLORS[state.routines.filter(r => !r.archived).length % H_COLORS.length];
  state.routines.push({ id: 'r_' + Date.now(), name, freq: _hManageFreq, color, archived: false, createdAt: toDateStr(new Date()) });
  hSave(state);
  if (inp) inp.value = '';
  renderManageSheet();
  renderHabitsApp();
}

// ── Main render ───────────────────────────────────────────────
function renderHabitsApp() {
  const state = hGet();
  renderHeroMeter(state);
  renderWeekStrip(state);
  renderMainView(state);
}

function renderHeroMeter(state) {
  const todayPct  = calcTodayCompletion(state);
  const monthPct  = calcMonthCompletion(state, _hYear, _hMonth);
  const streak    = calcDailyStreak(state);

  const meterEl = document.getElementById('hRevMeter');
  if (meterEl) meterEl.innerHTML = buildRevMeter(todayPct, 140);

  const statEls = {
    'hStatStreak': streak + ' day' + (streak !== 1 ? 's' : ''),
    'hStatMonth':  monthPct + '%',
  };
  Object.entries(statEls).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });
}

function renderWeekStrip(state) {
  const el = document.getElementById('hWeekStrip');
  if (!el) return;

  const today = new Date();
  // Show current week Mon-Sun
  const dow = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));

  const daily = state.routines.filter(r => r.freq === 'daily' && !r.archived);
  const todayStr = toDateStr(today);

  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const ds = toDateStr(d);
    const dayName = H_DAYS[d.getDay()];
    const dayNum  = d.getDate();
    const isToday = ds === todayStr;
    const isFuture = d > today;

    let pctClass = 'pct-0';
    if (!isFuture && daily.length) {
      const done = daily.filter(r => state.checkins.some(c => c.routineId === r.id && c.date === ds)).length;
      const pct = done / daily.length * 100;
      pctClass = pct === 0 ? 'pct-0' : pct < 40 ? 'pct-low' : pct < 80 ? 'pct-mid' : 'pct-high';
    }

    html += `<div class="week-heatmap-day">
      <div class="week-heatmap-label">${dayName.slice(0,1)}</div>
      <div class="week-heatmap-cell ${pctClass} ${isToday ? 'today' : ''} ${isFuture ? 'future' : ''}"></div>
      <div class="week-heatmap-num">${dayNum}</div>
    </div>`;
  }
  el.innerHTML = html;
}

function renderMainView(state) {
  const container = document.getElementById('hMainView');
  if (!container) return;

  if (_hView === 'today')    container.innerHTML = renderTodayView(state);
  if (_hView === 'weekly')   container.innerHTML = renderWeeklyView(state);
  if (_hView === 'monthly')  container.innerHTML = renderMonthlyView(state);
  if (_hView === 'calendar') container.innerHTML = renderCalendarView(state);
}

// ── Today view ────────────────────────────────────────────────
function renderTodayView(state) {
  const today = toDateStr(new Date());
  const daily = state.routines.filter(r => r.freq === 'daily' && !r.archived);
  const tasks  = state.tasks.filter(t => t.freq === 'daily' && t.date === today);

  const donePct = daily.length
    ? Math.round(daily.filter(r => state.checkins.some(c => c.routineId === r.id && c.date === today)).length / daily.length * 100)
    : 0;

  const routineRows = daily.length
    ? daily.map(r => {
        const done = state.checkins.some(c => c.routineId === r.id && c.date === today);
        const streak = calcRoutineStreak(state, r.id);
        return routineRow(r, done, streak, `toggleCheckin('${r.id}','daily')`);
      }).join('')
    : '<div class="h-empty">No daily routines — tap Manage to add some</div>';

  const taskRows = tasks.map(t => taskRow(t)).join('');

  return `
    <div class="h-section">
      <div class="h-section-head">
        <h2>Daily Routines</h2>
        <div class="h-section-head-right">
          <span class="h-section-pct">${donePct}%</span>
          <button class="h-add-btn" onclick="hOpenAddForm('daily')">+ Add</button>
        </div>
      </div>
      <div class="h-routine-list">${routineRows}</div>
      ${addForm('daily')}
    </div>
    <div class="h-section">
      <div class="h-section-head">
        <h2>Today's Tasks</h2>
        <div class="h-section-head-right">
          <button class="h-add-btn" onclick="hFocusTask('daily')">+ Add</button>
        </div>
      </div>
      <div class="h-routine-list">${taskRows || '<div class="h-empty">No tasks for today</div>'}</div>
      ${taskAddRow('daily')}
    </div>
    ${renderStreakCards(state)}
  `;
}

// ── Weekly view ───────────────────────────────────────────────
function renderWeeklyView(state) {
  const week  = _hWeek;
  const month = toMonthStr(_hYear, _hMonth);
  const weekly = state.routines.filter(r => r.freq === 'weekly' && !r.archived);
  const tasks  = state.tasks.filter(t => t.freq === 'weekly' && t.week === week);

  const donePct = weekly.length
    ? Math.round(weekly.filter(r => isCheckedWeek(state, r.id, week)).length / weekly.length * 100)
    : 0;

  const routineRows = weekly.length
    ? weekly.map(r => {
        const done = isCheckedWeek(state, r.id, week);
        return routineRow(r, done, null, `toggleCheckin('${r.id}','weekly')`);
      }).join('')
    : '<div class="h-empty">No weekly routines — tap Manage to add some</div>';

  // Weekly bar chart (last 8 weeks)
  const barChart = renderWeeklyBarChart(state);

  return `
    <div class="h-section">
      <div class="h-section-head">
        <h2>This Week's Routines</h2>
        <div class="h-section-head-right">
          <span class="h-section-pct">${donePct}%</span>
          <button class="h-add-btn" onclick="hOpenAddForm('weekly')">+ Add</button>
        </div>
      </div>
      <div class="h-routine-list">${routineRows}</div>
      ${addForm('weekly')}
    </div>
    <div class="h-section">
      <div class="h-section-head">
        <h2>This Week's Tasks</h2>
        <div class="h-section-head-right">
          <button class="h-add-btn" onclick="hFocusTask('weekly')">+ Add</button>
        </div>
      </div>
      <div class="h-routine-list">${tasks.map(t => taskRow(t)).join('') || '<div class="h-empty">No tasks this week</div>'}</div>
      ${taskAddRow('weekly')}
    </div>
    <div class="h-section">
      <div class="h-section-head"><h2>Weekly Completion</h2></div>
      ${barChart}
    </div>
  `;
}

function renderWeeklyBarChart(state) {
  const weekly = state.routines.filter(r => r.freq === 'weekly' && !r.archived);
  if (!weekly.length) return '<div class="h-empty">No weekly routines yet</div>';

  // Last 8 ISO weeks
  const weeks = [];
  const d = new Date();
  for (let i = 7; i >= 0; i--) {
    const dt = new Date(d);
    dt.setDate(d.getDate() - i * 7);
    weeks.push(isoWeek(dt));
  }

  const cols = weeks.map((w, idx) => {
    const done = weekly.filter(r => isCheckedWeek(state, r.id, w)).length;
    const pct  = weekly.length ? Math.round(done / weekly.length * 100) : 0;
    const isCurrent = w === _hWeek;
    const label = 'W' + w.split('-W')[1];
    return `<div class="h-bar-col">
      <div class="h-bar-pct-label">${pct > 0 ? pct + '%' : ''}</div>
      <div class="h-bar ${isCurrent ? 'current' : ''}" style="height:${Math.max(3, pct)}%"></div>
      <div class="h-bar-week-label">${label}</div>
    </div>`;
  }).join('');

  return `<div class="h-bar-chart">${cols}</div>`;
}

// ── Monthly view ──────────────────────────────────────────────
function renderMonthlyView(state) {
  const month = toMonthStr(_hYear, _hMonth);
  const monthly = state.routines.filter(r => r.freq === 'monthly' && !r.archived);
  const tasks   = state.tasks.filter(t => t.freq === 'monthly' && t.month === month);

  const donePct = monthly.length
    ? Math.round(monthly.filter(r => isCheckedMonth(state, r.id, month)).length / monthly.length * 100)
    : 0;

  const routineRows = monthly.length
    ? monthly.map(r => {
        const done = isCheckedMonth(state, r.id, month);
        return routineRow(r, done, null, `toggleCheckin('${r.id}','monthly')`);
      }).join('')
    : '<div class="h-empty">No monthly routines — tap Manage to add some</div>';

  // Year-wide monthly completion bars
  const yearBars = renderYearMonthBars(state);

  return `
    <div class="h-section">
      <div class="h-section-head">
        <h2>This Month's Routines</h2>
        <div class="h-section-head-right">
          <span class="h-section-pct">${donePct}%</span>
          <button class="h-add-btn" onclick="hOpenAddForm('monthly')">+ Add</button>
        </div>
      </div>
      <div class="h-routine-list">${routineRows}</div>
      ${addForm('monthly')}
    </div>
    <div class="h-section">
      <div class="h-section-head">
        <h2>This Month's Tasks</h2>
        <div class="h-section-head-right">
          <button class="h-add-btn" onclick="hFocusTask('monthly')">+ Add</button>
        </div>
      </div>
      <div class="h-routine-list">${tasks.map(t => taskRow(t)).join('') || '<div class="h-empty">No tasks this month</div>'}</div>
      ${taskAddRow('monthly')}
    </div>
    <div class="h-section">
      <div class="h-section-head"><h2>${_hYear} Monthly Overview</h2></div>
      ${yearBars}
    </div>
  `;
}

function renderYearMonthBars(state) {
  const cols = H_MONTHS.map((mName, mi) => {
    const pct = calcMonthCompletion(state, _hYear, mi);
    const isCurrent = mi === _hMonth;
    return `<div class="h-bar-col">
      <div class="h-bar-pct-label">${pct > 0 ? pct + '%' : ''}</div>
      <div class="h-bar ${isCurrent ? 'current' : ''}" style="height:${Math.max(pct > 0 ? 3 : 0, pct)}%"></div>
      <div class="h-bar-week-label">${mName.slice(0,3)}</div>
    </div>`;
  }).join('');
  return `<div class="h-bar-chart">${cols}</div>`;
}

// ── Calendar view (month heatmap) ─────────────────────────────
function renderCalendarView(state) {
  const y = _hYear, m = _hMonth;
  const days = daysInMonthH(y, m);
  const firstDow = new Date(y, m, 1).getDay(); // 0=Sun
  const today = new Date();
  const todayStr = toDateStr(today);
  const daily = state.routines.filter(r => r.freq === 'daily' && !r.archived);

  const dayNames = H_DAYS.map(d => `<div class="h-cal-day-name">${d.slice(0,1)}</div>`).join('');

  // Blank cells before first day
  let cells = '';
  for (let i = 0; i < firstDow; i++) {
    cells += '<div class="h-cal-cell empty"></div>';
  }

  for (let d = 1; d <= days; d++) {
    const ds = toDateStr(new Date(y, m, d));
    const isToday = ds === todayStr;
    const isFuture = new Date(y, m, d) > today;

    let heat = 0;
    if (!isFuture && daily.length) {
      const done = daily.filter(r => state.checkins.some(c => c.routineId === r.id && c.date === ds)).length;
      const pct = done / daily.length;
      heat = pct === 0 ? 0 : pct < 0.35 ? 1 : pct < 0.65 ? 2 : pct < 1 ? 3 : 4;
    }

    cells += `<div class="h-cal-cell heat-${heat} ${isToday ? 'today' : ''} ${isFuture ? 'future' : ''}"
      onclick="hCalDayClick(${d})">${d}</div>`;
  }

  // Year heatmap
  const yearHeatmap = renderYearHeatmap(state);

  return `
    <div class="h-section">
      <div class="h-section-head">
        <h2>${H_MONTHS[m]} ${y}</h2>
      </div>
      <div class="h-cal-grid">
        ${dayNames}
        ${cells}
      </div>
    </div>
    <div class="h-section">
      <div class="h-section-head"><h2>${y} Year View</h2></div>
      ${yearHeatmap}
    </div>
    ${renderStreakCards(state)}
  `;
}

function renderYearHeatmap(state) {
  const y = _hYear;
  const daily = state.routines.filter(r => r.freq === 'daily' && !r.archived);
  const today = new Date();

  // Build 365/366 cells, grouped by week (Mon-first)
  const jan1 = new Date(y, 0, 1);
  // Pad to Monday
  const startDow = jan1.getDay() || 7; // 1=Mon..7=Sun
  const padDays  = startDow - 1;

  let cells = '';
  // Padding empties at start
  for (let i = 0; i < padDays; i++) {
    cells += '<div class="h-year-cell" style="background:transparent"></div>';
  }

  const totalDays = (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 366 : 365;
  for (let di = 0; di < totalDays; di++) {
    const d = new Date(y, 0, 1 + di);
    const ds = toDateStr(d);
    const isFuture = d > today;
    let heat = 0;
    if (!isFuture && daily.length) {
      const done = daily.filter(r => state.checkins.some(c => c.routineId === r.id && c.date === ds)).length;
      const pct = done / daily.length;
      heat = pct === 0 ? 0 : pct < 0.35 ? 1 : pct < 0.65 ? 2 : pct < 1 ? 3 : 4;
    }
    cells += `<div class="h-year-cell heat-${heat}" title="${ds}"></div>`;
  }

  // Month labels
  const monthLabels = H_MONTHS.map((mn, mi) => {
    const firstOfMonth = new Date(y, mi, 1);
    const doy = Math.floor((firstOfMonth - jan1) / 86400000);
    const week = Math.floor((doy + padDays) / 7);
    const leftPx = week * 16; // approx column width
    return `<span class="h-year-month-label" style="position:absolute;left:${leftPx}px">${mn.slice(0,3)}</span>`;
  }).join('');

  return `
    <div class="h-year-heatmap">
      <div class="h-year-grid">${cells}</div>
    </div>
    <div style="position:relative;height:16px;padding:0 14px;overflow:hidden;">
      ${monthLabels}
    </div>
  `;
}

function hCalDayClick(day) {
  // Show a mini summary popup for that day (future: day detail sheet)
  // For now just a no-op — could expand later
}

// ── Streak cards ──────────────────────────────────────────────
function renderStreakCards(state) {
  const streak   = calcDailyStreak(state);
  const todayPct = calcTodayCompletion(state);
  const monthPct = calcMonthCompletion(state, _hYear, _hMonth);

  const flame  = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--coral)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z"/></svg>`;
  const target = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--coral)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`;
  const star   = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--coral)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

  return `
    <div class="h-section">
      <div class="h-section-head"><h2>Stats</h2></div>
      <div class="h-streak-cards">
        <div class="h-streak-card">
          <div class="h-streak-card-icon">${flame}</div>
          <div class="h-streak-card-val">${streak}</div>
          <div class="h-streak-card-label">Day Streak</div>
        </div>
        <div class="h-streak-card">
          <div class="h-streak-card-icon">${target}</div>
          <div class="h-streak-card-val">${todayPct}%</div>
          <div class="h-streak-card-label">Today</div>
        </div>
        <div class="h-streak-card">
          <div class="h-streak-card-icon">${star}</div>
          <div class="h-streak-card-val">${monthPct}%</div>
          <div class="h-streak-card-label">This Month</div>
        </div>
      </div>
    </div>
  `;
}

// ── Per-routine streak ────────────────────────────────────────
function calcRoutineStreak(state, routineId) {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 400; i++) {
    const ds = toDateStr(d);
    const done = state.checkins.some(c => c.routineId === routineId && c.date === ds);
    if (!done) {
      if (i === 0) { d.setDate(d.getDate() - 1); continue; }
      break;
    }
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// ── Row HTML builders ─────────────────────────────────────────
function checkSvg() {
  return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="20 6 9 17 4 12"/></svg>`;
}

function routineRow(r, done, streak, onclick) {
  // Completion bar for the period
  return `
    <div class="h-routine-row">
      <div class="h-check-circle ${done ? 'done' : ''}" onclick="${onclick}">
        ${checkSvg()}
      </div>
      <div class="h-routine-info">
        <div class="h-routine-name ${done ? 'done-text' : ''}">${r.name}</div>
        <div class="h-routine-meta">
          ${streak > 0 ? `<span class="h-routine-streak">🔥 ${streak}d</span>` : ''}
          <span class="h-routine-freq">${r.freq}</span>
        </div>
      </div>
      <div class="h-routine-bar-wrap">
        <div class="h-routine-bar">
          <div class="h-routine-bar-fill" style="width:${done ? 100 : 0}%;background:${r.color}"></div>
        </div>
      </div>
    </div>`;
}

function taskRow(t) {
  return `
    <div class="h-task-row">
      <div class="h-task-check ${t.done ? 'done' : ''}" onclick="toggleTask('${t.id}')">
        ${checkSvg()}
      </div>
      <span class="h-task-name ${t.done ? 'done-text' : ''}">${t.name}</span>
      <button class="h-task-del" onclick="deleteTask('${t.id}')">×</button>
    </div>`;
}

function addForm(freq) {
  return `
    <div class="h-add-form" id="hAddForm_${freq}">
      <input type="text" id="hRoutineName_${freq}" placeholder="Routine name…"
        onkeydown="if(event.key==='Enter')hSaveRoutine('${freq}')">
      <div class="h-add-form-row">
        <button class="h-save-btn" onclick="hSaveRoutine('${freq}')">Save</button>
        <button class="h-save-btn" style="background:var(--mid);" onclick="hCloseAddForm('${freq}')">Cancel</button>
      </div>
    </div>`;
}

function taskAddRow(freq) {
  return `
    <div class="h-task-row" style="border-top:1px solid var(--border);border-bottom:none;">
      <div class="h-task-check" style="opacity:0.3;cursor:default">
        <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="10" height="10"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </div>
      <input type="text" id="hTaskInput_${freq}" placeholder="Add task…"
        style="flex:1;border:none;outline:none;font-family:'Lora',Georgia,serif;font-size:13px;color:var(--dark);background:transparent;"
        onkeydown="if(event.key==='Enter')hAddTask('${freq}')">
      <button class="h-task-del" onclick="hAddTask('${freq}')" style="opacity:0.7;font-size:13px;font-family:'Montserrat',sans-serif;font-weight:700;color:var(--coral);">Add</button>
    </div>`;
}

// ── Simplified add form (since we generate per-section) ───────
function hOpenAddForm(freq) {
  _addFreq = freq;
  const formId = 'hAddForm_' + freq;
  const form = document.getElementById(formId);
  if (form) { form.classList.add('open'); form.querySelector('input').focus(); }
}
function hCloseAddForm(freq) {
  const formId = 'hAddForm_' + freq;
  const form = document.getElementById(formId);
  if (form) { form.classList.remove('open'); form.querySelector('input').value = ''; }
}
function hSaveRoutine(freq) {
  const inp = document.getElementById('hRoutineName_' + freq);
  const name = inp ? inp.value.trim() : '';
  if (!name) return;
  const state = hGet();
  const color = H_COLORS[state.routines.filter(r => !r.archived).length % H_COLORS.length];
  state.routines.push({ id: 'r_' + Date.now(), name, freq, color, archived: false, createdAt: toDateStr(new Date()) });
  hSave(state);
  hCloseAddForm(freq);
  renderHabitsApp();
}
function hFocusTask(freq) {
  const inp = document.getElementById('hTaskInput_' + freq);
  if (inp) inp.focus();
}

// ── Month navigation (reuse shared selectHabitMonth shape) ────
function selectHabitMonth(m) {
  _hMonth = m;
  _hYear  = new Date().getFullYear(); // keep year for now
  _hWeek  = isoWeek(new Date(_hYear, _hMonth, 1));
  renderHabitsApp();
}

// ── Init ──────────────────────────────────────────────────────
function initHabitsApp() {
  migrateOldHabits();
  renderHabitsApp();
}
