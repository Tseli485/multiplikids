/* ============================================================
   MultipliKids — visual.js
   Confettis (canvas vanilla), shake, toast badge, décor de fond.
   Respecte prefers-reduced-motion.
   ============================================================ */
(function () {
  'use strict';
  window.MK = window.MK || {};

  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let canvas = null, ctx = null, particles = [], rafId = null;

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  const COLORS = ['#FF6B35', '#4ECDC4', '#FFE66D', '#06D6A0', '#EF476F', '#fff'];

  // Lance une explosion de confettis
  function confetti(count) {
    if (reduced) return;
    ensureCanvas();
    count = count || 90;
    const cx = window.innerWidth / 2;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: cx + (Math.random() - 0.5) * 200,
        y: window.innerHeight * 0.35,
        vx: (Math.random() - 0.5) * 9,
        vy: Math.random() * -10 - 4,
        size: Math.random() * 8 + 4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.3,
        life: 1,
      });
    }
    if (!rafId) loop();
  }

  function loop() {
    rafId = requestAnimationFrame(loop);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const grav = 0.35;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += grav;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vrot;
      p.life -= 0.008;
      if (p.life <= 0 || p.y > canvas.height + 30) { particles.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (particles.length === 0) { cancelAnimationFrame(rafId); rafId = null; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  // Effet shake sur un élément
  function shake(el) {
    if (!el || reduced) return;
    el.classList.remove('shake');
    void el.offsetWidth; // reflow pour relancer l'animation
    el.classList.add('shake');
    setTimeout(function () { el.classList.remove('shake'); }, 450);
  }

  // Toast "badge débloqué"
  let toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }

  // Génère le décor de fond selon le thème
  function buildDecor(theme) {
    const host = document.getElementById('bg-decor');
    if (!host) return;
    host.innerHTML = '';
    if (reduced) return;
    if (theme === 'ocean') {
      for (let i = 0; i < 18; i++) {
        const b = document.createElement('div');
        b.className = 'bubble';
        const s = Math.random() * 26 + 8;
        b.style.width = s + 'px'; b.style.height = s + 'px';
        b.style.left = (Math.random() * 100) + '%';
        b.style.animationDuration = (Math.random() * 8 + 6) + 's';
        b.style.animationDelay = (Math.random() * 6) + 's';
        host.appendChild(b);
      }
    } else if (theme === 'jungle') {
      const leaves = ['🍃', '🌿', '🍀'];
      for (let i = 0; i < 14; i++) {
        const l = document.createElement('div');
        l.className = 'leaf';
        l.textContent = leaves[i % leaves.length];
        l.style.left = (Math.random() * 100) + '%';
        l.style.top = (Math.random() * 100) + '%';
        l.style.animationDuration = (Math.random() * 4 + 3) + 's';
        l.style.animationDelay = (Math.random() * 4) + 's';
        host.appendChild(l);
      }
    } else { // space
      for (let i = 0; i < 60; i++) {
        const s = document.createElement('div');
        s.className = 'star';
        s.style.left = (Math.random() * 100) + '%';
        s.style.top = (Math.random() * 100) + '%';
        const sc = Math.random() * 1.6 + 0.4;
        s.style.transform = 'scale(' + sc + ')';
        s.style.animationDelay = (Math.random() * 3) + 's';
        host.appendChild(s);
      }
    }
  }

  window.MK.visual = { confetti: confetti, shake: shake, toast: toast, buildDecor: buildDecor, reduced: reduced };
})();
