// Solo cliente: no importar desde Server Components.

export type User = { name: string };

export type SavedScore = {
	game: string;
	score: number;
	name: string;
	at: number;
};

const USER_KEY = "av_user";
const SCORES_KEY = "av_scores";

// Fuente externa para useSyncExternalStore. El snapshot es el string crudo
// (valor primitivo, estable entre lecturas).
const listeners = new Set<() => void>();
let memoryUser: string | null = null; // respaldo si localStorage está bloqueado

export function subscribeUser(listener: () => void): () => void {
	listeners.add(listener);
	const onStorage = (e: StorageEvent) => {
		if (e.key === USER_KEY) listener();
	};
	window.addEventListener("storage", onStorage);
	return () => {
		listeners.delete(listener);
		window.removeEventListener("storage", onStorage);
	};
}

export function getUserSnapshot(): string | null {
	try {
		return localStorage.getItem(USER_KEY);
	} catch {
		return memoryUser;
	}
}

export function getServerUserSnapshot(): string | null {
	return null;
}

export function parseUser(raw: string | null): User | null {
	if (!raw) return null;
	try {
		return JSON.parse(raw) as User | null;
	} catch {
		return null;
	}
}

export function writeUser(user: User | null): void {
	const raw = user ? JSON.stringify(user) : null;
	try {
		if (raw) localStorage.setItem(USER_KEY, raw);
		else localStorage.removeItem(USER_KEY);
	} catch {
		// localStorage bloqueado (modo privado): la sesión vive solo en memoria.
		memoryUser = raw;
	}
	listeners.forEach((l) => {
		l();
	});
}

export function saveScore(entry: Omit<SavedScore, "at">): void {
	try {
		const all = JSON.parse(
			localStorage.getItem(SCORES_KEY) || "[]",
		) as SavedScore[];
		all.push({ ...entry, at: Date.now() });
		localStorage.setItem(SCORES_KEY, JSON.stringify(all));
	} catch {
		// Sin persistencia disponible: se ignora.
	}
}
