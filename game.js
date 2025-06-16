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
      width: 120 * scale,
      height: 80 * scale,
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

    function drawBackground() {
  // Sunset gradient
  const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGradient.addColorStop(0, "#FF5F6D"); // warm pinkish-orange
  skyGradient.addColorStop(0.5, "#FFC371"); // soft orange
  skyGradient.addColorStop(1, "#2C3E50"); // dark blue-purple near horizon
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Distant hills with darker warm tones
  ctx.fillStyle = "#6E4A35"; // warm brownish
  for (let i = 0; i < canvas.width; i += 100) {
    const offset = (roadOffset * 0.3) % 200;
    ctx.beginPath();
    ctx.arc(i + offset, canvas.height - 120, 100, 0, Math.PI, true);
    ctx.fill();
      }

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
      }
      obstacles = obstacles.filter(obs => obs.x + 60 * scale > 0);

      obstacleTimer--;
      if (obstacleTimer <= 0) {
        const isTree = Math.random() < 0.5;
        if (isTree) {
          const height = (80 + Math.random() * 120) * scale;
          const y = canvas.height - 30 * scale - height;
          obstacles.push({ x: canvas.width, y: y, width: 60 * scale, height, type: "tree", trunkRandom: Math.random(), hit: false });
        } else if (Math.random() < 0.2) {
          obstacles.push({ x: canvas.width, y: canvas.height - 140 * scale, width: 50 * scale, height: 50 * scale, type: "fuel" });
        } else {
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
          if (obs.type === "tree" && !obs.hit) {
            obs.hit = true;
            health -= 25;
            if (health <= 0) {
              gameState = "gameover";
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
      ctx.fillText("Car Runner", canvas.width / 2 - 110, canvas.height / 2 - 20);
      ctx.font = "20px 'Press Start 2P', monospace";
      ctx.fillText("Press Space or Tap to Start", canvas.width / 2 - 130, canvas.height / 2 + 20);
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
      drawCar();
      drawObstacles();
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
      // Increase speed every 100 points
      if (score > 0 && Math.floor(score) % 100 === 0) {
        speed += 0.1;
      }
      fuelTimer++;
      if (fuelTimer % 5 === 0) fuel -= 0.1;
      if (fuel <= 0) {
        fuel = 0;
        gameState = "gameover";
      }

      ctx.fillStyle = "white";
      ctx.font = "20px 'Press Start 2P', monospace";
      ctx.fillText("Score: " + Math.floor(score), 10, 30);
      ctx.fillText("High Score: " + highScore, 10, 55);
      ctx.fillText("Health: " + health + "%", 10, 80);
      ctx.fillText("Fuel: " + Math.floor(fuel) + "%", 10, 105);

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