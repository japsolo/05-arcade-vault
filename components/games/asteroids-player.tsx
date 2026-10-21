"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GameOverModal } from "@/components/game-over-modal";
import {
	type AsteroidsCallbacks,
	type AsteroidsHandle,
	createAsteroids,
} from "@/lib/asteroids/engine";
import type { Game } from "@/lib/games";
import { useSession } from "@/lib/use-session";

export function AsteroidsPlayer({ game }: { game: Game }) {
	const { user } = useSession();
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const engineRef = useRef<AsteroidsHandle | null>(null);
	const [paused, setPaused] = useState(false);
	// null = partida en curso; un número = el motor avisó del GAME OVER y se abre el modal.
	const [finalScore, setFinalScore] = useState<number | null>(null);

	// Los callbacks viven en un ref para que el motor se cree una sola vez por montaje.
	const callbacksRef = useRef<AsteroidsCallbacks>({
		onPauseChange: setPaused,
		onGameOver: setFinalScore,
	});

	const name = user?.name ?? "INVITADO";

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const engine = createAsteroids(canvas, {
			onPauseChange: (p) => callbacksRef.current.onPauseChange(p),
			onGameOver: (s) => callbacksRef.current.onGameOver(s),
		});
		engineRef.current = engine;
		return () => {
			engine.destroy();
			engineRef.current = null;
			// Con cacheComponents la página se oculta (Activity) en vez de desmontarse y
			// conserva el estado de React; al volver se crea un motor nuevo en "ready".
			setPaused(false);
			setFinalScore(null);
		};
	}, []);

	const restart = () => {
		setFinalScore(null);
		engineRef.current?.restart();
	};

	return (
		<div className="av-player fade-in">
			<div className="player-hud">
				<div className="hud-stat">
					<div className="l">Jugador</div>
					<div className="v" style={{ color: "var(--ink)" }}>
						{name}
					</div>
				</div>
				<div className="hud-actions">
					<button
						type="button"
						className="btn yellow"
						onClick={() => engineRef.current?.togglePause()}
					>
						{paused ? "REANUDAR" : "PAUSA"}
					</button>
					<Link href={`/juegos/${game.id}`} className="btn ghost">
						SALIR
					</Link>
				</div>
			</div>

			<div className="touch-warning" role="note">
				<span className="pixel">REQUIERE TECLADO</span>
				<span className="mono">Este juego se controla con las flechas y la barra espaciadora.</span>
			</div>

			<div className="crt">
				<div className="crt-screen">
					<canvas
						ref={canvasRef}
						className="game-canvas"
						width={800}
						height={600}
						aria-label={`${game.title}: juego de naves en canvas`}
					/>
				</div>
				<div className="crt-bottom">
					<span className="led">SEÑAL OK</span>
					<span>{game.title} · CRT-83 · 60 HZ</span>
					<span>CARGA · 1MB</span>
				</div>
			</div>

			<p className="controls-hint">
				<kbd>← →</kbd> ROTAR · <kbd>↑</kbd> PROPULSAR · <kbd>ESPACIO</kbd> DISPARAR · <kbd>P</kbd>{" "}
				PAUSA
			</p>

			{finalScore !== null && (
				<GameOverModal gameId={game.id} score={finalScore} defaultName={name} onRestart={restart} />
			)}
		</div>
	);
}
