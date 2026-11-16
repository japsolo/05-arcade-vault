import { cacheLife, cacheTag } from "next/cache";
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
