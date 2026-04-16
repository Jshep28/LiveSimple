
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

// Drawer state
let _drawerTab      = 'income';   // 'income' | 'expense'
let _expenseType    = 'spend';    // 'spend' | 'bill' | 'debt' | 'savings'
let _incomeFreq     = 'monthly';  // 'weekly' | 'fortnightly' | 'monthly'

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
    expenses: [],     // spend log: {date, amount, category, note}
    incomeLog: [],    // income log: {date, amount, source, note, freq} freq=weekly|fortnightly|monthly
    billsLog: [],     // bills log:   {date, amount, name, note}
    savingsLog: [],   // savings log: {date, amount, name, note}
    debtLog: [],      // debt log:    {date, amount, name, note}
    rollover: '',
    notes: '',        // monthly note
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

// ── Storage availability check ────────────────────────────────
let _storageAvailable = null;
function checkStorageAvailable() {
  if (_storageAvailable !== null) return _storageAvailable;
  try {
    const key = '__ls_test__';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    _storageAvailable = true;
  } catch(e) {
    _storageAvailable = false;
  }
  return _storageAvailable;
}

// Load / save
function getAllState() {
  try { return JSON.parse(localStorage.getItem('livesimple_v2') || '{}'); } catch(e) { return {}; }
}
function saveAllState(s) {
  try {
    localStorage.setItem('livesimple_v2', JSON.stringify(s));
  } catch(e) {
    showStorageWarning();
  }
}

function showStorageWarning() {
  let warn = document.getElementById('storageWarningBanner');
  if (warn) return; // already shown
  warn = document.createElement('div');
  warn.id = 'storageWarningBanner';
  warn.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#ef4444;color:white;font-family:Montserrat,sans-serif;font-size:12px;font-weight:700;padding:10px 16px;text-align:center;';
  warn.innerHTML = '⚠️ Storage is blocked — your data won\'t be saved. Open this app directly (not inside another site) or use Export/Import in Settings to back up your data. <button onclick="this.parentNode.remove()" style="margin-left:12px;background:rgba(255,255,255,0.25);border:none;border-radius:4px;color:white;font-weight:700;padding:2px 8px;cursor:pointer;">✕</button>';
  document.body.prepend(warn);
}
// ── TAX / PROJECTION STATE ────────────────────────────────────
function getTaxPrefs() {
  const s = getAllState();
  return s._taxPrefs || { on: false, rate: 19 };
}
function saveTaxPrefs(p) {
  const s = getAllState();
  s._taxPrefs = p;
  saveAllState(s);
}
function toggleTax() {
  const p = getTaxPrefs();
  p.on = !p.on;
  saveTaxPrefs(p);
  renderReview();
}
function setTaxRate(r) {
  const p = getTaxPrefs();
  p.rate = r;
  saveTaxPrefs(p);
  renderReview();
}
function focusTaxCustom() {
  const input = document.getElementById('taxCustomInput');
  if (input) { input.focus(); input.select(); }
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
  // Update the progress bar for this specific period row in real-time
  updatePeriodRowBar(section, periodIdx, rowIdx, d);
}

function updatePeriodRowBar(section, periodIdx, rowIdx, d) {
  const rowsId = section + '-period-rows-' + periodIdx;
  const container = document.getElementById(rowsId);
  if (!container) return;
  const rows = container.querySelectorAll('.tracker-row');
  const row = rows[rowIdx];
  if (!row) return;
  const bar = row.nextElementSibling;
  if (!bar || !bar.classList.contains('row-progress')) return;
  const fill = bar.querySelector('.row-progress-fill');
  if (!fill) return;
  const mode = section === 'income' ? (d.incomePeriodMode || 'monthly') : (d.billsPeriodMode || 'monthly');
  const periods = getPeriodsForMonth(currentBudgetMonth, currentYear, mode);
  const pRows = ensurePeriodRows(d, section, periodIdx);
  const monthRow = (d[section] || [])[rowIdx] || {};
  const pRow = pRows[rowIdx] || { actual: '' };
  const mb = num(monthRow.budget);
  const pa = num(pRow.actual);
  const periods_count = periods.length;
  const prorated = mb > 0 ? (mb / periods_count) : 0;
  const pctFill = prorated > 0 ? Math.min(pa / prorated * 100, 100) : 0;
  const over = prorated > 0 && pa > prorated;
  const periodOverIsGood = section === 'income';
  const barColor = over ? (periodOverIsGood ? 'var(--green)' : 'var(--red)') : pa > 0 ? 'var(--green)' : 'var(--coral)';
  fill.style.width = pctFill + '%';
  fill.style.background = barColor;
}

function togglePeriodPaid(section, periodIdx, rowIdx, checked) {
  const d = getBudgetMonth(currentBudgetMonth);
  const pRows = ensurePeriodRows(d, section, periodIdx);
  pRows[rowIdx].paid = checked;
  aggregatePeriods(d, section);
  saveBudgetMonth(currentBudgetMonth, d);
}

// ── Render income / bills section (no period tabs) ───────────
function renderSectionWithPeriods(section, d, uncatAmount) {
  const isIncome = section === 'income';
  const hasPaid  = section === 'bills';
  const barId    = section + '-period-bar';
  const headerId = section + '-header';
  const rowsId   = section + '-rows';

  // Clear period bar (not used)
  const barEl = document.getElementById(barId);
  if (barEl) barEl.innerHTML = '';

  // Column header
  const headerEl = document.getElementById(headerId);
  if (headerEl) {
    headerEl.innerHTML = hasPaid
      ? `<span>Bill</span><span>Budget</span><span>Actual</span>`
      : `<span>Source</span><span>Budget</span><span>Actual</span>`;
  }

  renderTrackerSection(rowsId, d[section], section, hasPaid, uncatAmount);
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

  // ── Compute actuals from logs ─────────────────────────────────
  // Income: sum incomeLog entries by source name
  const incLog = d.incomeLog || [];
  const knownIncomeSources = d.income.map(r => r.name);
  d.income.forEach(r => {
    r.actual = incLog.filter(e => e.source === r.name).reduce((a, e) => a + num(e.amount), 0) || '';
  });
  const uncatIncome = incLog.filter(e => !e.source || !knownIncomeSources.includes(e.source))
    .reduce((a, e) => a + num(e.amount), 0);

  // Bills: sum billsLog entries by name
  const blLog = d.billsLog || [];
  const knownBills = d.bills.map(r => r.name);
  d.bills.forEach(r => {
    r.actual = blLog.filter(e => e.name === r.name).reduce((a, e) => a + num(e.amount), 0) || '';
  });
  const uncatBills = blLog.filter(e => !e.name || !knownBills.includes(e.name))
    .reduce((a, e) => a + num(e.amount), 0);

  // Savings: sum savingsLog entries by name
  const svLog = d.savingsLog || [];
  const knownSavings = d.savings.map(r => r.name);
  d.savings.forEach(r => {
    r.actual = svLog.filter(e => e.name === r.name).reduce((a, e) => a + num(e.amount), 0) || '';
  });
  const uncatSavings = svLog.filter(e => !e.name || !knownSavings.includes(e.name))
    .reduce((a, e) => a + num(e.amount), 0);

  // Debt: sum debtLog entries by name
  const dtLog = d.debtLog || [];
  const knownDebt = d.debt.map(r => r.name);
  d.debt.forEach(r => {
    r.actual = dtLog.filter(e => e.name === r.name).reduce((a, e) => a + num(e.amount), 0) || '';
  });
  const uncatDebt = dtLog.filter(e => !e.name || !knownDebt.includes(e.name))
    .reduce((a, e) => a + num(e.amount), 0);

  // Render income and bills sections
  renderSectionWithPeriods('income', d, uncatIncome);
  renderSectionWithPeriods('bills', d, uncatBills);

  // Render remaining sections normally
  renderExpenseSummary(d);
  renderTrackerSection('savings-rows', d.savings, 'savings', false, uncatSavings);
  renderTrackerSection('debt-rows', d.debt, 'debt', true, uncatDebt);
  renderTransactionLog(d);
  renderBreakdown(d);
  updateTotals(d);
  populateCatDropdown(d);
  updateCopyBar(d);
  // Restore active section pill (re-apply after render)
  selectBudgetSection(_activeBudgetSection);
}

function selectBudgetMonth(m) {
  currentBudgetMonth = m;
  incomePeriodTab = 'overview';
  billsPeriodTab  = 'overview';
  renderBudget();
}

let _activeBudgetSection = 'income';

function selectBudgetSection(section) {
  _activeBudgetSection = section;
  // Toggle pills
  ['income','bills','expense','savings','debt'].forEach(s => {
    const pill = document.getElementById('pill-' + s);
    if (pill) pill.classList.toggle('active', s === section);
  });
  // Show/hide panels
  ['income','bills','expense','savings','debt'].forEach(s => {
    const panel = document.getElementById('panel-' + s);
    if (panel) panel.style.display = s === section ? '' : 'none';
  });
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
  if (section === 'expenseSummary') {
    const catName = d.expenseSummary[i].name;
    d.expenses.forEach(e => { if (e.category === catName) e.category = ''; });
  }
  // Unlink log entries when a named row is deleted
  const logMap = { income: 'incomeLog', bills: 'billsLog', savings: 'savingsLog', debt: 'debtLog' };
  if (logMap[section] && d[section][i]) {
    const rowName = d[section][i].name;
    const key = logMap[section];
    if (d[key]) d[key].forEach(e => {
      if ((e.source || e.name) === rowName) { e.source = ''; e.name = ''; }
    });
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

// ── Copy budget amounts (and optionally actuals) from previous month ───────────────────
function copyLastMonth(includeActuals) {
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

  // Copy structure and budget amounts
  ['income', 'bills', 'savings', 'debt'].forEach(section => {
    if (prevData[section]) {
      cur[section] = prevData[section].map(r => ({
        name: r.name,
        budget: r.budget,
        actual: '',
        ...(r.paid !== undefined ? { paid: false } : {}),
      }));
    }
  });

  // Copy log entries and period data if includeActuals
  if (includeActuals) {
    ['incomeLog', 'billsLog', 'savingsLog', 'debtLog', 'expenses'].forEach(key => {
      if (prevData[key]) cur[key] = JSON.parse(JSON.stringify(prevData[key]));
    });
    ['incomePeriods', 'billsPeriods'].forEach(key => {
      if (prevData[key]) cur[key] = JSON.parse(JSON.stringify(prevData[key]));
    });
    if (prevData.incomePeriodMode) cur.incomePeriodMode = prevData.incomePeriodMode;
    if (prevData.billsPeriodMode)  cur.billsPeriodMode  = prevData.billsPeriodMode;
  }

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

function renderTrackerSection(containerId, rows, section, hasPaid, uncatAmount) {
  const el = document.getElementById(containerId);
  if (!rows.length && !(uncatAmount > 0)) {
    el.innerHTML = `<div class="empty">No entries — click <strong>+ Add</strong> to add one</div>`;
    return;
  }
  // For income, savings, and debt: going over budget is GOOD (green). Bills only: red when over.
  const overIsGood = section === 'income' || section === 'savings' || section === 'debt';
  const deleteSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>`;
  const checkSvg  = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><polyline points="20 6 9 17 4 12"/></svg>`;

  let html = rows.map((row, i) => {
    const b = num(row.budget), a = num(row.actual);
    const pctFill = b > 0 ? Math.min(a / b * 100, 100) : 0;
    const overBudget = b > 0 && a > b;
    const barColor = overBudget
      ? (overIsGood ? 'var(--green)' : 'var(--red)')
      : a > 0 ? 'var(--green)' : 'var(--coral)';
    const paidClass = (hasPaid && row.paid) ? ' row-paid' : '';
    return `
    <div class="swipe-wrap" data-section="${section}" data-index="${i}" data-has-paid="${hasPaid}">
      ${hasPaid ? `<div class="swipe-action-check">${checkSvg}Done</div>` : ''}
      <div class="swipe-action-delete">${deleteSvg}Delete</div>
      <div class="swipe-content">
        <div class="tracker-row${paidClass}" style="padding-right:28px;">
          <div class="row-name">
            <input type="text" value="${row.name.replace(/"/g,'&quot;')}" onchange="updateName('${section}',${i},this.value)" placeholder="Name" title="Click to rename">
          </div>
          <div class="amount-input">
            <span>${currency}</span>
            <input type="number" value="${row.budget||''}" min="0" step="0.01" placeholder="0.00" inputmode="decimal"
              onchange="updateBudget('${section}',${i},this.value)" title="Budgeted amount">
          </div>
          <div class="row-total ${overBudget && !overIsGood ? 'red' : ''}" style="color:${a > 0 ? (overBudget && !overIsGood ? 'var(--red)' : overBudget && overIsGood ? 'var(--green)' : 'var(--dark)') : 'var(--mid)'}">
            ${a > 0 ? bFmt(a) : '—'}${overBudget && !overIsGood ? ' <span style="font-size:9px;color:var(--red)">over</span>' : overBudget && overIsGood ? ' <span style="font-size:9px;color:var(--green)">↑</span>' : ''}
          </div>
          <button class="row-del" onclick="deleteRow('${section}',${i})" title="Remove row">×</button>
        </div>
        ${b > 0 ? `<div class="row-progress"><div class="row-progress-fill" style="width:${pctFill}%;background:${barColor};"></div></div>` : ''}
      </div>
    </div>
  `}).join('');

  // Uncategorised row at the bottom (when amount > 0)
  if (uncatAmount > 0) {
    html += `
    <div class="tracker-row uncat-row" style="padding-right:28px;opacity:0.75;">
      <div class="row-name" style="color:var(--mid);font-style:italic;">
        ${hasPaid ? '<span style="width:18px;display:inline-block;"></span>' : ''}
        <span style="padding-left:2px;">Uncategorised</span>
      </div>
      <div class="amount-input" style="visibility:hidden;">
        <span>${currency}</span><input type="number" disabled style="width:60px;">
      </div>
      <div class="row-total" style="color:var(--mid);">
        ${bFmt(uncatAmount)}
      </div>
    </div>`;
  }

  el.innerHTML = html;
}

function renderExpenseSummary(d) {
  // Compute actuals from expense log
  const knownCats = d.expenseSummary.map(es => es.name);
  d.expenseSummary.forEach(es => {
    es.actual = d.expenses.filter(e => e.category === es.name).reduce((a,e) => a + num(e.amount), 0);
  });
  const uncatExpenses = (d.expenses || [])
    .filter(e => !e.category || !knownCats.includes(e.category))
    .reduce((a, e) => a + num(e.amount), 0);

  const el = document.getElementById('expense-summary-rows');
  if (!d.expenseSummary.length && !(uncatExpenses > 0)) {
    el.innerHTML = `<div class="empty">No categories — click <strong>+ Add</strong> to add one</div>`;
    return;
  }
  const deleteSvgEs = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>`;
  let html = d.expenseSummary.map((row, i) => {
    const b = num(row.budget), a = row.actual;
    const pctFill = b > 0 ? Math.min(a / b * 100, 100) : 0;
    const overBudget = b > 0 && a > b;
    const barColor = overBudget ? 'var(--red)' : a > 0 ? 'var(--coral)' : 'var(--coral)';
    return `
    <div class="swipe-wrap" data-section="expenseSummary" data-index="${i}" data-has-paid="false">
      <div class="swipe-action-delete">${deleteSvgEs}Delete</div>
      <div class="swipe-content">
        <div class="tracker-row" style="padding-right:28px;">
          <div class="row-name">
            <input type="text" value="${row.name.replace(/"/g,'&quot;')}" onchange="updateName('expenseSummary',${i},this.value);renderBudget();" placeholder="Category" title="Click to rename">
          </div>
          <div class="amount-input">
            <span>${currency}</span>
            <input type="number" value="${row.budget||''}" min="0" step="0.01" placeholder="0.00" inputmode="decimal"
              onchange="updateBudget('expenseSummary',${i},this.value)" title="Budgeted amount">
          </div>
          <div class="row-total ${overBudget ? 'red' : ''}" style="color:${a > 0 ? (overBudget ? 'var(--red)' : 'var(--dark)') : 'var(--mid)'}">
            ${bFmt(a)}${overBudget ? ' <span style="font-size:9px;color:var(--red)">over</span>' : ''}
          </div>
          <button class="row-del" onclick="deleteRow('expenseSummary',${i})" title="Remove category">×</button>
        </div>
        ${b > 0 ? `<div class="row-progress"><div class="row-progress-fill" style="width:${pctFill}%;background:${barColor};"></div></div>` : ''}
      </div>
    </div>
  `}).join('');

  // Uncategorised expenses row
  if (uncatExpenses > 0) {
    html += `
    <div class="tracker-row uncat-row" style="padding-right:28px;opacity:0.75;">
      <div class="row-name" style="color:var(--mid);font-style:italic;">
        <span style="padding-left:2px;">Uncategorised</span>
      </div>
      <div class="amount-input" style="visibility:hidden;">
        <span>${currency}</span><input type="number" disabled style="width:60px;">
      </div>
      <div class="row-total" style="color:var(--mid);">
        ${bFmt(uncatExpenses)}
      </div>
    </div>`;
  }

  el.innerHTML = html;
}

// Store flattened transaction list for popup lookups
let _txnList = [];

function renderTransactionLog(d) {
  const el = document.getElementById('expense-log');

  // Build unified list
  const all = [];
  (d.incomeLog || []).forEach((e, i) => all.push({ ...e, _type: 'income',  _key: 'incomeLog',  _i: i }));
  (d.expenses   || []).forEach((e, i) => all.push({ ...e, _type: 'spend',   _key: 'expenses',   _i: i }));
  (d.billsLog   || []).forEach((e, i) => all.push({ ...e, _type: 'bill',    _key: 'billsLog',   _i: i }));
  (d.savingsLog || []).forEach((e, i) => all.push({ ...e, _type: 'savings', _key: 'savingsLog', _i: i }));
  (d.debtLog    || []).forEach((e, i) => all.push({ ...e, _type: 'debt',    _key: 'debtLog',    _i: i }));

  if (!all.length) {
    el.innerHTML = '<div class="empty">No entries logged yet — tap + to log income or expenses</div>';
    _txnList = [];
    return;
  }

  all.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  _txnList = all;

  const typeStyles = {
    income:  { label: 'Income',  color: 'var(--green)', sign: '+' },
    spend:   { label: 'Spend',   color: 'var(--coral)', sign: '-' },
    bill:    { label: 'Bill',    color: 'var(--red)',   sign: '-' },
    savings: { label: 'Savings', color: 'var(--navy)',  sign: '-' },
    debt:    { label: 'Debt',    color: '#8b5cf6',      sign: '-' },
  };

  const txnDelSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" style="width:16px;height:16px;flex-shrink:0"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>`;

  el.innerHTML = all.map((e, idx) => {
    const ts  = typeStyles[e._type];
    const cat = e.category || e.source || e.name || '—';
    const freqBadge = e._type === 'income' && e.freq && e.freq !== 'monthly'
      ? `<span class="log-freq-badge">${e.freq.slice(0,4)}</span>` : '';
    return `<div class="swipe-wrap txn-swipe-wrap" data-txn-idx="${idx}">
      <div class="swipe-action-delete">${txnDelSvg}Delete</div>
      <div class="swipe-content">
        <div class="expense-row" onclick="openTxnPopup(${idx})">
          <span class="expense-date">${e.date ? e.date.slice(5) : '—'}</span>
          <span class="expense-amount" style="color:${ts.color}">${ts.sign}${bFmt(e.amount)}</span>
          <span class="expense-cat">${cat}${freqBadge}</span>
          <span class="log-type-badge" style="background:${ts.color}20;color:${ts.color}">${ts.label}</span>
          <button class="delete-btn" onclick="event.stopPropagation();deleteTxn(${idx})">×</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openTxnPopup(idx) {
  const e = _txnList[idx];
  if (!e) return;
  const typeStyles = {
    income:  { label: 'Income',  color: 'var(--green)', sign: '+' },
    spend:   { label: 'Spend',   color: 'var(--coral)', sign: '-' },
    bill:    { label: 'Bill',    color: 'var(--red)',   sign: '-' },
    savings: { label: 'Savings', color: 'var(--navy)',  sign: '-' },
    debt:    { label: 'Debt',    color: '#8b5cf6',      sign: '-' },
  };
  const ts  = typeStyles[e._type];
  const cat = e.category || e.source || e.name || '—';

  document.getElementById('txnPopupAmount').textContent = ts.sign + bFmt(e.amount);
  document.getElementById('txnPopupAmount').style.color = ts.color;
  document.getElementById('txnPopupCat').textContent = cat;
  document.getElementById('txnPopupDate').textContent = e.date
    ? new Date(e.date + 'T00:00:00').toLocaleDateString(undefined, { day:'numeric', month:'short', year:'numeric' })
    : '—';
  document.getElementById('txnPopupType').textContent = ts.label;

  const freqRow = document.getElementById('txnPopupFreqRow');
  if (e._type === 'income' && e.freq) {
    freqRow.style.display = '';
    document.getElementById('txnPopupFreq').textContent =
      e.freq.charAt(0).toUpperCase() + e.freq.slice(1);
  } else {
    freqRow.style.display = 'none';
  }

  const noteRow = document.getElementById('txnPopupNoteRow');
  const noteEl  = document.getElementById('txnPopupNote');
  if (e.note) {
    noteRow.style.display = '';
    noteEl.textContent = e.note;
  } else {
    noteRow.style.display = 'none';
  }

  // ── Category reassign dropdown ──────────────────────────────
  const catEditRow = document.getElementById('txnPopupCatEditRow');
  const catSelect  = document.getElementById('txnPopupCatSelect');
  const d = getBudgetMonth(currentBudgetMonth);

  // Build options list based on entry type
  let options = [];
  if (e._type === 'income') {
    options = d.income.map(r => r.name);
  } else if (e._type === 'spend') {
    options = d.expenseSummary.map(r => r.name);
  } else if (e._type === 'bill') {
    options = d.bills.map(r => r.name);
  } else if (e._type === 'savings') {
    options = d.savings.map(r => r.name);
  } else if (e._type === 'debt') {
    options = d.debt.map(r => r.name);
  }

  if (options.length > 0) {
    catEditRow.style.display = '';
    const currentCat = e.category || e.source || e.name || '';
    catSelect.innerHTML = `<option value="">— No category —</option>` +
      options.map(o => `<option value="${o.replace(/"/g,'&quot;')}" ${o === currentCat ? 'selected' : ''}>${o}</option>`).join('');
    // Store current idx for reassign callback
    catSelect.dataset.txnIdx = idx;
  } else {
    catEditRow.style.display = 'none';
  }

  document.getElementById('txnPopupDelete').onclick = function() { deleteTxn(idx); closeTxnPopup(); };
  document.getElementById('txnPopupOverlay').classList.add('open');
}

function reassignTxnCat(newVal) {
  const catSelect = document.getElementById('txnPopupCatSelect');
  const idx = parseInt(catSelect.dataset.txnIdx, 10);
  const e = _txnList[idx];
  if (!e) return;
  const d = getBudgetMonth(currentBudgetMonth);
  const entry = d[e._key] ? d[e._key][e._i] : null;
  if (!entry) return;

  if (e._type === 'income') {
    entry.source = newVal;
  } else if (e._type === 'spend') {
    entry.category = newVal;
  } else {
    // bill, savings, debt
    entry.name = newVal;
  }

  saveBudgetMonth(currentBudgetMonth, d);
  // Update cat display in popup header
  document.getElementById('txnPopupCat').textContent = newVal || '—';
  renderBudget();
}

function closeTxnPopup(e) {
  if (e && e.target !== document.getElementById('txnPopupOverlay')) return;
  document.getElementById('txnPopupOverlay').classList.remove('open');
}

function deleteTxn(idx) {
  const e = _txnList[idx];
  if (!e) return;
  const d = getBudgetMonth(currentBudgetMonth);
  if (e._key === 'expenses') {
    d.expenses.splice(e._i, 1);
  } else {
    if (d[e._key]) d[e._key].splice(e._i, 1);
  }
  saveBudgetMonth(currentBudgetMonth, d);
  renderBudget();
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
  // Refresh both drawer dropdowns based on current type state
  populateIncomeSourceDropdown();
  populateExpenseCatDropdown();
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

  // Compute actuals from logs (same logic as renderBudget)
  const incLog = data.incomeLog  || [];
  const blLog  = data.billsLog   || [];
  const svLog  = data.savingsLog || [];
  const dtLog  = data.debtLog    || [];
  const incActual = data.income.reduce((a,r) =>
    a + incLog.filter(e => e.source === r.name).reduce((s,e) => s + num(e.amount), 0), 0);
  const blActual  = data.bills.reduce((a,r) =>
    a + blLog.filter(e => e.name === r.name).reduce((s,e) => s + num(e.amount), 0), 0);
  const svActual  = data.savings.reduce((a,r) =>
    a + svLog.filter(e => e.name === r.name).reduce((s,e) => s + num(e.amount), 0), 0);
  const dtActual  = data.debt.reduce((a,r) =>
    a + dtLog.filter(e => e.name === r.name).reduce((s,e) => s + num(e.amount), 0), 0);

  const pIn  = Math.max(incActual || data.income.reduce((a,r) => a + num(r.budget), 0), 0);
  const pOut = (blActual  || data.bills.reduce((a,r) => a + num(r.budget), 0))
             + (data.expenses || []).reduce((a,e) => a + num(e.amount), 0)
             + (svActual  || data.savings.reduce((a,r) => a + num(r.budget), 0))
             + (dtActual  || data.debt.reduce((a,r) => a + num(r.budget), 0));

  // This month's own rollover from the month before it
  const prevM = month === 0 ? 11 : month - 1;
  const prevY = month === 0 ? year - 1 : year;
  const prevRollover = calcRollover(prevM, prevY, depth + 1);

  return pIn + prevRollover - pOut;
}

function updateTotals(d) {
  // Uncategorised amounts (same logic as renderBudget)
  const incLog = d.incomeLog || [];
  const knownIncomeSources = d.income.map(r => r.name);
  const uncatIncome = incLog.filter(e => !e.source || !knownIncomeSources.includes(e.source))
    .reduce((a, e) => a + num(e.amount), 0);

  const blLog = d.billsLog || [];
  const knownBills = d.bills.map(r => r.name);
  const uncatBills = blLog.filter(e => !e.name || !knownBills.includes(e.name))
    .reduce((a, e) => a + num(e.amount), 0);

  const svLog = d.savingsLog || [];
  const knownSavings = d.savings.map(r => r.name);
  const uncatSavings = svLog.filter(e => !e.name || !knownSavings.includes(e.name))
    .reduce((a, e) => a + num(e.amount), 0);

  const dtLog = d.debtLog || [];
  const knownDebt = d.debt.map(r => r.name);
  const uncatDebt = dtLog.filter(e => !e.name || !knownDebt.includes(e.name))
    .reduce((a, e) => a + num(e.amount), 0);

  // Income
  const ib = d.income.reduce((a,r) => a+num(r.budget), 0);
  const ia = d.income.reduce((a,r) => a+num(r.actual), 0) + uncatIncome;
  document.getElementById('income-budget-total').textContent = bFmt(ib);
  document.getElementById('income-actual-total').textContent = bFmt(ia);

  // Bills
  const bb = d.bills.reduce((a,r) => a+num(r.budget), 0);
  const ba = d.bills.reduce((a,r) => a+num(r.actual), 0) + uncatBills;
  document.getElementById('bills-budget-total').textContent = bFmt(bb);
  document.getElementById('bills-actual-total').textContent = bFmt(ba);

  // Expenses (ea already includes all expenses regardless of category)
  const eb = d.expenseSummary.reduce((a,r) => a+num(r.budget), 0);
  const ea = (d.expenses || []).reduce((a,e) => a+num(e.amount), 0);
  document.getElementById('expenses-budget-total').textContent = bFmt(eb);
  document.getElementById('expenses-actual-total').textContent = bFmt(ea);

  // Savings
  const sb = d.savings.reduce((a,r) => a+num(r.budget), 0);
  const sa = d.savings.reduce((a,r) => a+num(r.actual), 0) + uncatSavings;
  document.getElementById('savings-budget-total').textContent = bFmt(sb);
  document.getElementById('savings-actual-total').textContent = bFmt(sa);

  // Debt
  const db = d.debt.reduce((a,r) => a+num(r.budget), 0);
  const da = d.debt.reduce((a,r) => a+num(r.actual), 0) + uncatDebt;
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
function togglePaid(section, i, checked) {
  const d = getBudgetMonth(currentBudgetMonth);
  d[section][i].paid = checked;
  // Move paid bills to bottom, unpaid to top
  if (section === 'bills') {
    const unpaid = d.bills.filter(r => !r.paid);
    const paid   = d.bills.filter(r =>  r.paid);
    d.bills = [...unpaid, ...paid];
  }
  saveBudgetMonth(currentBudgetMonth, d);
  renderBudget();
}

// ── Drawer tab / type switching ───────────────────────────────
function switchDrawerTab(tab) {
  _drawerTab = tab;
  document.getElementById('drawerTabIncome').classList.toggle('active', tab === 'income');
  document.getElementById('drawerTabExpense').classList.toggle('active', tab === 'expense');
  document.getElementById('drawerPanelIncome').style.display  = tab === 'income'  ? '' : 'none';
  document.getElementById('drawerPanelExpense').style.display = tab === 'expense' ? '' : 'none';
  if (tab === 'income')  populateIncomeSourceDropdown();
  if (tab === 'expense') populateExpenseCatDropdown();
}

function switchExpenseType(type) {
  _expenseType = type;
  ['spend','bill','debt','savings'].forEach(t => {
    document.getElementById('expType' + t.charAt(0).toUpperCase() + t.slice(1)).classList.toggle('active', t === type);
  });
  // Update category label and repopulate dropdown
  const labels = { spend:'Category', bill:'Bill', debt:'Debt', savings:'Savings Goal' };
  document.getElementById('expCatLabel').textContent = labels[type];
  populateExpenseCatDropdown();
}

function switchIncomeFreq(freq) {
  _incomeFreq = freq;
  ['weekly','fortnightly','monthly'].forEach(f => {
    const ids = { weekly:'incFreqWeekly', fortnightly:'incFreqFort', monthly:'incFreqMonthly' };
    document.getElementById(ids[f]).classList.toggle('active', f === freq);
  });
}

// ── Populate dropdowns ────────────────────────────────────────
function populateIncomeSourceDropdown() {
  const d = getBudgetMonth(currentBudgetMonth);
  const sel = document.getElementById('incCat');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Select source…</option>' +
    d.income.filter(r => r.name).map(r =>
      `<option value="${r.name}" ${cur===r.name?'selected':''}>${r.name}</option>`
    ).join('');
}

function populateExpenseCatDropdown() {
  const d = getBudgetMonth(currentBudgetMonth);
  const sel = document.getElementById('expCat');
  if (!sel) return;
  const cur = sel.value;
  let options = [];
  if (_expenseType === 'spend') {
    options = d.expenseSummary.filter(r => r.name).map(r => r.name);
  } else if (_expenseType === 'bill') {
    options = d.bills.filter(r => r.name).map(r => r.name);
  } else if (_expenseType === 'debt') {
    options = d.debt.filter(r => r.name).map(r => r.name);
  } else if (_expenseType === 'savings') {
    options = d.savings.filter(r => r.name).map(r => r.name);
  }
  const label = { spend:'Select category…', bill:'Select bill…', debt:'Select debt…', savings:'Select goal…' }[_expenseType];
  sel.innerHTML = `<option value="">${label}</option>` +
    options.map(n => `<option value="${n}" ${cur===n?'selected':''}>${n}</option>`).join('');
}

// ── Add income entry ──────────────────────────────────────────
function addIncome() {
  const date   = document.getElementById('incDate').value;
  const amount = document.getElementById('incAmount').value;
  const source = document.getElementById('incCat').value;
  const note   = document.getElementById('incNote').value;
  if (!amount) { document.getElementById('incAmount').focus(); return; }
  const d = getBudgetMonth(currentBudgetMonth);
  if (!d.incomeLog) d.incomeLog = [];
  d.incomeLog.push({ date, amount: parseFloat(amount), source, note, freq: _incomeFreq });
  saveBudgetMonth(currentBudgetMonth, d);
  document.getElementById('incAmount').value = '';
  document.getElementById('incNote').value   = '';
  const overlay = document.getElementById('expenseDrawerOverlay');
  if (overlay) overlay.classList.remove('open');
  renderBudget();
}

function deleteIncomeEntry(i) {
  const d = getBudgetMonth(currentBudgetMonth);
  if (!d.incomeLog) return;
  d.incomeLog.splice(i, 1);
  saveBudgetMonth(currentBudgetMonth, d);
  renderBudget();
}

// ── Add expense / bill / debt / savings entry ─────────────────
function addExpense() {
  const date   = document.getElementById('expDate').value;
  const amount = document.getElementById('expAmount').value;
  const cat    = document.getElementById('expCat').value;
  const note   = document.getElementById('expNote').value;
  if (!amount) { document.getElementById('expAmount').focus(); return; }
  const d = getBudgetMonth(currentBudgetMonth);
  const entry = { date, amount: parseFloat(amount), note };

  if (_expenseType === 'spend') {
    d.expenses.push({ ...entry, category: cat });
  } else if (_expenseType === 'bill') {
    if (!d.billsLog) d.billsLog = [];
    d.billsLog.push({ ...entry, name: cat });
  } else if (_expenseType === 'debt') {
    if (!d.debtLog) d.debtLog = [];
    d.debtLog.push({ ...entry, name: cat });
  } else if (_expenseType === 'savings') {
    if (!d.savingsLog) d.savingsLog = [];
    d.savingsLog.push({ ...entry, name: cat });
  }

  saveBudgetMonth(currentBudgetMonth, d);
  document.getElementById('expAmount').value = '';
  document.getElementById('expNote').value   = '';
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

function deleteLogEntry(logKey, i) {
  const d = getBudgetMonth(currentBudgetMonth);
  if (!d[logKey]) return;
  d[logKey].splice(i, 1);
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
function openExpenseDrawer(tab) {
  const overlay = document.getElementById('expenseDrawerOverlay');
  if (overlay) overlay.classList.add('open');

  // Set today's date on both date fields if empty
  const today = new Date().toISOString().slice(0,10);
  ['expDate','incDate'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = today;
  });

  // Update currency symbols
  const sym = document.getElementById('drawerCurrencySym');
  if (sym) sym.textContent = currency;
  const symInc = document.getElementById('drawerCurrencyInc');
  if (symInc) symInc.textContent = currency;

  // Switch to requested tab (default income)
  switchDrawerTab(tab || _drawerTab);

  setTimeout(function() {
    const amt = _drawerTab === 'income'
      ? document.getElementById('incAmount')
      : document.getElementById('expAmount');
    if (amt) amt.focus();
  }, 320);
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
  // Storage status badge
  const ok = checkStorageAvailable();
  const lbl = document.getElementById('storageStatusLabel');
  const desc = document.getElementById('storageStatusDesc');
  const badge = document.getElementById('storageStatusBadge');
  if (lbl && desc && badge) {
    if (ok) {
      lbl.textContent = 'Local storage active';
      desc.textContent = 'Your data is saved on this device and persists when you close the browser';
      badge.textContent = '✅';
    } else {
      lbl.textContent = 'Storage blocked';
      desc.textContent = 'Data cannot be saved — open the app directly (not inside another website), or use Export/Import to back up manually';
      badge.textContent = '⚠️';
      badge.style.fontSize = '22px';
    }
  }

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
  const reviewYearLabelEl = document.getElementById('reviewYearLabel');
  if (reviewYearLabelEl) reviewYearLabelEl.textContent = '· ' + reviewYear + ' ·';
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

  // ── PROJECTED TAKE-HOME ──────────────────────────────────────
  const taxPrefs = getTaxPrefs();
  const taxOn = taxPrefs.on;
  const taxRate = parseFloat(taxPrefs.rate) || 0;

  // Toggle UI
  const taxTrack = document.getElementById('taxToggleTrack');
  if (taxTrack) taxTrack.classList.toggle('on', taxOn);
  const taxStrip = document.getElementById('taxRateStrip');
  if (taxStrip) taxStrip.classList.toggle('visible', taxOn);

  // Highlight active tax rate button
  document.querySelectorAll('.tax-rate-btn:not(.tax-rate-custom)').forEach(btn => {
    btn.classList.toggle('active', parseFloat(btn.dataset.rate) === taxRate);
  });

  // ── Determine which months are "filled" (have any real data) ──
  // A month is filled if it has income, expenses, or any logged entries in the stored state.
  const filledMonths = monthlyData.map((m, i) => {
    const raw = months[i]; // undefined if never touched
    if (!raw) return false;
    const hasIncome  = m.inc > 0;
    const hasSpend   = m.spent > 0;
    const hasLogs    = (raw.incomeLog  || []).length > 0
                    || (raw.expenses   || []).length > 0
                    || (raw.billsLog   || []).length > 0
                    || (raw.savingsLog || []).length > 0
                    || (raw.debtLog    || []).length > 0;
    const hasBudget  = (raw.income  || []).some(r => parseFloat(r.budget) > 0)
                    || (raw.bills   || []).some(r => parseFloat(r.budget) > 0);
    return hasIncome || hasSpend || hasLogs || hasBudget;
  });

  // Per-month take-home (income - tax - spent) for filled months only
  const filledTakeHomeValues = monthlyData
    .filter((_, i) => filledMonths[i])
    .map(m => {
      const tax = m.inc * (taxRate / 100);
      return m.inc - tax - m.spent;
    });

  const filledCount = filledTakeHomeValues.length;
  const avgTakeHome = filledCount
    ? filledTakeHomeValues.reduce((a, v) => a + v, 0) / filledCount
    : 0;

  // Average income/tax for the subtitle tax line
  const avgFilledIncome = filledCount
    ? monthlyData.filter((_, i) => filledMonths[i]).reduce((a, m) => a + m.inc, 0) / filledCount
    : 0;
  const avgTaxAmount = avgFilledIncome * (taxRate / 100);

  // Annual total: actual values for filled months + avg for empty months
  const annualTakeHome = monthlyData.reduce((sum, m, i) => {
    if (filledMonths[i]) {
      const tax = m.inc * (taxRate / 100);
      return sum + (m.inc - tax - m.spent);
    } else {
      return sum + avgTakeHome;
    }
  }, 0);

  const projNumEl = document.getElementById('rv-proj-num');
  const projSubEl = document.getElementById('rv-proj-sub');
  const projTaxEl = document.getElementById('rv-proj-tax');

  if (filledCount === 0) {
    projNumEl.textContent = '—';
    projNumEl.className = 'proj-big-num';
    projSubEl.textContent = 'No income data for ' + reviewYear;
    if (projTaxEl) projTaxEl.style.display = 'none';
  } else {
    projNumEl.textContent = (annualTakeHome >= 0 ? '+' : '') + bFmt(annualTakeHome);
    projNumEl.className = 'proj-big-num' + (annualTakeHome < 0 ? ' negative' : '');
    const emptyCount = 12 - filledCount;
    const baseLabel = filledCount === 12
      ? 'All 12 months actual data'
      : filledCount === 1
        ? '1 month actual · ' + emptyCount + ' projected from avg'
        : filledCount + ' months actual · ' + emptyCount + ' projected from avg';
    projSubEl.textContent = taxOn
      ? baseLabel + ' · after ' + taxRate + '% tax'
      : baseLabel + ' · pre-tax';
    if (projTaxEl) {
      if (taxOn && avgTaxAmount > 0) {
        const annualTax = avgTaxAmount * filledCount + avgTaxAmount * (12 - filledCount);
        projTaxEl.innerHTML = '−' + bFmt(annualTax) + '/yr in tax';
        projTaxEl.style.display = 'block';
      } else {
        projTaxEl.style.display = 'none';
      }
    }
  }

  // Small projection chart — actual for filled months, avg for empty months
  const projLabels = MONTHS.map(m => m.slice(0,3));
  const perMonthTakeHome = monthlyData.map((m, i) => {
    if (filledMonths[i]) {
      const tax = m.inc * (taxRate / 100);
      return m.inc - tax - m.spent;
    }
    return avgTakeHome;
  });
  const perMonthTax = monthlyData.map((m, i) => {
    if (!taxOn) return 0;
    if (filledMonths[i]) return m.inc * (taxRate / 100);
    return avgTaxAmount;
  });
  const projTakeHome = perMonthTakeHome.map(v => Math.max(v, 0));
  const projTax      = perMonthTax;
  const projNeg      = perMonthTakeHome.map(v => v < 0 ? Math.abs(v) : 0);

  const projCanvas = document.getElementById('projChart');
  if (projCanvas) {
    if (window._projChartInstance) { window._projChartInstance.destroy(); }
    window._projChartInstance = new Chart(projCanvas, {
      type: 'bar',
      data: {
        labels: projLabels,
        datasets: [
          {
            label: 'Take-home',
            data: projTakeHome,
            // Solid for actual months, faded/hatched for projected months
            backgroundColor: filledMonths.map(f => f ? 'rgba(34,197,94,0.80)' : 'rgba(34,197,94,0.30)'),
            borderColor: filledMonths.map(f => f ? 'rgba(34,197,94,0)' : 'rgba(34,197,94,0.55)'),
            borderWidth: filledMonths.map(f => f ? 0 : 1.5),
            borderDash: [4, 3],
            borderRadius: 4,
            stack: 'proj',
          },
          {
            label: 'Tax',
            data: projTax,
            backgroundColor: filledMonths.map(f => f ? 'rgba(239,68,68,0.50)' : 'rgba(239,68,68,0.20)'),
            borderRadius: 4,
            stack: 'proj',
          },
          {
            label: 'Deficit',
            data: projNeg,
            backgroundColor: filledMonths.map(f => f ? 'rgba(239,68,68,0.80)' : 'rgba(239,68,68,0.35)'),
            borderRadius: 4,
            stack: 'proj',
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ' ' + ctx.dataset.label + ': ' + bFmt(ctx.parsed.y),
              afterLabel: ctx => {
                if (ctx.datasetIndex === 0) {
                  return filledMonths[ctx.dataIndex] ? '  ✓ actual' : '  ~ projected';
                }
                return '';
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { font: { family: 'Montserrat', size: 9 }, color: '#6b7a8d' }
          },
          y: {
            stacked: true,
            display: false,
            beginAtZero: true
          }
        }
      }
    });
  }

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
// ============================================================
//  SWIPE GESTURES  (mobile: swipe-left = delete, swipe-right = check off bills)
// ============================================================
(function() {
  const THRESHOLD  = 72;   // px needed to trigger action
  const MAX_TRAVEL = 90;   // max px the row slides before snap
  const isMobile   = () => window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  let activeTouchWrap = null;  // currently dragging wrap

  function attachSwipe(wrap) {
    if (wrap._swipeAttached) return;
    wrap._swipeAttached = true;

    let startX = 0, startY = 0, deltaX = 0, dragging = false, axis = null;
    const content = wrap.querySelector('.swipe-content');
    if (!content) return;

    function getSection() { return wrap.dataset.section; }
    function getIndex()   { return parseInt(wrap.dataset.index, 10); }
    function hasPaid()    { return wrap.dataset.hasPaid === 'true'; }

    wrap.addEventListener('touchstart', e => {
      if (!isMobile()) return;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      deltaX = 0;
      axis = null;
      dragging = true;
      content.style.transition = 'none';
    }, { passive: true });

    wrap.addEventListener('touchmove', e => {
      if (!dragging || !isMobile()) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      // Lock axis on first significant movement
      if (!axis) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      if (axis !== 'x') return;

      // Prevent page scroll when swiping horizontally
      e.preventDefault();

      deltaX = dx;
      // Clamp travel
      const clamped = Math.max(-MAX_TRAVEL, Math.min(MAX_TRAVEL, deltaX));

      // Only allow right-swipe on bill rows; always allow left-swipe
      const allowRight = hasPaid();
      const effective = (clamped < 0) ? clamped : (allowRight ? clamped : 0);

      content.style.transform = `translateX(${effective}px)`;

      // Show/hide hint panels
      wrap.classList.toggle('reveal-delete', effective < -THRESHOLD * 0.5);
      wrap.classList.toggle('reveal-check',  effective >  THRESHOLD * 0.5 && allowRight);

      // Dismiss any other open row
      if (activeTouchWrap && activeTouchWrap !== wrap) resetWrap(activeTouchWrap);
      activeTouchWrap = wrap;
    }, { passive: false });

    wrap.addEventListener('touchend', () => {
      if (!dragging || !isMobile()) return;
      dragging = false;
      axis = null;
      content.style.transition = '';

      const allowRight = hasPaid();
      const isTxnRow = wrap.classList.contains('txn-swipe-wrap');

      if (deltaX < -THRESHOLD) {
        // ── Swipe left: delete ──────────────────────────────────
        wrap.classList.add('animate-out');
        wrap.classList.remove('reveal-delete');
        setTimeout(() => {
          if (isTxnRow) {
            deleteTxn(parseInt(wrap.dataset.txnIdx, 10));
          } else {
            deleteRow(getSection(), getIndex());
          }
        }, 280);
      } else if (deltaX > THRESHOLD && allowRight) {
        // ── Swipe right: mark paid ──────────────────────────────
        wrap.classList.add('animate-check');
        wrap.classList.remove('reveal-check');
        setTimeout(() => {
          togglePaid(getSection(), getIndex(), true);
        }, 280);
      } else {
        // ── Snap back ───────────────────────────────────────────
        content.style.transform = '';
        wrap.classList.remove('reveal-delete', 'reveal-check');
      }
    });

    wrap.addEventListener('touchcancel', () => {
      dragging = false;
      axis = null;
      content.style.transition = '';
      content.style.transform  = '';
      wrap.classList.remove('reveal-delete', 'reveal-check');
    });
  }

  function resetWrap(wrap) {
    const content = wrap.querySelector('.swipe-content');
    if (content) { content.style.transition = ''; content.style.transform = ''; }
    wrap.classList.remove('reveal-delete', 'reveal-check');
  }

  // Use event delegation on the budget page so it picks up re-rendered rows
  document.addEventListener('touchstart', e => {
    const wrap = e.target.closest('.swipe-wrap');
    if (!wrap) {
      // Tap outside — reset any open row
      if (activeTouchWrap) { resetWrap(activeTouchWrap); activeTouchWrap = null; }
      return;
    }
    attachSwipe(wrap);
  }, { passive: true });
})();

document.addEventListener('DOMContentLoaded', function() {
  const opts = document.querySelectorAll('#budgetCurrencyPicker .curr-opt');
  if (opts.length) opts[0].classList.add('active');
  // Check storage on load and warn immediately if blocked
  if (!checkStorageAvailable()) {
    showStorageWarning();
  }
});
renderBudget();
// Show FAB since budget is the default active page
(function() { var f=document.getElementById('expenseFab'); if(f) f.classList.add('visible'); })();
