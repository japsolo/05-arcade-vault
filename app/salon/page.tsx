import type { Metadata } from "next";
import { HallOfFame } from "@/components/hall-of-fame";
import { getGames } from "@/lib/games";
import { getAllLeaderboards } from "@/lib/scores";

export const metadata: Metadata = {
	title: "Salón de la Fama · Arcade Vault",
};

export default async function HallPage() {
	// Top 100 por juego: la tabla muestra 12 y el resto sirve para "TU MEJOR MARCA".
	const [games, leaderboards] = await Promise.all([getGames(), getAllLeaderboards(100)]);
	return <HallOfFame games={games} leaderboards={leaderboards} />;
}
