"use client";

import { useEffect } from "react";

// Añade la clase `in` a cada `.reveal` cuando entra en el viewport.
// Solo toca el DOM (sin setState), así que cumple react-hooks/set-state-in-effect.
export function Reveal() {
	useEffect(() => {
		const els = document.querySelectorAll(".reveal");
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting) {
						e.target.classList.add("in");
						io.unobserve(e.target);
					}
				}
			},
			{ threshold: 0.12 },
		);
		for (const el of els) io.observe(el);
		return () => io.disconnect();
	}, []);

	return null;
}
