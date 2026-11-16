"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { submitScore } from "@/app/juegos/[id]/jugar/actions";
import { type SubmitScoreState, sanitizeName } from "@/lib/score-rules";

type GameOverModalProps = {
	gameId: string;
	playable: boolean; // solo los juegos reales guardan puntuación
	score: number;
	defaultName: string; // nombre de la sesión o "INVITADO"
	onRestart: () => void;
};

export function GameOverModal({
	gameId,
	playable,
	score,
	defaultName,
	onRestart,
}: GameOverModalProps) {
	const [state, setState] = useState<SubmitScoreState>({ status: "idle" });
	const [pending, startTransition] = useTransition();
	// null = el usuario aún no ha editado el campo; se usa defaultName.
	const [editedName, setEditedName] = useState<string | null>(null);

	const name = editedName ?? sanitizeName(defaultName);

	const handleSave = () => {
		startTransition(async () => {
			setState(await submitScore({ gameId, name, score }));
		});
	};

	return (
		<div className="modal-bd">
			<div className="modal" role="dialog" aria-modal="true">
				<h2>FIN DEL JUEGO</h2>
				<div className="final-label">PUNTUACIÓN FINAL</div>
				<div className="final">{score.toLocaleString("es-ES")}</div>
				{!playable ? (
					<div className="final-label">PARTIDA DE DEMOSTRACIÓN · NO SE GUARDA</div>
				) : state.status === "saved" ? (
					<div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
				) : (
					<>
						<div className="input-row">
							<input
								value={name}
								onChange={(e) => setEditedName(sanitizeName(e.target.value))}
								placeholder="TUS INICIALES"
								aria-label="Tus iniciales"
								disabled={pending}
							/>
							<button
								type="button"
								className="btn yellow"
								onClick={handleSave}
								disabled={pending || name === ""}
							>
								{pending ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
							</button>
						</div>
						{state.status === "error" && (
							<div
								className="pixel"
								role="alert"
								style={{
									fontSize: 9,
									color: "var(--magenta)",
									marginTop: 10,
									letterSpacing: "0.12em",
								}}
							>
								{state.message}
							</div>
						)}
					</>
				)}
				<div className="actions">
					<button type="button" className="btn" onClick={onRestart}>
						JUGAR DE NUEVO
					</button>
					<Link href="/biblioteca" className="btn magenta">
						VOLVER AL VAULT
					</Link>
				</div>
			</div>
		</div>
	);
}
