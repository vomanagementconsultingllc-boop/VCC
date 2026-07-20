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

  /* ---- Services dropdown ---- */
  var dd = document.querySelector('.nav-dd');
  if (dd) {
    var ddBtn = dd.querySelector('.nav-dd-btn');
    function isMobileNav() { return window.innerWidth <= 680; }
    function setDd(open) {
      dd.classList.toggle('open', open);
      ddBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    /* Tap toggles on mobile; on desktop hover handles it */
    ddBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      setDd(!dd.classList.contains('open'));
    });
    /* Click outside closes */
    document.addEventListener('click', function (e) {
      if (!dd.contains(e.target)) setDd(false);
    });
    /* Desktop hover open/close */
    dd.addEventListener('mouseenter', function () { if (!isMobileNav()) setDd(true); });
    dd.addEventListener('mouseleave', function () { if (!isMobileNav()) setDd(false); });
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

  /* ---- Booking form ---- */
  var form = document.getElementById('book-form');
  if (!form) return;
  var success = document.getElementById('book-success');

  function setError(field, msg) {
    var input = form.querySelector('[name="' + field + '"]');
    if (!input) return;
    input.classList.add('err');
    var hint = input.parentElement.querySelector('.hint');
    if (hint) { hint.textContent = msg; hint.classList.add('err'); }
  }
  function clearError(input) {
    input.classList.remove('err');
    var hint = input.parentElement.querySelector('.hint');
    if (hint) { hint.textContent = hint.getAttribute('data-default') || ''; hint.classList.remove('err'); }
  }
  form.querySelectorAll('.inp, .sel, .ta').forEach(function (input) {
    input.addEventListener('input', function () { clearError(input); });
    input.addEventListener('change', function () { clearError(input); });
  });

  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var ok = true;
    var data = {};
    form.querySelectorAll('.inp, .sel, .ta').forEach(function (input) {
      data[input.name] = (input.value || '').trim();
    });

    if (!data.name) { setError('name', 'Please tell us your name.'); ok = false; }
    if (!data.email) { setError('email', 'We need an email to reach you.'); ok = false; }
    else if (!isEmail(data.email)) { setError('email', 'That email doesn’t look right.'); ok = false; }
    if (!data.business) { setError('business', 'What’s your business called?'); ok = false; }
    if (!data.revenue) { setError('revenue', 'Pick a range so we point you to the right plan.'); ok = false; }

    if (!ok) {
      var firstErr = form.querySelector('.err');
      if (firstErr && firstErr.focus) firstErr.focus({ preventScroll: false });
      return;
    }

    var planLabel = data.goal ? data.goal : 'Not sure yet, help me figure it out';
    var when = data.timeframe ? data.timeframe : 'Flexible';
    var echo = document.getElementById('success-echo');
    if (echo) {
      echo.textContent = data.name + ' · ' + data.business + '  ·  ' + planLabel + '  ·  ' + when;
    }

    /* Send lead to GoHighLevel */
    fetch('https://services.leadconnectorhq.com/hooks/83NztwuzwKcB7h8fQQkh/webhook-trigger/4443b4fb-c762-4bbd-b2f4-271ed028c9cc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        phone: '',
        companyName: data.business,
        website: data.website,
        monthlyRevenue: data.revenue,
        timeframe: data.timeframe,
        goal: data.goal,
        message: data.about,
        source: 'VCC Website'
      })
    }).catch(function () {});

    form.style.display = 'none';
    success.classList.add('show');
    success.setAttribute('tabindex', '-1');
    success.focus({ preventScroll: true });
  });
})();
