import type { ComponentType } from "react";
import { AsteroidsPlayer } from "@/components/games/asteroids-player";
import type { Game } from "@/lib/games";

// Juegos con reproductor real, por id del catálogo. Los que no estén aquí usan el
// GamePlayer simulado.
export const PLAYABLE: Partial<Record<string, ComponentType<{ game: Game }>>> = {
	rocas: AsteroidsPlayer,
};
