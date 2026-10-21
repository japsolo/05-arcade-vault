// Motor de Asteroides: estado, input, update, draw y bucle de game.js, más las
// fases "ready" y pausa. Sin React: un componente de cliente lo crea y lo destruye.

import {
	Asteroid,
	Bullet,
	H,
	type Keys,
	Particle,
	POINTS,
	POWERUP_DROP_CHANCE,
	POWERUP_DURATION,
	PowerUp,
	Ship,
	W,
	dist,
	rand,
} from "./entities";

export type AsteroidsCallbacks = {
	onPauseChange: (paused: boolean) => void; // también cuando la pausa viene de P/Esc o de blur
	onGameOver: (score: number) => void; // una vez por partida, 1,5 s después del GAME OVER
};

export type AsteroidsHandle = {
	togglePause: () => void; // sin efecto en "ready" y "gameover"
	restart: () => void; // reinicia la partida y vuelve a "ready"
	destroy: () => void; // cancela el rAF y quita todos los listeners
};

type Phase = "ready" | "playing" | "dead" | "gameover";

const GAME_OVER_DELAY = 1500; // ms entre el GAME OVER del canvas y onGameOver
const SCROLL_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"]);

// Con el foco en un campo editable (p. ej. las iniciales del modal) el juego no escucha.
function isEditable(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false;
	return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA";
}

export function createAsteroids(
	canvas: HTMLCanvasElement,
	callbacks: AsteroidsCallbacks,
): AsteroidsHandle {
	const ctx = canvas.getContext("2d");
	if (!ctx) return { togglePause() {}, restart() {}, destroy() {} };

	// ── Input ─────────────────────────────────────────────────────────────────
	let keys: Keys = {};
	let justPressed: Keys = {};

	function pressed(code: string) {
		const val = justPressed[code];
		justPressed[code] = false;
		return val;
	}

	function clearKeys() {
		keys = {};
		justPressed = {};
	}

	function onKeyDown(e: KeyboardEvent) {
		if (isEditable(e.target)) return;
		// En "gameover" el juego no usa teclas y el modal está abierto: ESPACIO debe poder
		// activar sus botones con el teclado.
		if (SCROLL_KEYS.has(e.code) && phase !== "gameover") e.preventDefault();
		const first = !keys[e.code];
		if (first) justPressed[e.code] = true;
		keys[e.code] = true;
		if (first && (e.code === "KeyP" || e.code === "Escape")) togglePause();
	}

	// keyup siempre se registra para que ninguna tecla se quede "pegada".
	function onKeyUp(e: KeyboardEvent) {
		keys[e.code] = false;
	}

	function onBlur() {
		clearKeys();
		autoPause();
	}

	function onVisibilityChange() {
		if (document.visibilityState === "hidden") onBlur();
	}

	// ── Estado del juego ──────────────────────────────────────────────────────
	let ship: Ship;
	let bullets: Bullet[];
	let asteroids: Asteroid[];
	let particles: Particle[];
	let powerUps: PowerUp[];
	let score: number;
	let lives: number;
	let level: number;
	let phase: Phase;
	let paused = false; // solo puede ser true en "playing" o "dead"
	let deadTimer = 0;
	let powerUpSpawned: boolean;
	let killsSinceSpawn: number;
	let gameOverTimer: ReturnType<typeof setTimeout> | null = null;

	function spawnAsteroids(count: number) {
		const SAFE_DIST = 130;
		for (let i = 0; i < count; i++) {
			let x: number, y: number;
			do {
				x = rand(0, W);
				y = rand(0, H);
			} while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
			asteroids.push(new Asteroid(x, y, 3));
		}
	}

	function initGame() {
		ship = new Ship();
		bullets = [];
		asteroids = [];
		particles = [];
		powerUps = [];
		powerUpSpawned = false;
		killsSinceSpawn = 0;
		score = 0;
		lives = 3;
		level = 1;
		phase = "ready";
		spawnAsteroids(4);
	}

	function nextLevel() {
		level++;
		bullets = [];
		particles = [];
		powerUps = [];
		powerUpSpawned = false;
		killsSinceSpawn = 0;
		ship.reset();
		spawnAsteroids(3 + level);
	}

	function explode(x: number, y: number, count = 8) {
		for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
	}

	function killShip() {
		explode(ship.x, ship.y, 14);
		ship.dead = true;
		lives--;
		if (lives <= 0) {
			phase = "gameover";
			const finalScore = score;
			gameOverTimer = setTimeout(() => {
				gameOverTimer = null;
				callbacks.onGameOver(finalScore);
			}, GAME_OVER_DELAY);
		} else {
			phase = "dead";
			deadTimer = 2;
		}
	}

	// ── Pausa ─────────────────────────────────────────────────────────────────
	function setPaused(value: boolean) {
		if (paused === value) return;
		paused = value;
		if (!paused) {
			// Sin salto de simulación al reanudar ni disparos acumulados en pausa.
			lastTime = null;
			justPressed = {};
		}
		needsDraw = true;
		callbacks.onPauseChange(paused);
	}

	function togglePause() {
		if (phase !== "playing" && phase !== "dead") return;
		setPaused(!paused);
	}

	function autoPause() {
		if (phase === "playing" || phase === "dead") setPaused(true);
	}

	// ── Update ────────────────────────────────────────────────────────────────
	function update(dt: number) {
		if (phase === "ready") {
			if (pressed("Space")) phase = "playing";
			return;
		}

		// A diferencia del original, ESPACIO no reinicia: el reinicio llega con restart().
		if (phase === "gameover") {
			particles.forEach((p) => p.update(dt));
			particles = particles.filter((p) => !p.dead);
			return;
		}

		if (phase === "dead") {
			deadTimer -= dt;
			particles.forEach((p) => p.update(dt));
			particles = particles.filter((p) => !p.dead);
			asteroids.forEach((a) => a.update(dt));
			if (deadTimer <= 0) {
				phase = "playing";
				ship.reset();
			}
			return;
		}

		// Disparar
		if (pressed("Space")) {
			bullets.push(...ship.tryShoot());
		}

		ship.update(dt, keys);
		bullets.forEach((b) => b.update(dt));
		asteroids.forEach((a) => a.update(dt));
		particles.forEach((p) => p.update(dt));
		powerUps.forEach((p) => p.update(dt));

		bullets = bullets.filter((b) => !b.dead);
		particles = particles.filter((p) => !p.dead);
		powerUps = powerUps.filter((p) => !p.dead);

		for (const p of powerUps) {
			if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
				p.dead = true;
				ship.tripleShot = POWERUP_DURATION;
			}
		}

		// Bala vs asteroide
		const newAsteroids: Asteroid[] = [];
		for (const b of bullets) {
			for (const a of asteroids) {
				if (!a.dead && !b.dead && dist(b, a) < a.radius) {
					b.dead = true;
					a.dead = true;
					score += POINTS[a.size];
					explode(a.x, a.y, a.size * 5);
					newAsteroids.push(...a.split());
					if (!powerUpSpawned) {
						killsSinceSpawn++;
						const guaranteed = killsSinceSpawn >= 5;
						if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
							powerUps.push(new PowerUp(a.x, a.y));
							powerUpSpawned = true;
						}
					}
				}
			}
		}
		asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
		bullets = bullets.filter((b) => !b.dead);

		// Nave vs asteroide
		if (ship.invincible <= 0) {
			for (const a of asteroids) {
				if (dist(ship, a) < ship.radius + a.radius * 0.82) {
					killShip();
					break;
				}
			}
		}

		// Nivel completado
		if (asteroids.length === 0) nextLevel();
	}

	// ── Draw ──────────────────────────────────────────────────────────────────
	function drawLifeIcon(c: CanvasRenderingContext2D, x: number, y: number) {
		c.save();
		c.translate(x, y);
		c.rotate(-Math.PI / 2);
		c.strokeStyle = "#fff";
		c.lineWidth = 1.2;
		c.lineJoin = "round";
		c.beginPath();
		c.moveTo(9, 0);
		c.lineTo(-6, -5);
		c.lineTo(-3, 0);
		c.lineTo(-6, 5);
		c.closePath();
		c.stroke();
		c.restore();
	}

	function drawHUD(c: CanvasRenderingContext2D) {
		c.fillStyle = "#fff";
		c.font = "15px monospace";

		c.textAlign = "left";
		c.fillText(`SCORE  ${score}`, 14, 26);

		c.textAlign = "center";
		c.fillText(`NIVEL ${level}`, W / 2, 26);

		for (let i = 0; i < lives; i++) drawLifeIcon(c, W - 16 - i * 22, 18);

		if (ship.tripleShot > 0) {
			c.textAlign = "left";
			c.fillStyle = "#0ff";
			c.fillText(`3x  ${ship.tripleShot.toFixed(1)}s`, 14, 46);
		}
	}

	function drawOverlay(c: CanvasRenderingContext2D, title: string, sub: string) {
		c.textAlign = "center";
		c.fillStyle = "#fff";
		c.font = "bold 46px monospace";
		c.fillText(title, W / 2, H / 2 - 18);
		c.font = "18px monospace";
		c.fillStyle = "rgba(255,255,255,0.65)";
		c.fillText(sub, W / 2, H / 2 + 22);
	}

	function draw(c: CanvasRenderingContext2D) {
		c.fillStyle = "#000";
		c.fillRect(0, 0, W, H);

		particles.forEach((p) => p.draw(c));
		asteroids.forEach((a) => a.draw(c));
		powerUps.forEach((p) => p.draw(c));
		bullets.forEach((b) => b.draw(c));
		if (phase !== "ready") ship.draw(c);

		drawHUD(c);

		if (phase === "ready") drawOverlay(c, "ROCAS", "PULSA ESPACIO PARA EMPEZAR");
		else if (phase === "gameover") drawOverlay(c, "GAME OVER", `PUNTAJE: ${score}`);
		else if (paused) drawOverlay(c, "EN PAUSA", "P O ESC PARA CONTINUAR");
	}

	// ── Escalado ──────────────────────────────────────────────────────────────
	// Mundo lógico de W×H; el buffer del canvas es W·dpr × H·dpr y el CSS lo ajusta.
	let dpr = 0;

	function syncResolution(c: CanvasRenderingContext2D) {
		const next = window.devicePixelRatio || 1;
		if (next === dpr) return;
		dpr = next;
		canvas.width = Math.round(W * dpr);
		canvas.height = Math.round(H * dpr);
		c.setTransform(dpr, 0, 0, dpr, 0, 0);
		needsDraw = true;
	}

	// ── Loop principal ────────────────────────────────────────────────────────
	let lastTime: number | null = null;
	let rafId = 0;
	// En pausa no se redibuja cada frame para que la escena quede congelada
	// (la llama y el pulso del power-up se animan al dibujar).
	let needsDraw = true;

	function loop(ts: number) {
		const c = ctx!; // ya comprobado arriba; las funciones declaradas no heredan el narrowing
		const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
		lastTime = ts;
		syncResolution(c);
		if (!paused) update(dt);
		if (!paused || needsDraw) {
			draw(c);
			needsDraw = false;
		}
		rafId = requestAnimationFrame(loop);
	}

	// ── API ───────────────────────────────────────────────────────────────────
	function restart() {
		if (gameOverTimer !== null) clearTimeout(gameOverTimer);
		gameOverTimer = null;
		clearKeys();
		initGame();
		setPaused(false);
		lastTime = null;
		needsDraw = true;
	}

	function destroy() {
		cancelAnimationFrame(rafId);
		if (gameOverTimer !== null) clearTimeout(gameOverTimer);
		gameOverTimer = null;
		window.removeEventListener("keydown", onKeyDown);
		window.removeEventListener("keyup", onKeyUp);
		window.removeEventListener("blur", onBlur);
		document.removeEventListener("visibilitychange", onVisibilityChange);
	}

	window.addEventListener("keydown", onKeyDown);
	window.addEventListener("keyup", onKeyUp);
	window.addEventListener("blur", onBlur);
	document.addEventListener("visibilitychange", onVisibilityChange);

	initGame();
	rafId = requestAnimationFrame(loop);

	return { togglePause, restart, destroy };
}
