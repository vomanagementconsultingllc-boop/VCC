/* Vo Creative Studio: waitlist page */
(function () {
  'use strict';

  /* Paste the Discord invite link here to show a "join now" button after signup. */
  var DISCORD_INVITE_URL = '';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var seg = function (p, a, b) { return clamp((p - a) / (b - a), 0, 1); };
  var ease = function (t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- nav state ---------- */
  var nav = document.getElementById('nav');
  var sheet = document.getElementById('blueprint');

  /* ---------- the stage: one long background ---------- */
  var city = document.getElementById('city');
  var stage = document.getElementById('stage');
  var photo = stage.querySelector('.stage-photo');
  var lines = stage.querySelector('.stage-lines');
  var blue = stage.querySelector('.stage-blue');
  var scrim = stage.querySelector('.stage-scrim');

  var m = { vh: 0, top: 0, h: 0, stageH: 0, imgH: 0, sheetTop: 0 };
  function measure() {
    m.vh = window.innerHeight;
    m.top = city.getBoundingClientRect().top + window.scrollY;
    m.h = city.offsetHeight;
    m.stageH = stage.offsetHeight;
    m.imgH = photo.offsetHeight;
    m.sheetTop = sheet.getBoundingClientRect().top + window.scrollY;
  }

  function loadLines() {
    if (lines.getAttribute('srcset')) return;
    lines.setAttribute('srcset', lines.getAttribute('data-srcset'));
  }

  var ticking = false;
  function update() {
    ticking = false;
    var y = window.scrollY;

    var p = clamp((y - m.top) / Math.max(1, m.h - m.vh), 0, 1);
    nav.classList.toggle('is-solid', y > 24);
    nav.classList.toggle('on-sheet', p > .9 || y + nav.offsetHeight >= m.sheetTop);
    // 0 → .78: ride down the tower. .66 → .86: lines draw in. .80 → .97: flood blue.
    var pan = reduceMotion ? 0 : -(m.imgH - m.stageH) * ease(seg(p, 0, .78));
    var t = 'translate3d(0,' + pan.toFixed(1) + 'px,0)';
    photo.style.transform = t;
    lines.style.transform = t;

    var l = seg(p, .62, .84);
    var b = seg(p, .8, .97);
    if (l > 0) loadLines();
    photo.style.opacity = (1 - seg(p, .7, .9)).toFixed(3);
    lines.style.opacity = (l * (1 - .6 * b)).toFixed(3);
    blue.style.opacity = b.toFixed(3);
    scrim.style.opacity = (1 - b).toFixed(3);
  }
  function onScroll() {
    if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
  }

  measure();
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { measure(); update(); });
  window.addEventListener('load', function () {
    measure(); update();
    // fetch the line drawing once the page has settled
    window.setTimeout(loadLines, 600);
  });
  photo.addEventListener('load', function () { measure(); update(); });

  /* ---------- scroll reveals ---------- */
  var revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- floor plan: draw-in + rooms ---------- */
  var plan = document.getElementById('plan');
  var svg = plan.querySelector('svg');

  function prepDraw(root) {
    var els = root.querySelectorAll('.ln');
    var list = [];
    els.forEach(function (el) {
      var len = 0;
      try { len = el.getTotalLength(); } catch (err) { len = 0; }
      if (!len) return;
      el.style.strokeDasharray = len + ' ' + len;
      el.style.strokeDashoffset = String(len);
      list.push(el);
    });
    return list;
  }
  function runDraw(list, total) {
    list.forEach(function (el, i) {
      var isWall = el.classList.contains('wall');
      var delay = isWall ? (i / list.length) * 500 : 350 + (i / list.length) * total;
      el.style.transition = 'stroke-dashoffset ' + (isWall ? 1100 : 900) + 'ms cubic-bezier(.4,.1,.2,1) ' + Math.round(delay) + 'ms';
      el.style.strokeDashoffset = '0';
    });
    // clear the dash styles once drawn so strokes render crisp
    window.setTimeout(function () {
      list.forEach(function (el) {
        el.style.transition = '';
        el.style.strokeDasharray = '';
        el.style.strokeDashoffset = '';
      });
    }, total + 2400);
  }

  var skylineSvg = document.querySelector('.skyline-svg');

  if (!reduceMotion && 'IntersectionObserver' in window) {
    var planLines = prepDraw(svg);
    var skyLines = skylineSvg ? prepDraw(skylineSvg) : [];
    var drawIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        if (e.target === plan) {
          plan.classList.add('is-drawn');
          runDraw(planLines, 1300);
        } else {
          runDraw(skyLines, 1100);
        }
        drawIo.unobserve(e.target);
      });
    }, { threshold: 0.25 });
    drawIo.observe(plan);
    if (skylineSvg) drawIo.observe(skylineSvg);
  } else {
    plan.classList.add('is-drawn');
  }

  var roomBtns = Array.prototype.slice.call(document.querySelectorAll('.room'));
  var hits = Array.prototype.slice.call(svg.querySelectorAll('.hit'));
  var tags = Array.prototype.slice.call(svg.querySelectorAll('.tag'));

  function mark(list, id, cls) {
    list.forEach(function (el) { el.classList.toggle(cls, el.getAttribute('data-room') === id); });
  }
  function setActive(id, fromPlan) {
    roomBtns.forEach(function (b) {
      var on = b.getAttribute('data-room') === id;
      b.setAttribute('aria-expanded', on ? 'true' : 'false');
      b.parentElement.classList.toggle('is-active', on);
      if (on && fromPlan && window.matchMedia('(max-width: 1080px)').matches) {
        b.parentElement.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    });
    mark(hits, id, 'is-active');
    mark(tags, id, 'is-active');
  }
  function preview(id) { mark(hits, id, 'is-hover'); }

  roomBtns.forEach(function (b) {
    var id = b.getAttribute('data-room');
    b.addEventListener('click', function () { setActive(id, false); });
    b.addEventListener('mouseenter', function () { preview(id); });
    b.addEventListener('mouseleave', function () { preview(null); });
    b.addEventListener('focus', function () { preview(id); });
    b.addEventListener('blur', function () { preview(null); });
  });
  hits.forEach(function (h) {
    var id = h.getAttribute('data-room');
    h.addEventListener('click', function () { setActive(id, true); });
    h.addEventListener('mouseenter', function () { preview(id); });
    h.addEventListener('mouseleave', function () { preview(null); });
  });
  setActive('01', false);

  /* ---------- waitlist form ---------- */
  var form = document.getElementById('waitlist-form');
  var success = document.getElementById('success');
  var submitBtn = document.getElementById('f-submit');
  var formErr = document.getElementById('form-err');
  var fName = document.getElementById('f-name');
  var fEmail = document.getElementById('f-email');
  var fPhone = document.getElementById('f-phone');
  var fOptin = document.getElementById('f-optin');
  var optinLabel = document.getElementById('optin-label');
  var submitHTML = submitBtn.innerHTML;

  function digits(v) { return (v || '').replace(/\D/g, ''); }
  function usDigits(v) {
    var d = digits(v);
    if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
    return d;
  }
  function formatPhone(v) {
    var d = usDigits(v);
    if (d.length !== 10) return v.trim();
    return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
  }

  var rules = [
    { el: fName, msg: 'Add your name.', ok: function (v) { return v.trim().length >= 2; } },
    { el: fEmail, msg: 'Enter a valid email, like you@yourbusiness.com.', ok: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); } },
    { el: fPhone, msg: 'Enter a 10-digit phone number.', ok: function (v) { return usDigits(v).length === 10; } }
  ];
  function setErr(rule, show) {
    var box = document.getElementById(rule.el.getAttribute('aria-describedby'));
    rule.el.setAttribute('aria-invalid', show ? 'true' : 'false');
    box.textContent = show ? rule.msg : '';
  }
  function validate() {
    var first = null;
    rules.forEach(function (r) {
      var bad = !r.ok(r.el.value);
      setErr(r, bad);
      if (bad && !first) first = r.el;
    });
    if (first) first.focus();
    return !first;
  }
  rules.forEach(function (r) {
    r.el.addEventListener('input', function () {
      if (r.el.getAttribute('aria-invalid') === 'true' && r.ok(r.el.value)) setErr(r, false);
    });
  });
  fPhone.addEventListener('blur', function () { if (fPhone.value) fPhone.value = formatPhone(fPhone.value); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    formErr.hidden = true;
    if (!validate()) return;

    var hp = form.querySelector('[name="bot-field"]');
    var body = new URLSearchParams();
    body.append('form-name', 'studio-waitlist');
    body.append('name', fName.value.trim());
    body.append('email', fEmail.value.trim());
    body.append('phone', formatPhone(fPhone.value));
    body.append('marketing_opt_in', fOptin.checked ? 'yes' : 'no');
    body.append('consent_language', fOptin.checked ? optinLabel.textContent.trim() : '');
    body.append('source', (window.location.search.slice(1) || document.referrer || 'direct').slice(0, 300));
    body.append('bot-field', hp ? hp.value : '');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      showSuccess();
    }).catch(function () {
      submitBtn.disabled = false;
      submitBtn.innerHTML = submitHTML;
      formErr.hidden = false;
    });
  });

  function showSuccess() {
    var first = fName.value.trim().split(/\s+/)[0];
    document.getElementById('s-name').textContent = first || 'founder';
    document.getElementById('s-email').textContent = fEmail.value.trim();
    var discord = document.getElementById('s-discord');
    if (DISCORD_INVITE_URL) { discord.href = DISCORD_INVITE_URL; discord.hidden = false; }
    form.hidden = true;
    success.hidden = false;
    success.focus({ preventScroll: true });
    measure();
  }
})();
