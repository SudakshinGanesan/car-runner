// boss.js

// This file will contain all logic for the boss battle.
// We'll pass in everything it needs from game.js (like the canvas context, player, etc.)

let boss = {}; // The boss object
let lasers = []; // Array for player's lasers
let bossLasers = []; // Array for boss's lasers
let localCarImg = null;
const playerSpeed = 7;

// --- PUBLIC FUNCTIONS (EXPORTED) ---

// Called once to set up the boss battle
export function initBossMode(ctx, playerObject, carImg) {
  console.log("Boss mode initiated!");
  localCarImg = carImg;

  // Initialize the boss
  boss = {
    x: ctx.canvas.width / 2,
    y: 150,
    width: 200,
    height: 100,
    health: 100,
    maxHealth: 100,
    speed: 3,
    direction: 1, // 1 for right, -1 for left
  };

  // Transform the player
  playerObject.isTransformed = true;
  playerObject.x = ctx.canvas.width / 2;
  playerObject.y = ctx.canvas.height - 200;
}

export function fireLaser(playerObject, mouse) {
  if (lasers.length >= 10) return; // Limit lasers on screen

  const laser = {
    x: playerObject.x + playerObject.width / 2,
    y: playerObject.y,
    width: 4,
    height: 20,
    color: '#00FFFF',
    speed: 15,
  };

  const angle = Math.atan2(mouse.y - laser.y, mouse.x - laser.x);
  laser.vx = Math.cos(angle) * laser.speed;
  laser.vy = Math.sin(angle) * laser.speed;
  lasers.push(laser);
}

// The main game loop for the boss battle
export function updateBossMode(ctx, playerObject, keys, mouse) {
  let status = "active"; // Default status

  // 1. Update player movement (all directions)
  if (keys["ArrowUp"] || keys["w"]) playerObject.y -= playerSpeed;
  if (keys["ArrowDown"] || keys["s"]) playerObject.y += playerSpeed;
  if (keys["ArrowLeft"] || keys["a"]) playerObject.x -= playerSpeed;
  if (keys["ArrowRight"] || keys["d"]) playerObject.x += playerSpeed;

  // Clamp player to screen bounds
  playerObject.x = Math.max(0, Math.min(playerObject.x, ctx.canvas.width - playerObject.width));
  playerObject.y = Math.max(0, Math.min(playerObject.y, ctx.canvas.height - playerObject.height));

  // 2. Update boss movement (simple side-to-side)
  boss.x += boss.speed * boss.direction;
  if (boss.x > ctx.canvas.width - boss.width || boss.x < 0) {
    boss.direction *= -1;
  }

  // 3. Update player lasers
  lasers.forEach(laser => {
    laser.x += laser.vx;
    laser.y += laser.vy;
  });
  // Filter out lasers that are off-screen
  lasers = lasers.filter(laser => laser.y > 0 && laser.y < ctx.canvas.height && laser.x > 0 && laser.x < ctx.canvas.width);

  // 4. Handle collisions
  lasers.forEach((laser, index) => {
    if (
      laser.x < boss.x + boss.width &&
      laser.x + laser.width > boss.x &&
      laser.y < boss.y + boss.height &&
      laser.y + laser.height > boss.y
    ) {
      boss.health -= 5; // Decrease boss health
      lasers.splice(index, 1); // Remove laser on hit
      if (boss.health <= 0) {
        boss.health = 0;
        console.log("Boss defeated!");
        status = "defeated"; // Set status to defeated
      }
    }
  });
  return status; // Return the final status
}

// The drawing loop for the boss battle
export function drawBossMode(ctx, playerObject) {
  // 1. Draw the transformed player
  if (localCarImg) {
    ctx.drawImage(localCarImg, playerObject.x, playerObject.y, playerObject.width, playerObject.height);
    // Add "transformer" parts
    ctx.fillStyle = 'gray';
    ctx.fillRect(playerObject.x - 10, playerObject.y + 20, 10, 40);
    ctx.fillRect(playerObject.x + playerObject.width, playerObject.y + 20, 10, 40);
  }

  // 2. Draw the boss (alien fighter jet)
  ctx.fillStyle = '#8A2BE2'; // Purple
  ctx.beginPath();
  ctx.moveTo(boss.x + boss.width / 2, boss.y);
  ctx.lineTo(boss.x, boss.y + boss.height * 0.8);
  ctx.lineTo(boss.x + boss.width, boss.y + boss.height * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4B0082'; // Darker purple cockpit
  ctx.fillRect(boss.x + boss.width / 2 - 15, boss.y + 20, 30, 30);

  // 3. Draw all lasers
  lasers.forEach(laser => {
    ctx.fillStyle = laser.color;
    ctx.fillRect(laser.x, laser.y, laser.width, laser.height);
  });

  // 4. Draw the boss health bar
  const barWidth = ctx.canvas.width * 0.6;
  const barHeight = 25;
  const barX = (ctx.canvas.width - barWidth) / 2;
  const barY = 30;
  // Background
  ctx.fillStyle = '#555';
  ctx.fillRect(barX, barY, barWidth, barHeight);
  // Health
  const healthPercentage = boss.health / boss.maxHealth;
  ctx.fillStyle = '#FF4136'; // Red
  ctx.fillRect(barX, barY, barWidth * healthPercentage, barHeight);
  // Text
  ctx.fillStyle = 'white';
  ctx.font = '18px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`ALIEN MOTHERSHIP`, ctx.canvas.width / 2, barY + barHeight / 1.5);
  ctx.textAlign = 'left';
} 