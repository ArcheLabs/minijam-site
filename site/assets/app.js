/* MiniJAM — homepage motion field
   Canvas curves, glowing runners, ambient particles, pointer disturbance
   and scroll-driven rectangle split. No external dependencies. */

(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const root = document.documentElement;
  const hero = document.getElementById('hero');
  const sticky = document.getElementById('heroSticky');
  const canvas = document.getElementById('motionField');
  if (!hero || !sticky || !canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  const rectEls = [...document.querySelectorAll('.field-rect')];
  const navEl = document.querySelector('.nav');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const state = {
    w: innerWidth,
    h: innerHeight,
    dpr: Math.min(devicePixelRatio || 1, 2),
    heroProgress: 0,
    last: performance.now(),
    nextRunnerAt: performance.now() + 1000,
    pointerInside: false,
    pointerDownTimer: undefined,
    pageVisible: document.visibilityState === 'visible',
    particles: [],
    runners: [],
    pulses: []
  };

  const mouse = {
    x: state.w * .5, y: state.h * .5,
    tx: state.w * .5, ty: state.h * .5,
    auraX: state.w * .5, auraY: state.h * .5,
    vx: 0, vy: 0
  };

  const runnerPalettes = [
    { core: '247,253,255', mid: '91,198,246', glow: '0,159,232' },
    { core: '255,247,247', mid: '239,92,95', glow: '214,21,24' }
  ];

  const curveDefs = [
    { base: .17, amp1: .035, amp2: .014, f1: 1.20, f2: 2.70, speed: .00013, phase: .4 },
    { base: .31, amp1: .047, amp2: .018, f1: 1.55, f2: 3.25, speed: -.00010, phase: 2.1 },
    { base: .47, amp1: .031, amp2: .020, f1: 1.05, f2: 2.10, speed: .00009, phase: 4.3 },
    { base: .64, amp1: .052, amp2: .015, f1: 1.72, f2: 3.70, speed: -.00012, phase: 1.4 },
    { base: .80, amp1: .037, amp2: .022, f1: 1.32, f2: 2.45, speed: .00011, phase: 5.3 }
  ];

  /* ---------- Setup ---------- */

  function createAmbientParticles() {
    const count = reduced ? 65 : (state.w < 760 ? 110 : 190);
    state.particles = Array.from({ length: count }, () => ({
      x: Math.random() * state.w,
      y: Math.random() * state.h,
      vx: (Math.random() - .5) * .10,
      vy: (Math.random() - .5) * .10,
      size: .45 + Math.random() * 1.25,
      alpha: .10 + Math.random() * .34,
      phase: Math.random() * TAU,
      field: .45 + Math.random() * 1.1,
      glow: 0,
      tint: Math.random() < .13 ? 1 : 0,
      tail: Math.random() < .22
    }));
  }

  function resizeCanvas() {
    state.w = innerWidth;
    state.h = innerHeight;
    state.dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(state.w * state.dpr);
    canvas.height = Math.round(state.h * state.dpr);
    canvas.style.width = `${state.w}px`;
    canvas.style.height = `${state.h}px`;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    createAmbientParticles();
  }

  /* ---------- Curves ---------- */

  function curvePoint(index, u, time) {
    const c = curveDefs[index];
    const uu = Math.max(-.1, Math.min(1.1, u));
    const x = -state.w * .08 + uu * state.w * 1.16;
    const slow = time * c.speed;
    const edge = Math.sin(Math.PI * Math.max(0, Math.min(1, uu)));
    const yNorm = c.base
      + Math.sin(uu * TAU * c.f1 + slow + c.phase) * c.amp1 * (.65 + edge * .35)
      + Math.sin(uu * TAU * c.f2 - slow * 1.61 + c.phase * .7) * c.amp2
      + Math.sin(time * .00018 + index * 1.33) * .008;
    return { x, y: yNorm * state.h };
  }

  function nearestCurveIndex(x, y, time) {
    let best = 0;
    let bestD = Infinity;
    const u = (x / state.w + .08) / 1.16;
    curveDefs.forEach((_, i) => {
      const p = curvePoint(i, u, time);
      const d = Math.abs(p.y - y);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  /* ---------- Runners ---------- */

  function spawnRunner({ curve, start = -.04, direction = 1, duration, energy = 1, tone } = {}) {
    const index = curve ?? Math.floor(Math.random() * curveDefs.length);
    const dir = direction >= 0 ? 1 : -1;
    state.runners.push({
      curve: index,
      u: start,
      direction: dir,
      duration: duration ?? (900 + Math.random() * 520),
      energy,
      tone: tone ?? (Math.random() < .18 ? 1 : 0),
      trail: []
    });
  }

  function automaticRunner(time) {
    if (reduced || time < state.nextRunnerAt || state.heroProgress > .82) return;
    const direction = Math.random() < .82 ? 1 : -1;
    spawnRunner({ start: direction > 0 ? -.04 : 1.04, direction });
    if (Math.random() < .22) {
      spawnRunner({
        curve: Math.floor(Math.random() * curveDefs.length),
        start: direction > 0 ? -.10 : 1.10,
        direction,
        duration: 1150 + Math.random() * 300,
        energy: .72
      });
    }
    state.nextRunnerAt = time + 1900 + Math.random() * 2600;
  }

  function updateRunners(time, dt) {
    const frame = dt / 16.667;
    for (let i = state.runners.length - 1; i >= 0; i--) {
      const r = state.runners[i];
      r.u += r.direction * dt / r.duration;
      const point = curvePoint(r.curve, r.u, time);
      r.trail.unshift(point);
      if (r.trail.length > 36) r.trail.pop();
      disturbParticles(point.x, point.y, 118 * r.energy, .20 * r.energy, .045 * r.direction, frame, 1.28 * r.energy);

      if ((r.direction > 0 && r.u > 1.09) || (r.direction < 0 && r.u < -.09)) {
        state.runners.splice(i, 1);
      }
    }
  }

  /* ---------- Particles ---------- */

  function disturbParticles(cx, cy, radius, force, swirl, dt, light = 1) {
    const r2 = radius * radius;
    for (const p of state.particles) {
      let dx = p.x - cx;
      let dy = p.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r2 || d2 < .01) continue;
      const d = Math.sqrt(d2);
      const falloff = 1 - d / radius;
      dx /= d; dy /= d;
      const scale = force * falloff * falloff * dt;
      p.vx += (dx * scale - dy * swirl * falloff * dt);
      p.vy += (dy * scale + dx * swirl * falloff * dt);
      p.glow = Math.max(p.glow, falloff * light);
    }
  }

  function applyPointerInfluence(frame) {
    if (!state.pointerInside || state.heroProgress >= .9 || reduced) return;
    const speed = Math.hypot(mouse.vx, mouse.vy);
    disturbParticles(mouse.x, mouse.y, 152, .085 + speed * .005, .028 + speed * .0014, frame, .78);
  }

  function updateParticles(time, dt) {
    const frame = Math.min(2.2, dt / 16.667);
    applyPointerInfluence(frame);

    for (const p of state.particles) {
      const fieldAngle =
        Math.sin(p.x * .0031 + time * .00024 + p.phase) * 1.7 +
        Math.cos(p.y * .0042 - time * .00019 + p.phase * 1.31) * 1.15;
      const fieldStrength = .0045 * p.field * frame;
      p.vx += Math.cos(fieldAngle) * fieldStrength;
      p.vy += Math.sin(fieldAngle) * fieldStrength;

      const damping = Math.pow(.982, frame);
      p.vx *= damping;
      p.vy *= damping;
      const maxV = 2.8;
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > maxV) { p.vx *= maxV / speed; p.vy *= maxV / speed; }

      p.x += p.vx * frame;
      p.y += p.vy * frame;
      p.glow *= Math.pow(.94, frame);

      const pad = 12;
      if (p.x < -pad) p.x = state.w + pad;
      if (p.x > state.w + pad) p.x = -pad;
      if (p.y < -pad) p.y = state.h + pad;
      if (p.y > state.h + pad) p.y = -pad;
    }
  }

  /* ---------- Pulses ---------- */

  function updatePulses(dt) {
    for (let i = state.pulses.length - 1; i >= 0; i--) {
      state.pulses[i].life += dt;
      if (state.pulses[i].life > state.pulses[i].duration) state.pulses.splice(i, 1);
    }
  }

  /* ---------- Rectangles ---------- */

  function updateRectangles(time) {
    if (!rectEls.length) return;
    const runnerPoints = state.runners.map(r => curvePoint(r.curve, r.u, time));

    rectEls.forEach((el, index) => {
      const box = el.getBoundingClientRect();
      const cx = box.left + box.width * .5;
      const cy = box.top + box.height * .5;
      const phase = index * 1.91;

      let shiftX = Math.sin(time * (.00020 + index * .000018) + phase) * (4.8 + index * 1.2);
      let shiftY = Math.cos(time * (.00016 + index * .000015) + phase * .8) * (7.5 - index * .8);
      let rotation = Math.sin(time * .00012 + phase) * (.42 + index * .09);
      let energy = .035 + Math.sin(time * .00042 + phase) * .015;
      let impactX = 50;
      let impactY = 50;

      if (state.pointerInside && state.heroProgress < .88 && !reduced) {
        const dx = cx - mouse.x;
        const dy = cy - mouse.y;
        const dist = Math.hypot(dx, dy);
        const radius = 330;
        if (dist < radius && dist > .1) {
          const f = 1 - dist / radius;
          shiftX += dx / dist * f * 10;
          shiftY += dy / dist * f * 8;
          rotation += (mouse.x - cx) / radius * f * .8;
          energy = Math.max(energy, f * .30);
          impactX = ((mouse.x - box.left) / box.width) * 100;
          impactY = ((mouse.y - box.top) / box.height) * 100;
        }
      }

      for (const p of runnerPoints) {
        const dx = cx - p.x;
        const dy = cy - p.y;
        const dist = Math.hypot(dx, dy);
        const radius = Math.max(230, Math.min(360, box.height * .72));
        if (dist < radius && dist > .1) {
          const f = 1 - dist / radius;
          shiftX += dx / dist * f * 13;
          shiftY += dy / dist * f * 10;
          rotation += (p.x < cx ? 1 : -1) * f * .7;
          energy = Math.max(energy, Math.min(1, f * 1.2));
          impactX = ((p.x - box.left) / box.width) * 100;
          impactY = ((p.y - box.top) / box.height) * 100;
        }
      }

      const split = Math.max(0, Math.min(1, (state.heroProgress - .12) / .76));
      const splitEase = 1 - Math.pow(1 - split, 3);
      const splitDistance = Math.min(280, state.w * .19);
      const scrollShiftX = (index - 1) * splitEase * splitDistance;
      const scrollShiftY = splitEase * (index === 1 ? -54 : 38);
      const scrollRotation = splitEase * (index - 1) * 1.35;
      const scrollScale = 1 + Math.max(0, state.heroProgress - .42) * .055;

      impactX = Math.max(-20, Math.min(120, impactX));
      impactY = Math.max(-20, Math.min(120, impactY));
      const scanY = (time * (.014 + index * .0018) + index * 29) % 130 - 15;

      el.style.transform = `translate3d(${(shiftX + scrollShiftX).toFixed(2)}px, ${(shiftY + scrollShiftY).toFixed(2)}px, 0) rotate(${(rotation + scrollRotation).toFixed(3)}deg) scale(${scrollScale.toFixed(4)})`;
      el.style.setProperty('--energy', Math.max(0, Math.min(1, energy)).toFixed(3));
      el.style.setProperty('--impact-x', `${impactX.toFixed(1)}%`);
      el.style.setProperty('--impact-y', `${impactY.toFixed(1)}%`);
      el.style.setProperty('--scan-y', `${scanY.toFixed(1)}%`);
    });
  }

  /* ---------- Drawing ---------- */

  function drawCurves(time, fade) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    curveDefs.forEach((_, index) => {
      const points = [];
      const steps = Math.max(90, Math.round(state.w / 11));
      for (let i = 0; i <= steps; i++) points.push(curvePoint(index, i / steps, time));

      ctx.beginPath();
      points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.strokeStyle = `rgba(89,97,102,${.034 * fade})`;
      ctx.lineWidth = 10;
      ctx.stroke();

      ctx.beginPath();
      points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.strokeStyle = `rgba(${index === 3 ? '128,82,85' : '122,151,164'},${(.14 + index * .008) * fade})`;
      ctx.lineWidth = .65;
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawParticles(fade) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const p of state.particles) {
      const glow = p.glow;
      const a = (p.alpha + glow * .53) * fade;
      if (p.tail && Math.hypot(p.vx, p.vy) > .45) {
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * 3.8, p.y - p.vy * 3.8);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = `rgba(${p.tint ? '230,102,105' : '123,200,235'},${a * .46})`;
        ctx.lineWidth = .45 + glow * .45;
        ctx.stroke();
      }
      if (glow > .08) {
        const radius = 4 + glow * 12;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
        g.addColorStop(0, `rgba(${p.tint ? '238,92,95' : '68,189,241'},${glow * .18 * fade})`);
        g.addColorStop(1, `rgba(${p.tint ? '214,21,24' : '0,159,232'},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = `rgba(${glow > .15 ? (p.tint ? '246,122,124' : '116,211,250') : '203,211,214'},${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size + glow * .65, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRunners(time, fade) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const r of state.runners) {
      const palette = runnerPalettes[r.tone] || runnerPalettes[0];
      if (r.trail.length > 1) {
        for (let i = r.trail.length - 1; i > 0; i--) {
          const a = 1 - i / r.trail.length;
          const p0 = r.trail[i];
          const p1 = r.trail[i - 1];
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.strokeStyle = `rgba(${palette.glow},${a * a * .56 * r.energy * fade})`;
          ctx.lineWidth = .65 + a * 2.4 * r.energy;
          ctx.stroke();
        }
      }

      const p = curvePoint(r.curve, r.u, time);
      const radius = 24 + r.energy * 17;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      g.addColorStop(0, `rgba(${palette.core},${.97 * fade})`);
      g.addColorStop(.12, `rgba(${palette.mid},${.82 * fade})`);
      g.addColorStop(.48, `rgba(${palette.glow},${.22 * fade})`);
      g.addColorStop(1, `rgba(${palette.glow},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, TAU);
      ctx.fill();

      ctx.fillStyle = `rgba(${palette.core},${fade})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.7 + r.energy, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPulses(fade) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const pulse of state.pulses) {
      const u = pulse.life / pulse.duration;
      const radius = 12 + u * 125;
      ctx.beginPath();
      ctx.arc(pulse.x, pulse.y, radius, 0, TAU);
      ctx.strokeStyle = `rgba(${pulse.tone ? '214,21,24' : '0,159,232'},${(1 - u) * .24 * fade})`;
      ctx.lineWidth = .7;
      ctx.stroke();
    }
    ctx.restore();
  }

  function renderFrame(time) {
    ctx.clearRect(0, 0, state.w, state.h);
    const fade = Math.max(0, 1 - state.heroProgress * 1.16);
    if (fade <= .001) return;
    drawCurves(time, fade);
    drawParticles(fade);
    drawRunners(time, fade);
    drawPulses(fade);
  }

  /* ---------- Scroll & pointer ---------- */

  function updateScrollState() {
    const max = Math.max(1, hero.offsetHeight - innerHeight);
    state.heroProgress = Math.max(0, Math.min(1, scrollY / max));
    root.style.setProperty('--hero-progress', state.heroProgress.toFixed(4));
  }

  function pointerMove(e) {
    const rect = sticky.getBoundingClientRect();
    state.pointerInside = e.clientY >= rect.top && e.clientY <= rect.bottom && state.heroProgress < .98;
    mouse.tx = e.clientX;
    mouse.ty = e.clientY;
    root.style.setProperty('--cursor-x', `${e.clientX}px`);
    root.style.setProperty('--cursor-y', `${e.clientY}px`);
    if (navEl) {
      const navOpacity = Math.max(.72, 1 - e.clientY / 220);
      navEl.style.setProperty('--nav-opacity', navOpacity.toFixed(3));
    }
  }

  function pointerDown(e) {
    if (!state.pointerInside || state.heroProgress > .88) return;
    document.body.classList.add('pointer-down');
    clearTimeout(state.pointerDownTimer);
    state.pointerDownTimer = setTimeout(() => document.body.classList.remove('pointer-down'), 520);

    const curve = nearestCurveIndex(e.clientX, e.clientY, performance.now());
    const u = Math.max(-.02, Math.min(.96, (e.clientX / state.w + .08) / 1.16));
    const direction = e.clientX < state.w * .86 ? 1 : -1;
    const tone = Math.random() < .28 ? 1 : 0;
    spawnRunner({ curve, start: u, direction, duration: 820 + Math.random() * 260, energy: 1.15, tone });
    state.pulses.push({ x: e.clientX, y: e.clientY, life: 0, duration: 720, tone });
    disturbParticles(e.clientX, e.clientY, 185, .34, .065, 1.5, 1.2);
  }

  /* ---------- Main loop ---------- */

  function animate(time) {
    const dt = Math.min(34, time - state.last || 16.667);
    state.last = time;

    mouse.vx = (mouse.tx - mouse.x) * .10;
    mouse.vy = (mouse.ty - mouse.y) * .10;
    mouse.x += mouse.vx;
    mouse.y += mouse.vy;
    mouse.auraX += (mouse.tx - mouse.auraX) * .13;
    mouse.auraY += (mouse.ty - mouse.auraY) * .13;
    root.style.setProperty('--aura-x', `${mouse.auraX}px`);
    root.style.setProperty('--aura-y', `${mouse.auraY}px`);

    automaticRunner(time);
    updateParticles(time, dt);
    updateRunners(time, dt);
    updatePulses(dt);
    updateRectangles(time);
    renderFrame(time);

    if (state.pageVisible) requestAnimationFrame(animate);
  }

  function handleVisibilityChange() {
    state.pageVisible = document.visibilityState === 'visible';
    if (state.pageVisible) {
      state.last = performance.now();
      requestAnimationFrame(animate);
    }
  }

  /* ---------- Init ---------- */

  function init() {
    const stageEls = [...document.querySelectorAll('.stage')];
    function revealInitiallyVisibleStages() {
      const viewportH = innerHeight || document.documentElement.clientHeight;
      stageEls.forEach(el => {
        const rect = el.getBoundingClientRect();
        const visible = Math.min(rect.bottom, viewportH) - Math.max(rect.top, 0);
        if (visible > Math.min(rect.height * .35, viewportH * .32)) el.classList.add('visible');
      });
    }

    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
      });
    }, { threshold: .42 });
    stageEls.forEach(el => io.observe(el));

    addEventListener('resize', resizeCanvas, { passive: true });
    addEventListener('scroll', updateScrollState, { passive: true });
    addEventListener('pointermove', pointerMove, { passive: true });
    addEventListener('pointerdown', pointerDown, { passive: true });
    addEventListener('pointerup', () => document.body.classList.remove('pointer-down'), { passive: true });
    addEventListener('pointerleave', () => { state.pointerInside = false; }, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    resizeCanvas();
    updateScrollState();
    requestAnimationFrame(revealInitiallyVisibleStages);
    if (!reduced) {
      spawnRunner({ curve: 2, start: -.04, direction: 1, duration: 1120, energy: 1, tone: 0 });
    }
    requestAnimationFrame(animate);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
