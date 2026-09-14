/* =============================================================
   VO CREATIVE CO. — Website interactions
   Sticky nav, mobile menu, scroll reveal, hover-play clips,
   booking form validation + success state.
   ============================================================= */

(function () {
  'use strict';

  /* ---- Scroll-triggered autoplay for About clips ---- */
  var pvids = document.querySelectorAll('.pvid');
  pvids.forEach(function (box) {
    var v = box.querySelector('video');
    if (!v) return;
    /* Force browser to load the file and show the first frame */
    v.load();
    v.addEventListener('loadeddata', function () {
      try { v.currentTime = 0.01; } catch (e) {}
    }, { once: true });
    /* Tap fallback for mobile browsers that block autoplay */
    box.addEventListener('click', function () {
      box.classList.add('playing');
      v.play().catch(function () {});
    });
  });

  if ('IntersectionObserver' in window && pvids.length) {
    var vidObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var box = entry.target;
        var v = box.querySelector('video');
        if (!v) return;
        if (entry.isIntersecting) {
          box.classList.add('playing');
          v.play().catch(function () {});
        } else {
          box.classList.remove('playing');
          v.pause();
          try { v.currentTime = 0; } catch (e) {}
        }
      });
    }, { threshold: 0.15 });
    pvids.forEach(function (box) { vidObserver.observe(box); });
  }

  /* ---- Sticky nav state ---- */
  var nav = document.querySelector('.nav');
  function onScroll() {
    if (window.scrollY > 24) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- Mobile menu ---- */
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle) {
    toggle.addEventListener('click', function () { links.classList.toggle('open'); });
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') links.classList.remove('open');
    });
  }

  /* ---- Nav dropdowns (Services, Our Work) ---- */
  function isMobileNav() { return window.innerWidth <= 680; }
  var navDds = document.querySelectorAll('.nav-dd');
  navDds.forEach(function (dd) {
    var ddBtn = dd.querySelector('.nav-dd-btn');
    if (!ddBtn) return;
    function setDd(open) {
      dd.classList.toggle('open', open);
      ddBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    ddBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      setDd(!dd.classList.contains('open'));
    });
    dd.addEventListener('mouseenter', function () { if (!isMobileNav()) setDd(true); });
    dd.addEventListener('mouseleave', function () { if (!isMobileNav()) setDd(false); });
  });
  /* Click outside closes any open dropdown */
  document.addEventListener('click', function (e) {
    navDds.forEach(function (dd) {
      if (!dd.contains(e.target)) {
        dd.classList.remove('open');
        var b = dd.querySelector('.nav-dd-btn');
        if (b) b.setAttribute('aria-expanded', 'false');
      }
    });
  });

  /* ---- Client marquee: pin the section and scroll the row horizontally,
         then release so the page continues down ---- */
  var marquee = document.getElementById('client-marquee');
  var clientsSection = document.getElementById('clients');
  var clientsPin = document.getElementById('clients-pin');
  if (marquee && clientsSection && clientsPin) {
    var mtrack = marquee.querySelector('.marquee-track');
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var overflowX = 0;
    var scheduled = false;
    var clones = [];

    /* DESKTOP: pin the section, drive the row with vertical scroll */
    function updatePin() {
      scheduled = false;
      if (!clientsSection.classList.contains('is-pinned') || overflowX <= 0) return;
      var top = clientsPin.getBoundingClientRect().top;
      var progress = (-top) / overflowX;
      if (progress < 0) progress = 0;
      if (progress > 1) progress = 1;
      mtrack.style.transform = 'translateX(' + (-progress * overflowX) + 'px)';
    }

    /* MOBILE: continuous auto-scroll (duplicate the row for a seamless loop) */
    function setAuto(on) {
      if (on && clones.length === 0) {
        var kids = Array.prototype.slice.call(mtrack.children);
        var gap = parseFloat(getComputedStyle(mtrack).columnGap || getComputedStyle(mtrack).gap) || 0;
        var shift = 0;
        kids.forEach(function (n) { shift += n.offsetWidth + gap; });
        kids.forEach(function (n) {
          var c = n.cloneNode(true);
          c.setAttribute('aria-hidden', 'true');
          clones.push(c);
          mtrack.appendChild(c);
        });
        mtrack.style.setProperty('--marquee-shift', shift + 'px');
        mtrack.style.setProperty('--marquee-dur', (kids.length * 2.6) + 's');
      } else if (!on && clones.length) {
        clones.forEach(function (c) { if (c.parentNode) c.parentNode.removeChild(c); });
        clones = [];
        mtrack.style.removeProperty('--marquee-shift');
        mtrack.style.removeProperty('--marquee-dur');
      }
      clientsSection.classList.toggle('is-auto', on);
    }

    function measure() {
      var mobile = window.innerWidth <= 680;
      if (reduceMotion) {                 // accessible baseline: swipeable row
        clientsSection.classList.remove('is-pinned');
        setAuto(false);
        clientsPin.style.height = ''; mtrack.style.transform = ''; overflowX = 0;
        return;
      }
      if (mobile) {                       // mobile: auto-scroll marquee
        clientsSection.classList.remove('is-pinned');
        clientsPin.style.height = ''; mtrack.style.transform = ''; overflowX = 0;
        setAuto(true);
        return;
      }
      /* desktop: pinned horizontal scroll */
      setAuto(false);
      overflowX = mtrack.scrollWidth - window.innerWidth;
      if (overflowX <= 0) {
        clientsSection.classList.remove('is-pinned');
        clientsPin.style.height = ''; mtrack.style.transform = ''; overflowX = 0;
        return;
      }
      clientsSection.classList.add('is-pinned');
      clientsPin.style.height = (window.innerHeight + overflowX) + 'px';
      updatePin();
    }

    window.addEventListener('scroll', function () {
      if (!scheduled) { scheduled = true; requestAnimationFrame(updatePin); }
    }, { passive: true });
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    measure();
    setTimeout(measure, 300); // re-measure once images/fonts settle
  }

  /* ---- Client showcase modals (Our Work) ---- */
  var scTriggers = document.querySelectorAll('[data-sc]');
  if (scTriggers.length) {
    function scOpen(modal) {
      modal.classList.add('open');
      document.body.classList.add('sc-lock');
      /* autoplay only muted reels; interviews stay paused (press play for sound) */
      modal.querySelectorAll('video').forEach(function (v) { if (v.muted) v.play().catch(function () {}); });
      var closeBtn = modal.querySelector('.sc-close');
      if (closeBtn) closeBtn.focus();
    }
    function scClose(modal) {
      modal.classList.remove('open');
      document.body.classList.remove('sc-lock');
      modal.querySelectorAll('video').forEach(function (v) { v.pause(); });
    }
    scTriggers.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var modal = document.getElementById('sc-' + btn.getAttribute('data-sc'));
        if (modal) scOpen(modal);
      });
    });
    document.querySelectorAll('.sc-modal').forEach(function (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal || (e.target.closest && e.target.closest('[data-close]'))) scClose(modal);
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        document.querySelectorAll('.sc-modal.open').forEach(scClose);
      }
    });
  }

  /* ---- Scroll reveal ---- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---- Carousels (one item at a time, or 3-up coverflow) ---- */
  document.querySelectorAll('.carousel').forEach(function (car) {
    var track = car.querySelector('.car-track');
    var slides = car.querySelectorAll('.car-slide');
    if (!track || !slides.length) return;
    var prev = car.querySelector('.car-prev');
    var next = car.querySelector('.car-next');
    var viewport = car.querySelector('.car-viewport');
    var wrap = car.parentElement;
    var curEl = wrap ? wrap.querySelector('.car-count-cur') : null;
    var cover = car.classList.contains('coverflow');
    var muteBtn = cover && wrap ? wrap.querySelector('.car-mute') : null;
    var i = 0;
    var soundOn = false;

    function fgOf(s) { return s.querySelector('.vwork-fg') || s.querySelector('video'); }

    function layout() {
      if (cover && viewport) {
        var sw = slides[0].offsetWidth;
        var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
        var step = sw + gap;
        var x = (viewport.offsetWidth / 2) - (i * step + sw / 2);
        track.style.transform = 'translateX(' + x + 'px)';
      } else {
        track.style.transform = 'translateX(' + (-i * 100) + '%)';
      }
    }

    function updateMuteUI() {
      if (!muteBtn) return;
      muteBtn.classList.toggle('is-on', soundOn);
      muteBtn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
      muteBtn.setAttribute('aria-label', soundOn ? 'Mute video' : 'Unmute video');
      var lbl = muteBtn.querySelector('.car-mute-lbl');
      if (lbl) lbl.textContent = soundOn ? 'Sound on' : 'Sound off';
    }

    function show(n) {
      i = (n + slides.length) % slides.length;
      layout();
      slides.forEach(function (s, idx) {
        if (cover) {
          var active = idx === i;
          var neighbor = Math.abs(idx - i) === 1;
          s.classList.toggle('is-active', active);
          s.querySelectorAll('video').forEach(function (v) {
            if (active || neighbor) { v.play().catch(function () {}); }
            else { v.pause(); }
            v.muted = true;
          });
          if (active && soundOn) {
            var fg = fgOf(s);
            if (fg) { fg.muted = false; fg.play().catch(function () {}); }
          }
        } else {
          var v = s.querySelector('video');
          if (v) {
            if (idx === i) { v.play().catch(function () {}); }
            else { v.pause(); try { v.currentTime = 0; } catch (e) {} }
          }
        }
      });
      if (curEl) curEl.textContent = i + 1;
    }

    if (prev) prev.addEventListener('click', function () { show(i - 1); });
    if (next) next.addEventListener('click', function () { show(i + 1); });

    if (cover) {
      if (muteBtn) {
        muteBtn.addEventListener('click', function () { soundOn = !soundOn; updateMuteUI(); show(i); });
        updateMuteUI();
      }
      slides.forEach(function (s, idx) {
        var fg = fgOf(s);
        if (fg) fg.addEventListener('click', function () { if (idx !== i) show(idx); });
      });
      window.addEventListener('resize', layout, { passive: true });
    }

    show(0);
  });

  /* ---- Initiative (non-profit) application form ---- */
  var initForm = document.getElementById('initiative-form');
  if (initForm) {
    var initSuccess = document.getElementById('initiative-success');
    function initEmailOk(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
    function initSetErr(field, msg) {
      var input = initForm.querySelector('[name="' + field + '"]');
      if (!input) return;
      input.classList.add('err');
      var hint = input.parentElement.querySelector('.hint');
      if (hint) { hint.textContent = msg; hint.classList.add('err'); }
    }
    initForm.querySelectorAll('.inp, .ta').forEach(function (input) {
      input.addEventListener('input', function () {
        input.classList.remove('err');
        var hint = input.parentElement.querySelector('.hint');
        if (hint) { hint.textContent = ''; hint.classList.remove('err'); }
      });
    });
    initForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = {};
      initForm.querySelectorAll('.inp, .ta').forEach(function (i) { data[i.name] = (i.value || '').trim(); });
      var ok = true;
      if (!data.org) { initSetErr('org', 'What&rsquo;s your organization called?'); ok = false; }
      if (!data.name) { initSetErr('name', 'Please tell us your name.'); ok = false; }
      if (!data.email) { initSetErr('email', 'We need an email to reach you.'); ok = false; }
      else if (!initEmailOk(data.email)) { initSetErr('email', 'That email doesn’t look right.'); ok = false; }
      if (!data.cause) { initSetErr('cause', 'Tell us a little about your cause.'); ok = false; }
      if (!ok) { var fe = initForm.querySelector('.err'); if (fe && fe.focus) fe.focus(); return; }

      /* Netlify Forms capture (same-origin) */
      var nl = new URLSearchParams();
      nl.append('form-name', 'initiative');
      Object.keys(data).forEach(function (k) { nl.append(k, data[k] || ''); });
      fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: nl.toString() }).catch(function () {});

      initForm.style.display = 'none';
      if (initSuccess) { initSuccess.classList.add('show'); initSuccess.setAttribute('tabindex', '-1'); initSuccess.focus({ preventScroll: true }); }
    });
  }

  /* ---- Booking form: step-by-step wizard with service branching ---- */
  var form = document.getElementById('book-form');
  if (!form) return;
  var success = document.getElementById('book-success');
  var steps = Array.prototype.slice.call(form.querySelectorAll('.wstep'));
  var backBtn = document.getElementById('wiz-back');
  var nextBtn = document.getElementById('wiz-next');
  var submitBtn = document.getElementById('wiz-submit');
  var bar = document.getElementById('wiz-bar');
  var curEl = document.getElementById('wiz-cur');
  var totalEl = document.getElementById('wiz-total');
  var serviceInput = form.querySelector('[name="service"]');

  var BIZ = ['E-commerce', 'Social Media Management', 'Full Service Marketing'];
  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  function stepApplies(step) {
    var w = step.getAttribute('data-when');
    if (w === 'all') return true;
    var service = serviceInput ? serviceInput.value : '';
    if (w === 'biz') return BIZ.indexOf(service) !== -1;
    return w.split(',').map(function (s) { return s.trim(); }).indexOf(service) !== -1;
  }
  function activeSteps() { return steps.filter(stepApplies); }

  /* Pre-select a service if arriving from a service page (?service=...) */
  try {
    var wanted = new URLSearchParams(window.location.search).get('service');
    if (wanted && serviceInput) {
      Array.prototype.forEach.call(serviceInput.options, function (opt) {
        if (opt.value.toLowerCase() === wanted.toLowerCase()) { serviceInput.value = opt.value; }
      });
    }
  } catch (e) {}

  function stepInput(step) { return step.querySelector('.inp, .sel, .ta'); }
  function stepHint(step) { return step.querySelector('.hint'); }
  function clearErr(step) {
    if (!step) return;
    var i = stepInput(step); if (i) i.classList.remove('err');
    var h = stepHint(step); if (h) { h.textContent = h.getAttribute('data-default') || ''; h.classList.remove('err'); }
  }
  function showErr(step, msg) {
    var i = stepInput(step); if (i) i.classList.add('err');
    var h = stepHint(step); if (h) { h.textContent = msg; h.classList.add('err'); }
  }

  var pos = 0;

  function render() {
    var list = activeSteps();
    if (pos < 0) pos = 0;
    if (pos > list.length - 1) pos = list.length - 1;
    steps.forEach(function (s) { s.classList.remove('active'); });
    var current = list[pos];
    current.classList.add('active');
    var total = list.length;
    if (curEl) curEl.textContent = pos + 1;
    if (totalEl) totalEl.textContent = total;
    if (bar) bar.style.width = Math.round((pos + 1) / total * 100) + '%';
    if (backBtn) backBtn.style.visibility = pos === 0 ? 'hidden' : 'visible';
    var last = pos === total - 1;
    if (nextBtn) nextBtn.hidden = last;
    if (submitBtn) submitBtn.hidden = !last;
    var inp = stepInput(current);
    if (inp) { setTimeout(function () { try { inp.focus({ preventScroll: true }); } catch (e) {} }, 40); }
  }

  function validateCurrent() {
    var step = activeSteps()[pos];
    var inp = stepInput(step);
    if (!inp) return true;
    var val = (inp.value || '').trim();
    if (inp.hasAttribute('required') && !val) { showErr(step, 'This one is required to continue.'); return false; }
    if (inp.type === 'email' && val && !isEmail(val)) { showErr(step, 'That email does not look right.'); return false; }
    clearErr(step);
    return true;
  }

  function goNext() { if (validateCurrent()) { pos += 1; render(); } }
  function goBack() { pos -= 1; render(); }

  if (nextBtn) nextBtn.addEventListener('click', goNext);
  if (backBtn) backBtn.addEventListener('click', goBack);
  if (serviceInput) serviceInput.addEventListener('change', function () {
    clearErr(serviceInput.closest('.wstep'));
    render();
  });

  steps.forEach(function (step) {
    var inp = stepInput(step);
    if (!inp) return;
    inp.addEventListener('input', function () { clearErr(step); });
    inp.addEventListener('change', function () { clearErr(step); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && inp.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (pos === activeSteps().length - 1) { if (submitBtn) submitBtn.click(); }
        else { goNext(); }
      }
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validateCurrent()) return;

    var data = {};
    activeSteps().forEach(function (step) {
      var i = stepInput(step);
      if (i && i.name) data[i.name] = (i.value || '').trim();
    });

    var echo = document.getElementById('success-echo');
    if (echo) { echo.textContent = [data.name, data.service, data.timeframe].filter(Boolean).join('  ·  '); }

    /* Netlify Forms capture (same-origin). */
    var nl = new URLSearchParams();
    nl.append('form-name', 'booking');
    Object.keys(data).forEach(function (k) { nl.append(k, data[k] || ''); });
    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: nl.toString()
    }).catch(function () {});

    form.style.display = 'none';
    success.classList.add('show');
    success.setAttribute('tabindex', '-1');
    success.focus({ preventScroll: true });
  });

  render();
})();

/* "We fly with you" flyby: the plane sweeps diagonally across its own
   section (bottom-left to top-right) as that section passes through the
   viewport. No-op on other pages and under prefers-reduced-motion. */
(function () {
  var plane = document.querySelector('.flyby-plane');
  if (!plane) return;
  var section = plane.closest('.flyby');
  if (!section) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var ticking = false;

  function draw() {
    ticking = false;
    var vh = window.innerHeight;
    var rect = section.getBoundingClientRect();
    var W = section.offsetWidth;
    var H = section.offsetHeight;
    var pw = plane.offsetWidth;
    var ph = plane.offsetHeight;
    // 0 as the section enters from the bottom, 1 as it leaves past the top.
    var p = (vh - rect.top) / (vh + H);
    p = Math.min(1, Math.max(0, p));

    // Full-screen plane flying straight across, left to right, no vertical
    // movement (vertically centered in the section).
    var x = -pw + p * (W + 2 * pw);
    var y = (H - ph) / 2;

    plane.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(draw); }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  draw();
})();
