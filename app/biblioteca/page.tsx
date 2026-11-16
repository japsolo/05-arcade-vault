import type { Metadata } from "next";
import { LibraryBrowser } from "@/components/library-browser";
import { CATEGORIES, getGames } from "@/lib/games";

export const metadata: Metadata = {
	title: "Biblioteca · Arcade Vault",
};

export default async function Home() {
	const games = await getGames();

	return (
		<div className="fade-in">
			<section className="av-hero">
				<h1 className="flicker">ARCADE VAULT</h1>
				<div className="sub">
					INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
				</div>
			</section>
			<LibraryBrowser games={games} categories={CATEGORIES} />
		</div>
	);
}
