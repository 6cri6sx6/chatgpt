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
const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
const center = { x: 0, y: 0 };
let focusRadius = 120;
let haloRadius = 1100;

const bubbles = [
  { offsetX: -0.22, offsetY: -0.18, radius: 0.32, speed: 0.00012, sway: 80, color: glowRgb[1] },
  { offsetX: 0.25, offsetY: -0.28, radius: 0.36, speed: -0.0001, sway: 70, color: glowRgb[0] },
  { offsetX: -0.12, offsetY: 0.22, radius: 0.28, speed: 0.00015, sway: 120, color: glowRgb[2] },
];

const pointerBubble = { radius: 0.18, color: glowRgb[1] };
const ripple = { freq: 0.025, speed: 0.0022, amp: 0.12 };

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const maxDimension = Math.max(canvas.width, canvas.height);
  cellSize = Math.max(5, Math.min(9, Math.floor(maxDimension / 150)));
  center.x = canvas.width / 2;
  center.y = canvas.height / 2;
  focusRadius = Math.hypot(canvas.width, canvas.height) * 0.024;
  haloRadius = Math.hypot(canvas.width, canvas.height) * 0.34;

  if (mouse.x === 0 && mouse.y === 0 && mouse.targetX === 0 && mouse.targetY === 0) {
    mouse.x = mouse.targetX = center.x;
    mouse.y = mouse.targetY = center.y;
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
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

function pixelColor(px, py, t) {
  const xNorm = px / canvas.width;
  const yNorm = py / canvas.height;

  let accumulator = { r: 0, g: 0, b: 0 };
  let weight = 0;

  bubbles.forEach((bubble, i) => {
    const cx = center.x + bubble.offsetX * canvas.width * 0.5 + Math.cos(t * bubble.speed + i) * bubble.sway;
    const cy = center.y + bubble.offsetY * canvas.height * 0.5 + Math.sin(t * bubble.speed + i * 1.7) * bubble.sway;
    const dist = Math.hypot(px - cx, py - cy);
    const influence = Math.exp(-(dist * dist) / (2 * Math.pow(bubble.radius * canvas.width, 2)));
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cols = Math.ceil(canvas.width / cellSize);
  const rows = Math.ceil(canvas.height / cellSize);

  mouse.x = lerp(mouse.x, mouse.targetX, 0.92);
  mouse.y = lerp(mouse.y, mouse.targetY, 0.92);

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
