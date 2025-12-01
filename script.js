const canvas = document.getElementById('pixel-canvas');
const ctx = canvas.getContext('2d');

const palette = {
  bg1: getComputedStyle(document.documentElement).getPropertyValue('--bg-dark-1').trim(),
  bg2: getComputedStyle(document.documentElement).getPropertyValue('--bg-dark-2').trim(),
  accent1: getComputedStyle(document.documentElement).getPropertyValue('--accent-1').trim(),
  accent2: getComputedStyle(document.documentElement).getPropertyValue('--accent-2').trim(),
  accent3: getComputedStyle(document.documentElement).getPropertyValue('--accent-3').trim(),
};

const baseRgb = [palette.bg1, palette.bg2].map(hexToRgb);
const glowRgb = [palette.accent1, palette.accent2, palette.accent3].map(hexToRgb);

let cellSize = 8;
let minDim = 0;
const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
let focusRadius = 120;
let haloRadius = 1100;
let lastTime = 0;

const bubbles = [];
const pointerBubble = { radius: 0.08, color: glowRgb[1] };
const ripple = { freq: 0.035, speed: 0.0024, amp: 0.14 };

const physics = {
  sticky: 0.18,
  drag: 0.95,
  maxSpeed: 120,
};

function resizeCanvas() {
  const prevWidth = canvas.width || window.innerWidth;
  const prevHeight = canvas.height || window.innerHeight;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const maxDimension = Math.max(canvas.width, canvas.height);
  minDim = Math.min(canvas.width, canvas.height);
  cellSize = Math.max(4, Math.min(8, Math.floor(maxDimension / 180)));
  focusRadius = Math.hypot(canvas.width, canvas.height) * 0.014;
  haloRadius = Math.hypot(canvas.width, canvas.height) * 0.22;

  if (mouse.x === 0 && mouse.y === 0 && mouse.targetX === 0 && mouse.targetY === 0) {
    mouse.x = mouse.targetX = canvas.width / 2;
    mouse.y = mouse.targetY = canvas.height / 2;
  }

  if (!bubbles.length) {
    initBubbles();
  } else {
    scaleBubbles(prevWidth, prevHeight);
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

function initBubbles() {
  const count = 6;
  for (let i = 0; i < count; i++) {
    const ratio = 0.04 + Math.random() * 0.02;
    const radius = minDim * ratio;
    bubbles.push({
      x: canvas.width * (0.2 + Math.random() * 0.6),
      y: canvas.height * (0.2 + Math.random() * 0.6),
      radius,
      ratio,
      vx: (Math.random() * 2 - 1) * 60,
      vy: (Math.random() * 2 - 1) * 60,
      color: glowRgb[i % glowRgb.length],
    });
  }
}

function scaleBubbles(prevWidth, prevHeight) {
  bubbles.forEach((bubble) => {
    const nx = bubble.x / (prevWidth || 1);
    const ny = bubble.y / (prevHeight || 1);
    bubble.x = canvas.width * nx;
    bubble.y = canvas.height * ny;
    bubble.radius = minDim * bubble.ratio;
  });
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function lerpColor(c1, c2, t) {
  return {
    r: Math.round(lerp(c1.r, c2.r, t)),
    g: Math.round(lerp(c1.g, c2.g, t)),
    b: Math.round(lerp(c1.b, c2.b, t)),
  };
}

function rgbToString({ r, g, b }) {
  return `rgb(${r}, ${g}, ${b})`;
}

function backgroundTint(xNorm, yNorm) {
  const mix = clamp01((xNorm + yNorm) / 2);
  return lerpColor(baseRgb[0], baseRgb[1], mix);
}

function updateBubbles(delta, t) {
  const dt = delta / 1000;
  const targetSpacing = minDim * 0.2;
  const wobble = Math.sin(t * 0.0015) * 8;

  for (let i = 0; i < bubbles.length; i++) {
    for (let j = i + 1; j < bubbles.length; j++) {
      const a = bubbles[i];
      const b = bubbles[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) + 0.001;
      const diff = dist - targetSpacing;
      const force = clamp01(Math.abs(diff) / targetSpacing) * Math.sign(diff) * physics.sticky;
      const fx = (dx / dist) * force * 140;
      const fy = (dy / dist) * force * 140;
      a.vx += fx * dt;
      a.vy += fy * dt;
      b.vx -= fx * dt;
      b.vy -= fy * dt;
    }
  }

  bubbles.forEach((bubble, i) => {
    bubble.vx += Math.sin(t * 0.0008 + i) * wobble * dt;
    bubble.vy += Math.cos(t * 0.0009 + i * 0.7) * wobble * dt;

    bubble.vx *= physics.drag;
    bubble.vy *= physics.drag;

    const speed = Math.hypot(bubble.vx, bubble.vy);
    if (speed > physics.maxSpeed) {
      const scale = physics.maxSpeed / speed;
      bubble.vx *= scale;
      bubble.vy *= scale;
    }

    bubble.x += bubble.vx * dt;
    bubble.y += bubble.vy * dt;

    if (bubble.x < -bubble.radius) bubble.x = canvas.width + bubble.radius;
    if (bubble.x > canvas.width + bubble.radius) bubble.x = -bubble.radius;
    if (bubble.y < -bubble.radius) bubble.y = canvas.height + bubble.radius;
    if (bubble.y > canvas.height + bubble.radius) bubble.y = -bubble.radius;
  });
}

function pixelColor(px, py, t) {
  const xNorm = px / canvas.width;
  const yNorm = py / canvas.height;

  let accumulator = { r: 0, g: 0, b: 0 };
  let weight = 0;

  bubbles.forEach((bubble) => {
    const dist = Math.hypot(px - bubble.x, py - bubble.y);
    const influence = Math.exp(-(dist * dist) / (2 * Math.pow(bubble.radius, 2)));
    accumulator.r += bubble.color.r * influence;
    accumulator.g += bubble.color.g * influence;
    accumulator.b += bubble.color.b * influence;
    weight += influence;
  });

  const dx = px - mouse.x;
  const dy = py - mouse.y;
  const distPointer = Math.hypot(dx, dy);
  const rippleShift = Math.sin(distPointer * ripple.freq - t * ripple.speed) * ripple.amp;
  const pointerInfluence = Math.exp(-Math.pow(distPointer / (focusRadius * (1 + rippleShift)), 2));

  accumulator.r += pointerBubble.color.r * pointerInfluence * 1.4;
  accumulator.g += pointerBubble.color.g * pointerInfluence * 1.4;
  accumulator.b += pointerBubble.color.b * pointerInfluence * 1.4;
  weight += pointerInfluence * 1.4;

  const haloInfluence = clamp01(1 - distPointer / haloRadius) * 0.08;
  accumulator.r += glowRgb[2].r * haloInfluence;
  accumulator.g += glowRgb[2].g * haloInfluence;
  accumulator.b += glowRgb[2].b * haloInfluence;
  weight += haloInfluence;

  if (weight === 0) return backgroundTint(xNorm, yNorm);

  const blended = {
    r: accumulator.r / weight,
    g: accumulator.g / weight,
    b: accumulator.b / weight,
  };

  const base = backgroundTint(xNorm, yNorm);
  return lerpColor(base, blended, clamp01(weight));
}

function draw(timestamp = 0) {
  const delta = lastTime ? timestamp - lastTime : 16;
  lastTime = timestamp;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cols = Math.ceil(canvas.width / cellSize);
  const rows = Math.ceil(canvas.height / cellSize);

  mouse.x = lerp(mouse.x, mouse.targetX, 0.96);
  mouse.y = lerp(mouse.y, mouse.targetY, 0.96);

  updateBubbles(delta, timestamp);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = x * cellSize;
      const py = y * cellSize;
      const color = pixelColor(px + cellSize / 2, py + cellSize / 2, timestamp);
      ctx.fillStyle = rgbToString(color);
      ctx.fillRect(px, py, cellSize, cellSize);
    }
  }
  requestAnimationFrame(draw);
}

function updateTarget(e) {
  mouse.targetX = e.clientX;
  mouse.targetY = e.clientY;
}

resizeCanvas();
draw();

window.addEventListener('resize', resizeCanvas);
window.addEventListener('pointermove', updateTarget);
window.addEventListener('touchmove', (e) => {
  if (e.touches[0]) updateTarget(e.touches[0]);
}, { passive: true });
