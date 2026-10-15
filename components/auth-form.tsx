"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";
import { useSession } from "@/components/session-provider";

type Tab = "in" | "up";

export function AuthForm() {
	const router = useRouter();
	const { login } = useSession();
	const [tab, setTab] = useState<Tab>("in");
	const [username, setUsername] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const id = useId();

	// Sesión simulada: no hay validación ni backend (ver SPEC 01).
	const submit = (e: FormEvent) => {
		e.preventDefault();
		login({ name: (username || "PLAYER1").toUpperCase().slice(0, 10) });
		router.push("/biblioteca");
	};

	const playAsGuest = () => {
		login(null);
		router.push("/biblioteca");
	};

	return (
		<div className="av-auth-wrap fade-in">
			<div className="auth-card">
				<div className="auth-header">
					<div className="mark" />
					<h2 className="neon-cyan">ARCADE VAULT</h2>
					<div
						className="mono"
						style={{
							fontSize: 11,
							color: "var(--ink-faint)",
							letterSpacing: "0.16em",
							marginTop: 6,
						}}
					>
						ACCESO AL SISTEMA · v2.6
					</div>
				</div>

				<div className="auth-tabs">
					<button
						type="button"
						className={tab === "in" ? "on" : ""}
						onClick={() => setTab("in")}
					>
						INICIAR SESIÓN
					</button>
					<button
						type="button"
						className={tab === "up" ? "on" : ""}
						onClick={() => setTab("up")}
					>
						CREAR CUENTA
					</button>
				</div>

				<form onSubmit={submit}>
					<div className="field">
						<label htmlFor={`${id}-user`}>Usuario</label>
						<input
							id={`${id}-user`}
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							placeholder="px_kai"
							autoComplete="username"
						/>
					</div>
					{tab === "up" && (
						<div className="field slide-in">
							<label htmlFor={`${id}-email`}>Correo electrónico</label>
							<input
								id={`${id}-email`}
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="jugador@vault.gg"
								autoComplete="email"
							/>
						</div>
					)}
					<div className="field">
						<label htmlFor={`${id}-pass`}>Contraseña</label>
						<input
							id={`${id}-pass`}
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="••••••••"
							autoComplete={tab === "in" ? "current-password" : "new-password"}
						/>
					</div>

					<button
						className="btn lg"
						type="submit"
						style={{ width: "100%", marginTop: 8 }}
					>
						{tab === "in" ? "ENTRAR AL VAULT" : "CREAR Y JUGAR"}
					</button>
				</form>

				<button
					type="button"
					className="btn ghost"
					style={{ width: "100%", marginTop: 10 }}
					onClick={playAsGuest}
				>
					JUGAR COMO INVITADO
				</button>

				<div className="auth-divider">O CONTINÚA CON</div>
				<div className="social">
					<button type="button" className="btn ghost">
						◆ GOOGLE
					</button>
					<button type="button" className="btn ghost">
						▣ GITHUB
					</button>
				</div>

				<div
					style={{
						marginTop: 18,
						textAlign: "center",
						fontSize: 11,
						color: "var(--ink-faint)",
						letterSpacing: "0.1em",
					}}
				>
					AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
				</div>
			</div>
		</div>
	);
}
