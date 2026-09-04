/* ============================================================
   AMBIENT SKY — a full-screen canvas scene driven by real time
   of day and live weather data fetched from our own server.js
   ============================================================ */

// ---------- DOM ----------
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const locBtn = document.getElementById('locBtn');
const cityLabel = document.getElementById('cityLabel');
const tempLabel = document.getElementById('tempLabel');
const condLabel = document.getElementById('condLabel');
const clockLabel = document.getElementById('clockLabel');
const statusLabel = document.getElementById('statusLabel');

let W, H;
function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ---------- App state ----------
const state = {
  hour: new Date().getHours() + new Date().getMinutes() / 60,
  condition: 'clear', // clear | cloudy | rain | snow | fog | storm
  temp: null,
  place: 'Loading…',
  utcOffsetSeconds: -new Date().getTimezoneOffset() * 60,
};

// ---------- Weather code → condition ----------
function classifyWeatherCode(code) {
  if (code === 0) return 'clear';
  if ([1, 2, 3].includes(code)) return 'cloudy';
  if ([45, 48].includes(code)) return 'fog';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'storm';
  return 'clear';
}

const CONDITION_LABEL = {
  clear: 'Clear Sky',
  cloudy: 'Cloudy',
  fog: 'Foggy',
  rain: 'Rainy',
  snow: 'Snowy',
  storm: 'Thunderstorm',
};

// ---------- Fetching weather from our server.js ----------
async function loadWeatherByCoords(lat, lon, label) {
  try {
    statusLabel.textContent = 'Fetching weather…';
    const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
    const data = await res.json();
    if (!data.current) throw new Error('no current data');

    state.temp = Math.round(data.current.temperature_2m);
    state.condition = classifyWeatherCode(data.current.weather_code);
    state.place = label;

    // Open-Meteo returns the local time for the requested coordinates when
    // timezone=auto is used. Keep the city's UTC offset so the clock and the
    // animated sun/moon stay on that city's local time, not the browser's time.
    if (typeof data.utc_offset_seconds === 'number') {
      state.utcOffsetSeconds = data.utc_offset_seconds;
    }
    if (data.current.time) {
      const localParts = data.current.time.split('T')[1]?.split(':');
      if (localParts?.length >= 2) {
        state.hour = Number(localParts[0]) + Number(localParts[1]) / 60;
      }
    }

    updateOverlay();
    statusLabel.textContent = '';
  } catch (err) {
    console.error(err);
    statusLabel.textContent = 'Could not load weather.';
  }
}

async function loadWeatherByCity(city) {
  try {
    statusLabel.textContent = 'Searching city…';
    const geoRes = await fetch(`/api/geocode?city=${encodeURIComponent(city)}`);
    const geo = await geoRes.json();
    if (geo.error) throw new Error(geo.error);
    await loadWeatherByCoords(geo.latitude, geo.longitude, `${geo.name}, ${geo.country}`);
  } catch (err) {
    console.error(err);
    statusLabel.textContent = 'City not found.';
  }
}

function useGeolocation() {
  if (!navigator.geolocation) {
    loadWeatherByCity('London');
    return;
  }
  statusLabel.textContent = 'Locating you…';
  navigator.geolocation.getCurrentPosition(
    (pos) => loadWeatherByCoords(pos.coords.latitude, pos.coords.longitude, 'Your Location'),
    () => loadWeatherByCity('London'),
    { timeout: 6000 }
  );
}

function updateOverlay() {
  cityLabel.textContent = state.place;
  tempLabel.textContent = state.temp !== null ? `${state.temp}°` : '--°';
  condLabel.textContent = CONDITION_LABEL[state.condition];
}

searchBtn.addEventListener('click', () => {
  const city = cityInput.value.trim();
  if (city) loadWeatherByCity(city);
});
cityInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') searchBtn.click();
});
locBtn.addEventListener('click', useGeolocation);

useGeolocation(); // kick things off

// ---------- Clock ----------
function tickClock() {
  // Convert the current UTC time into the selected city's local time.
  const localMs = Date.now() + state.utcOffsetSeconds * 1000;
  const local = new Date(localMs);

  const hours = local.getUTCHours();
  const minutes = local.getUTCMinutes();
  const seconds = local.getUTCSeconds();
  state.hour = hours + minutes / 60 + seconds / 3600;

  clockLabel.textContent = local.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}
setInterval(tickClock, 1000);
tickClock();

// ============================================================
// SKY GRADIENT — smoothly interpolated color stops across 24h
// ============================================================
const SKY_STOPS = [
  [0, '#02020a', '#0a0a2a'],
  [4, '#02020a', '#0a0a2a'],
  [6, '#2b2145', '#ff7e5f'],
  [8, '#4facfe', '#a1c4fd'],
  [12, '#56ccf2', '#c9ecff'],
  [17, '#4facfe', '#a1c4fd'],
  [19, '#3a1c71', '#d76d77'],
  [21, '#0f0c29', '#302b63'],
  [24, '#02020a', '#0a0a2a'],
];

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function lerpColor(c1, c2, t) {
  const p1 = hexToRgb(c1), p2 = hexToRgb(c2);
  const r = Math.round(p1.r + (p2.r - p1.r) * t);
  const g = Math.round(p1.g + (p2.g - p1.g) * t);
  const b = Math.round(p1.b + (p2.b - p1.b) * t);
  return `rgb(${r},${g},${b})`;
}
function getSkyColors(hour) {
  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    const [h1, top1, bot1] = SKY_STOPS[i];
    const [h2, top2, bot2] = SKY_STOPS[i + 1];
    if (hour >= h1 && hour <= h2) {
      const t = (hour - h1) / (h2 - h1);
      return { top: lerpColor(top1, top2, t), bottom: lerpColor(bot1, bot2, t) };
    }
  }
  return { top: SKY_STOPS[0][1], bottom: SKY_STOPS[0][2] };
}
function darknessFactor(hour) {
  if (hour >= 21 || hour <= 5) return 1;
  if (hour > 5 && hour < 7) return 1 - (hour - 5) / 2;
  if (hour > 19 && hour < 21) return (hour - 19) / 2;
  return 0;
}
function drawSky() {
  const { top, bottom } = getSkyColors(state.hour);
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

// ============================================================
// STARS
// ============================================================
const stars = Array.from({ length: 160 }, () => ({
  x: Math.random(),
  y: Math.random() * 0.65,
  r: Math.random() * 1.4 + 0.3,
  phase: Math.random() * Math.PI * 2,
  speed: 0.5 + Math.random(),
}));

function drawStars(time) {
  const dark = darknessFactor(state.hour);
  if (dark <= 0) return;
  ctx.save();
  stars.forEach((s) => {
    const twinkle = 0.5 + 0.5 * Math.sin(time * 0.001 * s.speed + s.phase);
    ctx.globalAlpha = dark * twinkle;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

// ============================================================
// SUN / MOON — arcs across the sky based on real hour of day
// ============================================================
function drawCelestialBody() {
  const dayProgress = (state.hour - 6) / 12;
  const isDaytime = dayProgress >= 0 && dayProgress <= 1;
  let progress, isSun;

  if (isDaytime) {
    progress = dayProgress;
    isSun = true;
  } else {
    const nightHour = state.hour < 6 ? state.hour + 24 : state.hour;
    progress = (nightHour - 18) / 12;
    isSun = false;
  }

  const x = W * 0.1 + progress * W * 0.8;
  const arcHeight = H * 0.5;
  const y = H * 0.85 - Math.sin(progress * Math.PI) * arcHeight;

  ctx.save();
  if (isSun) {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 65);
    glow.addColorStop(0, 'rgba(255,247,200,0.9)');
    glow.addColorStop(1, 'rgba(255,247,200,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 65, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff7c8';
    ctx.beginPath();
    ctx.arc(x, y, 28, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 48);
    glow.addColorStop(0, 'rgba(220,220,255,0.8)');
    glow.addColorStop(1, 'rgba(220,220,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 48, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e8e8ff';
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();

    // crescent shading
    ctx.fillStyle = getSkyColors(state.hour).top;
    ctx.beginPath();
    ctx.arc(x + 9, y - 4, 20, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ============================================================
// CLOUDS
// ============================================================
let clouds = [];
function makeCloud() {
  return {
    x: Math.random() * W,
    y: Math.random() * H * 0.4 + H * 0.05,
    scale: 0.6 + Math.random() * 1.2,
    speed: 5 + Math.random() * 15,
    opacity: 0.45 + Math.random() * 0.4,
  };
}
function initClouds() {
  const count = state.condition === 'clear' ? 3 : state.condition === 'cloudy' ? 9 : 6;
  clouds = Array.from({ length: count }, makeCloud);
}
function drawCloud(c) {
  ctx.save();
  ctx.globalAlpha = c.opacity;
  ctx.fillStyle = darknessFactor(state.hour) > 0.5 ? '#4a4a63' : '#ffffff';
  const blobs = [[0, 0, 30], [25, -10, 25], [50, 0, 30], [20, 10, 25], [-20, 8, 20]];
  ctx.translate(c.x, c.y);
  ctx.scale(c.scale, c.scale);
  blobs.forEach(([bx, by, br]) => {
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}
function updateClouds(dt) {
  clouds.forEach((c) => {
    c.x += c.speed * dt;
    if (c.x - 100 > W) c.x = -120;
  });
}

// ============================================================
// RAIN / SNOW PARTICLES
// ============================================================
let particles = [];
function initParticles() {
  particles = [];
  if (state.condition === 'rain' || state.condition === 'storm') {
    for (let i = 0; i < 220; i++) {
      particles.push({
        x: Math.random() * W, y: Math.random() * H,
        len: 10 + Math.random() * 10, speed: 400 + Math.random() * 300,
      });
    }
  } else if (state.condition === 'snow') {
    for (let i = 0; i < 130; i++) {
      particles.push({
        x: Math.random() * W, y: Math.random() * H,
        r: 1 + Math.random() * 3, speed: 30 + Math.random() * 40,
        drift: Math.random() * 2 - 1,
      });
    }
  }
}
function drawParticles(dt) {
  if (state.condition === 'rain' || state.condition === 'storm') {
    ctx.save();
    ctx.strokeStyle = 'rgba(174,194,224,0.6)';
    ctx.lineWidth = 1.5;
    particles.forEach((p) => {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - 4, p.y + p.len);
      ctx.stroke();
      p.y += p.speed * dt;
      p.x -= 40 * dt;
      if (p.y > H) { p.y = -20; p.x = Math.random() * W; }
    });
    ctx.restore();
  } else if (state.condition === 'snow') {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    particles.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      p.y += p.speed * dt;
      p.x += p.drift * 20 * dt;
      if (p.y > H) { p.y = -10; p.x = Math.random() * W; }
    });
    ctx.restore();
  }
}

// ============================================================
// LIGHTNING (storm only)
// ============================================================
let lightningAlpha = 0;
let lightningTimer = 2;
function updateLightning(dt) {
  if (state.condition !== 'storm') { lightningAlpha = 0; return; }
  lightningTimer -= dt;
  if (lightningTimer <= 0) {
    lightningAlpha = 1;
    lightningTimer = 2 + Math.random() * 5;
  }
  lightningAlpha = Math.max(0, lightningAlpha - dt * 3);
}
function drawLightning() {
  if (lightningAlpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = lightningAlpha * 0.8;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ============================================================
// FOG
// ============================================================
function drawFog() {
  if (state.condition !== 'fog') return;
  ctx.save();
  ctx.globalAlpha = 0.45;
  const grad = ctx.createLinearGradient(0, H * 0.5, 0, H);
  grad.addColorStop(0, 'rgba(200,200,210,0)');
  grad.addColorStop(1, 'rgba(200,200,210,0.9)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ============================================================
// GROUND SILHOUETTE
// ============================================================
function drawGround() {
  ctx.save();
  ctx.fillStyle = darknessFactor(state.hour) > 0.5 ? '#050508' : '#0d1b1e';
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, H * 0.9);
  for (let x = 0; x <= W; x += 40) {
    ctx.lineTo(x, H * 0.9 + Math.sin(x * 0.01) * 10);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ============================================================
// MAIN LOOP
// ============================================================
let lastTime = performance.now();
let lastCondition = null;

function loop(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;

  if (state.condition !== lastCondition) {
    initClouds();
    initParticles();
    lastCondition = state.condition;
  }

  ctx.clearRect(0, 0, W, H);
  drawSky();
  drawStars(time);
  drawCelestialBody();
  updateClouds(dt);
  clouds.forEach(drawCloud);
  drawFog();
  drawParticles(dt);
  updateLightning(dt);
  drawLightning();
  drawGround();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);