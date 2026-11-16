# SPEC 06 — Catálogo de juegos y leaderboard en Supabase

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 02, SPEC 04, SPEC 05
> **Fecha:** 2026-11-16
> **Objetivo:** Mover el catálogo de juegos a una tabla `games` y las puntuaciones a una tabla `scores` en Supabase, y mostrar un leaderboard real en el Salón, la ficha del juego y la home.

---

## Por qué existe esta spec

Hoy el catálogo vive en `lib/games.ts` y todas las puntuaciones que se ven son falsas. `seededScores` genera rankings deterministas y la home tiene `RECENT_SCORES` y `TOP_PLAYERS` escritos a mano. Las partidas reales de `rocas` se guardan en `localStorage` (`av_scores`) y nadie las lee. La SPEC 04 dejó lista la conexión con Supabase sin tablas. Esta es la primera spec que crea tablas: catálogo y puntuaciones en la base de datos, y todas las pantallas leen el ranking real.

Todavía no hay auth. La escritura es anónima y pasa por una Server Action que valida los datos, con las mismas reglas repetidas en `CHECK` y en RLS. Hasta que llegue el auth se acepta que alguien pueda insertar puntuaciones falsas.

---

## Alcance

**Dentro:**

- Primera migración de Supabase:
  - Tablas `games` y `scores`.
  - Vistas `leaderboard` y `game_stats`.
  - Políticas RLS.
  - Seed de los 8 juegos de `lib/games.ts`.
  - Revocar `EXECUTE` de `public.rls_auto_enable()` (pendiente desde la SPEC 04).
- Guardar el SQL en `supabase/migrations/` y aplicarlo con el MCP de Supabase (`apply_migration`).
- Generar los tipos en `lib/supabase/database.types.ts` (`generate_typescript_types`) y tipar los clientes con `Database`.
- Cliente público sin cookies, `lib/supabase/public.ts`, para lecturas dentro de `'use cache'`.
- Catálogo desde la DB:
  - `getGames()` y `getGame(id)` en `lib/games.ts` sustituyen el array `GAMES`.
  - `best` (máxima puntuación) y `plays` (número de partidas guardadas) se calculan desde `scores`.
  - Lo usan la home, `/biblioteca`, `/juegos/[id]`, `/juegos/[id]/jugar`, `/salon` y los `generateStaticParams`.
- Leaderboard real (mejor marca por nombre):
  - Ficha `/juegos/[id]`: top 10 del juego.
  - `/salon`: podio + tabla top 12 por juego, y la fila «TU MEJOR MARCA» calculada con el nombre de la sesión.
  - Home, «ÚLTIMAS PUNTUACIONES»: las 7 partidas más recientes de cualquier juego.
  - Home, «TOP JUGADORES · HOY»: las 5 mejores puntuaciones individuales de las últimas 24 h.
- Estados vacíos en todas esas vistas, porque `scores` arranca vacío.
- Escritura:
  - Server Action `submitScore` en `app/juegos/[id]/jugar/actions.ts`, con validación compartida en `lib/score-rules.ts`.
  - Después de insertar, `updateTag("scores")`.
  - El modal FIN DEL JUEGO la usa con estados enviando / error / guardado.
- Solo los juegos jugables (`games.playable = true`, hoy solo `rocas`) pueden guardar. En los simulados el modal no muestra el campo ni el botón GUARDAR.
- Eliminar los datos falsos y `localStorage` de puntuaciones:
  - `seededScores`, `ScoreRow`, `PLAYERS`.
  - `saveScore`, `SavedScore`, `SCORES_KEY`.
  - `RECENT_SCORES`, `TOP_PLAYERS` y sus tipos.
  - El array `GAMES`.
- Documentar en `CLAUDE.md` las tablas, las vistas, la caché, la Server Action y el cliente público.

**Fuera de alcance (para otras specs):**

- Auth real, perfiles, `user_id` en `scores` y sustituir `lib/session.ts` / `useSession`.
- Rate limit, captcha o cualquier antitrampa más allá de la validación básica.
- Subir a Supabase las partidas que ya haya en `av_scores` (se ignoran).
- Hacer jugables otros juegos (Tetris, Arkanoid…) o guardar desde los simulados.
- Paginación del ranking, filtros por fecha en el Salón o rankings semanales o mensuales.
- Moderar o borrar puntuaciones desde la app (no hay `UPDATE` ni `DELETE` por RLS).
- Panel de administración del catálogo.
- Mover a la DB el resto de datos de la home (`FEATURES`, `HOME_STATS`, `FAQ`, `PRICE_FEATURES`).
- Realtime o actualización en vivo sin recargar.
- Arreglar el 404 con HTTP 200 de `/juegos/no-existe` (observado en la SPEC 04).
- Tests automatizados.

---

## Modelo de datos

### Tablas (migración `supabase/migrations/<timestamp>_games_scores.sql`)

```sql
create table public.games (
  id         text primary key,                 -- 'rocas', 'caida'…
  title      text not null,
  short      text not null,
  long       text not null,
  cat        text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover      text not null,                    -- clase CSS: 'cover-rocas'
  color      text not null check (color in ('cyan','magenta','green','yellow')),
  playable   boolean not null default false,   -- true solo para 'rocas'
  sort_order int not null                      -- orden actual de lib/games.ts
);

create table public.scores (
  id         bigint generated always as identity primary key,
  game_id    text not null references public.games(id),
  name       text not null check (name ~ '^[A-Z0-9_]{1,10}$'),
  score      int  not null check (score between 1 and 9999999),
  created_at timestamptz not null default now()
);
create index scores_game_score_idx on public.scores (game_id, score desc, created_at);
create index scores_created_at_idx on public.scores (created_at desc);
```

### Vistas (`security_invoker = true`, respetan RLS)

```sql
-- Mejor marca de cada nombre por juego, con su posición.
-- Empate: gana la marca más antigua.
leaderboard(game_id, name, score, created_at, rank)

-- Estadísticas por juego (todas las partidas guardadas).
game_stats(game_id, best /* int | null */, plays /* int */)
```

### RLS

- `games`: `SELECT` para `anon` y `authenticated`. Sin políticas de escritura.
- `scores`:
  - `SELECT` para `anon` y `authenticated`.
  - `INSERT` para `anon` y `authenticated` con `WITH CHECK` sobre el nombre (regex), el rango del score y `exists (select 1 from games where id = game_id and playable)`.
  - Sin `UPDATE` ni `DELETE`.
- `revoke execute on function public.rls_auto_enable() from anon, authenticated, public`.

### Seed

Los 8 juegos actuales con sus `id`, `title`, `short`, `long`, `cat`, `cover` y `color` tal cual. `best` y `plays` desaparecen del catálogo. `playable = true` solo en `rocas`. `scores` arranca vacía.

### Tipos TypeScript

```ts
// lib/games.ts (sin "use client"; lecturas con 'use cache')
export type Game = {
	id: string;
	title: string;
	short: string;
	long: string;
	cat: Category;
	cover: string;
	color: AccentColor;
	playable: boolean;
	best: number | null; // de game_stats; null = sin partidas
	plays: number; // de game_stats
};
export async function getGames(): Promise<Game[]>; // tags: games, scores
export async function getGame(id: string): Promise<Game | undefined>;

// lib/scores.ts (lecturas con 'use cache', tag: scores)
export type LeaderboardRow = { rank: number; name: string; score: number; date: string }; // date "DD/MM/AAAA"
export type RecentScore = {
	player: string;
	gameTitle: string;
	color: AccentColor;
	score: number;
	at: string;
}; // at ISO
export type TopPlayer = { rank: number; player: string; score: number };
export async function getLeaderboard(gameId: string, limit: number): Promise<LeaderboardRow[]>;
export async function getAllLeaderboards(limit: number): Promise<Record<string, LeaderboardRow[]>>; // para /salon
export async function getRecentScores(limit: number): Promise<RecentScore[]>;
export async function getTopToday(limit: number): Promise<TopPlayer[]>; // últimas 24 h

// lib/score-rules.ts (compartido cliente/servidor, sin secretos)
export const NAME_RE = /^[A-Z0-9_]{1,10}$/;
export const SCORE_MAX = 9_999_999;
export function sanitizeName(raw: string): string; // mayúsculas, quita lo que no sea A-Z0-9_, corta a 10
export type SubmitScoreState = { status: "idle" | "saved" | "error"; message?: string };

// app/juegos/[id]/jugar/actions.ts
("use server");
export async function submitScore(input: {
	gameId: string;
	name: string;
	score: number;
}): Promise<SubmitScoreState>;
```

### Caché

- Las lecturas usan `lib/supabase/public.ts`. Es un cliente `createClient` de `@supabase/supabase-js` con la clave publishable y `persistSession: false`, sin `cookies()`, así que vale dentro de `'use cache'`.
- `getGames`/`getGame`: `cacheTag("games", "scores")` y `cacheLife("hours")`.
- Leaderboards: `cacheTag("scores")` y `cacheLife("hours")`.
- Actividad de la home (`getRecentScores`, `getTopToday`): `cacheTag("scores")` y `cacheLife("minutes")`, porque el top de hoy depende de la hora.
- `submitScore` llama a `updateTag("scores")` después de insertar. El jugador ve su marca en la siguiente navegación.

### Convenciones

- `submitScore` inserta con `await createClient()` de `lib/supabase/server.ts` (rol `anon` mientras no haya auth). Nunca se usa una clave secreta.
- Antes de insertar, la Action valida con `lib/score-rules.ts` y comprueba con `getGame` que el juego existe y es `playable`. RLS repite las comprobaciones.
- «TU MEJOR MARCA» en `/salon` busca `user.name` saneado con `sanitizeName` en el ranking del juego (top 100, que el servidor pasa al componente cliente). Si no aparece, muestra «AÚN SIN MARCA EN {JUEGO}».
- Fechas en `es-ES`. Ranking: `DD/MM/AAAA`. Ticker: relativo («hace 5 min»), calculado al renderizar.

---

## Plan de implementación

Cada paso deja la app compilando y ejecutable. Antes de los pasos 2 y 5, leer en `node_modules/next/dist/docs/01-app/` las guías de `use cache`, `cacheTag`, `cacheLife` y `updateTag`.

1. **Migración y tipos.** Escribir `supabase/migrations/<timestamp>_games_scores.sql` con las tablas, índices, vistas, RLS, seed y revocación de `rls_auto_enable`. Aplicarla con `apply_migration`. Generar `lib/supabase/database.types.ts` y pasar el genérico `Database` a `lib/supabase/server.ts`, `client.ts` y `proxy.ts`.
   - Comprobación: `list_tables` muestra `games` (8 filas) y `scores` (0 filas). `get_advisors` (security) no muestra avisos de RLS ni de `rls_auto_enable`. Un `INSERT` con `game_id = 'caida'` falla por RLS. La app no cambia.
2. **Catálogo desde la DB.**
   - Crear `lib/supabase/public.ts`.
   - En `lib/games.ts`, sustituir `GAMES` por `getGames()`/`getGame()`, que leen `games` + `game_stats`.
   - Pasar los juegos como props a `LibraryBrowser` y `HallOfFame` (son de cliente).
   - Adaptar la home, la ficha, `/jugar`, `/salon` y los `generateStaticParams`.
   - `GameCard` y la ficha muestran `best` como «—» si es `null` y `plays` con `toLocaleString("es-ES")`.
   - Comprobación: las 5 rutas muestran los 8 juegos en el mismo orden. «Mejor global» es «—» y «Partidas» es «0». `npm run build` pasa.
3. **Leaderboard por juego.**
   - Crear en `lib/scores.ts` `getLeaderboard` y `getAllLeaderboards`, y borrar `seededScores`.
   - La ficha usa el top 10.
   - `/salon` recibe las clasificaciones (top 100 por juego) y muestra podio + top 12 + «TU MEJOR MARCA».
   - Estados vacíos:
     - Ficha y tabla del Salón: «AÚN NO HAY PUNTUACIONES · SÉ EL PRIMERO» si el juego es jugable, y «RANKING DISPONIBLE CUANDO EL JUEGO SEA JUGABLE» si no.
     - Podio: los huecos sin marca muestran `---`.
   - Comprobación: con `scores` vacío se ven los estados vacíos. Tras insertar a mano (SQL) 3 filas de `rocas` con dos nombres repetidos, cada nombre sale una sola vez con su mejor marca, ordenadas.
4. **Actividad de la home.**
   - Crear `getRecentScores(7)` y `getTopToday(5)`, y borrar `RECENT_SCORES`, `TOP_PLAYERS` y sus tipos de `lib/home.ts`.
   - El color del ticker es el `color` del juego.
   - Estados vacíos: «SIN PARTIDAS TODAVÍA» y «NADIE HA JUGADO HOY».
   - La barra `tp-fill` se calcula proporcional a la puntuación del #1.
   - Comprobación: con las filas del paso 3, el ticker y el top las muestran. Con una fila de hace más de 24 h, esa fila no sale en el top pero sí en el ticker.
5. **Guardar puntuaciones.**
   - Crear `lib/score-rules.ts` y `app/juegos/[id]/jugar/actions.ts` (`submitScore` + `updateTag("scores")`).
   - `GameOverModal`:
     - recibe `game` (o `playable`) y solo muestra el input y GUARDAR si es jugable;
     - el input aplica `sanitizeName`, también al nombre por defecto;
     - estados: enviando (botón deshabilitado, «GUARDANDO…»), error («✖ NO SE PUDO GUARDAR», permite reintentar) y guardado (el toast actual).
   - Borrar `saveScore`, `SavedScore` y `SCORES_KEY` de `lib/session.ts`.
   - Comprobación: jugar a `rocas`, guardar y ver la marca en `/salon`, en la ficha y en la home sin reiniciar el servidor. En un juego simulado no hay botón GUARDAR. Un nombre como `ñu-1` se guarda como `U1`.
6. **Documentación.** Actualizar `CLAUDE.md`: tablas, vistas, RLS, cliente público, caché y tags, `submitScore`, la desaparición de `av_scores` y de los datos mock, y que el catálogo vive en la DB. Marcar la SPEC 06 como `Implementado`.

**Desviaciones durante la implementación:**

- Paso 1: el archivo de la migración se renombró a `20261116181953_games_scores.sql`, que es la versión que registró `apply_migration` (no la hora en que se escribió el archivo).
- Paso 1: además de RLS, la migración revoca a `anon` y `authenticated` los permisos `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE` sobre `games` y `UPDATE`/`DELETE`/`TRUNCATE` sobre `scores`, como segunda barrera.
- Paso 1: se tipó también `lib/supabase/proxy.ts` con `Database`, no solo `server.ts` y `client.ts`.
- Paso 2: `LibraryBrowser` recibe también `categories` por props. Un componente de cliente que importe un valor de `lib/games.ts` arrastra las funciones `'use cache'` a su bundle y rompe la compilación. Los componentes de cliente solo importan tipos de `lib/games.ts` y `lib/scores.ts`.
- Paso 3: `lib/score-rules.ts` se creó en este paso (con `sanitizeName`), porque «TU MEJOR MARCA» lo necesita. En el paso 5 se completó.
- Paso 3: las fechas del ranking se formatean con `timeZone: "Europe/Madrid"`, para que el día no dependa del huso horario del servidor.
- Paso 3: «TU MEJOR MARCA» muestra el nombre del ranking (saneado) y no el de la sesión.
- Paso 4: `RecentScore` lleva también `when` («hace 5 min»). Se calcula dentro de `getRecentScores`, al construir la caché, y no al renderizar. Con `cacheComponents`, `Date.now()` fuera de `'use cache'` impide pre-renderizar la home.
- Paso 5: `submitScore` recibe un objeto y se llama desde el modal con `useTransition`, no con `useActionState`/`FormData`. GUARDAR también se deshabilita si el nombre queda vacío tras sanear.
- Paso 5: si la puntuación es 0, el modal muestra «✖ PUNTUACIÓN NO VÁLIDA» al pulsar GUARDAR.
- **Observado, sin tocar:** una fila insertada a mano por SQL no invalida la caché. Solo `submitScore` llama a `updateTag("scores")`. En `next dev`, una petición con `Cache-Control: no-cache` la salta.

---

## Criterios de aceptación

- [x] `npm run lint` y `npm run build` terminan sin errores.
- [x] Existe `supabase/migrations/<timestamp>_games_scores.sql`, y `list_migrations` la muestra aplicada.
- [x] `games` tiene 8 filas y solo `rocas` tiene `playable = true`.
- [x] `scores` tiene RLS activado, `SELECT` público, `INSERT` con `WITH CHECK` y ninguna política de `UPDATE` ni `DELETE`.
- [x] Un `INSERT` en `scores` como `anon` con `game_id = 'caida'`, `name = 'abc'` o `score = 0` es rechazado.
- [x] `get_advisors` (security) no muestra avisos sobre `games`, `scores`, las vistas ni `rls_auto_enable`.
- [x] Existe `lib/supabase/database.types.ts`, y los tres clientes de `lib/supabase/` y `public.ts` están tipados con `Database`.
- [x] Ningún archivo del repo importa `GAMES`, `seededScores`, `saveScore`, `RECENT_SCORES` ni `TOP_PLAYERS`, y la cadena `av_scores` no aparece en el código.
- [x] `/`, `/biblioteca`, `/juegos/[id]`, `/juegos/[id]/jugar` y `/salon` muestran los 8 juegos en el orden actual.
- [x] Con `scores` vacío, cada vista muestra su estado vacío y «Mejor global» se ve como «—».
- [x] Con dos partidas del mismo nombre en `rocas`, el ranking de la ficha y del Salón muestra ese nombre una sola vez, con su mejor marca.
- [x] Al guardar una partida de `rocas`, la marca aparece en `/salon`, en la ficha de `rocas`, en «ÚLTIMAS PUNTUACIONES» y en «TOP JUGADORES · HOY» al navegar a esas rutas, sin reiniciar el servidor.
- [x] «Mejor global» y «Partidas» de `rocas` se actualizan tras guardar.
- [x] Con sesión iniciada y una marca guardada con ese nombre, la fila «TU MEJOR MARCA» de `/salon` muestra su posición y puntuación reales. Sin marca, muestra «AÚN SIN MARCA EN {JUEGO}».
- [x] En los juegos simulados, el modal FIN DEL JUEGO no muestra el input ni el botón GUARDAR.
- [x] Si `submitScore` falla (p. ej. URL de Supabase alterada), el modal muestra el error y permite reintentar.
- [x] No hay errores ni warnings de hidratación en la consola en esas rutas, con y sin `av_user` en `localStorage`.
- [x] Ninguna clave secreta de Supabase aparece en el repo ni en `.env`.
- [x] `CLAUDE.md` documenta tablas, vistas, RLS, caché y `submitScore`.

---

## Decisiones tomadas y descartadas

- **Sí:** catálogo y leaderboard en la misma spec y en la misma migración. Decisión del usuario. `scores.game_id` necesita la FK a `games`.
- **No:** dividirlo en dos specs.
- **No:** dejarlo en mock o `localStorage`.
- **Sí:** escritura anónima con una Server Action que valida, y las mismas reglas en `CHECK` y en RLS. Decisión del usuario: no esperar al auth.
- **No:** Supabase Anonymous Sign-in. Adelanta parte del auth.
- **No:** esta spec en modo solo lectura.
- **Sí:** solo guardan los juegos reales. Hoy solo `rocas`. Decisión del usuario: las puntuaciones simuladas ensuciarían el ranking.
- **Sí:** columna `playable` en `games`. La usan RLS, la Server Action y el modal. Así no hay que importar el registro de componentes en el servidor.
  - Contrapartida: al hacer jugable un juego hay que registrarlo en `PLAYABLE` y poner `playable = true` en una migración.
- **Sí:** el ranking guarda todas las partidas y muestra la mejor de cada nombre. En empate gana la más antigua. Decisión del usuario.
- **No:** mostrar todas las partidas como filas.
- **Sí:** `best` y `plays` calculados desde `scores` (vista `game_stats`). Decisión del usuario.
- **No:** migrar `best` y `plays` como columnas estáticas. Contradecirían el ranking real.
- **Sí:** home con «ÚLTIMAS PUNTUACIONES» (7 más recientes) y «TOP JUGADORES · HOY» (5 mejores puntuaciones individuales de las últimas 24 h). Decisión del usuario.
- **No:** top histórico en la home.
- **Sí:** eliminar `av_scores`, `saveScore` y todos los datos mock de puntuaciones. Decisión del usuario.
- **No:** seguir escribiendo una copia local.
- **No:** subir a la DB las partidas antiguas de `av_scores`.
- **Sí:** seed de los 8 juegos y `scores` vacío. Decisión del usuario.
- **No:** sembrar puntuaciones falsas.
- **Sí:** `'use cache'` con `cacheTag` y un cliente público sin cookies, más `updateTag("scores")` en la Action. Decisión del usuario.
- **No:** lecturas dinámicas en cada petición.
- **Sí:** validación básica, sin rate limit. Decisión del usuario.
  - Nombre `^[A-Z0-9_]{1,10}$`.
  - Score entero entre 1 y 9.999.999.
  - El juego tiene que existir y ser jugable.
- **No:** limitar por IP.
- **Sí:** «INVITADO» se puede guardar como cualquier otro nombre. Decisión del usuario.
- **Sí:** el nombre se sanea en el cliente (`sanitizeName`) en vez de rechazarlo. La sesión y el modal admiten hoy espacios y acentos, y de otro modo el guardado fallaría sin explicación.
- **Sí:** guardar el SQL en `supabase/migrations/` además de aplicarlo con el MCP. Así la migración queda versionada en git, sin adoptar todavía la Supabase CLI.
- **Sí:** generar `database.types.ts` y revocar `rls_auto_enable` aquí. La SPEC 04 los dejó para «la primera spec con tablas».
- **Pendiente de confirmar al revisar:** son propuestas mías.
  - Nombres: `getGames`, `getLeaderboard`, `submitScore`, `lib/score-rules.ts`, `lib/supabase/public.ts`, vistas `leaderboard` y `game_stats`.
  - Textos de los estados vacíos y del error del modal.
  - Top 12 en el Salón y 100 filas para buscar «TU MEJOR MARCA».
  - Valores de `cacheLife`.
  - Que la pestaña inicial de `/salon` siga siendo el primer juego del catálogo.

---

## Riesgos identificados

| Riesgo                                                                                                                                                                                     | Mitigación                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Sin auth, cualquiera puede insertar puntuaciones falsas llamando a la API de Supabase directamente.                                                                                        | RLS limita nombre, rango y juego jugable. Aceptado hasta la spec de auth, que añadirá `user_id`.                                     |
| Leer `cookies()` dentro de `'use cache'` rompe en runtime aunque `next build` pase.                                                                                                        | Todas las lecturas cacheadas usan `lib/supabase/public.ts`, que no toca cookies. Solo `submitScore` usa `lib/supabase/server.ts`.    |
| `generateStaticParams` y el pre-render necesitan Supabase disponible durante `next build`.                                                                                                 | Las variables `NEXT_PUBLIC_SUPABASE_*` ya están en `.env`. Si Supabase falla, el build falla y no se publica un catálogo vacío.      |
| El top «de hoy» y el «hace X min» quedan congelados mientras dure la caché.                                                                                                                | `cacheLife("minutes")` en la actividad de la home.                                                                                   |
| `PLAYABLE` (código) y `games.playable` (DB) se desincronizan.                                                                                                                              | Documentarlo en `CLAUDE.md`. Un juego registrado pero sin `playable` simplemente no puede guardar.                                   |
| Una migración cambia `games` (p. ej. `playable`) y un servidor en marcha sigue sirviendo el catálogo anterior: la app nunca invalida el tag `games` y `getGames` usa `cacheLife("hours")`. | Un deploy o un reinicio del servidor lo resuelve; si no, se actualiza al caducar la caché. Observado al probar el error de guardado. |
| El servidor de desarrollo se queda con un build antiguo.                                                                                                                                   | No lanzar `build` con `dev` corriendo. Si pasa, `rm -rf .next`.                                                                      |

---

## Qué **no** está en esta spec

- Auth real y `user_id` en las puntuaciones.
- Rate limit o antitrampa avanzada.
- Migrar las partidas antiguas de `av_scores`.
- Nuevos juegos jugables o guardar desde los simulados.
- Paginación, filtros por fecha o rankings por periodo en el Salón.
- Moderación o borrado de puntuaciones.
- Panel de administración del catálogo.
- Resto de datos de la home en la DB.
- Realtime.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
