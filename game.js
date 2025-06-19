      /*
      --- AMBITIOUS UPGRADE PLAN ---
      1. Visuals:
        - Parallax background layers (sky, hills, trees)
        - Animated sprite for car and wheels
        - Particle effects (dust when jumping/landing)

      2. Physics:
        - Realistic gravity with variable jump power
        - Smooth acceleration and friction
        - Curved hills and terrain physics

      3. Gameplay:
        - Procedural terrain generation
        - Boost pickups and fuel management
        - Obstacles with physics-based interactions
        - Scoring system with multipliers
        - Lives or health system

      4. UI and Experience:
        - Start screen, pause, and game over transitions
        - Touch and keyboard input support
        - Adaptive difficulty scaling with speed
        - Local high score storage
    */
    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
    let scale = canvas.width / 1200;

    const carImg = new Image();
    let carImgLoaded = false;
    carImg.src = "car3.png";
    carImg.onload = () => {
      carImgLoaded = true;
    };

    let roadOffset = 0;

    let gameState = "start"; // "start", "playing", "paused", "gameover"

    // Particle array for dust effects
    let particles = [];
    let floatingTexts = [];

    const car = {
      x: 400 * scale,
      y: 450 * scale,
      width: 180 * scale,
      height: 100 * scale,
      color: "skyblue",
      dy: 0,
      onGround: true
    };

    let carFrame = 0;

    const gravity = 0.5;
    const jumpStrength = -12 * scale;
    let obstacles = [];
    let obstacleTimer = 0;
let score = 0;
let highScore = parseInt(localStorage.getItem("highScore")) || 0;
let health = 100;
let fuel = 100;
let fuelTimer = 0;
let speed = 3;

let shieldActive = false;
let shieldTimer = 0;

let turboActive = false;
let turboTimer = 0;
const turboSpeedMultiplier = 2;

    function drawBackground() {
  // Sunset gradient
  const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGradient.addColorStop(0, "#FF5F6D"); // warm pinkish-orange
  skyGradient.addColorStop(0.5, "#FFC371"); // soft orange
  skyGradient.addColorStop(1, "#2C3E50"); // dark blue-purple near horizon
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
/*
  // Distant mountain range
  ctx.fillStyle = "#6E4A35"; // mountain color
  ctx.beginPath();
  ctx.moveTo(0, canvas.height);
  let step = 0;
  while (step < canvas.width + 100) {
    const peakX = step + Math.random() * 60 + 40;
    const peakY = canvas.height - (80 + Math.random() * 60);
    ctx.lineTo(peakX, peakY);
    step = peakX + Math.random() * 30 + 30;
  }
  ctx.lineTo(canvas.width, canvas.height);
  ctx.closePath();
  ctx.fill();
*/
    }

    function drawCar() {
      if (carImgLoaded) {
        ctx.drawImage(carImg, car.x, car.y - 15, car.width, car.height + 15);
      }

      const wheelRadius = 10;
      const wheelOffsetY = car.y + car.height;
      const leftWheelX = car.x + 22;
      const rightWheelX = car.x + car.width - 22;
      const angle = (carFrame * 0.3) % (2 * Math.PI);

      ctx.fillStyle = "black";
    }

    function drawRoad() {
      const roadHeight = 110 * scale;
      roadOffset -= speed * 1.5;
      if (roadOffset <= -60 * scale) roadOffset = 0;

      ctx.fillStyle = "#555";
      for (let i = 0; i < canvas.width / (60 * scale) + 2; i++) {
        ctx.fillRect(i * 60 * scale + roadOffset, canvas.height - roadHeight, 30 * scale, roadHeight);
      }
    }

    function drawObstacles() {
      for (let obs of obstacles) {
        if (obs.type === "tree") {
          const trunkHeight = obs.height * (0.3 + 0.4 * (obs.trunkRandom || 0.5)); // vary between 30% to 70% of height
          const trunkWidth = 10;
          const swayX = obs.hit ? Math.sin(Date.now() / 100) * 8 : 0;
          const swayY = obs.hit ? Math.cos(Date.now() / 120) * 2 : 0;
          const trunkX = obs.x + obs.width / 2 - trunkWidth / 2 + swayX;
          const trunkY = obs.y + obs.height - trunkHeight + swayY;

          // Draw trunk
          ctx.fillStyle = "#8B4513"; // brown
          ctx.fillRect(trunkX, trunkY, trunkWidth, trunkHeight);

          // Draw foliage as circles, scaled to trunk and height
          ctx.fillStyle = "#2e8b57"; // dark green
          const foliageRadius1 = obs.height * 0.3;
          const foliageRadius2 = obs.height * 0.25;
          const foliageRadius3 = obs.height * 0.2;

          ctx.beginPath();
          ctx.arc(obs.x + obs.width / 2 + swayX, trunkY + swayY, foliageRadius1, 0, Math.PI * 2);
          ctx.arc(obs.x + obs.width / 2 - foliageRadius2 + swayX, trunkY + foliageRadius2 * 0.3 + swayY, foliageRadius2, 0, Math.PI * 2);
          ctx.arc(obs.x + obs.width / 2 + foliageRadius2 + swayX, trunkY + foliageRadius2 * 0.3 + swayY, foliageRadius2, 0, Math.PI * 2);
          ctx.arc(obs.x + obs.width / 2 + swayX, trunkY - foliageRadius3 * 0.8 + swayY, foliageRadius3, 0, Math.PI * 2);
          ctx.fill();
        } else if (obs.type === "cloud") {
          ctx.fillStyle = "#ddd";
          ctx.beginPath();
          ctx.arc(obs.x + 20, obs.y + 20, 20, 0, Math.PI * 2);
          ctx.arc(obs.x + 40, obs.y + 10, 30, 0, Math.PI * 2);
          ctx.arc(obs.x + 70, obs.y + 20, 20, 0, Math.PI * 2);
          ctx.fill();
        }
        else if (obs.type === "fuel") {
          ctx.font = `${Math.floor(obs.height)}px Arial`;
          ctx.fillStyle = "yellow";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("⛽", obs.x + obs.width / 2, obs.y + obs.height / 2);
        }
        else if (obs.type === "ufo") {
          // Draw UFO body
          ctx.fillStyle = "#b0e0e6";
          ctx.beginPath();
          ctx.ellipse(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.width / 2, obs.height / 2, 0, 0, Math.PI * 2);
          ctx.fill();

          // Draw UFO base
          ctx.fillStyle = "#666";
          ctx.beginPath();
          ctx.ellipse(obs.x + obs.width / 2, obs.y + obs.height / 2 + 5, obs.width * 0.6, 10 * scale, 0, 0, Math.PI);
          ctx.fill();
        }
        else if (obs.type === "turbo") {
          // Only draw custom turbo orb and flames, no bounding box or fillRect
          const centerX = obs.x + obs.width / 2;
          const centerY = obs.y + obs.height / 2;
          const radius = obs.height / 2;

          // Animated flame effect
          const time = Date.now() * 0.01;
          const flameOffset = Math.sin(time) * 2;

          // Flame colors gradient
          const flameGradient = ctx.createRadialGradient(centerX, centerY, radius * 0.3, centerX, centerY, radius * 1.5);
          flameGradient.addColorStop(0, "rgba(255, 140, 0, 0.9)");
          flameGradient.addColorStop(0.3, "rgba(255, 69, 0, 0.7)");
          flameGradient.addColorStop(0.7, "rgba(255, 0, 0, 0.4)");
          flameGradient.addColorStop(1, "rgba(255, 0, 0, 0)");

          // Draw flame shape (triangles) behind orb, slightly offset to left as exhaust
          ctx.fillStyle = flameGradient;
          ctx.beginPath();
          ctx.moveTo(centerX - radius * 0.7, centerY + flameOffset);
          ctx.lineTo(centerX - radius * 1.5, centerY - radius * 0.5 + flameOffset);
          ctx.lineTo(centerX - radius * 1.5, centerY + radius * 0.5 + flameOffset);
          ctx.closePath();
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(centerX - radius * 1.1, centerY - flameOffset);
          ctx.lineTo(centerX - radius * 1.8, centerY - radius * 0.3 - flameOffset);
          ctx.lineTo(centerX - radius * 1.8, centerY + radius * 0.3 - flameOffset);
          ctx.closePath();
          ctx.fill();

          // Draw turbo orb with gradient
          const orbGradient = ctx.createRadialGradient(centerX - radius * 0.3, centerY - radius * 0.3, 0, centerX, centerY, radius);
          orbGradient.addColorStop(0, "#FFD700"); // bright gold
          orbGradient.addColorStop(0.7, "#FFA500"); // orange
          orbGradient.addColorStop(1, "#FF8C00"); // dark orange
          
          ctx.fillStyle = orbGradient;
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.fill();

          // Add glow effect
          ctx.shadowColor = "#FFD700";
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Lightning bolt symbol
          ctx.fillStyle = "white";
          ctx.font = `${radius * 1.2}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("⚡", centerX, centerY);
        }
        else if (obs.type === "shield") {
          // Only draw custom shield oval and emoji, no bounding box or fillRect
          const centerX = obs.x + obs.width / 2;
          const centerY = obs.y + obs.height / 2;
          const width = obs.width * 1.2;
          const height = obs.height * 0.7;

          // Animated shield effect
          const time = Date.now() * 0.005;
          const pulseScale = 1 + Math.sin(time) * 0.1;

          // Draw cyan translucent oval with white border
          const shieldGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, height / 2);
          shieldGradient.addColorStop(0, "rgba(0, 255, 255, 0.8)");
          shieldGradient.addColorStop(0.7, "rgba(0, 255, 255, 0.4)");
          shieldGradient.addColorStop(1, "rgba(0, 255, 255, 0.1)");
          
          ctx.fillStyle = shieldGradient;
          ctx.beginPath();
          ctx.arc(centerX, centerY, (width / 2) * pulseScale, 0, Math.PI * 2);
          ctx.fill();

          // Draw shield border with glow
          ctx.strokeStyle = "rgba(0, 255, 255, 0.8)";
          ctx.lineWidth = 3;
          ctx.shadowColor = "#00FFFF";
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(centerX, centerY, (width / 2) * pulseScale, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Inner white border
          ctx.strokeStyle = "white";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(centerX, centerY, (width / 2) * pulseScale - 2, 0, Math.PI * 2);
          ctx.stroke();

          // Draw shield emoji inside oval
          ctx.fillStyle = "white";
          ctx.font = `${height * 0.8}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("🛡️", centerX, centerY);
        }
        else if (obs.type === "pothole") {
          // Draw a smooth amoeba-like black shape on the road, with a light gray jagged outline
          ctx.save();
          const relPoints = obs.relPoints;
          // Calculate midpoints for smooth curves
          ctx.beginPath();
          let len = relPoints.length;
          for (let i = 0; i < len; i++) {
            const p1 = relPoints[i];
            const p2 = relPoints[(i + 1) % len];
            const midX = obs.x + (p1.x + p2.x) / 2;
            const midY = obs.y + (p1.y + p2.y) / 2;
            if (i === 0) {
              ctx.moveTo(midX, midY);
            } else {
              ctx.quadraticCurveTo(obs.x + p1.x, obs.y + p1.y, midX, midY);
            }
          }
          ctx.closePath();
          // Fill
          ctx.fillStyle = "#000";
          ctx.shadowColor = "#111";
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
          // Outline
          ctx.strokeStyle = "#bbb";
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Draw dust particles
    function drawParticles() {
      for (let p of particles) {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;
    }

    function drawFloatingTexts() {
      for (let ft of floatingTexts) {
        ctx.globalAlpha = ft.alpha;
        ctx.fillStyle = "yellow";
        ctx.font = "18px Arial";
        ctx.fillText(ft.text, ft.x, ft.y);
        ft.y += ft.dy;
        ft.alpha -= 0.01;
      }
      ctx.globalAlpha = 1.0;
      floatingTexts = floatingTexts.filter(ft => ft.alpha > 0);
    }

    // Spawn dust particles at (x, y)
    function spawnDust(x, y) {
      for (let i = 0; i < 10; i++) {
        particles.push({
          x: x + Math.random() * 30 - 15,
          y: y + Math.random() * 5,
          radius: 2 + Math.random() * 2,
          dx: (Math.random() - 0.5) * 2,
          dy: -Math.random() * 1.5,
          alpha: 1.0,
          decay: 0.02,
          color: "#ccc"
        });
      }
    }

    function updateObstacles() {
      for (let obs of obstacles) {
        obs.x -= speed * 1.5;
        if (obs.type === "ufo" && obs.dx) {
          obs.x += obs.dx;
        }
        // UFO swoop logic
        if (obs.type === "ufo" && typeof obs.dy === "number") {
          if (obs.y < obs.targetY) {
            obs.y += obs.dy;
            if (obs.y > obs.targetY) {
              obs.y = obs.targetY;
              obs.dy = 0;
            }
          }
        }
      }
      obstacles = obstacles.filter(obs => obs.x + 60 * scale > 0);

      obstacleTimer--;
      if (obstacleTimer <= 0) {
        const rand = Math.random();
        if (rand < 0.25) {
          // Tree: 25%
          const height = (80 + Math.random() * 120) * scale;
          const y = canvas.height - 30 * scale - height;
          obstacles.push({ x: canvas.width, y: y, width: 60 * scale, height, type: "tree", trunkRandom: Math.random(), hit: false });
        } else if (rand < 0.50) {
          // Pothole: 25%
          const potholeWidth = 110 * scale + Math.random() * 50 * scale;
          const potholeHeight = 45 * scale + Math.random() * 20 * scale;
          const baseX = canvas.width;
          // Place pothole so it sits on the road
          const roadHeight = 110 * scale;
          const baseY = canvas.height - roadHeight + 10 * scale;
          // Generate amoeba points (relative to center)
          const relPoints = [];
          const numPoints = 14 + Math.floor(Math.random() * 5); // 14-18 points
          for (let i = 0; i < numPoints; i++) {
            const angle = (Math.PI * 2 / numPoints) * i;
            const rX = (potholeWidth / 2) * (0.8 + Math.random() * 0.4); // 80%-120% of radius
            const rY = (potholeHeight / 2) * (0.8 + Math.random() * 0.4);
            relPoints.push({
              x: potholeWidth / 2 + Math.cos(angle) * rX,
              y: potholeHeight / 2 + Math.sin(angle) * rY
            });
          }
          obstacles.push({
            x: baseX,
            y: baseY,
            width: potholeWidth,
            height: potholeHeight,
            type: "pothole",
            relPoints,
            hit: false
          });
        } else if (rand < 0.75) {
          // Power-up: 25% (split equally)
          const powerRand = Math.random();
          if (powerRand < 1/3) {
            obstacles.push({ x: canvas.width, y: canvas.height - 140 * scale, width: 50 * scale, height: 50 * scale, type: "fuel" });
          } else if (powerRand < 2/3) {
            obstacles.push({
              x: canvas.width,
              y: canvas.height - 80 * scale,
              width: 50 * scale,
              height: 50 * scale,
              type: "turbo"
            });
          } else {
            obstacles.push({
              x: canvas.width,
              y: canvas.height - 80 * scale,
              width: 50 * scale,
              height: 50 * scale,
              type: "shield"
            });
          }
        } // else: nothing (25%)
        // Separate roll for cloud (30% chance)
        if (Math.random() < 0.3) {
          obstacles.push({ x: canvas.width, y: 180 * scale + Math.random() * 60 * scale, width: 90 * scale, height: 50 * scale, type: "cloud" });
        }
        obstacleTimer = 60 + Math.random() * 80;
      }
    }

    function checkCollision() {
      for (let obs of obstacles) {
        const buffer = 20;
        if (
          car.x < obs.x + obs.width - buffer &&
          car.x + car.width > obs.x + buffer &&
          car.y < obs.y + obs.height - buffer &&
          car.y + car.height > obs.y + buffer
        ) {
          if ((obs.type === "tree" || obs.type === "ufo" || obs.type === "pothole") && !obs.hit) {
            obs.hit = true;
            if (!shieldActive) {
              health -= 25;
              if (health <= 0) {
                gameState = "gameover";
              }
            }
          }
          else if (obs.type === "fuel" && !obs.hit) {
            obs.hit = true;
            fuel = Math.min(100, fuel + 25);
            floatingTexts.push({
              text: "+25% Fuel",
              x: obs.x,
              y: obs.y,
              alpha: 1.0,
              dy: -0.5
            });
          }
          else if (obs.type === "turbo" && !obs.hit) {
            obs.hit = true;
            turboActive = true;
            turboTimer = 300; // 5 seconds at ~60 FPS
            floatingTexts.push({
              text: "Turbo Activated!",
              x: obs.x,
              y: obs.y,
              alpha: 1.0,
              dy: -0.5
            });
          }
          else if (obs.type === "shield" && !obs.hit) {
            obs.hit = true;
            shieldActive = true;
            shieldTimer = 300; // 5 seconds at ~60 FPS
            floatingTexts.push({
              text: "Shield Activated!",
              x: obs.x,
              y: obs.y,
              alpha: 1.0,
              dy: -0.5
            });
          }
        }
      }
    }

    function drawGameOver() {
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "white";
      ctx.font = "40px 'Press Start 2P', monospace";
      ctx.fillText("Game Over", canvas.width / 2 - 120, canvas.height / 2 - 20);
      ctx.font = "20px 'Press Start 2P', monospace";
      ctx.fillText("Press 'R' to restart", canvas.width / 2 - 100, canvas.height / 2 + 20);
    }

    function drawStartScreen() {
      ctx.fillStyle = "#222";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "white";
      ctx.font = "40px 'Press Start 2P', monospace";
      ctx.fillText("Car Runner", canvas.width / 2 - 110, canvas.height / 2 - 60);
      ctx.font = "20px 'Press Start 2P', monospace";
      ctx.fillText("Avoid obstacles and beat the high score!", canvas.width / 2 - 180, canvas.height / 2 - 10);
      ctx.font = "18px 'Press Start 2P', monospace";
      ctx.fillText("Press Spacebar or Touch to Jump", canvas.width / 2 - 130, canvas.height / 2 + 30);
      ctx.font = "16px 'Press Start 2P', monospace";
      ctx.fillText("Press Space or Tap to Start", canvas.width / 2 - 110, canvas.height / 2 + 60);
    }

    let jumpHoldTime = 0;
    const maxJumpHold = 15; // max frames to hold jump
    let jumping = false;

    function handleJumpStart() {
      if (car.onGround && gameState === "playing") {
        car.dy = jumpStrength;
        car.onGround = false;
        jumping = true;
        jumpHoldTime = 0;
      }
    }

    function handleJumpEnd() {
      jumping = false;
    }

    function drawCarShieldEffect() {
      if (!shieldActive) return;
      const centerX = car.x + car.width / 2;
      const centerY = car.y + car.height / 2;
      const radius = Math.max(car.width, car.height) * 0.65;
      const time = Date.now() * 0.005;
      const pulseScale = 1 + Math.sin(time) * 0.08;

      // Shield gradient
      const shieldGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * pulseScale);
      shieldGradient.addColorStop(0, "rgba(0,255,255,0.7)");
      shieldGradient.addColorStop(0.7, "rgba(0,255,255,0.3)");
      shieldGradient.addColorStop(1, "rgba(0,255,255,0.05)");

      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = shieldGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * pulseScale, 0, Math.PI * 2);
      ctx.fill();

      // Outer glow
      ctx.shadowColor = "#00FFFF";
      ctx.shadowBlur = 16;
      ctx.strokeStyle = "rgba(0,255,255,0.7)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * pulseScale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    function drawCarTurboEffect() {
      if (!turboActive) return;
      const centerX = car.x + car.width / 2;
      const centerY = car.y + car.height / 2;
      const radius = Math.max(car.width, car.height) * 0.45;
      const time = Date.now() * 0.01;
      const flameOffset = Math.sin(time) * 3;
      const flameLen = radius * 1.2;

      // Draw animated flames behind car
      ctx.save();
      const flameX = car.x - flameLen * 0.7;
      const flameY = centerY;
      const flameGradient = ctx.createRadialGradient(flameX, flameY, radius * 0.2, flameX, flameY, flameLen);
      flameGradient.addColorStop(0, "rgba(255, 200, 0, 0.8)");
      flameGradient.addColorStop(0.4, "rgba(255, 100, 0, 0.6)");
      flameGradient.addColorStop(1, "rgba(255, 0, 0, 0)");
      ctx.fillStyle = flameGradient;
      ctx.beginPath();
      ctx.moveTo(car.x, centerY + flameOffset);
      ctx.lineTo(car.x - flameLen, centerY - radius * 0.5 + flameOffset);
      ctx.lineTo(car.x - flameLen, centerY + radius * 0.5 + flameOffset);
      ctx.closePath();
      ctx.fill();

      // Draw turbo orb glow around car
      const orbGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      orbGradient.addColorStop(0, "#FFD700");
      orbGradient.addColorStop(0.7, "#FFA500");
      orbGradient.addColorStop(1, "#FF8C00");
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = orbGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.restore();
    }

    function update() {
      carFrame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawBackground();

      if (gameState === "start") {
        drawStartScreen();
        return;
      }

      if (gameState === "gameover") {
        drawRoad();
        drawCar();
        drawObstacles();
        drawParticles();
        drawGameOver();
        return;
      }

      // "playing" or "paused"
      drawRoad();
      drawObstacles();
      drawCar();
      drawCarShieldEffect();
      drawCarTurboEffect();
      drawParticles();
      drawFloatingTexts();

      if (gameState === "paused") {
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "white";
        ctx.font = "40px 'Press Start 2P', monospace";
        ctx.fillText("Paused", canvas.width / 2 - 70, canvas.height / 2 - 20);
        ctx.font = "20px 'Press Start 2P', monospace";
        ctx.fillText("Press 'P' to resume", canvas.width / 2 - 100, canvas.height / 2 + 20);
        return;
      }

      // playing
      car.dy += gravity;
      if (jumping && jumpHoldTime < maxJumpHold) {
        car.dy += jumpStrength * 0.05; // slightly reduce gravity during hold
        jumpHoldTime++;
      }
      // Particle landing detection
      const previousY = car.y;
      car.y += car.dy;
      const groundY = canvas.height - 150 * scale;
      if (car.y >= groundY) {
        if (!car.onGround && previousY < groundY) {
          spawnDust(car.x + car.width / 2, groundY + car.height / 2);
        }
        car.y = groundY;
        car.dy = 0;
        car.onGround = true;
      }

      // Update particles
      for (let p of particles) {
        p.x += p.dx;
        p.y += p.dy;
        p.alpha -= p.decay;
      }
      particles = particles.filter(p => p.alpha > 0);

      updateObstacles();
      checkCollision();
      score += 0.1;

      // Turbo and shield logic, and speed/visual indicators
      if (turboActive) {
        speed = 3 * turboSpeedMultiplier;
        turboTimer--;
        if (turboTimer <= 0) {
          turboActive = false;
          speed = 3; // reset to base speed (or your variable speed if increased)
        }
      } else {
        // Normal speed increases based on score
        if (score > 0 && Math.floor(score) % 100 === 0) {
          speed += 0.1;
        }
      }

      if (shieldActive) {
        shieldTimer--;
        if (shieldTimer <= 0) {
          shieldActive = false;
        }
      }

      // Optional: Visual indicators for active shield or turbo
      // if (shieldActive) {
      //   ctx.strokeStyle = "cyan";
      //   ctx.lineWidth = 5;
      //   ctx.strokeRect(car.x - 5, car.y - 5, car.width + 10, car.height + 10);
      // }
      // if (turboActive) {
      //   ctx.strokeStyle = "orange";
      //   ctx.lineWidth = 5;
      //   ctx.strokeRect(car.x - 10, car.y - 10, car.width + 20, car.height + 20);
      // }

      fuelTimer++;
      if (fuelTimer % 5 === 0) fuel -= 0.1;
      if (fuel <= 0) {
        fuel = 0;
        gameState = "gameover";
      }

      const infoText = `Score: ${Math.floor(score)}   High Score: ${highScore}   Health: ${health}%   Fuel: ${Math.floor(fuel)}%`;
      ctx.fillStyle = "white";
      ctx.font = "20px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.fillText(infoText, canvas.width / 2, 40);
      ctx.textAlign = "left";

      requestAnimationFrame(update);
    }

    function restartGame() {
      if (score > highScore) {
        highScore = Math.floor(score);
        localStorage.setItem("highScore", highScore);
      }
      health = 100;
      fuel = 100;
      car.x = 100 * scale;
      car.y = canvas.height - 150 * scale;
      car.dy = 0;
      car.onGround = true;
      obstacles = [];
      obstacleTimer = 0;
      score = 0;
      particles = [];
      gameState = "playing";
      update();
    }

    document.addEventListener("keydown", (e) => {
      if ((e.key === " " || e.key === "Spacebar")) {
        if (gameState === "start") {
          gameState = "playing";
          restartGame();
        } else if (car.onGround && gameState === "playing") {
          handleJumpStart();
        }
      } else if (e.key === "r" || e.key === "R") {
        if (gameState === "gameover") restartGame();
      } else if (e.key === "p" || e.key === "P") {
        if (gameState === "playing") gameState = "paused";
        else if (gameState === "paused") gameState = "playing";
      }
    });

    document.addEventListener("keyup", (e) => {
      if ((e.key === " " || e.key === "Spacebar") && gameState === "playing") {
        handleJumpEnd();
      }
    });

    canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      if (gameState === "start") {
        gameState = "playing";
        restartGame();
      } else {
        handleJumpStart();
      }
    }, { passive: false });

    canvas.addEventListener("touchend", (e) => {
      e.preventDefault();
      handleJumpEnd();
    }, { passive: false });

    canvas.addEventListener("click", () => {
      if (gameState === "start") {
        gameState = "playing";
        restartGame();
      } else {
        handleJumpStart();
        setTimeout(handleJumpEnd, 100); // quick tap simulates short jump
      }
    });

    update();