// Cliente público sin cookies, para lecturas dentro de 'use cache'.
// No lee cookies() ni sesión: solo ve lo que RLS permite al rol anon.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export function createPublicClient() {
	return createClient<Database>(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
		{ auth: { persistSession: false, autoRefreshToken: false } },
	);
}
