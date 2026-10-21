"use client";

import Link from "next/link";
import { useState } from "react";
import { saveScore } from "@/lib/session";

type GameOverModalProps = {
	gameId: string;
	score: number;
	defaultName: string; // nombre de la sesión o "INVITADO"
	onRestart: () => void;
};

export function GameOverModal({ gameId, score, defaultName, onRestart }: GameOverModalProps) {
	const [saved, setSaved] = useState(false);
	// null = el usuario aún no ha editado el campo; se usa defaultName.
	const [editedName, setEditedName] = useState<string | null>(null);

	const name = editedName ?? defaultName;

	const handleSave = () => {
		saveScore({ game: gameId, score, name });
		setSaved(true);
	};

	return (
		<div className="modal-bd">
			<div className="modal" role="dialog" aria-modal="true">
				<h2>FIN DEL JUEGO</h2>
				<div className="final-label">PUNTUACIÓN FINAL</div>
				<div className="final">{score.toLocaleString("es-ES")}</div>
				{saved ? (
					<div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
				) : (
					<div className="input-row">
						<input
							value={name}
							onChange={(e) => setEditedName(e.target.value.toUpperCase().slice(0, 10))}
							placeholder="TUS INICIALES"
							aria-label="Tus iniciales"
						/>
						<button type="button" className="btn yellow" onClick={handleSave}>
							GUARDAR PUNTUACIÓN
						</button>
					</div>
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
