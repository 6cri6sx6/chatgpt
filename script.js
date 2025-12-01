const canvas = document.getElementById('pixel-canvas');
const ctx = canvas.getContext('2d');

const cssVars = getComputedStyle(document.documentElement);
const palette = [
  hexToRgb(cssVars.getPropertyValue('--bg-top').trim()),
  hexToRgb(cssVars.getPropertyValue('--bg-mid').trim()),
  hexToRgb(cssVars.getPropertyValue('--bg-bottom').trim()),
];

const grid = { cell: 10, cols: 0, rows: 0 };
const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
let highlightRadius = 140;
let haloRadius = 420;

function resizeCanvas() {
  const prevW = canvas.width;
  const prevH = canvas.height;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  grid.cell = Math.max(8, Math.round(Math.min(canvas.width, canvas.height) / 80));
  grid.cols = Math.ceil(canvas.width / grid.cell);
  grid.rows = Math.ceil(canvas.height / grid.cell);

  highlightRadius = Math.hypot(canvas.width, canvas.height) * 0.075;
  haloRadius = Math.hypot(canvas.width, canvas.height) * 0.32;

  if (mouse.x === 0 && mouse.y === 0) {
    mouse.x = mouse.targetX = canvas.width / 2;
    mouse.y = mouse.targetY = canvas.height / 2;
  } else if (prevW && prevH) {
    const nx = mouse.targetX / prevW;
    const ny = mouse.targetY / prevH;
    mouse.x = mouse.targetX = nx * canvas.width;
    mouse.y = mouse.targetY = ny * canvas.height;
  }
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

function gradientColor(t) {
  const stops = [0, 0.55, 1];
  if (t <= stops[0]) return palette[0];
  if (t >= stops[2]) return palette[2];
  if (t <= stops[1]) {
    const nt = (t - stops[0]) / (stops[1] - stops[0]);
    return lerpColor(palette[0], palette[1], nt);
  }
  const nt = (t - stops[1]) / (stops[2] - stops[1]);
  return lerpColor(palette[1], palette[2], nt);
}

function pixelColor(x, y, t) {
  const ny = clamp01((y + Math.sin((x + t * 0.05) * 0.02) * 6) / canvas.height);
  const base = gradientColor(ny);

  const dx = x - mouse.x;
  const dy = y - mouse.y;
  const dist = Math.hypot(dx, dy);
  const focus = Math.exp(-Math.pow(dist / highlightRadius, 2));

  const wave = Math.max(0, Math.sin(dist / (grid.cell * 2.6) - t * 0.006));
  const haloBase = clamp01(1 - dist / haloRadius);
  const halo = haloBase * (0.1 + 0.08 * wave);

  const highlight = lerpColor(base, palette[2], 0.08);
  const glow = {
    r: base.r + (palette[0].r - base.r) * focus + halo * 60,
    g: base.g + (palette[1].g - base.g) * focus + halo * 70,
    b: base.b + (palette[2].b - base.b) * focus + halo * 40,
  };

  return lerpColor(base, lerpColor(glow, highlight, 0.42), clamp01(focus + halo));
}

function draw(timestamp = 0) {
  if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
    resizeCanvas();
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  mouse.x = lerp(mouse.x, mouse.targetX, 0.9);
  mouse.y = lerp(mouse.y, mouse.targetY, 0.9);

  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      const px = x * grid.cell;
      const py = y * grid.cell;
      const color = pixelColor(px + grid.cell / 2, py + grid.cell / 2, timestamp);
      ctx.fillStyle = rgbToString(color);
      ctx.fillRect(px, py, grid.cell, grid.cell);
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
