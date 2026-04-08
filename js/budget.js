
// ============================================================
//  STATE
// ============================================================
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

let currency = '$';
let currentBudgetMonth = new Date().getMonth();
let currentHabitMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let selectedWeek = 0;
let incomePeriodTab = 'overview'; // 'overview' | 0 | 1 | 2 ...
let billsPeriodTab  = 'overview';

// Default data structure per month
function defaultMonth(m) {
  return {
    income: [
      {name:'Paycheck', budget:'', actual:''},
      {name:'Business', budget:'', actual:''},
      {name:'Side Hustle', budget:'', actual:''},
      {name:'Interest Income', budget:'', actual:''},
      {name:'Dividends', budget:'', actual:''},
    ],
    bills: [
      {name:'Rent', budget:'', actual:'', paid:false, recurring:false},
      {name:'Internet', budget:'', actual:'', paid:false, recurring:false},
      {name:'Electricity', budget:'', actual:'', paid:false, recurring:false},
      {name:'Water', budget:'', actual:'', paid:false, recurring:false},
      {name:'Mobile', budget:'', actual:'', paid:false, recurring:false},
      {name:'Gym', budget:'', actual:'', paid:false, recurring:false},
      {name:'Health Insurance', budget:'', actual:'', paid:false, recurring:false},
      {name:'Gas', budget:'', actual:'', paid:false, recurring:false},
      {name:'Spotify', budget:'', actual:'', paid:false, recurring:false},
      {name:'Netflix', budget:'', actual:'', paid:false, recurring:false},
    ],
    expenseSummary: [
      {name:'Food', budget:'', actual:0},
      {name:'Dining Out', budget:'', actual:0},
      {name:'Transportation', budget:'', actual:0},
      {name:'Household', budget:'', actual:0},
      {name:'Education', budget:'', actual:0},
      {name:'Health', budget:'', actual:0},
      {name:'Beauty', budget:'', actual:0},
      {name:'Gifts', budget:'', actual:0},
      {name:'Self-development', budget:'', actual:0},
      {name:'Entertainment', budget:'', actual:0},
    ],
    savings: [
      {name:'Car', budget:'', actual:''},
      {name:'Travel', budget:'', actual:''},
      {name:'Renovation', budget:'', actual:''},
      {name:'Emergency Fund', budget:'', actual:''},
    ],
    debt: [
      {name:'Student Loan', budget:'', actual:'', paid:false, recurring:false},
      {name:'Credit Card', budget:'', actual:'', paid:false, recurring:false},
    ],
    expenses: [], // log entries: {date, amount, category, note}
    rollover: '',
    notes: '',    // monthly note
  };
}

function defaultHabitMonth(m) {
  return {
    dailyHabits: ['Spend 30 minutes learning', 'Exercise', 'Read 10 pages'],
    dailyChecks: {}, // key: "habitIndex_day" => true
    weeklyHabits: ['Go to the gym 3x', 'Meal prep', 'Budget review'],
    weeklyChecks: {}, // key: "habitIndex_week" => true
    monthlyHabits: ['Progress photo', 'Apply for job', 'Go to an event'],
    monthlyChecks: {}, // key: "habitIndex" => true
  };
}

// Load / save
function getAllState() {
  try { return JSON.parse(localStorage.getItem('livesimple_v2') || '{}'); } catch(e) { return {}; }
}
function saveAllState(s) {
  localStorage.setItem('livesimple_v2', JSON.stringify(s));
}
function getYearState(y) {
  const all = getAllState();
  if (!all[y]) all[y] = { budget: {}, habits: {} };
  return all[y];
}
function saveYearState(y, ys) {
  const all = getAllState();
  all[y] = ys;
  saveAllState(all);
}
function getBudgetMonth(m) {
  const ys = getYearState(currentYear);
  if (!ys.budget[m]) ys.budget[m] = defaultMonth(m);
  return ys.budget[m];
}
function saveBudgetMonth(m, data) {
  const all = getAllState();
  if (!all[currentYear]) all[currentYear] = { budget: {}, habits: {} };
  all[currentYear].budget[m] = data;
  saveAllState(all);
}
// ── Period helpers ────────────────────────────────────────────
function getPeriodsForMonth(m, y, type) {
  const totalDays = new Date(y, m + 1, 0).getDate();
  if (type === 'weekly') {
    const periods = [];
    let start = 1, week = 0;
    while (start <= totalDays) {
      const end = Math.min(start + 6, totalDays);
      periods.push({ label: 'Wk ' + (week + 1) + ' (' + start + '–' + end + ')', index: week, startDay: start, endDay: end });
      start += 7; week++;
    }
    return periods;
  }
  // fortnightly
  return [
    { label: 'Fortnight 1 (1–14)',       index: 0, startDay: 1,  endDay: 14 },
    { label: 'Fortnight 2 (15–' + totalDays + ')', index: 1, startDay: 15, endDay: totalDays },
  ];
}

// Ensure period rows exist and match current monthly row count
function ensurePeriodRows(d, section, periodIdx) {
  const key = section + 'Periods';
  if (!d[key]) d[key] = {};
  if (!d[key][periodIdx]) d[key][periodIdx] = [];
  const pRows = d[key][periodIdx];
  const src   = d[section];
  // Grow to match
  while (pRows.length < src.length) {
    pRows.push(section === 'bills'
      ? { actual: '', paid: false }
      : { actual: '' });
  }
  // Trim extras
  pRows.length = src.length;
  return pRows;
}

// Aggregate period actuals back into the monthly row array
function aggregatePeriods(d, section) {
  const mode = section === 'income' ? (d.incomePeriodMode || 'monthly') : (d.billsPeriodMode || 'monthly');
  if (mode === 'monthly') return;
  const periods = getPeriodsForMonth(currentBudgetMonth, currentYear, mode);
  d[section].forEach((row, i) => {
    row.actual = periods.reduce((sum, p) => {
      const pr = ((d[section + 'Periods'] || {})[p.index] || [])[i];
      return sum + num(pr ? pr.actual : 0);
    }, 0) || '';
    if (section === 'bills') {
      row.paid = periods.some(p => {
        const pr = ((d.billsPeriods || {})[p.index] || [])[i];
        return pr && pr.paid;
      });
    }
  });
}

// ── Section period controls ───────────────────────────────────
function setIncomePeriodMode(mode) {
  const d = getBudgetMonth(currentBudgetMonth);
  d.incomePeriodMode = mode;
  saveBudgetMonth(currentBudgetMonth, d);
  incomePeriodTab = 'overview';
  renderBudget();
}

function setBillsPeriodMode(mode) {
  const d = getBudgetMonth(currentBudgetMonth);
  d.billsPeriodMode = mode;
  saveBudgetMonth(currentBudgetMonth, d);
  billsPeriodTab = 'overview';
  renderBudget();
}

function selectIncomePeriodTab(tab) { incomePeriodTab = tab; renderBudget(); }
function selectBillsPeriodTab(tab)  { billsPeriodTab  = tab; renderBudget(); }

// ── Period-specific data updates ──────────────────────────────
function updatePeriodActual(section, periodIdx, rowIdx, val) {
  const d = getBudgetMonth(currentBudgetMonth);
  const pRows = ensurePeriodRows(d, section, periodIdx);
  pRows[rowIdx].actual = val;
  aggregatePeriods(d, section);
  saveBudgetMonth(currentBudgetMonth, d);
  updateTotals(d);
}

function togglePeriodPaid(section, periodIdx, rowIdx, checked) {
  const d = getBudgetMonth(currentBudgetMonth);
  const pRows = ensurePeriodRows(d, section, periodIdx);
  pRows[rowIdx].paid = checked;
  aggregatePeriods(d, section);
  saveBudgetMonth(currentBudgetMonth, d);
}

// ── Render section period controls + rows ─────────────────────
function renderSectionWithPeriods(section, d) {
  const isIncome  = section === 'income';
  const mode      = isIncome ? (d.incomePeriodMode || 'monthly') : (d.billsPeriodMode || 'monthly');
  const tab       = isIncome ? incomePeriodTab : billsPeriodTab;
  const barId     = section + '-period-bar';
  const headerId  = section + '-header';
  const addBtnId  = section + '-add-btn';
  const rowsId    = section + '-rows';
  const setMode   = isIncome ? 'setIncomePeriodMode' : 'setBillsPeriodMode';
  const selTab    = isIncome ? 'selectIncomePeriodTab' : 'selectBillsPeriodTab';

  // ── Period control bar ──
  const barEl = document.getElementById(barId);
  if (barEl) {
    if (mode === 'monthly') {
      barEl.innerHTML = `
        <div class="section-period-bar">
          <select class="section-period-select" onchange="${setMode}(this.value)">
            <option value="monthly" selected>Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="fortnightly">Fortnightly</option>
          </select>
        </div>`;
    } else {
      const periods = getPeriodsForMonth(currentBudgetMonth, currentYear, mode);
      const tabBtns = periods.map(p =>
        `<button class="period-tab-btn ${tab === p.index ? 'active' : ''}" onclick="${selTab}(${p.index})">${p.label}</button>`
      ).join('');
      barEl.innerHTML = `
        <div class="section-period-bar">
          <select class="section-period-select" onchange="${setMode}(this.value)">
            <option value="monthly">Monthly</option>
            <option value="weekly" ${mode==='weekly'?'selected':''}>Weekly</option>
            <option value="fortnightly" ${mode==='fortnightly'?'selected':''}>Fortnightly</option>
          </select>
          <button class="period-tab-btn overview-btn ${tab === 'overview' ? 'active' : ''}" onclick="${selTab}('overview')">Overview</button>
          <div class="section-period-tabs">${tabBtns}</div>
        </div>`;
    }
  }

  // ── Column header ──
  const headerEl = document.getElementById(headerId);
  const hasPaid = section === 'bills';
  const isPeriodTab = mode !== 'monthly' && tab !== 'overview';
  if (headerEl) {
    if (isPeriodTab) {
      headerEl.innerHTML = hasPaid
        ? `<span>${isIncome ? 'Source' : 'Bill'}</span><span>Monthly Budget</span><span>This Period</span>`
        : `<span>Source</span><span>Monthly Budget</span><span>This Period</span>`;
    } else {
      headerEl.innerHTML = hasPaid
        ? `<span>Bill</span><span>Budget</span><span>Actual</span>`
        : `<span>Source</span><span>Budget</span><span>Actual</span>`;
    }
  }

  // ── Add button ──
  const addBtn = document.getElementById(addBtnId);
  if (addBtn) addBtn.style.display = isPeriodTab ? 'none' : '';

  // ── Rows ──
  if (!isPeriodTab) {
    // Overview / monthly: standard render (actuals already aggregated into d[section])
    renderTrackerSection(rowsId, d[section], section, hasPaid);
    // In period-overview, disable editing of actual column (it's auto-aggregated)
    if (mode !== 'monthly') {
      document.querySelectorAll('#' + rowsId + ' .amount-input:last-of-type input').forEach(inp => {
        inp.readOnly = true;
        inp.style.opacity = '0.5';
        inp.title = 'Aggregated from ' + mode + ' data';
      });
    }
  } else {
    // Period tab: render per-period rows
    const periods = getPeriodsForMonth(currentBudgetMonth, currentYear, mode);
    if (tab >= periods.length) {
      // Invalid tab, reset
      if (isIncome) incomePeriodTab = 'overview'; else billsPeriodTab = 'overview';
      renderSectionWithPeriods(section, d);
      return;
    }
    const pRows = ensurePeriodRows(d, section, tab);
    const el = document.getElementById(rowsId);
    if (!d[section].length) {
      el.innerHTML = `<div class="empty">No entries — switch to Overview to add rows</div>`;
      return;
    }
    el.innerHTML = d[section].map((monthRow, i) => {
      const pRow   = pRows[i] || { actual: '', paid: false };
      const mb     = num(monthRow.budget);
      const pa     = num(pRow.actual);
      const periods_count = periods.length;
      const prorated = mb > 0 ? (mb / periods_count) : 0;
      const over   = prorated > 0 && pa > prorated;
      const pctFill = prorated > 0 ? Math.min(pa / prorated * 100, 100) : 0;
      const barColor = over ? 'var(--red)' : pa > 0 ? 'var(--green)' : 'var(--coral)';
      const paidHtml = hasPaid
        ? `<input type="checkbox" class="paid-checkbox" ${pRow.paid ? 'checked' : ''}
             onchange="togglePeriodPaid('${section}',${tab},${i},this.checked)"
             title="${pRow.paid ? 'Mark unpaid' : 'Mark paid'}">`
        : '';
      return `
        <div class="tracker-row" style="padding-right:28px;">
          <div class="row-name">
            ${paidHtml}
            <input type="text" value="${monthRow.name.replace(/"/g,'&quot;')}" readonly
              style="opacity:0.75;cursor:default;${pRow.paid ? 'text-decoration:line-through;opacity:0.4;' : ''}" title="Edit name on Overview tab">
          </div>
          <div class="amount-input">
            <span style="opacity:0.5">${currency}</span>
            <input type="number" value="${monthRow.budget||''}" readonly style="opacity:0.45;cursor:default" title="Monthly budget — edit on Overview tab">
          </div>
          <div class="amount-input">
            <span>${currency}</span>
            <input type="number" value="${pRow.actual||''}" min="0" step="0.01" placeholder="0.00"
              onchange="updatePeriodActual('${section}',${tab},${i},this.value)" title="Amount this period">
          </div>
          <span style="width:28px;display:inline-block;"></span>
        </div>
        ${prorated > 0 ? `<div class="row-progress"><div class="row-progress-fill" style="width:${pctFill}%;background:${barColor};"></div></div>` : ''}
      `;
    }).join('');
  }
}

function getHabitMonth(m) {
  const ys = getYearState(currentYear);
  if (!ys.habits[m]) ys.habits[m] = defaultHabitMonth(m);
  return ys.habits[m];
}
function saveHabitMonth(m, data) {
  const all = getAllState();
  if (!all[currentYear]) all[currentYear] = { budget: {}, habits: {} };
  all[currentYear].habits[m] = data;
  saveAllState(all);
}

// ============================================================
//  UTILS
// ============================================================
function bFmt(n) {
  if (!n && n !== 0) return currency + '0';
  return currency + parseFloat(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function num(v) { return parseFloat(v) || 0; }
function pct(a, b) { return b ? Math.round(a/b*100) + '%' : '0%'; }

// ============================================================
//  PAGE SWITCHING
// ============================================================
function showPage(p, btn) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
  document.getElementById('page-' + p).classList.add('active');
  if (btn) btn.classList.add('active');
  if (p === 'budget') renderBudget();
  if (p === 'habits') renderHabits();
  if (p === 'review') renderReview();
  if (p === 'settings') renderSettings();
  updateFabVisibility(p);
}

// Budget currency state (full codes + symbols)
const BUDGET_CURRENCY_SYMBOLS = {
  AUD: '$', USD: '$', GBP: '£', EUR: '€',
  JPY: '¥', CAD: 'C$', NZD: 'NZ$', SGD: 'S$',
};

// Exchange rates relative to AUD (budget app stores values in user's chosen currency)
// These are approximate static rates — budget doesn't need live FX like invest does
const BUDGET_FX_TO_AUD = {
  AUD: 1, USD: 1.53, GBP: 1.97, EUR: 1.67,
  JPY: 0.0103, CAD: 1.13, NZD: 0.91, SGD: 1.15,
};

let budgetCurrencyCode = 'AUD';

function toggleBudgetCurrencyPicker() {
  const picker = document.getElementById('budgetCurrencyPicker');
  picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
}

function pickBudgetCurrency(code, label, symbol) {
  document.getElementById('budgetCurrencyBtnLabel').textContent = label;
  document.getElementById('budgetCurrencyPicker').style.display = 'none';
  document.querySelectorAll('#budgetCurrencyPicker .curr-opt').forEach(el => {
    el.classList.toggle('active', el.textContent.trim() === label.trim());
  });
  budgetCurrencyCode = code;
  currency = BUDGET_CURRENCY_SYMBOLS[code] || '$';
  bSetCurrency(currency);
}

// Close budget currency picker on outside click
document.addEventListener('click', e => {
  const dd = document.getElementById('budgetCurrencyDropdown');
  if (dd && !dd.contains(e.target)) {
    const picker = document.getElementById('budgetCurrencyPicker');
    if (picker) picker.style.display = 'none';
  }
});

function bSetCurrency(v) {
  currency = v;
  // Update drawer currency symbol if drawer exists
  const sym = document.getElementById('drawerCurrencySym');
  if (sym) sym.textContent = v;
  renderBudget();
  if (typeof renderReview === 'function') renderReview();
}

// ============================================================
//  BUDGET PAGE
// ============================================================
function renderBudget() {
  // Month selector
  const ms = document.getElementById('monthSelector');
  ms.innerHTML = MONTHS.map((m,i) =>
    `<button class="month-btn ${i===currentBudgetMonth?'active':''}" onclick="selectBudgetMonth(${i})">${m.slice(0,3)}</button>`
  ).join('');
  requestAnimationFrame(function() {
    const active = ms.querySelector('.month-btn.active');
    if (active) active.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
    if (typeof window.refreshMonthArrows === 'function') window.refreshMonthArrows();
  });

  document.getElementById('heroMonth').textContent = MONTHS[currentBudgetMonth].split('').join(' ');

  const d = getBudgetMonth(currentBudgetMonth);

  // Aggregate period data into monthly rows before rendering
  aggregatePeriods(d, 'income');
  aggregatePeriods(d, 'bills');

  // Apply recurring bill amounts from last month if not yet filled
  if (applyRecurring(d)) saveBudgetMonth(currentBudgetMonth, d);

  // Render income and bills with section-level period controls
  renderSectionWithPeriods('income', d);
  renderSectionWithPeriods('bills', d);

  // Render remaining sections normally
  renderExpenseSummary(d);
  renderTrackerSection('savings-rows', d.savings, 'savings', false);
  renderTrackerSection('debt-rows', d.debt, 'debt', true);
  renderExpenseLog(d);
  renderBreakdown(d);
  updateTotals(d);
  populateCatDropdown(d);
  updateCopyBar(d);
}

function selectBudgetMonth(m) {
  currentBudgetMonth = m;
  incomePeriodTab = 'overview';
  billsPeriodTab  = 'overview';
  renderBudget();
}

// ── Add a blank row to any section ───────────────────────────
function addRow(section) {
  const d = getBudgetMonth(currentBudgetMonth);
  const hasPaid = section === 'bills' || section === 'debt';
  const newRow = { name: '', budget: '', actual: '' };
  if (hasPaid) newRow.paid = false;
  if (section === 'expenseSummary') newRow.actual = 0;
  d[section].push(newRow);
  saveBudgetMonth(currentBudgetMonth, d);
  renderBudget();
  // Focus the new row's name input after render
  requestAnimationFrame(() => {
    const containerMap = {
      income: '#income-rows',
      bills: '#bills-rows',
      expenseSummary: '#expense-summary-rows',
      savings: '#savings-rows',
      debt: '#debt-rows'
    };
    const containerId = containerMap[section];
    if (!containerId) return;
    const inputs = document.querySelectorAll(containerId + ' .row-name input[type=text]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });
}

// ── Delete a row from any section ────────────────────────────
function deleteRow(section, i) {
  const d = getBudgetMonth(currentBudgetMonth);
  // If deleting an expense category, also clean up any logged expenses in that category
  if (section === 'expenseSummary') {
    const catName = d.expenseSummary[i].name;
    // Don't delete expenses, just unlink them (set category to '')
    d.expenses.forEach(e => { if (e.category === catName) e.category = ''; });
  }
  d[section].splice(i, 1);
  // Also trim period data to stay in sync
  if (section === 'income' || section === 'bills') {
    const key = section + 'Periods';
    Object.values(d[key] || {}).forEach(pRows => { if (pRows.length > i) pRows.splice(i, 1); });
  }
  saveBudgetMonth(currentBudgetMonth, d);
  renderBudget();
}

// ── Copy budget amounts from previous month ───────────────────
function copyLastMonth() {
  const prevMonth = currentBudgetMonth === 0 ? 11 : currentBudgetMonth - 1;
  const prevYear = currentBudgetMonth === 0 ? currentYear - 1 : currentYear;

  // Temporarily switch year context to get prev month data
  const all = getAllState();
  const prevYearData = all[prevYear] || {};
  const prevData = (prevYearData.budget || {})[prevMonth];

  if (!prevData) {
    alert('No data found for ' + MONTHS[prevMonth] + (currentBudgetMonth === 0 ? ' ' + prevYear : '') + '.');
    return;
  }

  const cur = getBudgetMonth(currentBudgetMonth);

  // Copy structure and budget amounts (not actuals, not paid status, not expenses, not notes)
  ['income', 'bills', 'savings', 'debt'].forEach(section => {
    if (prevData[section]) {
      cur[section] = prevData[section].map(r => ({
        name: r.name,
        budget: r.budget,
        actual: '',
        ...(r.paid !== undefined ? { paid: false } : {}),
        ...(r.recurring !== undefined ? { recurring: r.recurring } : {})
      }));
    }
  });
  if (prevData.expenseSummary) {
    cur.expenseSummary = prevData.expenseSummary.map(r => ({
      name: r.name,
      budget: r.budget,
      actual: 0
    }));
  }

  saveBudgetMonth(currentBudgetMonth, cur);
  renderBudget();
}

// ── Show/hide the "copy last month" helper bar ────────────────
function updateCopyBar(d) {
  const bar = document.getElementById('copyLastMonthBar');
  if (!bar) return;
  // Show bar if this month has no budgeted amounts set anywhere
  const hasAnyBudget =
    [...d.income, ...d.bills, ...d.savings, ...d.debt, ...d.expenseSummary]
      .some(r => r.budget && parseFloat(r.budget) > 0);
  const prevMonth = currentBudgetMonth === 0 ? 11 : currentBudgetMonth - 1;
  const prevYear = currentBudgetMonth === 0 ? currentYear - 1 : currentYear;
  const all = getAllState();
  const hasPrevData = !!((all[prevYear] || {}).budget || {})[prevMonth];
  bar.classList.toggle('visible', !hasAnyBudget && hasPrevData);
}

function renderTrackerSection(containerId, rows, section, hasPaid) {
  const el = document.getElementById(containerId);
  if (!rows.length) {
    el.innerHTML = `<div class="empty">No entries — click <strong>+ Add</strong> to add one</div>`;
    return;
  }
  el.innerHTML = rows.map((row, i) => {
    const b = num(row.budget), a = num(row.actual);
    const pctFill = b > 0 ? Math.min(a / b * 100, 100) : 0;
    const overBudget = b > 0 && a > b;
    const barColor = overBudget ? 'var(--red)' : a > 0 ? 'var(--green)' : 'var(--coral)';
    const isRecurring = !!row.recurring;
    return `
    <div class="tracker-row" style="padding-right:28px;">
      <div class="row-name">
        ${hasPaid ? `<input type="checkbox" class="paid-checkbox" ${row.paid?'checked':''} onchange="togglePaid('${section}',${i},this.checked)" title="${row.paid?'Mark unpaid':'Mark paid'}">` : ''}
        <input type="text" value="${row.name.replace(/"/g,'&quot;')}" onchange="updateName('${section}',${i},this.value)" placeholder="Name" style="${row.paid?'text-decoration:line-through;opacity:0.5;':''}" title="Click to rename">
        ${hasPaid ? `<button class="recurring-btn ${isRecurring?'active':''}" onclick="toggleRecurring('${section}',${i})" title="${isRecurring?'Recurring — click to disable':'Set as recurring (auto-fills actual each month)'}">↻</button>` : ''}
      </div>
      <div class="amount-input">
        <span>${currency}</span>
        <input type="number" value="${row.budget||''}" min="0" step="0.01" placeholder="0.00"
          onchange="updateBudget('${section}',${i},this.value)" title="Budgeted amount">
      </div>
      <div class="amount-input">
        <span>${currency}</span>
        <input type="number" value="${row.actual||''}" min="0" step="0.01" placeholder="0.00"
          onchange="updateActual('${section}',${i},this.value)" title="Actual amount">
      </div>
      <button class="row-del" onclick="deleteRow('${section}',${i})" title="Remove row">×</button>
    </div>
    ${b > 0 ? `<div class="row-progress"><div class="row-progress-fill" style="width:${pctFill}%;background:${barColor};"></div></div>` : ''}
  `}).join('');
}

function renderExpenseSummary(d) {
  // Compute actuals from expense log
  d.expenseSummary.forEach(es => {
    es.actual = d.expenses.filter(e => e.category === es.name).reduce((a,e) => a + num(e.amount), 0);
  });
  const el = document.getElementById('expense-summary-rows');
  if (!d.expenseSummary.length) {
    el.innerHTML = `<div class="empty">No categories — click <strong>+ Add</strong> to add one</div>`;
    return;
  }
  el.innerHTML = d.expenseSummary.map((row, i) => {
    const b = num(row.budget), a = row.actual;
    const pctFill = b > 0 ? Math.min(a / b * 100, 100) : 0;
    const overBudget = b > 0 && a > b;
    const barColor = overBudget ? 'var(--red)' : a > 0 ? 'var(--coral)' : 'var(--coral)';
    return `
    <div class="tracker-row" style="padding-right:28px;">
      <div class="row-name">
        <input type="text" value="${row.name.replace(/"/g,'&quot;')}" onchange="updateName('expenseSummary',${i},this.value);renderBudget();" placeholder="Category" title="Click to rename">
      </div>
      <div class="amount-input">
        <span>${currency}</span>
        <input type="number" value="${row.budget||''}" min="0" step="0.01" placeholder="0.00"
          onchange="updateBudget('expenseSummary',${i},this.value)" title="Budgeted amount">
      </div>
      <div class="row-total ${overBudget ? 'red' : ''}" style="color:${a > 0 ? (overBudget ? 'var(--red)' : 'var(--dark)') : 'var(--mid)'}">
        ${bFmt(a)}${overBudget ? ' <span style="font-size:9px;color:var(--red)">over</span>' : ''}
      </div>
      <button class="row-del" onclick="deleteRow('expenseSummary',${i})" title="Remove category">×</button>
    </div>
    ${b > 0 ? `<div class="row-progress"><div class="row-progress-fill" style="width:${pctFill}%;background:${barColor};"></div></div>` : ''}
  `}).join('');
}

function renderExpenseLog(d) {
  const el = document.getElementById('expense-log');
  if (!d.expenses.length) {
    el.innerHTML = '<div class="empty">No expenses logged yet</div>';
    return;
  }
  el.innerHTML = [...d.expenses].reverse().map((e, ri) => {
    const i = d.expenses.length - 1 - ri;
    return `<div class="expense-row">
      <span class="expense-date">${e.date ? e.date.slice(5) : '—'}</span>
      <span class="expense-amount">-${bFmt(e.amount)}</span>
      <span class="expense-cat">${e.category || '—'}</span>
      <span class="expense-note">${e.note || ''}</span>
      <button class="delete-btn" onclick="deleteExpense(${i})">×</button>
    </div>`;
  }).join('');
}

function renderBreakdown(d) {
  const el = document.getElementById('breakdown-rows');
  const cats = d.expenseSummary.map(es => ({
    name: es.name,
    total: d.expenses.filter(e => e.category === es.name).reduce((a,e) => a+num(e.amount), 0)
  })).filter(c => c.total > 0).sort((a,b) => b.total - a.total);

  const grand = cats.reduce((a,c) => a+c.total, 0);
  if (!cats.length) {
    el.innerHTML = '<div class="empty">No expenses logged yet</div>';
    return;
  }
  el.innerHTML = cats.map(c => `
    <div class="breakdown-bar-row">
      <div class="breakdown-label-row">
        <span class="breakdown-cat">${c.name} <span style="color:var(--mid);font-size:11px">${bFmt(c.total)}</span></span>
        <span class="breakdown-pct">${pct(c.total, grand)}</span>
      </div>
      <div class="breakdown-bar-bg">
        <div class="breakdown-bar-fill" style="width:${grand ? (c.total/grand*100) : 0}%"></div>
      </div>
    </div>
  `).join('');
}

function populateCatDropdown(d) {
  const sel = document.getElementById('expCat');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Category</option>' +
    d.expenseSummary.map(es => `<option value="${es.name}" ${cur===es.name?'selected':''}>${es.name}</option>`).join('');
}

// ── Rollover preference (on by default) ──────────────────────
function getRolloverPref() {
  const stored = localStorage.getItem('ls_rollover_enabled');
  return stored === null ? true : stored === 'true';
}
function setRolloverPref(enabled) {
  localStorage.setItem('ls_rollover_enabled', enabled ? 'true' : 'false');
  renderBudget(); // refresh immediately so left-to-spend updates
}

// ── calcRollover: returns the "left to spend" of any past month ──
// Chains recursively so each month's rollover includes the one before it.
// depth guard stops at 24 months to prevent runaway recursion.
function calcRollover(month, year, depth) {
  depth = depth || 0;
  // At the top-level call, check if the user has disabled rollover
  if (depth === 0 && !getRolloverPref()) return 0;
  if (depth > 24) return 0;

  const all = getAllState();
  const data = ((all[year] || {}).budget || {})[month];
  if (!data) return 0;

  const pIn  = Math.max(data.income.reduce((a,r) => a + num(r.actual || r.budget), 0), 0);
  const pOut = data.bills.reduce((a,r)   => a + num(r.actual || r.budget), 0)
             + (data.expenses || []).reduce((a,e) => a + num(e.amount), 0)
             + data.savings.reduce((a,r)  => a + num(r.actual || r.budget), 0)
             + data.debt.reduce((a,r)     => a + num(r.actual || r.budget), 0);

  // This month's own rollover from the month before it
  const prevM = month === 0 ? 11 : month - 1;
  const prevY = month === 0 ? year - 1 : year;
  const prevRollover = calcRollover(prevM, prevY, depth + 1);

  return pIn + prevRollover - pOut;
}

function updateTotals(d) {
  // Income
  const ib = d.income.reduce((a,r) => a+num(r.budget), 0);
  const ia = d.income.reduce((a,r) => a+num(r.actual), 0);
  document.getElementById('income-budget-total').textContent = bFmt(ib);
  document.getElementById('income-actual-total').textContent = bFmt(ia);

  // Bills
  const bb = d.bills.reduce((a,r) => a+num(r.budget), 0);
  const ba = d.bills.reduce((a,r) => a+num(r.actual), 0);
  document.getElementById('bills-budget-total').textContent = bFmt(bb);
  document.getElementById('bills-actual-total').textContent = bFmt(ba);

  // Expenses
  const eb = d.expenseSummary.reduce((a,r) => a+num(r.budget), 0);
  const ea = d.expenses.reduce((a,e) => a+num(e.amount), 0);
  document.getElementById('expenses-budget-total').textContent = bFmt(eb);
  document.getElementById('expenses-actual-total').textContent = bFmt(ea);

  // Savings
  const sb = d.savings.reduce((a,r) => a+num(r.budget), 0);
  const sa = d.savings.reduce((a,r) => a+num(r.actual), 0);
  document.getElementById('savings-budget-total').textContent = bFmt(sb);
  document.getElementById('savings-actual-total').textContent = bFmt(sa);

  // Debt
  const db = d.debt.reduce((a,r) => a+num(r.budget), 0);
  const da = d.debt.reduce((a,r) => a+num(r.actual), 0);
  document.getElementById('debt-budget-total').textContent = bFmt(db);
  document.getElementById('debt-actual-total').textContent = bFmt(da);

  // Cash flow summary
  document.getElementById('cf-income').textContent = bFmt(ia || ib);
  document.getElementById('cf-bills').textContent = '-' + bFmt(ba || bb);
  document.getElementById('cf-expenses').textContent = '-' + bFmt(ea || eb);
  document.getElementById('cf-savings').textContent = '-' + bFmt(sa || sb);
  document.getElementById('cf-debt').textContent = '-' + bFmt(da || db);

  // Allocation
  const totalOut = (ba||bb) + (ea||eb) + (sa||sb) + (da||db);
  const totalIn = ia || ib;
  document.getElementById('alloc-bills').textContent = pct(ba||bb, totalIn);
  document.getElementById('alloc-expenses').textContent = pct(ea||eb, totalIn);
  document.getElementById('alloc-savings').textContent = pct(sa||sb, totalIn);
  document.getElementById('alloc-debt').textContent = pct(da||db, totalIn);

  // ── Rollover from previous month ──────────────────────────────
  // We carry forward the EXACT "left to spend" the previous month showed,
  // which itself includes that month's rollover — so the chain is correct.
  const prevMonth = currentBudgetMonth === 0 ? 11 : currentBudgetMonth - 1;
  const prevYear  = currentBudgetMonth === 0 ? currentYear - 1 : currentYear;
  const rolloverAmt = calcRollover(prevMonth, prevYear);

  const rolloverEl = document.getElementById('rolloverBadge');
  if (rolloverEl) {
    if (rolloverAmt !== 0) {
      const cls = rolloverAmt > 0 ? 'pos' : 'neg';
      const sign = rolloverAmt > 0 ? '+' : '';
      rolloverEl.innerHTML = `Rollover from ${MONTHS[prevMonth].slice(0,3)}: <span class="${cls}">${sign}${bFmt(Math.abs(rolloverAmt))}</span>`;
      rolloverEl.style.display = 'block';
    } else {
      rolloverEl.style.display = 'none';
    }
  }

  // Left to spend (include rollover)
  const left = (ia || ib) + rolloverAmt - totalOut;
  const leftEl = document.getElementById('leftAmount');
  leftEl.textContent = bFmt(Math.abs(left));
  leftEl.className = 'left-amount ' + (left > 0 ? 'positive' : left < 0 ? 'negative' : 'zero');
  if (left < 0) leftEl.textContent = '-' + bFmt(Math.abs(left));

  // ── Spending insights ─────────────────────────────────────────
  renderInsights(d, totalIn);

  // ── Month notes ───────────────────────────────────────────────
  const notesEl = document.getElementById('monthNotes');
  if (notesEl && document.activeElement !== notesEl) {
    notesEl.value = d.notes || '';
  }
}

// ── Recurring bills: toggle ───────────────────────────────────
function toggleRecurring(section, i) {
  const d = getBudgetMonth(currentBudgetMonth);
  d[section][i].recurring = !d[section][i].recurring;
  saveBudgetMonth(currentBudgetMonth, d);
  renderBudget();
}

// ── Apply recurring actuals when loading a month ──────────────
function applyRecurring(d) {
  const prevMonth = currentBudgetMonth === 0 ? 11 : currentBudgetMonth - 1;
  const prevYear  = currentBudgetMonth === 0 ? currentYear - 1 : currentYear;
  const all = getAllState();
  const prevData = ((all[prevYear] || {}).budget || {})[prevMonth];
  if (!prevData) return false;
  let changed = false;
  ['bills','debt'].forEach(section => {
    (d[section] || []).forEach((row, i) => {
      if (row.recurring && (!row.actual || row.actual === '')) {
        // Find matching row by name in previous month
        const prevRow = (prevData[section] || []).find(r => r.name === row.name);
        if (prevRow && (prevRow.actual || prevRow.budget)) {
          d[section][i].actual = prevRow.actual || prevRow.budget;
          changed = true;
        }
      }
    });
  });
  return changed;
}

// ── Month notes save ──────────────────────────────────────────
function saveMonthNotes(val) {
  const d = getBudgetMonth(currentBudgetMonth);
  d.notes = val;
  saveBudgetMonth(currentBudgetMonth, d);
}

// ── Spending insights ─────────────────────────────────────────
function renderInsights(d, totalIn) {
  const bar = document.getElementById('insightsBar');
  if (!bar) return;
  const insights = [];

  // Over-budget categories
  d.expenseSummary.forEach(es => {
    const b = num(es.budget), a = es.actual || 0;
    if (b > 0 && a > b) {
      const overpct = Math.round((a - b) / b * 100);
      insights.push(`⚠️ <strong>${es.name}</strong> is ${overpct}% over budget (${bFmt(a)} of ${bFmt(b)})`);
    }
  });

  // Over-budget bills
  d.bills.forEach(r => {
    const b = num(r.budget), a = num(r.actual);
    if (b > 0 && a > b) insights.push(`⚠️ <strong>${r.name}</strong> bill exceeded budget by ${bFmt(a-b)}`);
  });

  // Savings rate warning
  if (totalIn > 0) {
    const sa = d.savings.reduce((a,r)=>a+num(r.actual||r.budget),0);
    const savingsRate = sa / totalIn * 100;
    if (savingsRate < 10 && savingsRate >= 0 && d.savings.some(r => r.budget)) {
      insights.push(`💡 Savings rate is ${savingsRate.toFixed(0)}% — aim for at least 20%`);
    }
  }

  // Unpaid bills past mid-month
  const todayNow = new Date();
  const todayDate = todayNow.getDate();
  if (todayNow.getMonth() === currentBudgetMonth && todayNow.getFullYear() === currentYear && todayDate > 15) {
    const unpaid = d.bills.filter(r => r.budget && !r.paid);
    if (unpaid.length) insights.push(`🗓 ${unpaid.length} bill${unpaid.length>1?'s':''} still unpaid: ${unpaid.map(r=>r.name).join(', ')}`);
  }

  if (insights.length) {
    bar.innerHTML = insights.map(t => `<div class="insight-item">${t}</div>`).join('');
    bar.classList.add('visible');
  } else {
    bar.classList.remove('visible');
  }
}

function updateName(section, i, val) {
  const d = getBudgetMonth(currentBudgetMonth);
  d[section][i].name = val;
  saveBudgetMonth(currentBudgetMonth, d);
}
function updateBudget(section, i, val) {
  const d = getBudgetMonth(currentBudgetMonth);
  d[section][i].budget = val;
  saveBudgetMonth(currentBudgetMonth, d);
  updateTotals(d);
}
function updateActual(section, i, val) {
  const d = getBudgetMonth(currentBudgetMonth);
  d[section][i].actual = val;
  saveBudgetMonth(currentBudgetMonth, d);
  updateTotals(d);
}
function togglePaid(section, i, checked) {
  const d = getBudgetMonth(currentBudgetMonth);
  d[section][i].paid = checked;
  saveBudgetMonth(currentBudgetMonth, d);
}

function addExpense() {
  const date = document.getElementById('expDate').value;
  const amount = document.getElementById('expAmount').value;
  const category = document.getElementById('expCat').value;
  const note = document.getElementById('expNote').value;
  if (!amount) { document.getElementById('expAmount').focus(); return; }
  const d = getBudgetMonth(currentBudgetMonth);
  d.expenses.push({ date, amount: parseFloat(amount), category, note });
  saveBudgetMonth(currentBudgetMonth, d);
  document.getElementById('expAmount').value = '';
  document.getElementById('expNote').value = '';
  // Close drawer
  const overlay = document.getElementById('expenseDrawerOverlay');
  if (overlay) overlay.classList.remove('open');
  renderBudget();
}

function deleteExpense(i) {
  const d = getBudgetMonth(currentBudgetMonth);
  d.expenses.splice(i, 1);
  saveBudgetMonth(currentBudgetMonth, d);
  renderBudget();
}

// ============================================================
//  HABITS PAGE
// ============================================================
function renderHabits() {
  const ms = document.getElementById('habitMonthSelector');
  ms.innerHTML = MONTHS.map((m,i) =>
    `<button class="month-btn ${i===currentHabitMonth?'active':''}" onclick="selectHabitMonth(${i})">${m.slice(0,3)}</button>`
  ).join('');
  requestAnimationFrame(function() {
    const active = ms.querySelector('.month-btn.active');
    if (active) active.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
    if (typeof window.refreshMonthArrows === 'function') window.refreshMonthArrows();
  });

  document.getElementById('habitMonthLabel').textContent = '· ' + MONTHS[currentHabitMonth] + ' ' + currentYear + ' ·';

  renderCalendar();
  renderWeeklyHabits();
  renderMonthlyHabits();
  updateHabitStats();
  updateHabitsBar();
  renderHabitProgressChart();

  // Auto-scroll calendar to today after render
  requestAnimationFrame(function() {
    scrollCalendarToToday();
  });
}

function selectHabitMonth(m) {
  currentHabitMonth = m;
  renderHabits();
}

function daysInMonth(m, y) { return new Date(y, m+1, 0).getDate(); }
function dayOfWeek(m, y, d) { return new Date(y, m, d).getDay(); }

function renderCalendar() {
  const h = getHabitMonth(currentHabitMonth);
  const days = daysInMonth(currentHabitMonth, currentYear);
  const today = new Date();
  const todayDay = (today.getMonth() === currentHabitMonth && today.getFullYear() === currentYear) ? today.getDate() : -1;

  // Header
  const headerEl = document.getElementById('calHeader');
  let headerHTML = `<div class="cal-habit-col">Habit</div>`;
  for (let d = 1; d <= days; d++) {
    const dow = dayOfWeek(currentHabitMonth, currentYear, d);
    const isToday = d === todayDay;
    headerHTML += `<div class="cal-day-head ${isToday?'today':''}">
      <span class="cal-day-num">${d}</span>
      <span class="cal-day-name">${DAYS[dow].slice(0,1)}</span>
    </div>`;
  }
  headerEl.innerHTML = headerHTML;

  // Body
  const bodyEl = document.getElementById('calBody');
  if (!h.dailyHabits.length) {
    bodyEl.innerHTML = '<div class="empty">Add your first daily habit above</div>';
    return;
  }

  bodyEl.innerHTML = h.dailyHabits.map((habit, hi) => {
    // calc pct
    let checked = 0, possible = todayDay > 0 ? todayDay : days;
    for (let d=1; d<=possible; d++) { if (h.dailyChecks[hi+'_'+d]) checked++; }
    const p = possible ? Math.round(checked/possible*100) : 0;

    let cells = '';
    for (let d=1; d<=days; d++) {
      const isFuture = d > todayDay && todayDay > 0;
      const isChecked = !!h.dailyChecks[hi+'_'+d];
      cells += `<div class="cal-cell ${isChecked?'checked':''} ${isFuture?'future':''}"
        onclick="${isFuture?'':` toggleDay(${hi},${d})`}"></div>`;
    }
    return `<div class="cal-row">
      <div class="cal-habit-name">
        <span style="flex:1;font-size:12px;">${habit}</span>
        <span class="pct">${p}%</span>
        <button class="del" onclick="deleteDailyHabit(${hi})">×</button>
      </div>
      ${cells}
    </div>`;
  }).join('');
}

function toggleDay(hi, d) {
  const h = getHabitMonth(currentHabitMonth);
  const key = hi + '_' + d;
  h.dailyChecks[key] = !h.dailyChecks[key];
  saveHabitMonth(currentHabitMonth, h);
  renderCalendar();
  updateHabitStats();
  renderHabitProgressChart();
}

function addDailyHabit() {
  const inp = document.getElementById('newDailyHabit');
  const val = inp.value.trim();
  if (!val) return;
  const h = getHabitMonth(currentHabitMonth);
  h.dailyHabits.push(val);
  saveHabitMonth(currentHabitMonth, h);
  inp.value = '';
  renderCalendar();
  updateHabitStats();
}

function deleteDailyHabit(hi) {
  const h = getHabitMonth(currentHabitMonth);
  h.dailyHabits.splice(hi, 1);
  // Reindex checks
  const newChecks = {};
  Object.entries(h.dailyChecks).forEach(([k, v]) => {
    const [i, d] = k.split('_').map(Number);
    if (i < hi) newChecks[k] = v;
    else if (i > hi) newChecks[(i-1)+'_'+d] = v;
  });
  h.dailyChecks = newChecks;
  saveHabitMonth(currentHabitMonth, h);
  renderCalendar();
  updateHabitStats();
}

function renderWeeklyHabits() {
  const h = getHabitMonth(currentHabitMonth);
  const el = document.getElementById('weekly-rows');
  if (!h.weeklyHabits.length) {
    el.innerHTML = '<div class="empty">No weekly habits yet</div>';
    return;
  }
  el.innerHTML = h.weeklyHabits.map((habit, i) => `
    <div class="wm-row">
      <input type="checkbox" ${h.weeklyChecks[i+'_'+selectedWeek] ? 'checked' : ''}
        onchange="toggleWeekly(${i}, this.checked)">
      <div class="wm-row-name">
        <input type="text" value="${habit}" onchange="updateWeeklyName(${i}, this.value)">
      </div>
      <button class="wm-del" onclick="deleteWeekly(${i})">×</button>
    </div>
  `).join('');
}

function toggleWeekly(i, checked) {
  const h = getHabitMonth(currentHabitMonth);
  h.weeklyChecks[i+'_'+selectedWeek] = checked;
  saveHabitMonth(currentHabitMonth, h);
}
function updateWeeklyName(i, val) {
  const h = getHabitMonth(currentHabitMonth);
  h.weeklyHabits[i] = val;
  saveHabitMonth(currentHabitMonth, h);
}
function addWeeklyHabit() {
  const inp = document.getElementById('newWeeklyHabit');
  const val = inp.value.trim();
  if (!val) return;
  const h = getHabitMonth(currentHabitMonth);
  h.weeklyHabits.push(val);
  saveHabitMonth(currentHabitMonth, h);
  inp.value = '';
  renderWeeklyHabits();
}
function deleteWeekly(i) {
  const h = getHabitMonth(currentHabitMonth);
  h.weeklyHabits.splice(i, 1);
  saveHabitMonth(currentHabitMonth, h);
  renderWeeklyHabits();
}
function selectWeek(w, btn) {
  selectedWeek = w;
  document.querySelectorAll('.week-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderWeeklyHabits();
  const h = getHabitMonth(currentHabitMonth);
  updateWeeklyRates(h);
}

function renderMonthlyHabits() {
  const h = getHabitMonth(currentHabitMonth);
  const el = document.getElementById('monthly-rows');
  if (!h.monthlyHabits.length) {
    el.innerHTML = '<div class="empty">No monthly habits yet</div>';
    return;
  }
  el.innerHTML = h.monthlyHabits.map((habit, i) => `
    <div class="wm-row">
      <input type="checkbox" ${h.monthlyChecks[i] ? 'checked' : ''}
        onchange="toggleMonthly(${i}, this.checked)">
      <div class="wm-row-name">
        <input type="text" value="${habit}" onchange="updateMonthlyName(${i}, this.value)">
      </div>
      <button class="wm-del" onclick="deleteMonthly(${i})">×</button>
    </div>
  `).join('');
}

function toggleMonthly(i, checked) {
  const h = getHabitMonth(currentHabitMonth);
  h.monthlyChecks[i] = checked;
  saveHabitMonth(currentHabitMonth, h);
}
function updateMonthlyName(i, val) {
  const h = getHabitMonth(currentHabitMonth);
  h.monthlyHabits[i] = val;
  saveHabitMonth(currentHabitMonth, h);
}
function addMonthlyHabit() {
  const inp = document.getElementById('newMonthlyHabit');
  const val = inp.value.trim();
  if (!val) return;
  const h = getHabitMonth(currentHabitMonth);
  h.monthlyHabits.push(val);
  saveHabitMonth(currentHabitMonth, h);
  inp.value = '';
  renderMonthlyHabits();
}
function deleteMonthly(i) {
  const h = getHabitMonth(currentHabitMonth);
  h.monthlyHabits.splice(i, 1);
  saveHabitMonth(currentHabitMonth, h);
  renderMonthlyHabits();
}

// ── Copy habit lists from previous month ─────────────────────
function copyLastHabits() {
  const prevMonth = currentHabitMonth === 0 ? 11 : currentHabitMonth - 1;
  const prevYear = currentHabitMonth === 0 ? currentYear - 1 : currentYear;
  const all = getAllState();
  const prevData = ((all[prevYear] || {}).habits || {})[prevMonth];
  if (!prevData) {
    alert('No habits found for ' + MONTHS[prevMonth] + '.');
    return;
  }
  const h = getHabitMonth(currentHabitMonth);
  // Copy habit names only, not check data
  h.dailyHabits = [...(prevData.dailyHabits || [])];
  h.weeklyHabits = [...(prevData.weeklyHabits || [])];
  h.monthlyHabits = [...(prevData.monthlyHabits || [])];
  saveHabitMonth(currentHabitMonth, h);
  renderHabits();
}

function updateHabitsBar() {
  const bar = document.getElementById('copyLastHabitsBar');
  if (!bar) return;
  const h = getHabitMonth(currentHabitMonth);
  const hasAny = (h.dailyHabits.length + h.weeklyHabits.length + h.monthlyHabits.length) > 0;
  const prevMonth = currentHabitMonth === 0 ? 11 : currentHabitMonth - 1;
  const prevYear = currentHabitMonth === 0 ? currentYear - 1 : currentYear;
  const all = getAllState();
  const hasPrevData = !!((all[prevYear] || {}).habits || {})[prevMonth];
  bar.classList.toggle('visible', !hasAny && hasPrevData);
}

// ── Habit progress line chart ─────────────────────────────────
let habitProgressChartObj = null;

function renderHabitProgressChart() {
  const h = getHabitMonth(currentHabitMonth);
  const today = new Date();
  const isCurrentMonth = today.getMonth() === currentHabitMonth && today.getFullYear() === currentYear;
  const todayDay = isCurrentMonth ? today.getDate() : daysInMonth(currentHabitMonth, currentYear);
  const days = daysInMonth(currentHabitMonth, currentYear);
  const numHabits = h.dailyHabits.length;

  const canvas = document.getElementById('habitProgressChart');
  const legendEl = document.getElementById('habitChartLegend');
  const subtitleEl = document.getElementById('habitChartSubtitle');
  if (!canvas) return;

  // Destroy previous chart instance
  if (habitProgressChartObj) { habitProgressChartObj.destroy(); habitProgressChartObj = null; }

  if (!numHabits) {
    canvas.style.display = 'none';
    if (legendEl) legendEl.innerHTML = '<span style="font-size:12px;color:var(--mid);font-style:italic;">Add daily habits to see progress</span>';
    if (subtitleEl) subtitleEl.textContent = '';
    return;
  }
  canvas.style.display = 'block';

  // Build day-by-day overall completion % (all habits combined)
  const labels = [];
  const overallData = [];
  const perHabitData = h.dailyHabits.map(() => []); // one array per habit

  for (let d = 1; d <= todayDay; d++) {
    labels.push(d);
    let done = 0;
    h.dailyHabits.forEach((_, hi) => {
      const checked = !!h.dailyChecks[hi + '_' + d];
      if (checked) done++;
      perHabitData[hi].push(checked ? 100 : 0);
    });
    overallData.push(numHabits ? Math.round(done / numHabits * 100) : 0);
  }

  // 7-day rolling average for smoothing
  const rollingAvg = overallData.map((_, i) => {
    const slice = overallData.slice(Math.max(0, i - 6), i + 1);
    return Math.round(slice.reduce((a, b) => a + b, 0) / slice.length);
  });

  // Monthly completion so far
  const avgCompletion = overallData.length
    ? Math.round(overallData.reduce((a, b) => a + b, 0) / overallData.length)
    : 0;
  if (subtitleEl) subtitleEl.textContent = avgCompletion + '% avg this month';

  const HABIT_COLORS = ['#ff6b5b','#4a90d9','#3dbf82','#f59e0b','#8b5cf6','#0097a7','#e85444','#22c55e'];

  const datasets = [
    {
      label: 'Daily %',
      data: overallData,
      borderColor: 'rgba(255,107,91,0.25)',
      backgroundColor: 'transparent',
      borderWidth: 1,
      pointRadius: 0,
      tension: 0.3,
      fill: false,
      order: 2,
    },
    {
      label: '7-day avg',
      data: rollingAvg,
      borderColor: '#ff6b5b',
      backgroundColor: 'rgba(255,107,91,0.08)',
      borderWidth: 2.5,
      pointRadius: 0,
      tension: 0.4,
      fill: true,
      order: 1,
    }
  ];

  // Legend
  if (legendEl) {
    legendEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--mid);font-family:'Montserrat',sans-serif;font-weight:600;">
        <div style="width:20px;height:2.5px;background:#ff6b5b;border-radius:2px;"></div> 7-day rolling avg
      </div>
      <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--mid);font-family:'Montserrat',sans-serif;font-weight:600;">
        <div style="width:20px;height:1px;background:rgba(255,107,91,0.35);border-radius:2px;"></div> Daily
      </div>
    `;
  }

  habitProgressChartObj = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: ctx => 'Day ' + ctx[0].label,
            label: ctx => ' ' + ctx.dataset.label + ': ' + ctx.parsed.y + '%'
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#6b7a8d',
            font: { size: 9 },
            maxTicksLimit: 10,
            callback: v => v + 1
          }
        },
        y: {
          min: 0, max: 100,
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: {
            color: '#6b7a8d',
            font: { size: 9 },
            callback: v => v + '%',
            stepSize: 25,
          }
        }
      }
    }
  });
}

// ── Auto-scroll calendar to today's column ────────────────────
function scrollCalendarToToday() {
  const today = new Date();
  const isCurrentMonth = today.getMonth() === currentHabitMonth && today.getFullYear() === currentYear;
  if (!isCurrentMonth) return; // only scroll for the current month

  const calWrap = document.querySelector('.cal-wrap');
  const calHeader = document.getElementById('calHeader');
  if (!calWrap || !calHeader) return;

  // Find the "today" header cell
  const todayHead = calHeader.querySelector('.cal-day-head.today');
  if (!todayHead) return;

  // Scroll so today is roughly centred, accounting for the fixed habit name column (160px)
  const habitColWidth = 160;
  const cellLeft = todayHead.offsetLeft;
  const wrapWidth = calWrap.clientWidth;
  const scrollTarget = cellLeft - habitColWidth - (wrapWidth - habitColWidth) / 2 + todayHead.offsetWidth / 2;

  calWrap.scrollTo({ left: Math.max(0, scrollTarget), behavior: 'smooth' });
}

function updateHabitStats() {
  const h = getHabitMonth(currentHabitMonth);
  const today = new Date();
  const todayDay = (today.getMonth() === currentHabitMonth && today.getFullYear() === currentYear) ? today.getDate() : daysInMonth(currentHabitMonth, currentYear);
  const numHabits = h.dailyHabits.length;

  if (!numHabits) {
    document.getElementById('h-today').textContent = '—';
    document.getElementById('h-month').textContent = '—';
    document.getElementById('h-streak').textContent = '0';
    return;
  }

  // Today %
  let todayChecked = 0;
  h.dailyHabits.forEach((_, hi) => { if (h.dailyChecks[hi+'_'+todayDay]) todayChecked++; });
  document.getElementById('h-today').textContent = Math.round(todayChecked/numHabits*100) + '%';

  // Month %
  let total = 0, possible = todayDay * numHabits;
  for (let d=1; d<=todayDay; d++) {
    h.dailyHabits.forEach((_, hi) => { if (h.dailyChecks[hi+'_'+d]) total++; });
  }
  document.getElementById('h-month').textContent = possible ? Math.round(total/possible*100) + '%' : '0%';

  // ── Cross-month streak ────────────────────────────────────────
  // Walk backwards from today across month boundaries
  let streak = 0;
  let checkMonth = currentHabitMonth;
  let checkYear = currentYear;
  let checkDay = todayDay;

  outer: for (let safety = 0; safety < 400; safety++) {
    const hData = getHabitMonthForYear(checkMonth, checkYear);
    const nH = (hData.dailyHabits || []).length;
    if (!nH) break;
    const allDone = hData.dailyHabits.every((_, hi) => hData.dailyChecks && hData.dailyChecks[hi+'_'+checkDay]);
    if (!allDone) break outer;
    streak++;
    checkDay--;
    if (checkDay < 1) {
      checkMonth--;
      if (checkMonth < 0) { checkMonth = 11; checkYear--; }
      checkDay = daysInMonth(checkMonth, checkYear);
    }
  }
  document.getElementById('h-streak').textContent = streak;

  // ── Weekly completion rates ───────────────────────────────────
  updateWeeklyRates(h);
}

function getHabitMonthForYear(m, y) {
  const all = getAllState();
  return ((all[y] || {}).habits || {})[m] || { dailyHabits: [], dailyChecks: {} };
}

function updateWeeklyRates(h) {
  // Calculate completion % for each week slot
  const daysPerWeek = [7, 7, 7, 7, 7]; // up to 5 weeks
  for (let w = 0; w < 5; w++) {
    const el = document.getElementById('wk-rate-' + w);
    if (!el) continue;
    if (!h.weeklyHabits.length) { el.textContent = ''; continue; }
    const checked = h.weeklyHabits.filter((_, i) => h.weeklyChecks && h.weeklyChecks[i+'_'+w]).length;
    const pctW = Math.round(checked / h.weeklyHabits.length * 100);
    el.textContent = checked > 0 ? ' ' + pctW + '%' : '';
  }
}

// ── Expense drawer ────────────────────────────────────────────
function openExpenseDrawer() {
  const overlay = document.getElementById('expenseDrawerOverlay');
  if (overlay) {
    overlay.classList.add('open');
    // Focus amount field after animation
    setTimeout(function() {
      const amt = document.getElementById('expAmount');
      if (amt) amt.focus();
    }, 320);
  }
  // Update currency symbol in drawer
  const sym = document.getElementById('drawerCurrencySym');
  if (sym) sym.textContent = currency;
}

function closeExpenseDrawer(e) {
  // If click came from overlay background (not drawer itself), close
  if (e && e.target !== document.getElementById('expenseDrawerOverlay')) return;
  const overlay = document.getElementById('expenseDrawerOverlay');
  if (overlay) overlay.classList.remove('open');
}

// ── FAB visibility — show only on budget page ─────────────────
function updateFabVisibility(page) {
  const fab = document.getElementById('expenseFab');
  if (!fab) return;
  fab.classList.toggle('visible', page === 'budget');
}

// Set default date
document.getElementById('expDate').valueAsDate = new Date();

// ============================================================
//  MODAL
// ============================================================
let _pendingAction = null;
function openModal(title, body, confirmText, action) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').textContent = body;
  document.getElementById('modalConfirm').textContent = confirmText;
  document.getElementById('modalConfirm').onclick = () => { closeModal(); action(); };
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

// ============================================================
//  YEAR NAVIGATION
// ============================================================
let reviewYear = currentYear;

function changeReviewYear(delta) {
  reviewYear += delta;
  renderReview();
}

// ============================================================
//  SETTINGS
// ============================================================
function renderSettings() {
  document.getElementById('resetYearLabel').textContent = currentYear;

  // Populate month name label in reset row
  const mLabel = MONTHS[currentBudgetMonth] + ' ' + currentYear;
  const resetMonthEl = document.getElementById('resetMonthLabel');
  if (resetMonthEl) resetMonthEl.textContent = mLabel;

  // Sync rollover toggle
  const toggle = document.getElementById('rolloverToggle');
  if (toggle) toggle.checked = getRolloverPref();
  const all = getAllState();
  const years = Object.keys(all).filter(k => !isNaN(k)).sort().reverse();
  const el = document.getElementById('year-cards-list');
  if (!years.length) {
    el.innerHTML = '<div class="empty">No saved data yet</div>';
    return;
  }
  el.innerHTML = '<div class="year-cards">' + years.map(y => {
    const ys = all[y];
    const monthCount = Object.keys(ys.budget || {}).length;
    const totalExp = Object.values(ys.budget || {}).reduce((a, m) =>
      a + (m.expenses || []).reduce((s, e) => s + (parseFloat(e.amount)||0), 0), 0);
    return `<div class="year-card">
      <div class="year-card-info">
        <div class="year-card-year">${y}</div>
        <div class="year-card-meta">${monthCount} months · ${currency}${Math.round(totalExp).toLocaleString()} logged</div>
      </div>
      <div class="year-card-actions">
        <button class="settings-btn neutral" onclick="loadYear(${y})">Load</button>
        <button class="settings-btn danger" onclick="confirmDeleteYear(${y})">Delete</button>
      </div>
    </div>`;
  }).join('') + '</div>';
}

function loadYear(y) {
  currentYear = y;
  currentBudgetMonth = 0;
  currentHabitMonth = 0;
  showPage('budget', document.getElementById('tab-budget'));
  document.getElementById('tab-budget').classList.add('active');
}

function confirmDeleteYear(y) {
  openModal(
    'Delete ' + y + ' data?',
    'All budget and habit data for ' + y + ' will be permanently deleted.',
    'Delete ' + y,
    () => {
      const all = getAllState();
      delete all[y];
      saveAllState(all);
      renderSettings();
    }
  );
}

function confirmReset(type) {
  const mName = MONTHS[currentBudgetMonth];
  const mLabel = mName + ' ' + currentYear;

  if (type === 'month-budget') {
    openModal('Reset ' + mName + ' budget?',
      'All budget data for ' + mLabel + ' will be cleared. Habit data will be kept.',
      'Reset Budget', () => {
        saveBudgetMonth(currentBudgetMonth, defaultMonth(currentBudgetMonth));
        renderBudget();
        renderSettings();
      });
  } else if (type === 'month-habits') {
    openModal('Reset ' + mName + ' habits?',
      'All habit data for ' + mLabel + ' will be cleared. Budget data will be kept.',
      'Reset Habits', () => {
        saveHabitMonth(currentHabitMonth, defaultHabitMonth(currentHabitMonth));
        renderSettings();
      });
  } else if (type === 'month-both') {
    openModal('Reset all of ' + mName + '?',
      'All budget and habit data for ' + mLabel + ' will be cleared. This cannot be undone.',
      'Reset Both', () => {
        saveBudgetMonth(currentBudgetMonth, defaultMonth(currentBudgetMonth));
        saveHabitMonth(currentHabitMonth, defaultHabitMonth(currentHabitMonth));
        renderBudget();
        renderSettings();
      });
  } else if (type === 'year') {
    openModal('Reset ' + currentYear + '?', 'All budget and habit data for ' + currentYear + ' will be cleared.', 'Reset Year', () => {
      const all = getAllState();
      all[currentYear] = { budget: {}, habits: {} };
      saveAllState(all);
      renderSettings();
    });
  } else {
    openModal('Wipe everything?', 'This will permanently delete ALL your data across every year. There is no undo.', 'Wipe All Data', () => {
      localStorage.removeItem('livesimple_v2');
      renderSettings();
    });
  }
}

function exportData() {
  const all = getAllState();
  const blob = new Blob([JSON.stringify(all, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'livesimple-backup-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
}

function exportCSV() {
  const all = getAllState();
  const rows = [['Year','Month','Type','Name','Budget','Actual','Paid','Notes']];
  Object.keys(all).filter(k => !isNaN(k)).sort().forEach(y => {
    const ys = all[y] || {};
    MONTHS.forEach((mName, mi) => {
      const m = (ys.budget || {})[mi];
      if (!m) return;
      const note = (m.notes || '').replace(/"/g,'""');
      const addRows = (type, arr, hasPaid) => {
        (arr || []).forEach(r => {
          rows.push([y, mName, type, r.name, r.budget||'', r.actual||'', hasPaid ? (r.paid?'yes':'no') : '', '']);
        });
      };
      addRows('Income', m.income, false);
      addRows('Bill', m.bills, true);
      addRows('ExpenseCategory', m.expenseSummary, false);
      addRows('Savings', m.savings, false);
      addRows('Debt', m.debt, true);
      (m.expenses || []).forEach(e => {
        rows.push([y, mName, 'ExpenseLog', e.note||'', '', e.amount||'', '', e.category||'']);
      });
      if (note) rows.push([y, mName, 'Note', note, '', '', '', '']);
    });
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'livesimple-export-' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
}

function importData(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      openModal('Import data?', 'This will merge imported data with your existing data. Existing entries may be overwritten.', 'Import', () => {
        const all = getAllState();
        Object.assign(all, data);
        saveAllState(all);
        renderSettings();
        renderBudget();
      });
    } catch(err) {
      alert('Invalid file. Please use a Live Simple backup JSON file.');
    }
  };
  reader.readAsText(file);
  input.value = '';
}

// ============================================================
//  YEAR IN REVIEW
// ============================================================
function renderReview() {
  reviewYear = reviewYear || currentYear;
  document.getElementById('reviewYearLabel').textContent = '· ' + reviewYear + ' ·';
  document.getElementById('reviewYearDisplay').textContent = reviewYear;

  const ys = getYearState(reviewYear);
  const months = ys.budget || {};

  let totalIncome = 0, totalSpent = 0, totalSaved = 0;
  const monthlyData = MONTHS.map((name, i) => {
    const m = months[i] || defaultMonth(i);
    const inc = Math.max(
      m.income.reduce((a,r) => a + (parseFloat(r.actual)||parseFloat(r.budget)||0), 0),
      0
    );
    const spent = (m.expenses || []).reduce((a,e) => a + (parseFloat(e.amount)||0), 0)
      + m.bills.reduce((a,r) => a + (parseFloat(r.actual)||parseFloat(r.budget)||0), 0);
    const saved = m.savings.reduce((a,r) => a + (parseFloat(r.actual)||parseFloat(r.budget)||0), 0);
    totalIncome += inc;
    totalSpent += spent;
    totalSaved += saved;
    return { name: name.slice(0,3), inc, spent, saved, notes: m.notes || '' };
  });

  // Habit rate across year
  let habitChecked = 0, habitPossible = 0;
  const today = new Date();
  Object.entries(ys.habits || {}).forEach(([mi, h]) => {
    const m = parseInt(mi);
    const days = new Date(reviewYear, m+1, 0).getDate();
    const cap = (reviewYear === today.getFullYear() && m === today.getMonth()) ? today.getDate() : days;
    const nHabits = (h.dailyHabits || []).length;
    habitPossible += cap * nHabits;
    for (let d=1; d<=cap; d++) {
      (h.dailyHabits || []).forEach((_, hi) => { if (h.dailyChecks && h.dailyChecks[hi+'_'+d]) habitChecked++; });
    }
  });
  const habitRate = habitPossible ? Math.round(habitChecked/habitPossible*100) : 0;

  document.getElementById('rv-net').textContent = bFmt(totalIncome - totalSpent);
  document.getElementById('rv-net').className = 'review-big-num ' + (totalIncome - totalSpent >= 0 ? '' : 'red');
  document.getElementById('rv-income').textContent = bFmt(totalIncome);
  document.getElementById('rv-spent').textContent = bFmt(totalSpent);
  document.getElementById('rv-saved').textContent = bFmt(totalSaved);
  document.getElementById('rv-habit').textContent = habitRate + '%';

  // Monthly bars
  const maxVal = Math.max(...monthlyData.map(m => Math.max(m.inc, m.spent)), 1);
  document.getElementById('rv-bars').innerHTML = monthlyData.map(m => {
    const incW = Math.round(m.inc / maxVal * 100);
    const spW = Math.round(m.spent / maxVal * 100);
    const hasData = m.inc > 0 || m.spent > 0;
    return `<div class="rmb-row" style="flex-wrap:wrap;">
      <span class="rmb-label">${m.name}</span>
      <div class="rmb-bar-wrap" style="position:relative;">
        <div style="position:absolute;top:0;left:0;height:100%;width:${incW}%;background:var(--green);opacity:0.3;border-radius:4px;"></div>
        <div style="height:100%;width:${spW}%;background:var(--coral);opacity:0.7;border-radius:4px;"></div>
      </div>
      <span class="rmb-val">${hasData ? bFmt(m.inc - m.spent) : '—'}</span>
      ${m.notes ? `<div style="width:100%;padding:2px 0 4px 40px;font-size:11px;color:var(--mid);font-style:italic;">📝 ${m.notes}</div>` : ''}
    </div>`;
  }).join('');

  // Category totals
  const catTotals = {};
  Object.values(months).forEach(m => {
    (m.expenses || []).forEach(e => {
      if (e.category) catTotals[e.category] = (catTotals[e.category]||0) + (parseFloat(e.amount)||0);
    });
  });
  const sorted = Object.entries(catTotals).sort((a,b) => b[1]-a[1]).slice(0,8);
  const grandCat = sorted.reduce((a,c) => a+c[1], 0);
  document.getElementById('rv-cats').innerHTML = sorted.length
    ? sorted.map(([cat, val]) => `
      <div class="breakdown-bar-row">
        <div class="breakdown-label-row">
          <span class="breakdown-cat">${cat} <span style="color:var(--mid);font-size:11px;">${bFmt(val)}</span></span>
          <span class="breakdown-pct">${grandCat ? Math.round(val/grandCat*100) : 0}%</span>
        </div>
        <div class="breakdown-bar-bg"><div class="breakdown-bar-fill" style="width:${grandCat ? val/grandCat*100 : 0}%"></div></div>
      </div>`).join('')
    : '<div class="empty">No expense data logged yet</div>';

  // Best & worst months
  const withData = monthlyData.filter(m => m.inc > 0 || m.spent > 0);
  if (withData.length >= 2) {
    const ranked = [...withData].sort((a,b) => (b.inc-b.spent)-(a.inc-a.spent));
    const best = ranked[0], worst = ranked[ranked.length-1];
    const bestNet = best.inc - best.spent;
    const worstNet = worst.inc - worst.spent;
    const bestCol = bestNet >= 0 ? 'var(--green)' : 'var(--red)';
    const worstCol = worstNet >= 0 ? 'var(--green)' : 'var(--red)';
    const worstIcon = worstNet >= 0 ? '📊' : '📉';
    document.getElementById('rv-bestworst').innerHTML = `
      <div class="tracker-row">
        <div class="row-name">🏆 Best month</div>
        <div style="font-family:Montserrat,sans-serif;font-weight:700;font-size:13px;">${best.name}</div>
        <div style="font-family:Montserrat,sans-serif;font-weight:700;font-size:13px;color:${bestCol};text-align:right">${bestNet >= 0 ? '+' : ''}${bFmt(bestNet)}</div>
      </div>
      <div class="tracker-row">
        <div class="row-name">${worstIcon} Tightest month</div>
        <div style="font-family:Montserrat,sans-serif;font-weight:700;font-size:13px;">${worst.name}</div>
        <div style="font-family:Montserrat,sans-serif;font-weight:700;font-size:13px;color:${worstCol};text-align:right">${worstNet >= 0 ? '+' : ''}${bFmt(worstNet)}</div>
      </div>`;
  } else {
    document.getElementById('rv-bestworst').innerHTML = '<div class="empty">Add more months of data to see your best and worst months</div>';
  }
}

// Init
// Set AUD as default active in budget currency picker
document.addEventListener('DOMContentLoaded', function() {
  const opts = document.querySelectorAll('#budgetCurrencyPicker .curr-opt');
  if (opts.length) opts[0].classList.add('active');
});
renderBudget();
// Show FAB since budget is the default active page
(function() { var f=document.getElementById('expenseFab'); if(f) f.classList.add('visible'); })();
