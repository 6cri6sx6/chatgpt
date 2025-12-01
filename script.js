const canvas = document.getElementById('pixel-canvas');
const ctx = canvas.getContext('2d');

const palette = {
  bg1: getComputedStyle(document.documentElement).getPropertyValue('--bg-dark-1').trim(),
  bg2: getComputedStyle(document.documentElement).getPropertyValue('--bg-dark-2').trim(),
  accent1: getComputedStyle(document.documentElement).getPropertyValue('--accent-1').trim(),
};

const colors = [palette.bg1, palette.bg2, palette.accent1].map(hexToRgb);
const grid = { cell: 5, cols: 0, rows: 0 };
const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
const anchors = [];
let baseRadius = 0;
let haloRadius = 0;
let lastTime = 0;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  grid.cell = Math.max(4, Math.round(Math.min(canvas.width, canvas.height) / 200));
  grid.cols = Math.ceil(canvas.width / grid.cell);
  grid.rows = Math.ceil(canvas.height / grid.cell);
  baseRadius = Math.hypot(canvas.width, canvas.height) * 0.012;
  haloRadius = Math.hypot(canvas.width, canvas.height) * 0.4;

  if (mouse.x === 0 && mouse.y === 0) {
    mouse.x = mouse.targetX = canvas.width / 2;
    mouse.y = mouse.targetY = canvas.height / 2;
  }

  if (!anchors.length) {
    initAnchors();
  }
}

function initAnchors() {
  const configs = [
    { radius: 0.16, speed: 0.12, offset: 0, colorIndex: 0 },
    { radius: 0.19, speed: -0.1, offset: Math.PI * 0.6, colorIndex: 1 },
    { radius: 0.22, speed: 0.07, offset: Math.PI * 1.2, colorIndex: 2 },
  ];

  configs.forEach((cfg) => {
    anchors.push({
      radiusRatio: cfg.radius,
      radius: Math.min(canvas.width, canvas.height) * cfg.radius,
      speed: cfg.speed,
      offset: cfg.offset,
      colorIndex: cfg.colorIndex,
      x: canvas.width / 2,
      y: canvas.height / 2,
    });
  });
}

function scaleAnchors(prevW, prevH) {
  anchors.forEach((a) => {
    const nx = a.x / (prevW || 1);
    const ny = a.y / (prevH || 1);
    a.x = nx * canvas.width;
    a.y = ny * canvas.height;
    a.radius = Math.min(canvas.width, canvas.height) * a.radiusRatio;
  });
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(v) { return Math.min(1, Math.max(0, v)); }
function lerpColor(c1, c2, t) {
  return {
    r: Math.round(lerp(c1.r, c2.r, t)),
    g: Math.round(lerp(c1.g, c2.g, t)),
    b: Math.round(lerp(c1.b, c2.b, t)),
  };
}
function rgbToString({ r, g, b }) { return `rgb(${r}, ${g}, ${b})`; }
function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function updateAnchors(t) {
  anchors.forEach((anchor, i) => {
    const wobble = Math.sin(t * 0.00018 + i) * 0.04;
    const angle = t * anchor.speed + anchor.offset;
    const orbit = Math.min(canvas.width, canvas.height) * anchor.radiusRatio * (1 + wobble);
    anchor.x = canvas.width / 2 + Math.cos(angle) * orbit;
    anchor.y = canvas.height / 2 + Math.sin(angle * 1.05) * orbit;
    anchor.radius = orbit * 0.45;
  });
}

function backgroundColor(x, y, t) {
  const nx = x / canvas.width;
  const ny = y / canvas.height;
  const drift = Math.sin(t * 0.00007) * 0.15;
  const mix = clamp01((nx + ny) / 2 + drift * 0.5);
  return lerpColor(colors[0], colors[1], mix);
}

function pixelColor(px, py, t) {
  let acc = { r: 0, g: 0, b: 0 };
  let weight = 0;

  anchors.forEach((anchor) => {
    const dist = Math.hypot(px - anchor.x, py - anchor.y);
    const falloff = Math.exp(-Math.pow(dist / anchor.radius, 2));
    const tint = colors[anchor.colorIndex];
    acc.r += tint.r * falloff;
    acc.g += tint.g * falloff;
    acc.b += tint.b * falloff;
    weight += falloff;
  });

  const dx = px - mouse.x;
  const dy = py - mouse.y;
  const distPointer = Math.hypot(dx, dy);
  const pointerInfluence = Math.exp(-Math.pow(distPointer / (baseRadius * 0.65), 2));
  const haloInfluence = clamp01(1 - distPointer / haloRadius) * 0.08;

  const pointerTint = lerpColor(colors[2], colors[1], 0.4);
  acc.r += pointerTint.r * (pointerInfluence + haloInfluence);
  acc.g += pointerTint.g * (pointerInfluence + haloInfluence);
  acc.b += pointerTint.b * (pointerInfluence + haloInfluence);
  weight += pointerInfluence + haloInfluence;

  const base = backgroundColor(px, py, t);
  if (weight === 0) return base;
  const blended = { r: acc.r / weight, g: acc.g / weight, b: acc.b / weight };
  return lerpColor(base, blended, clamp01(weight * 0.8));
}

function draw(timestamp = 0) {
  const prevW = canvas.width;
  const prevH = canvas.height;
  if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
    scaleAnchors(prevW, prevH);
    resizeCanvas();
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cols = grid.cols;
  const rows = grid.rows;

  mouse.x = lerp(mouse.x, mouse.targetX, 0.92);
  mouse.y = lerp(mouse.y, mouse.targetY, 0.92);

  updateAnchors(timestamp);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = x * grid.cell;
      const py = y * grid.cell;
      const color = pixelColor(px + grid.cell / 2, py + grid.cell / 2, timestamp);
      ctx.fillStyle = rgbToString(color);
      ctx.fillRect(px, py, grid.cell, grid.cell);
    }
  }

  lastTime = timestamp;
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
