// Compartido por el formulario (cliente) y la Server Action (servidor): sin "use server" ni secretos.

export const CONTACT_LIMITS = { name: 60, email: 254, msg: 2000 } as const;

export type ContactField = "name" | "email" | "msg";

export type ContactInput = { name: string; email: string; msg: string };

export type ContactState =
	| { status: "idle" }
	| {
			status: "error";
			message: string;
			fieldErrors: Partial<Record<ContactField, string>>;
			values: ContactInput;
	  }
	| { status: "sent"; name: string };

// Validación de formato mínima (algo@algo.algo); la entrega real la confirma Resend.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const REQUIRED: Record<ContactField, string> = {
	name: "INTRODUCE TU NOMBRE.",
	email: "INTRODUCE TU CORREO.",
	msg: "ESCRIBE UN MENSAJE.",
};

// Espera los valores ya recortados con trim().
export function validateContact(input: ContactInput): Partial<Record<ContactField, string>> {
	const errors: Partial<Record<ContactField, string>> = {};
	for (const field of ["name", "email", "msg"] as const) {
		if (!input[field]) errors[field] = REQUIRED[field];
		else if (input[field].length > CONTACT_LIMITS[field])
			errors[field] = `MÁXIMO ${CONTACT_LIMITS[field]} CARACTERES.`;
	}
	if (!errors.email && !EMAIL_RE.test(input.email)) errors.email = "CORREO NO VÁLIDO.";
	return errors;
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export function buildContactEmail(input: ContactInput): { subject: string; html: string; text: string } {
	const name = escapeHtml(input.name);
	const email = escapeHtml(input.email);
	const msg = escapeHtml(input.msg).replace(/\r?\n/g, "<br>");

	return {
		subject: `[Arcade Vault] Nuevo mensaje de ${input.name}`,
		html: [
			`<h2>Nuevo mensaje desde el formulario de contacto</h2>`,
			`<p><strong>Nombre:</strong> ${name}</p>`,
			`<p><strong>Correo:</strong> ${email}</p>`,
			`<p><strong>Mensaje:</strong></p>`,
			`<p>${msg}</p>`,
		].join("\n"),
		text: [
			"Nuevo mensaje desde el formulario de contacto",
			"",
			`Nombre: ${input.name}`,
			`Correo: ${input.email}`,
			"",
			"Mensaje:",
			input.msg,
		].join("\n"),
	};
}
