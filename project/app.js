/* =============================================================
   VO CREATIVE CO. — Website interactions
   Vanilla JS: sticky nav, mobile menu, scroll reveal,
   tier pre-select, booking form validation + success state.
   ============================================================= */
(function () {
  'use strict';

  /* ---- Background videos: attach each only once its file exists ---- */
  document.querySelectorAll('video[data-sources]').forEach(function (hv) {
    var cands = hv.dataset.sources.split(',').map(function (s) {
      var p = s.split('|'); return { url: p[0], type: p[1] };
    });
    var checked = 0, attached = 0;
    cands.forEach(function (c) {
      fetch(c.url, { method: 'GET', headers: { Range: 'bytes=0-1' }, cache: 'no-store' }).then(function (r) {
        if (r.ok || r.status === 206) { var s = document.createElement('source'); s.src = c.url; s.type = c.type; hv.appendChild(s); attached++; }
      }).catch(function () {}).finally(function () {
        checked++;
        if (checked === cands.length && attached) {
          try { hv.load(); if (!hv.hasAttribute('data-hoverplay')) { hv.play().catch(function () {}); } } catch (e) {}
        }
      });
    });
  });

  /* ---- Hover-to-play clips (About principles) ---- */
  document.querySelectorAll('[data-hovervid]').forEach(function (box) {
    var v = box.querySelector('video');
    if (!v) return;
    box.addEventListener('mouseenter', function () {
      if (v.querySelector('source')) { v.play().catch(function () {}); }
    });
    box.addEventListener('mouseleave', function () {
      v.pause();
      try { v.currentTime = 0; } catch (e) {}
    });
  });

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

  /* ---- Tier "choose" buttons pre-select the plan in the form ---- */
  var planSelect = document.getElementById('f-plan');
  document.querySelectorAll('[data-choose-plan]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var val = btn.getAttribute('data-choose-plan');
      if (planSelect) {
        planSelect.value = val;
        planSelect.classList.remove('err');
        planSelect.dispatchEvent(new Event('change'));
      }
    });
  });

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
    else if (!isEmail(data.email)) { setError('email', 'That email doesn\u2019t look right.'); ok = false; }
    if (!data.business) { setError('business', 'What\u2019s your business called?'); ok = false; }
    if (!data.revenue) { setError('revenue', 'Pick a range so we point you to the right plan.'); ok = false; }

    if (!ok) {
      var firstErr = form.querySelector('.err');
      if (firstErr && firstErr.focus) firstErr.focus({ preventScroll: false });
      return;
    }

    /* Build the confirmation echo */
    var planLabel = data.goal ? data.goal : 'Not sure yet, help me figure it out';
    var when = data.timeframe ? data.timeframe : 'Flexible';
    var echo = document.getElementById('success-echo');
    if (echo) {
      echo.textContent = data.name + ' \u00b7 ' + data.business + '  \u00b7  ' + planLabel + '  \u00b7  ' + when;
    }

    form.style.display = 'none';
    success.classList.add('show');
    success.setAttribute('tabindex', '-1');
    success.focus({ preventScroll: true });
  });
})();
