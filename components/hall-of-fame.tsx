"use client";

import Link from "next/link";
import { useState } from "react";
import type { Game } from "@/lib/games";
import { sanitizeName } from "@/lib/score-rules";
import type { LeaderboardRow } from "@/lib/scores";
import { useSession } from "@/lib/use-session";

const fmt = (n: number) => n.toLocaleString("es-ES");

const EMPTY_SLOT = { name: "---", score: "---", date: "" };

type HallOfFameProps = {
	games: Game[];
	leaderboards: Record<string, LeaderboardRow[]>;
};

export function HallOfFame({ games, leaderboards }: HallOfFameProps) {
	const { user } = useSession();
	const [tab, setTab] = useState(games[0].id);

	const game = games.find((g) => g.id === tab) ?? games[0];
	const ranking = leaderboards[tab] ?? [];
	const rows = ranking.slice(0, 12);

	// Podio: los huecos sin marca muestran ---.
	const slot = (i: number) => {
		const r = rows[i];
		return r ? { name: r.name, score: fmt(r.score), date: r.date } : EMPTY_SLOT;
	};
	const [first, second, third] = [slot(0), slot(1), slot(2)];

	// La sesión es simulada: la marca se busca por el nombre, saneado como al guardar.
	const you = user ? ranking.find((r) => r.name === sanitizeName(user.name)) : undefined;

	return (
		<div className="av-hall fade-in">
			<div className="hall-head">
				<h1>SALÓN DE LA FAMA</h1>
				<p className="pixel" style={{ fontSize: 10 }}>
					LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
				</p>
			</div>

			<div className="hall-tabs">
				{games.map((g) => (
					<button
						type="button"
						key={g.id}
						className={`chip${tab === g.id ? " active" : ""}`}
						onClick={() => setTab(g.id)}
					>
						{g.title}
					</button>
				))}
			</div>

			<div className="podium">
				<div className="podium-slot silver">
					<div className="rank-num">02</div>
					<div className="name">{second.name}</div>
					<div className="score">{second.score}</div>
					<div className="date">{second.date}</div>
				</div>
				<div className="podium-slot gold">
					<div
						className="pixel"
						style={{ fontSize: 9, color: "var(--gold)", letterSpacing: "0.18em" }}
					>
						CAMPEÓN
					</div>
					<div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
						01
					</div>
					<div className="name">{first.name}</div>
					<div className="score" style={{ fontSize: 20 }}>
						{first.score}
					</div>
					<div className="date">{first.date}</div>
				</div>
				<div className="podium-slot bronze">
					<div className="rank-num">03</div>
					<div className="name">{third.name}</div>
					<div className="score">{third.score}</div>
					<div className="date">{third.date}</div>
				</div>
			</div>

			<div className="hall-table">
				<div className="th">
					<div>RANGO</div>
					<div>JUGADOR</div>
					<div>PUNTUACIÓN</div>
					<div>FECHA</div>
				</div>
				{rows.length === 0 && (
					<div
						className="pixel"
						style={{
							padding: "32px 18px",
							textAlign: "center",
							fontSize: 10,
							letterSpacing: "0.14em",
							color: "var(--ink-faint)",
						}}
					>
						{game.playable
							? "AÚN NO HAY PUNTUACIONES · SÉ EL PRIMERO"
							: "RANKING DISPONIBLE CUANDO EL JUEGO SEA JUGABLE"}
					</div>
				)}
				{rows.map((r, i) => (
					<div
						key={`${tab}-${r.name}`}
						className={`tr${i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : ""}`}
						style={{ animationDelay: `${i * 50}ms` }}
					>
						<div className="rk">#{String(r.rank).padStart(2, "0")}</div>
						<div className="pl">{r.name}</div>
						<div className="sc">{fmt(r.score)}</div>
						<div className="dt">{r.date}</div>
					</div>
				))}
				{user && (
					<>
						<div className="tr you-label">▸ TU MEJOR MARCA EN {game.title}</div>
						{you ? (
							<div className="tr you" style={{ animationDelay: `${rows.length * 50 + 50}ms` }}>
								<div className="rk" style={{ color: "var(--yellow)" }}>
									#{String(you.rank).padStart(2, "0")}
								</div>
								<div className="pl" style={{ color: "var(--yellow)" }}>
									{you.name}
								</div>
								<div
									className="sc"
									style={{
										color: "var(--yellow)",
										textShadow: "0 0 6px rgba(245,255,0,0.5)",
									}}
								>
									{fmt(you.score)}
								</div>
								<div className="dt">{you.date}</div>
							</div>
						) : (
							<div className="tr you-label" style={{ color: "var(--ink-faint)" }}>
								AÚN SIN MARCA EN {game.title}
							</div>
						)}
					</>
				)}
			</div>

			<div style={{ textAlign: "center", marginTop: 32 }}>
				<Link href="/biblioteca" className="btn lg">
					VOLVER A LA BIBLIOTECA
				</Link>
			</div>
		</div>
	);
}
