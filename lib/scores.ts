import { cacheLife, cacheTag } from "next/cache";
import type { AccentColor } from "@/lib/games";
import { createPublicClient } from "@/lib/supabase/public";

// Como lib/games.ts: los componentes de cliente solo importan tipos de aquí.

export type LeaderboardRow = {
	rank: number;
	name: string;
	score: number;
	date: string; // DD/MM/AAAA
};

const dateFmt = new Intl.DateTimeFormat("es-ES", {
	day: "2-digit",
	month: "2-digit",
	year: "numeric",
	timeZone: "Europe/Madrid",
});

type LeaderboardView = {
	game_id: string | null;
	name: string | null;
	score: number | null;
	created_at: string | null;
	rank: number | null;
};

function toRow(r: LeaderboardView): LeaderboardRow {
	return {
		rank: r.rank ?? 0,
		name: r.name ?? "",
		score: r.score ?? 0,
		date: r.created_at ? dateFmt.format(new Date(r.created_at)) : "",
	};
}

// Mejor marca de cada nombre en un juego (vista `leaderboard`).
export async function getLeaderboard(gameId: string, limit: number): Promise<LeaderboardRow[]> {
	"use cache";
	cacheTag("scores");
	cacheLife("hours");

	const { data, error } = await createPublicClient()
		.from("leaderboard")
		.select("*")
		.eq("game_id", gameId)
		.lte("rank", limit)
		.order("rank");
	if (error) throw error;
	return data.map(toRow);
}

// Las clasificaciones de todos los juegos, por id, hasta `limit` filas cada una.
export async function getAllLeaderboards(limit: number): Promise<Record<string, LeaderboardRow[]>> {
	"use cache";
	cacheTag("scores");
	cacheLife("hours");

	const { data, error } = await createPublicClient()
		.from("leaderboard")
		.select("*")
		.lte("rank", limit)
		.order("game_id")
		.order("rank");
	if (error) throw error;

	const byGame: Record<string, LeaderboardRow[]> = {};
	for (const r of data) {
		if (!r.game_id) continue;
		(byGame[r.game_id] ??= []).push(toRow(r));
	}
	return byGame;
}

export type RecentScore = {
	player: string;
	gameTitle: string;
	color: AccentColor;
	score: number;
	at: string; // ISO
	when: string; // "hace 5 min", calculado al generar la caché
};

export type TopPlayer = { rank: number; player: string; score: number };

function timeAgo(at: string, now: number): string {
	const min = Math.max(0, Math.floor((now - new Date(at).getTime()) / 60_000));
	if (min < 1) return "ahora";
	if (min < 60) return `hace ${min} min`;
	const h = Math.floor(min / 60);
	if (h < 24) return `hace ${h} h`;
	const d = Math.floor(h / 24);
	return `hace ${d} ${d === 1 ? "día" : "días"}`;
}

// Últimas partidas de cualquier juego (ticker de la home).
// cacheLife "minutes": el "hace X min" y el top de hoy dependen de la hora.
export async function getRecentScores(limit: number): Promise<RecentScore[]> {
	"use cache";
	cacheTag("scores");
	cacheLife("minutes");

	const { data, error } = await createPublicClient()
		.from("scores")
		.select("name, score, created_at, games(title, color)")
		.order("created_at", { ascending: false })
		.limit(limit);
	if (error) throw error;

	const now = Date.now();
	return data.map((r) => ({
		player: r.name,
		gameTitle: r.games.title,
		color: r.games.color as AccentColor,
		score: r.score,
		at: r.created_at,
		when: timeAgo(r.created_at, now),
	}));
}

// Mejores puntuaciones individuales de las últimas 24 h.
export async function getTopToday(limit: number): Promise<TopPlayer[]> {
	"use cache";
	cacheTag("scores");
	cacheLife("minutes");

	const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
	const { data, error } = await createPublicClient()
		.from("scores")
		.select("name, score")
		.gte("created_at", since)
		.order("score", { ascending: false })
		.order("created_at", { ascending: true })
		.limit(limit);
	if (error) throw error;

	return data.map((r, i) => ({ rank: i + 1, player: r.name, score: r.score }));
}
