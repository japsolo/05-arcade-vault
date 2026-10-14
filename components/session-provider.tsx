"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useSyncExternalStore,
} from "react";
import {
	getServerUserSnapshot,
	getUserSnapshot,
	parseUser,
	subscribeUser,
	type User,
	writeUser,
} from "@/lib/session";

type SessionContextValue = {
	user: User | null;
	login: (user: User | null) => void;
	logout: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
	// En servidor y durante la hidratación el snapshot es null ("sin sesión");
	// después React vuelve a leer localStorage y actualiza.
	const raw = useSyncExternalStore(
		subscribeUser,
		getUserSnapshot,
		getServerUserSnapshot,
	);
	const user = useMemo(() => parseUser(raw), [raw]);

	const login = useCallback((next: User | null) => writeUser(next), []);
	const logout = useCallback(() => writeUser(null), []);

	const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);

	return (
		<SessionContext.Provider value={value}>{children}</SessionContext.Provider>
	);
}

export function useSession(): SessionContextValue {
	const ctx = useContext(SessionContext);
	if (!ctx) throw new Error("useSession debe usarse dentro de SessionProvider");
	return ctx;
}
