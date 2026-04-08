
(function() {
  function initMarquee() {
    var setA = document.getElementById('marketSetA');
    var setB = document.getElementById('marketSetB');
    var track = document.getElementById('marketTickerTrack');
    if (!setA || !setB || !track) return;

    // Clone set A content into set B for seamless loop
    setB.innerHTML = setA.innerHTML;

    // Calculate scroll distance = width of one set (including its padding)
    var setWidth = setA.offsetWidth;
    if (setWidth === 0) {
      requestAnimationFrame(initMarquee);
      return;
    }

    // Speed: pixels per second — comfortable reading pace
    var pxPerSec = 48;
    var duration = setWidth / pxPerSec;

    track.style.setProperty('--market-scroll-dist', '-' + setWidth + 'px');
    track.style.animation = 'marketScroll ' + duration + 's linear infinite';
  }

  // Run after layout
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(initMarquee, 150); });
  } else {
    setTimeout(initMarquee, 150);
  }

  // Re-init on resize so duration stays correct if window width changes
  window.addEventListener('resize', function() {
    var track = document.getElementById('marketTickerTrack');
    if (track) track.style.animation = '';
    setTimeout(initMarquee, 100);
  });
})();



// ── Scroll a tab bar by delta px ──────────────────────────────
function scrollTabBar(id, delta) {
  var el = document.getElementById(id);
  if (!el) return;
  el.scrollBy({ left: delta, behavior: 'smooth' });
}

// ── Update arrow visibility for a scroll-tab-wrap ────────────
function updateScrollArrows(stripId, leftBtnId, rightBtnId, wrapId) {
  var strip = document.getElementById(stripId);
  var leftBtn = document.getElementById(leftBtnId);
  var rightBtn = document.getElementById(rightBtnId);
  var wrap = document.getElementById(wrapId);
  if (!strip || !leftBtn || !rightBtn || !wrap) return;

  var canScrollLeft  = strip.scrollLeft > 2;
  var canScrollRight = strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 2;

  // Only show arrows if there is actually overflow
  var hasOverflow = strip.scrollWidth > strip.clientWidth + 4;

  leftBtn.classList.toggle('visible',  hasOverflow && canScrollLeft);
  rightBtn.classList.toggle('visible', hasOverflow && canScrollRight);

  wrap.classList.toggle('can-scroll-left',  hasOverflow && canScrollLeft);
  wrap.classList.toggle('can-scroll-right', hasOverflow && canScrollRight);
}

// ── Wire up both bars ─────────────────────────────────────────
function initScrollArrows() {
  // Budget nav tabs
  var budgetStrip = document.getElementById('budgetNavTabs');
  if (budgetStrip) {
    budgetStrip.addEventListener('scroll', function() {
      updateScrollArrows('budgetNavTabs','budgetNavLeft','budgetNavRight','budgetNavWrap');
    });
    updateScrollArrows('budgetNavTabs','budgetNavLeft','budgetNavRight','budgetNavWrap');
  }

  // Invest tab bar
  var investStrip = document.getElementById('investTabBar');
  if (investStrip) {
    investStrip.addEventListener('scroll', function() {
      updateScrollArrows('investTabBar','investTabLeft','investTabRight','investTabWrap');
    });
    updateScrollArrows('investTabBar','investTabLeft','investTabRight','investTabWrap');
  }
}

// Re-check on resize (viewport change)
window.addEventListener('resize', function() {
  updateScrollArrows('budgetNavTabs','budgetNavLeft','budgetNavRight','budgetNavWrap');
  updateScrollArrows('investTabBar','investTabLeft','investTabRight','investTabWrap');
});

// Init after DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initScrollArrows);
} else {
  initScrollArrows();
}
// Also init slightly later to catch any layout shifts
setTimeout(initScrollArrows, 300);

// ── Budget nav: dynamically wrap when tabs don't fit ─────────
(function() {
  function checkBudgetNavWrap() {
    var nav = document.querySelector('#app-budget nav');
    if (!nav) return;
    var tabs   = document.getElementById('budgetNavTabs');
    var logo   = nav.querySelector('.logo-dropdown-wrap');
    var curr   = document.getElementById('budgetCurrencyDropdown');
    var toggle = document.getElementById('budgetDarkToggle');
    if (!tabs || !logo || !curr) return;

    // Temporarily unwrap to measure natural widths
    var wasWrapped = nav.classList.contains('nav-wrapped');
    nav.classList.remove('nav-wrapped');

    // Force a reflow to get accurate measurements
    var navW    = nav.clientWidth;
    var logoW   = logo.scrollWidth;
    var tabsW   = tabs.scrollWidth;
    var currW   = curr.scrollWidth;
    var toggleW = toggle ? toggle.scrollWidth : 0;
    var gap     = 80; // generous buffer — wrap well before any overlap

    var fits = (logoW + tabsW + currW + toggleW + gap) <= navW;

    if (!fits) {
      nav.classList.add('nav-wrapped');
    }
    // Re-run scroll arrows after layout settles
    if (typeof updateScrollArrows === 'function') {
      requestAnimationFrame(function() {
        updateScrollArrows('budgetNavTabs','budgetNavLeft','budgetNavRight','budgetNavWrap');
      });
    }
  }

  // ResizeObserver watches the nav — fires instantly on any size change
  if (window.ResizeObserver) {
    var nav = document.querySelector('#app-budget nav');
    if (nav) {
      new ResizeObserver(checkBudgetNavWrap).observe(nav);
    }
  }
  // Fallback for older browsers
  window.addEventListener('resize', checkBudgetNavWrap);

  // Initial check
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      checkBudgetNavWrap();
      setTimeout(checkBudgetNavWrap, 200);
    });
  } else {
    checkBudgetNavWrap();
    setTimeout(checkBudgetNavWrap, 200);
  }
})();



// ── Month selector scroll arrows ──────────────────────────────

function scrollMonths(stripId, delta) {
  var el = document.getElementById(stripId);
  if (!el) return;
  el.scrollBy({ left: delta, behavior: 'smooth' });
}

function updateMonthArrows(stripId, leftBtnId, rightBtnId, wrapId) {
  var strip  = document.getElementById(stripId);
  var lBtn   = document.getElementById(leftBtnId);
  var rBtn   = document.getElementById(rightBtnId);
  var wrap   = document.getElementById(wrapId);
  if (!strip || !lBtn || !rBtn || !wrap) return;

  var hasOverflow    = strip.scrollWidth > strip.clientWidth + 4;
  var canScrollLeft  = strip.scrollLeft > 2;
  var canScrollRight = strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 2;

  lBtn.classList.toggle('visible',  hasOverflow && canScrollLeft);
  rBtn.classList.toggle('visible',  hasOverflow && canScrollRight);
  wrap.classList.toggle('can-scroll-left',  hasOverflow && canScrollLeft);
  wrap.classList.toggle('can-scroll-right', hasOverflow && canScrollRight);
}

function initMonthArrows() {
  var pairs = [
    { strip: 'monthSelector',     left: 'budgetMonthLeft', right: 'budgetMonthRight', wrap: 'budgetMonthWrap' },
    { strip: 'habitMonthSelector',left: 'habitMonthLeft',  right: 'habitMonthRight',  wrap: 'habitMonthWrap'  },
  ];
  pairs.forEach(function(p) {
    var strip = document.getElementById(p.strip);
    if (!strip) return;
    // Initial state
    updateMonthArrows(p.strip, p.left, p.right, p.wrap);
    // Update on scroll
    strip.addEventListener('scroll', function() {
      updateMonthArrows(p.strip, p.left, p.right, p.wrap);
    });
  });
}

// Re-check month arrows on resize too
window.addEventListener('resize', function() {
  updateMonthArrows('monthSelector',      'budgetMonthLeft','budgetMonthRight','budgetMonthWrap');
  updateMonthArrows('habitMonthSelector', 'habitMonthLeft', 'habitMonthRight', 'habitMonthWrap');
});

// Init — also retry after a short delay so JS-rendered month buttons are in the DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    initMonthArrows();
    setTimeout(initMonthArrows, 400);
  });
} else {
  initMonthArrows();
  setTimeout(initMonthArrows, 400);
}

// Expose a helper so the existing month-rendering JS can call this
// after it rebuilds the month buttons (renderMonthSelector calls, etc.)
window.refreshMonthArrows = function() {
  updateMonthArrows('monthSelector',      'budgetMonthLeft','budgetMonthRight','budgetMonthWrap');
  updateMonthArrows('habitMonthSelector', 'habitMonthLeft', 'habitMonthRight', 'habitMonthWrap');
};



// ============================================================
//  APP SWITCHER
// ============================================================
var _currentApp = localStorage.getItem('ls_active_app') || 'budget';

function _getActiveDropdown() {
  // Returns the visible logo dropdown wrap based on current app
  var id = _currentApp === 'invest' ? 'logoDropdownWrapInvest' : 'logoDropdownWrap';
  return document.getElementById(id);
}

function switchApp(appId) {
  localStorage.setItem('ls_active_app', appId);
  _currentApp = appId;

  // Show/hide wrappers
  document.querySelectorAll('.app-wrapper').forEach(function(w) {
    w.classList.remove('active');
  });
  document.getElementById('app-' + appId).classList.add('active');

  // Close both dropdowns
  ['logoDropdownWrap','logoDropdownWrapInvest'].forEach(function(id) {
    var w = document.getElementById(id);
    if (w) w.classList.remove('open');
  });

  // Update active highlight in ALL menus (budget + invest both have the menu)
  document.querySelectorAll('.logo-dropdown-item').forEach(function(item) {
    item.classList.toggle('active-app', item.dataset.app === appId);
  });
  document.querySelectorAll('.logo-dd-check').forEach(function(c) {
    c.style.display = c.closest('[data-app="' + appId + '"]') ? 'block' : 'none';
  });

  // Re-init the activated app
  if (appId === 'budget') {
    if (typeof renderBudget === 'function') renderBudget();
  }
  if (appId === 'invest') {
    if (typeof renderAll === 'function') renderAll();
    if (typeof updateMarketStatus === 'function') updateMarketStatus();
  }
}

function toggleLogoDropdown() {
  var wrap = _getActiveDropdown();
  if (!wrap) return;
  var isOpen = wrap.classList.contains('open');
  // Close all first
  ['logoDropdownWrap','logoDropdownWrapInvest'].forEach(function(id) {
    var w = document.getElementById(id);
    if (w) w.classList.remove('open');
  });
  if (!isOpen) wrap.classList.add('open');
}

// Close on outside click
document.addEventListener('click', function(e) {
  ['logoDropdownWrap','logoDropdownWrapInvest'].forEach(function(id) {
    var wrap = document.getElementById(id);
    if (wrap && !wrap.contains(e.target)) {
      wrap.classList.remove('open');
    }
  });
});



// ===== RESTORE LAST ACTIVE APP ON LOAD =====
(function() {
  var saved = localStorage.getItem('ls_active_app') || 'budget';
  if (saved !== 'budget') {
    switchApp(saved);
  }
})();



// ============================================================
//  DARK MODE
// ============================================================
function applyDarkMode(isDark) {
  const html = document.documentElement;
  if (isDark) {
    html.setAttribute('data-theme', 'dark');
  } else {
    html.removeAttribute('data-theme');
  }

  // Sync all toggle checkboxes
  ['darkModeToggleBudget','darkModeToggleInvest'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = isDark;
  });

  // Sync nav icon buttons
  const icon = isDark ? '☀️' : '🌙';
  ['budgetDarkIcon','investDarkIcon'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = isDark ? '☀️' : '🌙';
  });

  // Update Chart.js defaults for all future charts
  const textColor  = isDark ? '#8a97a8' : '#6b7a8d';
  const gridColor  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  if (window.Chart) {
    Chart.defaults.color = textColor;
    Chart.defaults.borderColor = gridColor;
  }

  // Re-render any active charts so they pick up new colours
  // We do this by invalidating the performance cache and re-rendering overviews
  if (typeof renderAll === 'function') renderAll();

  localStorage.setItem('ls_dark_mode', isDark ? '1' : '0');
}

function toggleDarkMode(forcedVal) {
  const isDark = forcedVal !== undefined
    ? forcedVal
    : document.documentElement.getAttribute('data-theme') !== 'dark';
  applyDarkMode(isDark);
}

// Restore on load
(function() {
  const saved = localStorage.getItem('ls_dark_mode');
  // Also respect OS preference if no saved preference
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved !== null ? saved === '1' : prefersDark;
  if (isDark) applyDarkMode(true);

  // Listen for OS theme changes
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (localStorage.getItem('ls_dark_mode') === null) {
        applyDarkMode(e.matches);
      }
    });
  }
})();
