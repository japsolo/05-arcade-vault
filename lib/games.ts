import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

// Los componentes de cliente solo importan tipos de este módulo: las lecturas
// usan 'use cache' y se llaman desde Server Components.

export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type AccentColor = "cyan" | "magenta" | "green" | "yellow";

export type Game = {
	id: string;
	title: string;
	short: string;
	long: string;
	cat: Category;
	cover: string;
	color: AccentColor;
	playable: boolean;
	best: number | null; // null = sin partidas guardadas
	plays: number;
};

export const CATEGORIES: ("TODOS" | Category)[] = [
	"TODOS",
	"ARCADE",
	"PUZZLE",
	"SHOOTER",
	"VERSUS",
];

// Catálogo con best/plays de la vista game_stats, en el orden de sort_order.
export async function getGames(): Promise<Game[]> {
	"use cache";
	cacheTag("games", "scores");
	cacheLife("hours");

	const supabase = createPublicClient();
	const [games, stats] = await Promise.all([
		supabase.from("games").select("*").order("sort_order"),
		supabase.from("game_stats").select("*"),
	]);
	if (games.error) throw games.error;
	if (stats.error) throw stats.error;

	const byId = new Map(stats.data.map((s) => [s.game_id, s]));
	return games.data.map((g) => ({
		id: g.id,
		title: g.title,
		short: g.short,
		long: g.long,
		cat: g.cat as Category,
		cover: g.cover,
		color: g.color as AccentColor,
		playable: g.playable,
		best: byId.get(g.id)?.best ?? null,
		plays: byId.get(g.id)?.plays ?? 0,
	}));
}

export async function getGame(id: string): Promise<Game | undefined> {
	const games = await getGames();
	return games.find((g) => g.id === id);
}
