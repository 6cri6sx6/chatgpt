const canvas = document.getElementById('pixel-canvas');
const ctx = canvas.getContext('2d');

const palette = {
  bg1: getComputedStyle(document.documentElement).getPropertyValue('--bg-dark-1').trim(),
  bg2: getComputedStyle(document.documentElement).getPropertyValue('--bg-dark-2').trim(),
  accent1: getComputedStyle(document.documentElement).getPropertyValue('--accent-1').trim(),
  accent2: getComputedStyle(document.documentElement).getPropertyValue('--accent-2').trim(),
  accent3: getComputedStyle(document.documentElement).getPropertyValue('--accent-3').trim(),
};

const gradientStops = [
  { pos: 0.0, color: palette.accent1 },
  { pos: 0.28, color: palette.accent2 },
  { pos: 0.55, color: palette.accent3 },
  { pos: 0.78, color: palette.bg2 },
  { pos: 1.0, color: palette.bg1 },
];

let cellSize = 18;
const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
const center = { x: 0, y: 0 };
let maxRadius = 400;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const maxDimension = Math.max(canvas.width, canvas.height);
  cellSize = Math.max(12, Math.min(24, Math.floor(maxDimension / 60)));
  center.x = canvas.width / 2;
  center.y = canvas.height / 2;
  maxRadius = Math.hypot(canvas.width, canvas.height) * 0.55;

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

function sampleGradient(t) {
  const clamped = clamp01(t);
  for (let i = 0; i < gradientStops.length - 1; i++) {
    const a = gradientStops[i];
    const b = gradientStops[i + 1];
    if (clamped >= a.pos && clamped <= b.pos) {
      const localT = (clamped - a.pos) / (b.pos - a.pos || 1);
      const color = lerpColor(hexToRgb(a.color), hexToRgb(b.color), localT);
      return `rgb(${color.r}, ${color.g}, ${color.b})`;
    }
  }
  const last = gradientStops[gradientStops.length - 1].color;
  return last;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cols = Math.ceil(canvas.width / cellSize);
  const rows = Math.ceil(canvas.height / cellSize);

  mouse.x = lerp(mouse.x, mouse.targetX, 0.08);
  mouse.y = lerp(mouse.y, mouse.targetY, 0.08);

  const offsetCenterX = lerp(center.x, mouse.x, 0.12);
  const offsetCenterY = lerp(center.y, mouse.y, 0.12);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = x * cellSize;
      const py = y * cellSize;
      const dx = (px + cellSize / 2) - offsetCenterX;
      const dy = (py + cellSize / 2) - offsetCenterY;
      const dist = Math.hypot(dx, dy);

      const gradientT = clamp01(dist / maxRadius);
      const color = sampleGradient(gradientT);

      ctx.fillStyle = color;
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
  if (e.touches[0]) {
    updateTarget(e.touches[0]);
  }
}, { passive: true });
