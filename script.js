const canvas = document.getElementById('pixel-canvas');
const ctx = canvas.getContext('2d');

const palette = [
  getComputedStyle(document.documentElement).getPropertyValue('--bg-dark-1').trim(),
  getComputedStyle(document.documentElement).getPropertyValue('--bg-dark-2').trim(),
  getComputedStyle(document.documentElement).getPropertyValue('--accent-1').trim(),
  getComputedStyle(document.documentElement).getPropertyValue('--accent-2').trim(),
  getComputedStyle(document.documentElement).getPropertyValue('--accent-3').trim(),
];

let cellSize = 18;
const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
const pointerInfluence = 120;
let tick = 0;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const maxDimension = Math.max(canvas.width, canvas.height);
  cellSize = Math.max(12, Math.min(24, Math.floor(maxDimension / 60)));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothStep(edge0, edge1, x) {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

function hash(x, y, seed) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + seed * 0.0001) * 43758.5453;
  return s - Math.floor(s);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cols = Math.ceil(canvas.width / cellSize);
  const rows = Math.ceil(canvas.height / cellSize);

  mouse.x = lerp(mouse.x, mouse.targetX, 0.08);
  mouse.y = lerp(mouse.y, mouse.targetY, 0.08);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = x * cellSize;
      const py = y * cellSize;
      const dx = (px + cellSize / 2) - mouse.x;
      const dy = (py + cellSize / 2) - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const influence = smoothStep(pointerInfluence, 0, dist);
      const jitter = hash(x, y, tick) * palette.length;
      const wave = Math.sin((x + y + tick * 0.04) * 0.9 + influence * 2);
      const colorIndex = Math.abs(Math.floor((jitter + wave + influence * 3) % palette.length));

      ctx.fillStyle = palette[colorIndex];
      ctx.fillRect(px, py, cellSize, cellSize);

      if (influence > 0.25) {
        const accent = palette[(colorIndex + 2) % palette.length];
        ctx.fillStyle = accent;
        ctx.globalAlpha = influence * 0.5;
        ctx.fillRect(px, py, cellSize, cellSize);
        ctx.globalAlpha = 1;
      }
    }
  }

  tick += 1;
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
