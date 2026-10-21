import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GamePlayer } from "@/components/game-player";
import { PLAYABLE } from "@/components/games/registry";
import { GAMES, getGame } from "@/lib/games";

type ParamsType = Pick<PageProps<"/juegos/[id]/jugar">, "params">;

export function generateStaticParams() {
	return GAMES.map((g) => ({ id: g.id }));
}

export async function generateMetadata({ params }: ParamsType): Promise<Metadata> {
	const { id } = await params;
	const game = getGame(id);
	return {
		title: game ? `Jugando ${game.title} · Arcade Vault` : "Juego no encontrado",
	};
}

export default function PlayPage({ params }: ParamsType) {
	// `params` depende de la URL: se lee dentro de Suspense (ver detalle del juego).
	return (
		<Suspense
			fallback={
				<div className="av-player fade-in">
					<div className="pixel neon-cyan" style={{ fontSize: 12 }}>
						CARGANDO_
					</div>
				</div>
			}
		>
			<Player params={params} />
		</Suspense>
	);
}

async function Player({ params }: ParamsType) {
	const { id } = await params;
	const game = getGame(id);
	if (!game) notFound();
	const GameComponent = PLAYABLE[id] ?? GamePlayer;
	return <GameComponent game={game} />;
}
