"use server";

import { Resend } from "resend";
import {
	buildContactEmail,
	type ContactInput,
	type ContactState,
	validateContact,
} from "@/lib/contact";

// Con onboarding@resend.dev, Resend solo entrega al correo dueño de la cuenta (CONTACT_TO_EMAIL).
const FROM = "Arcade Vault <onboarding@resend.dev>";
const SEND_FAILED = "✖ NO SE PUDO ENVIAR. INTÉNTALO DE NUEVO.";
const INVALID = "✖ REVISA LOS CAMPOS MARCADOS.";

function field(formData: FormData, name: string): string {
	const v = formData.get(name);
	return typeof v === "string" ? v.trim() : "";
}

export async function sendContact(
	_prev: ContactState,
	formData: FormData,
): Promise<ContactState> {
	const values: ContactInput = {
		name: field(formData, "name"),
		email: field(formData, "email"),
		msg: field(formData, "msg"),
	};

	// Honeypot: se responde éxito sin enviar, para no dar pistas al bot.
	if (field(formData, "website")) return { status: "sent", name: values.name };

	const fieldErrors = validateContact(values);
	if (Object.keys(fieldErrors).length > 0) {
		return { status: "error", message: INVALID, fieldErrors, values };
	}

	const apiKey = process.env.RESEND_API_KEY;
	const to = process.env.CONTACT_TO_EMAIL;
	if (!apiKey || !to) {
		console.error(
			"[contacto] Falta configuración:",
			!apiKey ? "RESEND_API_KEY" : "",
			!to ? "CONTACT_TO_EMAIL" : "",
		);
		return { status: "error", message: SEND_FAILED, fieldErrors: {}, values };
	}

	try {
		const { subject, html, text } = buildContactEmail(values);
		const { error } = await new Resend(apiKey).emails.send({
			from: FROM,
			to,
			replyTo: values.email,
			subject,
			html,
			text,
		});
		if (error) {
			console.error("[contacto] Resend rechazó el envío:", error);
			return { status: "error", message: SEND_FAILED, fieldErrors: {}, values };
		}
	} catch (err) {
		console.error("[contacto] Error al llamar a Resend:", err);
		return { status: "error", message: SEND_FAILED, fieldErrors: {}, values };
	}

	return { status: "sent", name: values.name };
}
