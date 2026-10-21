"use client";

import { type SubmitEvent, useActionState, useState } from "react";
import { sendContact } from "@/app/acerca-de/actions";
import type { ContactState } from "@/lib/contact";

const INITIAL: ContactState = { status: "idle" };

// "ENVIAR OTRO MENSAJE" remonta el formulario (nueva key) para volver al estado inicial de useActionState.
export function ContactForm() {
	const [round, setRound] = useState(0);
	return <ContactFormRound key={round} onReset={() => setRound((r) => r + 1)} />;
}

function ContactFormRound({ onReset }: { onReset: () => void }) {
	const [state, formAction, pending] = useActionState(sendContact, INITIAL);
	const [shake, setShake] = useState(false);

	// Los inputs no son controlados: React vacía el formulario tras cada acción, así que
	// los valores enviados vuelven en `state.values` como defaultValue cuando hay error.
	const values = state.status === "error" ? state.values : { name: "", email: "", msg: "" };
	const fieldErrors = state.status === "error" ? state.fieldErrors : {};

	const onSubmit = (e: SubmitEvent<HTMLFormElement>) => {
		const data = new FormData(e.currentTarget);
		const empty = ["name", "email", "msg"].some((k) => !String(data.get(k) ?? "").trim());
		if (empty) {
			e.preventDefault(); // no llega a invocar la acción
			setShake(true);
			setTimeout(() => setShake(false), 400);
		}
	};

	return (
		<form
			className={`contact-form${shake ? " shake" : ""}`}
			action={formAction}
			onSubmit={onSubmit}
			noValidate
		>
			{state.status !== "sent" ? (
				<>
					<div className="field">
						<label htmlFor="contact-name">NOMBRE</label>
						<input
							id="contact-name"
							name="name"
							defaultValue={values.name}
							placeholder="px_kai"
							aria-invalid={fieldErrors.name ? true : undefined}
						/>
						{fieldErrors.name && <div className="field-error">{fieldErrors.name}</div>}
					</div>
					<div className="field">
						<label htmlFor="contact-email">CORREO ELECTRÓNICO</label>
						<input
							id="contact-email"
							name="email"
							type="email"
							defaultValue={values.email}
							placeholder="jugador@vault.gg"
							aria-invalid={fieldErrors.email ? true : undefined}
						/>
						{fieldErrors.email && <div className="field-error">{fieldErrors.email}</div>}
					</div>
					<div className="field">
						<label htmlFor="contact-msg">MENSAJE</label>
						<textarea
							id="contact-msg"
							name="msg"
							rows={5}
							defaultValue={values.msg}
							placeholder="Cuéntanos qué tienes en mente…"
							aria-invalid={fieldErrors.msg ? true : undefined}
						/>
						{fieldErrors.msg && <div className="field-error">{fieldErrors.msg}</div>}
					</div>

					{/* Honeypot: invisible para personas; si llega relleno, la acción no envía nada. */}
					<div className="hp-field" aria-hidden="true">
						<label htmlFor="contact-website">WEBSITE</label>
						<input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
					</div>

					<button
						className="btn xl press"
						type="submit"
						style={{ width: "100%" }}
						disabled={pending}
					>
						{pending ? "▶ TRANSMITIENDO…" : "▶ ENVIAR MENSAJE"}
					</button>
					{state.status === "error" && (
						<p className="form-error pixel" role="alert">
							{state.message}
						</p>
					)}
				</>
			) : (
				<div className="terminal-success">
					<div className="term-bar">
						<span className="dot r" />
						<span className="dot y" />
						<span className="dot g" />
						{/** biome-ignore lint/suspicious/noCommentText: it's not a comment */}
						<span className="term-title">VAULT-OS // TERMINAL</span>
					</div>
					<div className="term-body">
						<div className="line">
							<span className="prompt">vault@arcade:~$</span> ./send_message --to=team
						</div>
						<div className="line dim">[OK] Conectando con servidor…</div>
						<div className="line dim">[OK] Validando contenido…</div>
						<div className="line dim">[OK] Transmitiendo paquete…</div>
						<div className="line success" role="status">
							&gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {state.name.toUpperCase()}.
							<span className="caret">_</span>
						</div>
						<div style={{ marginTop: 18 }}>
							<button className="btn ghost" type="button" onClick={onReset}>
								ENVIAR OTRO MENSAJE
							</button>
						</div>
					</div>
				</div>
			)}
		</form>
	);
}
