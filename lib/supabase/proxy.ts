// Solo proxy: refresca la sesión de Supabase y propaga las cookies a la
// petición (para los Server Components) y a la respuesta (para el navegador).

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
	let response = NextResponse.next({ request });

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll();
				},
				setAll(cookiesToSet, headers) {
					cookiesToSet.forEach(({ name, value }) => {
						request.cookies.set(name, value);
					});
					response = NextResponse.next({ request });
					cookiesToSet.forEach(({ name, value, options }) => {
						response.cookies.set(name, value, options);
					});
					// Cabeceras anti-caché: una respuesta con cookies de sesión no debe
					// servirse desde una caché compartida a otro usuario.
					Object.entries(headers).forEach(([key, value]) => {
						response.headers.set(key, value);
					});
				},
			},
		},
	);

	// No poner código entre createServerClient y getClaims: getClaims es lo que
	// refresca el token caducado. Sin cookie de sesión no hace llamadas de red.
	await supabase.auth.getClaims();

	return response;
}
