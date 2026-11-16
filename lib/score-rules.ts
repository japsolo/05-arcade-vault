// Reglas de las puntuaciones, compartidas por cliente y servidor (sin secretos).
// Las mismas reglas están como CHECK y RLS en la tabla `scores`.

export const NAME_RE = /^[A-Z0-9_]{1,10}$/;
export const SCORE_MAX = 9_999_999;

// Mayúsculas, quita lo que no sea A-Z, 0-9 o _ y corta a 10 caracteres.
export function sanitizeName(raw: string): string {
	return raw
		.toUpperCase()
		.replace(/[^A-Z0-9_]/g, "")
		.slice(0, 10);
}

export type SubmitScoreInput = { gameId: string; name: string; score: number };
export type SubmitScoreState = { status: "idle" | "saved" | "error"; message?: string };

// null = válido; si no, el motivo para mostrar en el modal.
export function validateScore({ name, score }: SubmitScoreInput): string | null {
	if (!NAME_RE.test(name)) return "✖ INICIALES: 1-10 LETRAS, NÚMEROS O _";
	if (!Number.isInteger(score) || score < 1 || score > SCORE_MAX) return "✖ PUNTUACIÓN NO VÁLIDA";
	return null;
}
