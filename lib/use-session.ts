import { useMemo, useSyncExternalStore } from "react";
import {
	getServerUserSnapshot,
	getUserSnapshot,
	parseUser,
	subscribeUser,
	type User,
	writeUser,
} from "@/lib/session";

type Session = {
	user: User | null;
	login: (user: User | null) => void;
	logout: () => void;
};

const login = (next: User | null) => writeUser(next);
const logout = () => writeUser(null);

// Cada componente lee la sesión con su propio useSyncExternalStore. Así, durante
// su hidratación usa el snapshot de servidor (null = "sin sesión") aunque otro
// componente ya haya leído localStorage; con un contexto, la Nav (dentro de un
// Suspense) hidrataba con el usuario y no coincidía con el HTML del servidor.
export function useSession(): Session {
	const raw = useSyncExternalStore(subscribeUser, getUserSnapshot, getServerUserSnapshot);
	const user = useMemo(() => parseUser(raw), [raw]);
	return useMemo(() => ({ user, login, logout }), [user]);
}
