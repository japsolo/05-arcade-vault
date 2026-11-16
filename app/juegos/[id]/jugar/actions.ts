"use server";

import { updateTag } from "next/cache";
import { getGame } from "@/lib/games";
import { type SubmitScoreInput, type SubmitScoreState, validateScore } from "@/lib/score-rules";
import { createClient } from "@/lib/supabase/server";

const SAVE_FAILED = "✖ NO SE PUDO GUARDAR";

// Sin auth: inserta como anon. RLS repite estas comprobaciones en la tabla `scores`.
export async function submitScore(input: SubmitScoreInput): Promise<SubmitScoreState> {
	const invalid = validateScore(input);
	if (invalid) return { status: "error", message: invalid };

	const game = await getGame(input.gameId);
	if (!game?.playable) return { status: "error", message: "✖ ESTE JUEGO NO GUARDA PUNTUACIONES" };

	const supabase = await createClient();
	const { error } = await supabase
		.from("scores")
		.insert({ game_id: input.gameId, name: input.name, score: input.score });
	if (error) {
		console.error("[puntuaciones] Supabase rechazó el insert:", error.message);
		return { status: "error", message: SAVE_FAILED };
	}

	// Leaderboards, stats del catálogo y actividad de la home leen con este tag.
	updateTag("scores");
	return { status: "saved" };
}
