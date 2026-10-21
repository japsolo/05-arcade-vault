# SPEC 04 — Conexión del proyecto con Supabase

> **Estado:** Aprobado
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-20
> **Objetivo:** Conectar la app con el proyecto de Supabase (dependencias, variables de entorno, clientes de servidor y navegador, y proxy) sin crear tablas ni cambiar ninguna pantalla.

---

## Por qué existe esta spec

El proyecto de Supabase ya existe y está vacío: no tiene tablas ni migraciones. Antes de llevar auth, puntuaciones o el catálogo a la base de datos, hace falta que la app sepa conectarse. Esta spec solo monta esa conexión siguiendo el patrón estándar de `@supabase/ssr` en Next.js. Añade un script para comprobar que la URL y la clave son correctas. Las funcionalidades que usen Supabase van en specs posteriores.

---

## Alcance

**Dentro:**

- Instalar `@supabase/supabase-js` y `@supabase/ssr`.
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: con valores en `.env` y sin valores en `.env.template`.
- `lib/supabase/server.ts`: `createClient()` asíncrono con `createServerClient` y `cookies()`, para Server Components, Server Actions y Route Handlers.
- `lib/supabase/client.ts`: `createClient()` con `createBrowserClient`, para componentes de cliente.
- `lib/supabase/proxy.ts`: `updateSession(request)`, que refresca la sesión de Supabase y propaga las cookies.
- `proxy.ts` en la raíz, que llama a `updateSession`, con un `matcher` que excluye los estáticos.
- Script `scripts/supabase-check.mjs` y comando `npm run supabase:check`, que comprueba que la URL y la clave son válidas.
- Documentar en `CLAUDE.md` los clientes, el proxy, las variables y el script.

**Fuera de alcance (para otras specs):**

- Crear tablas, migraciones o la carpeta `supabase/migrations/`.
- Mover datos mock a la base de datos: catálogo (`lib/games.ts`), puntuaciones (`av_scores`, `seededScores`) y datos de la home (`lib/home.ts`).
- Todo el flujo de auth: registro, login, logout, OAuth, perfiles y sustituir `lib/session.ts` / `useSession`.
- Generar tipos TypeScript (`database.types.ts`). Los clientes se crean sin el genérico `Database`.
- Revocar `EXECUTE` de `public.rls_auto_enable()` (aviso del advisor de seguridad). Necesita una migración.
- Usar los clientes desde alguna página o componente.
- Endpoint de health check en la app (`/api/health`).
- Supabase CLI, entorno local y branches.
- Tests automatizados.

---

## Modelo de datos

Esta spec no introduce estructuras de datos ni tablas. Solo añade configuración y módulos de conexión.

Variables de entorno (en `.env`, ya ignorado por git; las claves sin valor en `.env.template`):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Firmas de los módulos nuevos:

```ts
// lib/supabase/server.ts
export async function createClient(): Promise<SupabaseClient>;

// lib/supabase/client.ts
export function createClient(): SupabaseClient;

// lib/supabase/proxy.ts
export async function updateSession(request: NextRequest): Promise<NextResponse>;
```

Script en `package.json`:

```json
"supabase:check": "node --env-file=.env scripts/supabase-check.mjs"
```

Convenciones:

- `lib/supabase/server.ts` y `lib/supabase/proxy.ts` nunca se importan desde un componente con `"use client"`.
- Se usa solo la clave publishable (`sb_publishable_…`). Es pública por diseño; la seguridad de los datos la dará RLS cuando haya tablas.
- No se usa ninguna clave secreta (`sb_secret_…` / `service_role`) en esta spec.
- El script de comprobación hace `GET {URL}/auth/v1/health` con la cabecera `apikey`. Con HTTP 200 imprime `✔ SUPABASE OK` y sale con código 0. En cualquier otro caso (falta una variable, error de red, 401 por clave inválida) imprime `✖` y el motivo, y sale con código 1.

---

## Plan de implementación

Cada paso deja la app compilando y ejecutable.

1. **Dependencias y variables.** Instalar `@supabase/supabase-js` y `@supabase/ssr`. Obtener la URL y la clave publishable con el MCP de Supabase (`get_project_url`, `get_publishable_keys`) y añadirlas a `.env`. Añadir las dos claves vacías a `.env.template`. Comprobación: `npm run lint` y `npm run build` pasan.
2. **Script de comprobación.** Crear `scripts/supabase-check.mjs` y el comando `supabase:check` en `package.json`. Comprobación: `npm run supabase:check` imprime `✔ SUPABASE OK`. Con una clave alterada en `.env` imprime `✖` y sale con código 1; después se restaura la clave.
3. **Clientes.** Leer antes la guía de `cookies()` en `node_modules/next/dist/docs/01-app/`. Crear `lib/supabase/server.ts` y `lib/supabase/client.ts` según la guía de `@supabase/ssr` para Next.js. Comprobación: `npm run lint` y `npm run build` pasan. Nadie importa todavía los clientes.
4. **Proxy.** Leer antes la guía de `proxy` en `node_modules/next/dist/docs/01-app/` (Next 16 sustituye `middleware` por `proxy`). Crear `lib/supabase/proxy.ts` con `updateSession` y `proxy.ts` en la raíz. El `matcher` excluye `_next/static`, `_next/image`, `favicon.ico` e imágenes (`svg`, `png`, `jpg`, `jpeg`, `gif`, `webp`). Comprobación: `npm run build` lista el proxy, y en `next dev` todas las rutas se ven igual que antes, sin errores en la consola del servidor.
5. **Documentación.** Actualizar `CLAUDE.md` con los clientes de `lib/supabase/`, el proxy, las variables `NEXT_PUBLIC_SUPABASE_*` y `npm run supabase:check`. Marcar la SPEC 04 como `Implementado`.

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `package.json` incluye `@supabase/supabase-js` y `@supabase/ssr` en `dependencies`.
- [ ] `.env.template` incluye `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` sin valores.
- [ ] Con `.env` correcto, `npm run supabase:check` imprime `✔ SUPABASE OK` y sale con código 0.
- [ ] Con la clave alterada o sin variables, `npm run supabase:check` imprime `✖` y el motivo, y sale con código 1.
- [ ] Existen `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/proxy.ts` y `proxy.ts`.
- [ ] Ningún archivo con `"use client"` importa `lib/supabase/server.ts` ni `lib/supabase/proxy.ts`.
- [ ] `/`, `/biblioteca`, `/juegos/caida`, `/juegos/caida/jugar`, `/acceso`, `/salon` y `/acerca-de` se ven y funcionan igual que antes.
- [ ] No hay errores ni warnings de hidratación en la consola en esas rutas, con y sin `av_user` en `localStorage`.
- [ ] El proyecto de Supabase sigue sin tablas en `public` (`list_tables` vacío) y sin migraciones.
- [ ] Ninguna clave secreta de Supabase aparece en el repo ni en `.env`.
- [ ] `CLAUDE.md` documenta los clientes, el proxy, las variables y el script.

---

## Decisiones tomadas y descartadas

- **Sí:** esta spec cubre solo la conexión. Decisión del usuario: sin tablas, sin migraciones y sin mover datos.
- **No:** incluir el catálogo de juegos en DB. Era la versión anterior de esta spec; se deja para otra.
- **No:** incluir auth. Decisión del usuario: todo el flujo de auth va en su propia spec.
- **Sí:** `@supabase/supabase-js` + `@supabase/ssr` con clientes de servidor y navegador y el proxy. Es el montaje estándar de Supabase en Next.js y deja lista la spec de auth.
- **No:** un único cliente con `supabase-js`. Obligaría a rehacer la conexión al llegar el auth.
- **Sí:** verificar con un script `npm run supabase:check` contra `/auth/v1/health`. Comprueba URL y clave sin tablas y sin añadir nada a la app.
- **No:** Route Handler `/api/health`. Añade un endpoint público que habría que mantener o borrar.
- **No:** dar por buena la conexión porque compila. Una URL o una clave erróneas pasarían desapercibidas.
- **Sí:** `node --env-file=.env` en el script (Node 24). No hace falta `dotenv` ni `tsx`.
- **No:** generar `database.types.ts` ahora. Sin tablas, el tipo `Database` estaría vacío; se genera en la primera spec con tablas.
- **No:** revocar `EXECUTE` de `rls_auto_enable()` en esta spec. Necesita una migración; va en la primera spec que cree tablas.
- **Sí:** `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Es la convención actual de Supabase y el cliente de navegador las necesita.
- **Pendiente de confirmar al revisar:** el nombre del script (`scripts/supabase-check.mjs`, `supabase:check`), sus mensajes y la lista de extensiones del `matcher`. Los propuse yo.

---

## Riesgos identificados

| Riesgo                                                                          | Mitigación                                                                                                |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Next.js 16.4 sustituye `middleware` por `proxy` y cambia APIs como `cookies()`. | Leer las guías en `node_modules/next/dist/docs/01-app/` antes de los pasos 3 y 4.                         |
| La guía de `@supabase/ssr` puede estar escrita para `middleware.ts`.            | Adaptar solo el nombre del archivo y la exportación a `proxy.ts`; la lógica de `updateSession` no cambia. |
| El proxy añade trabajo a cada petición sin que haya usuarios todavía.           | Sin cookie de sesión, `updateSession` no hace llamadas de red. El `matcher` excluye los estáticos.        |
| El proxy rompe alguna ruta existente (redirecciones o cookies inesperadas).     | `updateSession` no redirige en esta spec. Criterio de aceptación sobre las 7 rutas.                       |
| Exponer por error una clave secreta.                                            | Solo se usa la clave publishable; criterio de aceptación explícito.                                       |
| El servidor de desarrollo (`next dev`) se queda con un build antiguo.           | No lanzar `build` con `dev` corriendo; si pasa, `rm -rf .next`.                                           |

---

## Qué **no** está en esta spec

- Tablas, migraciones o datos en Supabase.
- Catálogo, puntuaciones o datos de la home en DB.
- Auth y reemplazo de la sesión simulada.
- Tipos generados de la base de datos.
- Revocar el aviso de `rls_auto_enable()`.
- Endpoint de health check en la app.
- Supabase CLI, entorno local y branches.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
