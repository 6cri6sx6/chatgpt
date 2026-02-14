const canvas = document.getElementById('pixel-canvas');
const ctx = canvas.getContext('2d');

const cssVars = getComputedStyle(document.documentElement);
const palette = {
  dark1: cssVars.getPropertyValue('--bg-dark-1').trim(),
  dark2: cssVars.getPropertyValue('--bg-dark-2').trim(),
  accent1: cssVars.getPropertyValue('--accent-1').trim(),
  accent2: cssVars.getPropertyValue('--accent-2').trim(),
};

const grid = { cell: 8, cols: 0, rows: 0 };
const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
let highlightRadius = 120;
let haloRadius = 360;

function resizeCanvas() {
  const prevW = canvas.width;
  const prevH = canvas.height;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  grid.cell = Math.max(6, Math.round(Math.min(canvas.width, canvas.height) / 90));
  grid.cols = Math.ceil(canvas.width / grid.cell);
  grid.rows = Math.ceil(canvas.height / grid.cell);

  highlightRadius = Math.hypot(canvas.width, canvas.height) * 0.055;
  haloRadius = Math.hypot(canvas.width, canvas.height) * 0.26;

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

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
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

const stopTop = hexToRgb(palette.dark1);
const stopMid = hexToRgb(palette.dark2);
const stopAccent = lerpColor(hexToRgb(palette.accent1), hexToRgb(palette.accent2), 0.35);

function gradientColor(t) {
  const stops = [0, 0.6, 1];
  if (t <= stops[0]) return stopTop;
  if (t >= stops[2]) return stopAccent;
  if (t <= stops[1]) {
    const nt = (t - stops[0]) / (stops[1] - stops[0]);
    return lerpColor(stopTop, stopMid, nt);
  }
  const nt = (t - stops[1]) / (stops[2] - stops[1]);
  return lerpColor(stopMid, stopAccent, nt);
}

function pixelColor(x, y, t) {
  const time = t * 0.001;
  const wobble = Math.sin(time * 0.6) * grid.cell * 0.6;
  const ny = clamp01((y + wobble + Math.sin((x * 0.02) + time * 0.8) * grid.cell * 0.8) / canvas.height);
  const base = gradientColor(ny);

  const dx = x - mouse.x;
  const dy = y - mouse.y;
  const dist = Math.hypot(dx, dy);

  const focus = Math.exp(-Math.pow(dist / highlightRadius, 2));
  const ripple = Math.sin(dist / (grid.cell * 2.1) - time * 3.2) * 0.25 + 0.25;

  const haloPulse = 1 + Math.sin(time * 2.6) * 0.08;
  const haloBase = clamp01(1 - dist / (haloRadius * haloPulse));
  const halo = haloBase * (0.12 + 0.1 * ripple);

  const accentGlow = lerpColor(base, stopAccent, 0.35 + 0.25 * ripple);
  const haloTint = {
    r: base.r + (stopTop.r - base.r) * focus + halo * 50,
    g: base.g + (stopMid.g - base.g) * focus + halo * 60,
    b: base.b + (stopAccent.b - base.b) * focus + halo * 35,
  };

  return lerpColor(accentGlow, haloTint, clamp01(focus + halo));
}

function draw(timestamp = 0) {
  if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
    resizeCanvas();
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  mouse.x = lerp(mouse.x, mouse.targetX, 0.92);
  mouse.y = lerp(mouse.y, mouse.targetY, 0.92);

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
