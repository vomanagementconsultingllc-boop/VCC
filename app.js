/* =============================================================
   VO CREATIVE CO. — Website interactions
   Sticky nav, mobile menu, scroll reveal, hover-play clips,
   booking form validation + success state.
   ============================================================= */
(function () {
  'use strict';

  /* ---- Hover-to-play clips (About principles) ---- */
  document.querySelectorAll('[data-hovervid]').forEach(function (box) {
    var v = box.querySelector('video');
    if (!v) return;
    box.addEventListener('mouseenter', function () {
      v.play().catch(function () {});
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

    form.style.display = 'none';
    success.classList.add('show');
    success.setAttribute('tabindex', '-1');
    success.focus({ preventScroll: true });
  });
})();
