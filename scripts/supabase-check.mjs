// Comprueba que NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
// son válidas. Uso: npm run supabase:check (carga .env con --env-file).

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function fail(reason) {
	console.error(`✖ SUPABASE ERROR: ${reason}`);
	process.exit(1);
}

if (!url) fail("falta NEXT_PUBLIC_SUPABASE_URL");
if (!key) fail("falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

let res;
try {
	res = await fetch(new URL("/auth/v1/health", url), {
		headers: { apikey: key },
		signal: AbortSignal.timeout(10_000),
	});
} catch (err) {
	fail(`no se pudo conectar con ${url} (${err.cause?.code ?? err.message})`);
}

if (res.status !== 200) {
	const body = (await res.text()).slice(0, 200);
	fail(`HTTP ${res.status} desde ${url}${body ? ` — ${body}` : ""}`);
}

console.log(`✔ SUPABASE OK (${url})`);
