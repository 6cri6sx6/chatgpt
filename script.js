const canvas = document.getElementById('pixel-canvas');
const ctx = canvas.getContext('2d');

const palette = {
  bg1: getComputedStyle(document.documentElement).getPropertyValue('--bg-dark-1').trim(),
  bg2: getComputedStyle(document.documentElement).getPropertyValue('--bg-dark-2').trim(),
  accent1: getComputedStyle(document.documentElement).getPropertyValue('--accent-1').trim(),
};

const baseRgb = [palette.bg1, palette.bg2].map(hexToRgb);
const accentRgb = hexToRgb(palette.accent1);
const gradientStops = [baseRgb[0], baseRgb[1], lerpColor(accentRgb, baseRgb[1], 0.4)];

let cellSize = 6;
let minDim = 0;
const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
let focusRadius = 110;
let haloRadius = 900;
let lastTime = 0;

const anchors = [];
const pointerBubble = { radius: 0.08, color: gradientStops[2] };
const ripple = { freq: 0.035, speed: 0.002, amp: 0.11 };

function resizeCanvas() {
  const prevWidth = canvas.width || window.innerWidth;
  const prevHeight = canvas.height || window.innerHeight;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const maxDimension = Math.max(canvas.width, canvas.height);
  minDim = Math.min(canvas.width, canvas.height);
  cellSize = Math.max(3, Math.min(6, Math.floor(maxDimension / 200)));
  focusRadius = Math.hypot(canvas.width, canvas.height) * 0.01;
  haloRadius = Math.hypot(canvas.width, canvas.height) * 0.24;

  if (mouse.x === 0 && mouse.y === 0 && mouse.targetX === 0 && mouse.targetY === 0) {
    mouse.x = mouse.targetX = canvas.width / 2;
    mouse.y = mouse.targetY = canvas.height / 2;
  }

  if (!anchors.length) {
    initAnchors();
  } else {
    scaleAnchors(prevWidth, prevHeight);
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

function paletteGradient(t) {
  const clamped = ((t % 1) + 1) % 1;
  const pos = clamped * (gradientStops.length - 1);
  const idx = Math.floor(pos);
  const localT = pos - idx;
  const c1 = gradientStops[idx];
  const c2 = gradientStops[Math.min(idx + 1, gradientStops.length - 1)];
  return lerpColor(c1, c2, localT);
}

function initAnchors() {
  const configs = [
    { radiusRatio: 0.24, speed: 0.12, amp: 0.12, offset: 0, tint: 0.05 },
    { radiusRatio: 0.22, speed: -0.09, amp: 0.14, offset: Math.PI * 0.7, tint: 0.45 },
    { radiusRatio: 0.2, speed: 0.07, amp: 0.1, offset: Math.PI * 1.3, tint: 0.8 },
  ];

  configs.forEach((cfg) => {
    anchors.push({
      x: canvas.width * 0.5,
      y: canvas.height * 0.5,
      radiusRatio: cfg.radiusRatio,
      radius: minDim * cfg.radiusRatio,
      speed: cfg.speed,
      amp: cfg.amp,
      offset: cfg.offset,
      tint: cfg.tint,
    });
  });
}

function scaleAnchors(prevWidth, prevHeight) {
  anchors.forEach((anchor) => {
    const nx = anchor.x / (prevWidth || 1);
    const ny = anchor.y / (prevHeight || 1);
    anchor.x = canvas.width * nx;
    anchor.y = canvas.height * ny;
    anchor.radius = minDim * anchor.radiusRatio;
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

function backgroundTint(xNorm, yNorm, t) {
  const drift = (Math.sin(t * 0.00008) + Math.cos(t * 0.00011)) * 0.05;
  const mix = clamp01((xNorm + yNorm) / 2 + drift);
  return lerpColor(baseRgb[0], baseRgb[1], mix);
}

function updateAnchors(t) {
  anchors.forEach((anchor, i) => {
    const angle = t * anchor.speed + anchor.offset;
    const wobble = Math.sin(t * 0.00035 + i) * minDim * 0.02;
    anchor.x = canvas.width / 2 + Math.cos(angle) * minDim * anchor.amp + wobble;
    anchor.y = canvas.height / 2 + Math.sin(angle * 1.1) * minDim * anchor.amp;
    anchor.radius = minDim * anchor.radiusRatio * (1 + Math.sin(t * 0.00022 + i) * 0.05);
  });
}

function pixelColor(px, py, t) {
  const xNorm = px / canvas.width;
  const yNorm = py / canvas.height;

  let accumulator = { r: 0, g: 0, b: 0 };
  let weight = 0;

  anchors.forEach((anchor) => {
    const dist = Math.hypot(px - anchor.x, py - anchor.y);
    const influence = Math.exp(-(dist * dist) / (2 * Math.pow(anchor.radius, 2)));
    const wave = Math.sin(t * 0.00018 + anchor.tint * 6) * 0.06;
    const tint = paletteGradient(anchor.tint + wave);
    accumulator.r += tint.r * influence * 0.9;
    accumulator.g += tint.g * influence * 0.9;
    accumulator.b += tint.b * influence * 0.9;
    weight += influence;
  });

  const dx = px - mouse.x;
  const dy = py - mouse.y;
  const distPointer = Math.hypot(dx, dy);
  const rippleShift = Math.sin(distPointer * ripple.freq - t * ripple.speed) * ripple.amp;
  const pointerInfluence = Math.exp(-Math.pow(distPointer / (focusRadius * (1 + rippleShift)), 2));

  accumulator.r += pointerBubble.color.r * pointerInfluence;
  accumulator.g += pointerBubble.color.g * pointerInfluence;
  accumulator.b += pointerBubble.color.b * pointerInfluence;
  weight += pointerInfluence;

  const haloInfluence = clamp01(1 - distPointer / haloRadius) * 0.08;
  const haloColor = paletteGradient(0.2);
  accumulator.r += haloColor.r * haloInfluence;
  accumulator.g += haloColor.g * haloInfluence;
  accumulator.b += haloColor.b * haloInfluence;
  weight += haloInfluence;

  const base = backgroundTint(xNorm, yNorm, t);
  if (weight === 0) return base;

  const blended = {
    r: accumulator.r / weight,
    g: accumulator.g / weight,
    b: accumulator.b / weight,
  };

  return lerpColor(base, blended, clamp01(weight));
}

function draw(timestamp = 0) {
  const delta = lastTime ? timestamp - lastTime : 16;
  lastTime = timestamp;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cols = Math.ceil(canvas.width / cellSize);
  const rows = Math.ceil(canvas.height / cellSize);

  mouse.x = lerp(mouse.x, mouse.targetX, 0.9);
  mouse.y = lerp(mouse.y, mouse.targetY, 0.9);

  updateAnchors(timestamp);

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
