
// ============================================================
//  IFRAME DETECTION — warn user if storage may be blocked
// ============================================================
(function() {
  try {
    if (window.self !== window.top) {
      // We're inside an iframe — storage is likely blocked on Safari/Chrome
      // Show a persistent banner prompting the user to open the app directly
      document.addEventListener('DOMContentLoaded', function() {
        var banner = document.createElement('div');
        banner.id = 'iframeWarningBanner';
        banner.style.cssText = [
          'position:fixed','top:0','left:0','right:0','z-index:9998',
          'background:#1a2332','color:white',
          'font-family:Montserrat,sans-serif','font-size:12px','font-weight:600',
          'padding:10px 14px','display:flex','align-items:center',
          'justify-content:space-between','gap:10px','flex-wrap:wrap'
        ].join(';');
        banner.innerHTML =
          '<span style="display:flex;align-items:center;gap:6px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>For data to save between sessions, open Live Simple in its own tab.</span>' +
          '<a href="' + window.location.href + '" target="_blank" ' +
          'style="background:var(--coral,#f97316);color:white;border:none;border-radius:6px;' +
          'padding:5px 12px;font-family:Montserrat,sans-serif;font-weight:700;font-size:11px;' +
          'text-decoration:none;white-space:nowrap;cursor:pointer;">Open in new tab →</a>';
        document.body.prepend(banner);
      });
    }
  } catch(e) {
    // Cross-origin frame — definitely blocked, but we can't read window.top
    // The storage write will fail and showStorageWarning() will catch it
  }
})();

(function() {
  function initMarquee() {
    var setA = document.getElementById('marketSetA');
    var track = document.getElementById('marketTickerTrack');
    if (!setA || !track) return;

    // Measure one set's width
    var setWidth = setA.offsetWidth;
    if (setWidth === 0) {
      requestAnimationFrame(initMarquee);
      return;
    }

    // Remove all previously cloned sets (keep only setA)
    var existing = track.querySelectorAll('.market-ticker-set:not(#marketSetA)');
    existing.forEach(function(el) { el.parentNode.removeChild(el); });

    // Work out how many copies fill at least 3× the container width for a gap-free loop
    var containerWidth = track.parentElement.offsetWidth || window.innerWidth;
    var minFill = Math.max(containerWidth * 3, setWidth * 3);
    var copies = Math.ceil(minFill / setWidth);

    // Append copies of set A
    for (var i = 0; i < copies; i++) {
      var clone = setA.cloneNode(true);
      clone.removeAttribute('id');
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    }

    // The animation scrolls exactly one set-width, then loops seamlessly
    var pxPerSec = 48;
    var duration = setWidth / pxPerSec;

    track.style.setProperty('--market-scroll-dist', '-' + setWidth + 'px');
    // Reset then reapply so the animation restarts cleanly
    track.style.animation = 'none';
    // Force reflow so the browser registers the reset
    void track.offsetWidth;
    track.style.animation = 'marketScroll ' + duration + 's linear infinite';
  }

  // Expose globally so invest.js can call it after price/status updates
  window.reinitMarquee = initMarquee;

  // Run after layout
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(initMarquee, 150); });
  } else {
    setTimeout(initMarquee, 150);
  }

  // Re-init on resize
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

  // Habits nav tabs
  var habitsStrip = document.getElementById('habitsNavTabs');
  if (habitsStrip) {
    habitsStrip.addEventListener('scroll', function() {
      updateScrollArrows('habitsNavTabs','habitsNavLeft','habitsNavRight','habitsNavWrap');
    });
    updateScrollArrows('habitsNavTabs','habitsNavLeft','habitsNavRight','habitsNavWrap');
  }
}

// Re-check on resize (viewport change)
window.addEventListener('resize', function() {
  updateScrollArrows('budgetNavTabs','budgetNavLeft','budgetNavRight','budgetNavWrap');
  updateScrollArrows('investTabBar','investTabLeft','investTabRight','investTabWrap');
  updateScrollArrows('habitsNavTabs','habitsNavLeft','habitsNavRight','habitsNavWrap');
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

// ============================================================
//  MONTH DRUM PICKER  (Apple-clock-style horizontal scroll wheel)
// ============================================================
window.buildMonthDrum = function(containerId, months, activeIdx, onSelect, todayIdx) {
  var drum = document.getElementById(containerId);
  if (!drum) return;

  // Item width — must match CSS
  var ITEM_W = 72;

  // todayIdx: the real current month (for coral dot highlight), defaults to activeIdx
  var _todayIdx = (typeof todayIdx === 'number') ? todayIdx : activeIdx;

  // Track last-fired index to prevent double-firing
  var _lastFiredIdx = activeIdx;
  // Track whether user is currently touch-dragging (suppress click)
  var _isDragging = false;
  var _touchStartX = 0;

  // Build items with ghost padding so first/last can centre
  drum.innerHTML = '';

  // Ghost spacer so month[0] can sit at centre
  var ghost = document.createElement('div');
  ghost.className = 'month-drum-ghost';
  ghost.style.cssText = 'flex-shrink:0;';
  drum.appendChild(ghost);

  months.forEach(function(m, i) {
    var el = document.createElement('div');
    var cls = 'month-drum-item';
    if (i === activeIdx)  cls += ' active';
    if (i === _todayIdx)  cls += ' today';
    el.className = cls;
    el.dataset.idx = i;

    // Label + optional today dot
    var label = document.createElement('span');
    label.textContent = m.slice(0, 3).toUpperCase();
    el.appendChild(label);

    if (i === _todayIdx) {
      var dot = document.createElement('span');
      dot.className = 'month-drum-dot';
      el.appendChild(dot);
    }

    el.addEventListener('click', function() {
      if (_isDragging) return; // don't fire after a drag
      // Smooth scroll so user sees drum move naturally
      scrollDrumTo(drum, i, ITEM_W, true);
      // Update active highlight immediately (no wait)
      setDrumActive(drum, i);
      // Fire selection immediately — don't wait for debounce
      if (i !== _lastFiredIdx) {
        _lastFiredIdx = i;
        onSelect(i);
      }
    });
    drum.appendChild(el);
  });

  // Matching ghost at end
  var ghostEnd = document.createElement('div');
  ghostEnd.className = 'month-drum-ghost';
  ghostEnd.style.cssText = 'flex-shrink:0;';
  drum.appendChild(ghostEnd);

  // Size ghosts and jump to initial position
  function sizeGhosts() {
    var drumW = drum.clientWidth;
    var padW = Math.max(0, (drumW - ITEM_W) / 2);
    ghost.style.width = padW + 'px';
    ghostEnd.style.width = padW + 'px';
    scrollDrumTo(drum, activeIdx, ITEM_W, false);
  }

  if (drum.clientWidth > 0) {
    sizeGhosts();
  } else {
    requestAnimationFrame(sizeGhosts);
  }

  // Detect touch drags so we don't treat drag-release as a click
  drum.addEventListener('touchstart', function(e) {
    _touchStartX = e.touches[0].clientX;
    _isDragging = false;
  }, { passive: true });
  drum.addEventListener('touchmove', function(e) {
    if (Math.abs(e.touches[0].clientX - _touchStartX) > 6) _isDragging = true;
  }, { passive: true });
  drum.addEventListener('touchend', function() {
    // Reset drag flag after a short delay so the ensuing click event can check it
    setTimeout(function() { _isDragging = false; }, 100);
  }, { passive: true });

  // Snap detection for finger-drag scrolling (fires onSelect after scroll settles)
  var _snapTimer = null;
  drum.addEventListener('scroll', function() {
    updateDrumActive(drum, ITEM_W);
    clearTimeout(_snapTimer);
    _snapTimer = setTimeout(function() {
      var idx = getCentreIdx(drum, ITEM_W);
      if (idx >= 0 && idx < months.length) {
        setDrumActive(drum, idx);
        if (idx !== _lastFiredIdx) {
          _lastFiredIdx = idx;
          onSelect(idx);
        }
      }
    }, 150);
  }, { passive: true });
};

function getCentreIdx(drum, itemW) {
  // scrollLeft=0 shows item 0 at centre (because ghost pad = (drumW-itemW)/2)
  return Math.max(0, Math.round(drum.scrollLeft / itemW));
}

function setDrumActive(drum, idx) {
  drum.querySelectorAll('.month-drum-item').forEach(function(el) {
    el.classList.toggle('active', parseInt(el.dataset.idx) === idx);
  });
}

function updateDrumActive(drum, itemW) {
  var idx = getCentreIdx(drum, itemW);
  setDrumActive(drum, idx);
}

function scrollDrumTo(drum, idx, itemW, animate) {
  // scrollLeft = idx * itemW puts item idx at centre (ghost pad = (drumW-itemW)/2)
  drum.scrollTo({ left: idx * itemW, behavior: animate ? 'smooth' : 'instant' });
}

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
    { strip: 'monthSelector',      left: 'budgetMonthLeft', right: 'budgetMonthRight', wrap: 'budgetMonthWrap' },
    { strip: 'habitMonthSelector', left: 'habitMonthLeft',  right: 'habitMonthRight',  wrap: 'habitMonthWrap'  },
  ];
  pairs.forEach(function(p) {
    var strip = document.getElementById(p.strip);
    if (!strip) return;
    updateMonthArrows(p.strip, p.left, p.right, p.wrap);
    strip.addEventListener('scroll', function() {
      updateMonthArrows(p.strip, p.left, p.right, p.wrap);
    });
  });
}

window.addEventListener('resize', function() {
  updateMonthArrows('monthSelector',      'budgetMonthLeft', 'budgetMonthRight', 'budgetMonthWrap');
  updateMonthArrows('habitMonthSelector', 'habitMonthLeft',  'habitMonthRight',  'habitMonthWrap');
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    initMonthArrows();
    setTimeout(initMonthArrows, 400);
  });
} else {
  initMonthArrows();
  setTimeout(initMonthArrows, 400);
}

window.refreshMonthArrows = function() {
  updateMonthArrows('monthSelector',      'budgetMonthLeft', 'budgetMonthRight', 'budgetMonthWrap');
  updateMonthArrows('habitMonthSelector', 'habitMonthLeft',  'habitMonthRight',  'habitMonthWrap');
};



// ============================================================
//  APP SWITCHER
// ============================================================
var _currentApp = localStorage.getItem('ls_active_app') || 'budget';

function _getActiveDropdown() {
  var map = { invest: 'logoDropdownWrapInvest', habits: 'habitsLogoDropWrap' };
  var id = map[_currentApp] || 'logoDropdownWrap';
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

  // Close all dropdowns
  ['logoDropdownWrap','logoDropdownWrapInvest','habitsLogoDropWrap'].forEach(function(id) {
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
  if (appId === 'habits') {
    if (typeof initHabitsApp === 'function') initHabitsApp();
  }
}

const ALL_LOGO_DROPDOWNS = ['logoDropdownWrap','logoDropdownWrapInvest','habitsLogoDropWrap'];

function toggleLogoDropdown() {
  var wrap = _getActiveDropdown();
  if (!wrap) return;
  var isOpen = wrap.classList.contains('open');
  ALL_LOGO_DROPDOWNS.forEach(function(id) {
    var w = document.getElementById(id);
    if (w) w.classList.remove('open');
  });
  if (!isOpen) wrap.classList.add('open');
}

// Close on outside click
document.addEventListener('click', function(e) {
  ALL_LOGO_DROPDOWNS.forEach(function(id) {
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
  ['darkModeToggleBudget','darkModeToggleInvest','darkModeToggleHabits'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = isDark;
  });

  // Sync nav icon buttons with SVG icons
  const moonSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>`;
  const sunSVG  = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  ['budgetDarkIcon','investDarkIcon','habitsDarkIcon'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = isDark ? sunSVG : moonSVG;
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
  // Always call applyDarkMode so icons are initialised regardless of theme
  applyDarkMode(isDark);

  // Listen for OS theme changes
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (localStorage.getItem('ls_dark_mode') === null) {
        applyDarkMode(e.matches);
      }
    });
  }
})();
