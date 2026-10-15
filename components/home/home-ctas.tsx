"use client";

import Link from "next/link";
import { useSession } from "@/components/session-provider";

// CTAs de la home que dependen de la sesión (solo existe en cliente).
// Sin sesión (y durante la hidratación) se ve la variante de registro.

export function HeroCtas() {
	const { user } = useSession();
	return (
		<div className="home-ctas">
			<Link href="/biblioteca" className="btn xl pulse">
				▶ EXPLORAR JUEGOS
			</Link>
			{!user && (
				<Link href="/acceso" className="btn xl magenta">
					✦ CREAR CUENTA
				</Link>
			)}
		</div>
	);
}

export function PricingCta() {
	const { user } = useSession();
	return (
		<Link
			href={user ? "/biblioteca" : "/acceso"}
			className="btn xl pulse"
			style={{ width: "100%" }}
		>
			{user ? "IR A LA BIBLIOTECA →" : "EMPEZAR GRATIS →"}
		</Link>
	);
}
