const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let scale = 1;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  scale = canvas.width / 1200;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Images
const carImg = new Image();
carImg.src = "car3.png";
let carImgLoaded = false;
carImg.onload = () => {
  carImgLoaded = true;
};

const wheelImg = new Image();
wheelImg.src = "wheel.png"; // Placeholder wheel image

// Game state variables
let gameState = "start"; // start, playing, paused, gameover

// Parallax layers for background
const bgLayers = [
  { speed: 0.1, colorStart: "#111e3c", colorEnd: "#273858" }, // distant sky
  { speed: 0.3, colorStart: "#274753", colorEnd: "#4b6b7a" }, // distant hills
  { speed: 0.5, colorStart: "#2f5e3f", colorEnd: "#4c824a" }, // near trees
];

let bgOffsets = [0, 0, 0];

// Car object with physics
const car = {
  x: 150 * scale,
  y: 0,
  width: 180 * scale,
  height: 90 * scale,
  dy: 0,
  onGround: true,
  speed: 0,
  maxSpeed: 10 * scale,
  acceleration: 0.2 * scale,
  friction: 0.05 * scale,
  health: 100,
  fuel: 100,
  shield: 0, // shield time in frames
  turbo: 0,  // turbo time in frames
  wheelRotation: 0,
};

let gravity = 0.6 * scale;
let jumpStrength = -15 * scale;

let particles = [];
let obstacles = [];
let pickups = [];
let floatingTexts = [];

let score = 0;
let highScore = parseInt(localStorage.getItem("highScore")) || 0;
let comboMultiplier = 1;
let comboTimer = 0;

let obstacleTimer = 0;
let pickupTimer = 0;
let difficultyTimer = 0;

let speed = 5 * scale; // base ground scroll speed

// Terrain variables for procedural hills
const terrainPoints = [];
const terrainSpacing = 60 * scale;
const terrainAmplitude = 60 * scale;
const terrainFrequency = 0.005; // how often hills appear

// Day-night cycle variables
let dayTime = 0; // 0 to 1 cycle progress

// Controls
let keys = {};

// Utility: Clamp function
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Create terrain points for hills
function generateTerrain() {
  terrainPoints.length = 0;
  for (let i = 0; i < canvas.width / terrainSpacing + 10; i++) {
    let x = i * terrainSpacing;
    let y = canvas.height - 150 * scale;
    // Use sine wave for hills
    y -= Math.sin((x + performance.now() * 0.1) * terrainFrequency) * terrainAmplitude;
    terrainPoints.push({ x, y });
  }
}

// Draw parallax background layers
function drawParallaxBackground() {
  dayTime = (dayTime + 0.00005) % 1; // slow day-night cycle

  // Interpolate colors for sky gradient based on dayTime
  const dayColors = ["#87CEEB", "#FFD580", "#004466"]; // day sky colors
  const nightColors = ["#000014", "#440044", "#111122"]; // night sky colors

  function lerpColor(a, b, t) {
    const c1 = parseInt(a.slice(1), 16);
    const c2 = parseInt(b.slice(1), 16);
    const r1 = (c1 >> 16) & 0xff;
    const g1 = (c1 >> 8) & 0xff;
    const b1 = c1 & 0xff;
    const r2 = (c2 >> 16) & 0xff;
    const g2 = (c2 >> 8) & 0xff;
    const b2 = c2 & 0xff;
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const blue = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r},${g},${blue})`;
  }

  let skyTop = lerpColor(dayColors[0], nightColors[0], Math.abs(dayTime - 0.5) * 2);
  let skyMid = lerpColor(dayColors[1], nightColors[1], Math.abs(dayTime - 0.5) * 2);
  let skyBottom = lerpColor(dayColors[2], nightColors[2], Math.abs(dayTime - 0.5) * 2);

  let gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, skyTop);
  gradient.addColorStop(0.5, skyMid);
  gradient.addColorStop(1, skyBottom);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw layers (hills, trees) with parallax scroll
  for (let i = 0; i < bgLayers.length; i++) {
    const layer = bgLayers[i];
    bgOffsets[i] = (bgOffsets[i] - layer.speed * speed * 0.1) % canvas.width;

    ctx.fillStyle = layer.colorStart;
    for (let x = bgOffsets[i]; x < canvas.width + canvas.width; x += 300 * scale) {
      ctx.beginPath();
      // Draw simple hills or tree silhouettes
      let baseY = canvas.height - 100 * scale - i * 30 * scale;
      ctx.moveTo(x, canvas.height);
      ctx.lineTo(x + 50 * scale, baseY);
      ctx.lineTo(x + 100 * scale, canvas.height);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// Draw procedural terrain hills
function drawTerrain() {
  ctx.fillStyle = "#2e8b57"; // grass green

  ctx.beginPath();
  ctx.moveTo(terrainPoints[0].x, canvas.height);
  for (const pt of terrainPoints) {
    ctx.lineTo(pt.x, pt.y);
  }
  ctx.lineTo(terrainPoints[terrainPoints.length - 1].x, canvas.height);
  ctx.closePath();
  ctx.fill();
}

// Draw road with dashed lines
function drawRoad() {
  let roadHeight = 100 * scale;
  let baseY = canvas.height - 150 * scale;

  ctx.fillStyle = "#444";
  ctx.fillRect(0, baseY, canvas.width, roadHeight);

  ctx.strokeStyle = "yellow";
  ctx.lineWidth = 6 * scale;
  ctx.setLineDash([40 * scale, 30 * scale]);
  ctx.lineDashOffset -= speed * 5;
  ctx.beginPath();
  ctx.moveTo(0, baseY + roadHeight / 2);
  ctx.lineTo(canvas.width, baseY + roadHeight / 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

// Draw the car with animation and effects
function drawCar() {
  if (carImgLoaded) {
    ctx.save();
    ctx.translate(car.x + car.width / 2, car.y + car.height / 2);
    ctx.rotate(Math.sin(car.dy * 0.1) * 0.05); // slight tilt when jumping/falling
    ctx.drawImage(carImg, -car.width / 2, -car.height / 2, car.width, car.height);
    ctx.restore();

    // Draw wheels rotating
    car.wheelRotation += speed * 0.2;
    const wheelRadius = 20 * scale;
    let leftWheelX = car.x + 40 * scale;
    let rightWheelX = car.x + car.width - 60 * scale;
    let wheelY = car.y + car.height - 15 * scale;

    ctx.save();
    ctx.translate(leftWheelX, wheelY);
    ctx.rotate(car.wheelRotation);
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.arc(0, 0, wheelRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(rightWheelX, wheelY);
    ctx.rotate(car.wheelRotation);
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.arc(0, 0, wheelRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    // fallback car shape
    ctx.fillStyle = "blue";
    ctx.fillRect(car.x, car.y, car.width, car.height);
  }

  // Draw shield aura if active
  if (car.shield > 0) {
    ctx.strokeStyle = "cyan";
    ctx.lineWidth = 6 * scale;
    ctx.beginPath();
    ctx.ellipse(car.x + car.width / 2, car.y + car.height / 2, car.width * 0.6, car.height * 0.8, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Draw turbo flames if active
  if (car.turbo > 0) {
    for (let i = 0; i < 5; i++) {
      const flameX = car.x - 20 * scale - i * 10 * scale;
      const flameY = car.y + car.height / 2 + (Math.sin(performance.now() * 0.02 + i) * 5) * scale;
      ctx.fillStyle = `rgba(255,${100 + i * 30},0,${Math.random() * 0.5 + 0.5})`;
      ctx.beginPath();
      ctx.moveTo(flameX, flameY);
      ctx.lineTo(flameX + 10 * scale, flameY - 10 * scale);
      ctx.lineTo(flameX + 10 * scale, flameY + 10 * scale);
      ctx.fill();
    }
  }
}

// Draw obstacles with animation
function drawObstacles() {
  for (const obs of obstacles) {
    if (obs.type === "tree") {
      // sway animation
      let sway = Math.sin(performance.now() * 0.005 + obs.x) * 4 * scale;
      ctx.fillStyle = "#3a5a2a";
      ctx.fillRect(obs.x + sway, obs.y, 30 * scale, obs.height);
      ctx.fillStyle = "#2e8b57";
      ctx.beginPath();
      ctx.moveTo(obs.x + 15 * scale + sway, obs.y - 40 * scale);
      ctx.lineTo(obs.x + sway, obs.y);
      ctx.lineTo(obs.x + 30 * scale + sway, obs.y);
      ctx.closePath();
      ctx.fill();
    } else if (obs.type === "ufo") {
      // blinking lights
      ctx.fillStyle = `rgba(180, 255, 255, ${0.5 + 0.5 * Math.sin(performance.now() * 0.01)})`;
      ctx.beginPath();
      ctx.ellipse(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.width / 2, obs.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#666";
      ctx.beginPath();
      ctx.ellipse(obs.x + obs.width / 2, obs.y + obs.height / 2 + 5 * scale, obs.width * 0.6, 10 * scale, 0, 0, Math.PI);
      ctx.fill();
    } else if (obs.type === "rock") {
      ctx.fillStyle = "#555";
      ctx.beginPath();
      ctx.moveTo(obs.x, obs.y + obs.height);
      ctx.lineTo(obs.x + obs.width / 2, obs.y);
      ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// Draw pickups (fuel, boost)
function drawPickups() {
  for (const pu of pickups) {
    if (pu.type === "fuel") {
      ctx.font = `${Math.floor(40 * scale)}px Arial`;
      ctx.fillStyle = "yellow";
      ctx.textAlign = "center";
      ctx.fillText("⛽", pu.x + pu.size / 2, pu.y + pu.size / 1.5);
    } else if (pu.type === "boost") {
      ctx.fillStyle = "orange";
      ctx.beginPath();
      ctx.moveTo(pu.x, pu.y + pu.size);
      ctx.lineTo(pu.x + pu.size / 2, pu.y);
      ctx.lineTo(pu.x + pu.size, pu.y + pu.size);
      ctx.closePath();
      ctx.fill();
    } else if (pu.type === "shield") {
      ctx.fillStyle = "cyan";
      ctx.beginPath();
      ctx.arc(pu.x + pu.size / 2, pu.y + pu.size / 2, pu.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Particle effects for dust and sparks
function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;
}

// Floating texts for feedback
function drawFloatingTexts() {
  for (const ft of floatingTexts) {
    ctx.globalAlpha = ft.alpha;
    ctx.fillStyle = ft.color || "yellow";
    ctx.font = ft.font || "20px Arial";
    ctx.fillText(ft.text, ft.x, ft.y);
    ft.y += ft.dy;
    ft.alpha -= ft.decay;
  }
  ctx.globalAlpha = 1.0;
  floatingTexts = floatingTexts.filter(ft => ft.alpha > 0);
}

// Spawn dust particles for landing or skid
function spawnDust(x, y) {
  for (let i = 0; i < 10; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 30 * scale,
      y: y + Math.random() * 10 * scale,
      radius: 2 + Math.random() * 3 * scale,
      dx: (Math.random() - 0.5) * 1.5 * scale,
      dy: -Math.random() * 1.5 * scale,
      alpha: 1,
      decay: 0.02,
      color: "#ccc",
    });
  }
}

// Update game objects each frame
function updateGameObjects() {
  // Update terrain points for hills (simulate moving terrain)
  for (let pt of terrainPoints) {
    pt.x -= speed;
  }
  // Remove points that go off screen and add new points at end
  while (terrainPoints.length && terrainPoints[0].x < -terrainSpacing) {
    terrainPoints.shift();
    let lastX = terrainPoints[terrainPoints.length - 1].x;
    let newX = lastX + terrainSpacing;
    let newY = canvas.height - 150 * scale - Math.sin((newX + performance.now() * 0.1) * terrainFrequency) * terrainAmplitude;
    terrainPoints.push({ x: newX, y: newY });
  }

  // Update car physics
  car.dy += gravity;
  car.y += car.dy;

  // Determine ground height under car by interpolating terrain points
  let groundY = canvas.height;
  for (let i = 0; i < terrainPoints.length - 1; i++) {
    if (car.x >= terrainPoints[i].x && car.x <= terrainPoints[i + 1].x) {
      let t = (car.x - terrainPoints[i].x) / (terrainPoints[i + 1].x - terrainPoints[i].x);
      groundY = terrainPoints[i].y * (1 - t) + terrainPoints[i + 1].y * t;
      break;
    }
  }
  groundY -= car.height;

  if (car.y > groundY) {
    if (!car.onGround) {
      spawnDust(car.x + car.width / 2, groundY + car.height);
      floatingTexts.push({ text: "Landing!", x: car.x + car.width / 2, y: groundY, alpha: 1, dy: -0.7, decay: 0.02, color: "white" });
    }
    car.y = groundY;
    car.dy = 0;
    car.onGround = true;
  } else {
    car.onGround = false;
  }

  // Handle controls for jump
  if ((keys[" "] || keys["ArrowUp"]) && car.onGround) {
    car.dy = jumpStrength;
    car.onGround = false;
  }

  // Move obstacles and pickups to left
  obstacles.forEach(obs => {
    obs.x -= speed * (obs.speedMultiplier || 1);
  });
  pickups.forEach(pu => {
    pu.x -= speed * (pu.speedMultiplier || 1);
  });

  // Remove off-screen obstacles/pickups
  obstacles = obstacles.filter(o => o.x + o.width > 0);
  pickups = pickups.filter(p => p.x + p.size > 0);

  // Spawn obstacles and pickups with timers
  obstacleTimer--;
  if (obstacleTimer <= 0) {
    spawnRandomObstacle();
    obstacleTimer = 90 - Math.min(difficultyTimer, 60); // faster spawn as difficulty increases
  }
  pickupTimer--;
  if (pickupTimer <= 0) {
    spawnRandomPickup();
    pickupTimer = 200 - Math.min(difficultyTimer * 2, 150);
  }

  // Update power-up timers
  if (car.shield > 0) car.shield--;
  if (car.turbo > 0) {
    car.turbo--;
    speed = 8 * scale; // turbo speed
  } else {
    speed = 5 * scale + difficultyTimer * 0.02; // base speed with difficulty scaling
  }

  // Update particles
  particles.forEach(p => {
    p.x += p.dx;
    p.y += p.dy;
    p.alpha -= p.decay;
  });
  particles = particles.filter(p => p.alpha > 0);

  // Update floating texts
  drawFloatingTexts();

  // Check collisions
  checkCollisions();

  // Update score and combo
  score += 0.1 * comboMultiplier;
  if (comboTimer > 0) {
    comboTimer--;
  } else {
    comboMultiplier = 1;
  }

  // Increase difficulty over time
  difficultyTimer++;
}

// Spawn obstacle randomly
function spawnRandomObstacle() {
  const r = Math.random();
  let height = 60 * scale + Math.random() * 60 * scale;
  if (r < 0.5) {
    // tree
    obstacles.push({
      type: "tree",
      x: canvas.width + 50,
      y: canvas.height - height - 90 * scale,
      width: 40 * scale,
      height,
      speedMultiplier: 1,
      hit: false,
    });
  } else if (r < 0.7) {
    // ufo swooping from top
    obstacles.push({
      type: "ufo",
      x: canvas.width + 80,
      y: -100 * scale,
      width: 90 * scale,
      height: 45 * scale,
      dx: -3 * scale,
      dy: 2 + Math.random() * 1,
      targetY: canvas.height - 200 * scale,
      speedMultiplier: 0,
      hit: false,
    });
  } else {
    // rock on road
    obstacles.push({
      type: "rock",
      x: canvas.width + 80,
      y: canvas.height - 140 * scale,
      width: 60 * scale,
      height: 40 * scale,
      speedMultiplier: 1,
      hit: false,
    });
  }
}

// Spawn pickups
function spawnRandomPickup() {
  const r = Math.random();
  const size = 40 * scale;
  if (r < 0.5) {
    pickups.push({
      type: "fuel",
      x: canvas.width + 50,
      y: canvas.height - 150 * scale - size,
      size,
      speedMultiplier: 1,
    });
  } else if (r < 0.8) {
    pickups.push({
      type: "boost",
      x: canvas.width + 70,
      y: canvas.height - 150 * scale - size,
      size,
      speedMultiplier: 1,
    });
  } else {
    pickups.push({
      type: "shield",
      x: canvas.width + 90,
      y: canvas.height - 150 * scale - size,
      size,
      speedMultiplier: 1,
    });
  }
}

// Check collisions between car and obstacles/pickups
function checkCollisions() {
  const carRect = {
    x: car.x,
    y: car.y,
    width: car.width,
    height: car.height,
  };

  // Obstacles
  obstacles.forEach(obs => {
    if (!obs.hit && rectIntersect(carRect, obs)) {
      if (car.shield > 0) {
        // shield absorbs hit
        obs.hit = true;
        floatingTexts.push({ text: "Shield block!", x: car.x, y: car.y, alpha: 1, dy: -1, decay: 0.03, color: "cyan" });
      } else {
        car.health -= 25;
        obs.hit = true;
        spawnDust(car.x + car.width / 2, car.y + car.height);
        if (car.health <= 0) {
          gameState = "gameover";
        }
      }
    }
  });

  // Pickups
  pickups.forEach(pu => {
    if (rectIntersect(carRect, pu)) {
      if (pu.type === "fuel") {
        car.fuel = clamp(car.fuel + 25, 0, 100);
        floatingTexts.push({ text: "+Fuel", x: pu.x, y: pu.y, alpha: 1, dy: -1, decay: 0.02, color: "yellow" });
      } else if (pu.type === "boost") {
        car.turbo = 300; // frames
        floatingTexts.push({ text: "Turbo!", x: pu.x, y: pu.y, alpha: 1, dy: -1, decay: 0.02, color: "orange" });
      } else if (pu.type === "shield") {
        car.shield = 300; // frames
        floatingTexts.push({ text: "Shield!", x: pu.x, y: pu.y, alpha: 1, dy: -1, decay: 0.02, color: "cyan" });
      }
      // Remove pickup after collection
      pu.collected = true;
    }
  });

  pickups = pickups.filter(pu => !pu.collected);

  // Fuel consumption
  car.fuel -= 0.05;
  if (car.fuel <= 0) {
    car.fuel = 0;
    gameState = "gameover";
  }
}

// Rect intersection helper
function rectIntersect(r1, r2) {
  return !(
    r2.x > r1.x + r1.width ||
    r2.x + (r2.width || r2.size) < r1.x ||
    r2.y > r1.y + r1.height ||
    r2.y + (r2.height || r2.size) < r1.y
  );
}

// Draw UI overlays
function drawUI() {
  ctx.fillStyle = "white";
  ctx.font = `${20 * scale}px Arial`;
  ctx.fillText(`Score: ${Math.floor(score)}`, 20 * scale, 40 * scale);
  ctx.fillText(`High Score: ${highScore}`, 20 * scale, 70 * scale);
  ctx.fillText(`Health: ${Math.floor(car.health)}%`, 20 * scale, 100 * scale);
  ctx.fillText(`Fuel: ${Math.floor(car.fuel)}%`, 20 * scale, 130 * scale);

  // Power-up indicators
  if (car.shield > 0) {
    ctx.fillStyle = "cyan";
    ctx.fillText(`Shield: ${Math.floor(car.shield / 60)}s`, 20 * scale, 160 * scale);
  }
  if (car.turbo > 0) {
    ctx.fillStyle = "orange";
    ctx.fillText(`Turbo: ${Math.floor(car.turbo / 60)}s`, 20 * scale, 190 * scale);
  }
}

// Start screen
function drawStartScreen() {
  ctx.fillStyle = "#000d1a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white";
  ctx.font = `${50 * scale}px Arial`;
  ctx.textAlign = "center";
  ctx.fillText("Car Runner Deluxe", canvas.width / 2, canvas.height / 2 - 100 * scale);

  ctx.font = `${24 * scale}px Arial`;
  ctx.fillText("Press Space or Tap to Start", canvas.width / 2, canvas.height / 2);

  ctx.font = `${18 * scale}px Arial`;
  ctx.fillText("Jump: Space / Up Arrow", canvas.width / 2, canvas.height / 2 + 50 * scale);
}

// Pause screen
function drawPauseScreen() {
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white";
  ctx.font = `${50 * scale}px Arial`;
  ctx.textAlign = "center";
  ctx.fillText("Paused", canvas.width / 2, canvas.height / 2);
  ctx.font = `${20 * scale}px Arial`;
  ctx.fillText("Press P to Resume", canvas.width / 2, canvas.height / 2 + 40 * scale);
}

// Game over screen
function drawGameOverScreen() {
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "red";
  ctx.font = `${60 * scale}px Arial`;
  ctx.textAlign = "center";
  ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 50 * scale);
  ctx.fillStyle = "white";
  ctx.font = `${30 * scale}px Arial`;
  ctx.fillText(`Score: ${Math.floor(score)}`, canvas.width / 2, canvas.height / 2);
  ctx.fillText(`High Score: ${highScore}`, canvas.width / 2, canvas.height / 2 + 40 * scale);
  ctx.fillText("Press R to Restart", canvas.width / 2, canvas.height / 2 + 100 * scale);
}

// Main game loop
function update() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (gameState === "start") {
    drawStartScreen();
    requestAnimationFrame(update);
    return;
  }

  if (gameState === "gameover") {
    drawGameOverScreen();
    requestAnimationFrame(update);
    return;
  }

  if (gameState === "paused") {
    drawParallaxBackground();
    drawTerrain();
    drawRoad();
    drawCar();
    drawObstacles();
    drawPickups();
    drawParticles();
    drawUI();
    drawPauseScreen();
    requestAnimationFrame(update);
    return;
  }

  // playing
  drawParallaxBackground();
  generateTerrain();
  drawTerrain();
  drawRoad();
  drawCar();
  drawObstacles();
  drawPickups();
  drawParticles();
  drawUI();

  updateGameObjects();

  requestAnimationFrame(update);
}

// Reset game
function restartGame() {
  if (score > highScore) {
    highScore = Math.floor(score);
    localStorage.setItem("highScore", highScore);
  }
  score = 0;
  comboMultiplier = 1;
  comboTimer = 0;
  car.health = 100;
  car.fuel = 100;
  car.x = 150 * scale;
  car.y = canvas.height - 200 * scale;
  car.dy = 0;
  car.onGround = true;
  car.shield = 0;
  car.turbo = 0;
  obstacles = [];
  pickups = [];
  particles = [];
  difficultyTimer = 0;
  obstacleTimer = 60;
  pickupTimer = 150;
  gameState = "playing";
}

// Keyboard controls
document.addEventListener("keydown", (e) => {
  keys[e.key] = true;

  if (gameState === "start" && (e.key === " " || e.key === "Enter")) {
    restartGame();
  }

  if (gameState === "playing") {
    if (e.key === "p" || e.key === "P") {
      gameState = "paused";
    }
  } else if (gameState === "paused") {
    if (e.key === "p" || e.key === "P") {
      gameState = "playing";
    }
  }

  if (gameState === "gameover" && (e.key === "r" || e.key === "R")) {
    restartGame();
  }
});

document.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

// Touch controls
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  if (gameState === "start") {
    restartGame();
  } else if (gameState === "playing") {
    if (car.onGround) {
      car.dy = jumpStrength;
      car.onGround = false;
    }
  } else if (gameState === "gameover") {
    restartGame();
  }
}, { passive: false });

update();