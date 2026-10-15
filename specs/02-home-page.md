# SPEC 02 — Home page (landing) y mover la Biblioteca a `/biblioteca`

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-14
> **Objetivo:** Crear la landing de Arcade Vault en `/` a partir de `references/home-about/` (home, nav y estilos), mover la Biblioteca a `/biblioteca` y actualizar la Nav y todos los enlaces afectados.

---

## Por qué existe esta spec

La SPEC 01 dejó la Biblioteca en `/`. El prototipo de `references/home-about/` añade una landing con hero, propuesta de valor, vista previa de juegos, estadísticas, actividad, precios y CTA final, más una Nav con "Inicio" y "Acerca de". Esta spec lleva eso a la app real. La página About (`references/home-about/about.jsx`) se deja para otra spec.

---

## Alcance

**Dentro:**

- Nueva home en `/` fiel a `references/home-about/home.jsx`, con sus 7 bloques: hero con siluetas flotantes, "¿Por qué Arcade Vault?" (4 tarjetas), "Juegos disponibles ahora" (6 `MiniCard`), estadísticas, "Actividad en vivo" (últimas puntuaciones + top jugadores), precios con FAQ y CTA final.
- Animación de entrada `reveal` (IntersectionObserver) en las secciones que la usan.
- Mover la Biblioteca actual de `/` a `/biblioteca` (misma UI, `metadata` sin cambios).
- Nav según `references/home-about/nav.jsx`: añadir "Inicio" (`/`) y "Acerca de" (`/acerca-de`), tanto en la barra como en el panel móvil, con estados activos actualizados.
- Actualizar todos los enlaces y redirecciones que hoy apuntan a la Biblioteca en `/` (ver Plan, paso 2).
- Portar a `app/globals.css` los estilos de `references/home-about/styles.css` que falten: HOME PAGE, ACTIVITY, PRICING, GAMEPAD y temas, `reveal`, más cualquier diferencia de Nav/globales que afecte a la home. Todo salvo la sección ABOUT PAGE.
- Datos mock de la home (actividad, top jugadores, estadísticas, features, precios, FAQ) tipados en `lib/home.ts`.
- `metadata` de la home en español.
- Con sesión iniciada, los CTA de registro cambian (ver Decisiones).
- Correcciones en la Nav y la sesión (SPEC 01) detectadas al verificar la home en el navegador, ampliadas al alcance a petición del usuario (ver paso 7): error de hidratación con sesión iniciada, scroll horizontal a 390 px y alineación del texto de los botones.

**Fuera de alcance (para otras specs):**

- Página About / Contacto (`about.jsx`, estilos ABOUT PAGE) y la ruta `/acerca-de`. El enlace de la Nav existirá y dará 404 hasta esa spec.
- Cualquier uso real de los estilos GAMEPAD/temas (se portan a `globals.css`, pero ningún componente los monta aquí).
- Datos reales para actividad, ranking o estadísticas; son texto/mock fijo.
- Mostrar en la home las puntuaciones de `av_scores`.
- Preseleccionar la pestaña CREAR CUENTA en `/acceso` (sin query params).
- Tests automatizados.

---

## Modelo de datos

Estructuras nuevas en `lib/home.ts`; reutiliza `GAMES` y `AccentColor` de la SPEC 01.

```ts
// lib/home.ts
import type { AccentColor } from "@/lib/games";

export type Feature = { icon: "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET"; title: string; desc: string; color: AccentColor };
export type HomeStat = { n: string; u: string; s: string };
export type RecentScore = { player: string; game: string; score: number; when: string; color: AccentColor };
export type TopPlayer = { rank: number; player: string; score: number };
export type FaqItem = { q: string; a: string };

export const FEATURES: Feature[];       // 4 elementos, textos de home.jsx
export const HOME_STATS: HomeStat[];    // 3 elementos: "12+", "MILES", "GLOBAL"
export const RECENT_SCORES: RecentScore[]; // 7 elementos
export const TOP_PLAYERS: TopPlayer[];  // 5 elementos
export const PRICE_FEATURES: string[];  // 6 ítems de la lista del plan
export const FAQ: FaqItem[];            // 3 elementos
```

Convenciones:

- Los textos se copian literalmente de `home.jsx` (en español, MAYÚSCULAS donde la referencia las usa).
- Números con `toLocaleString("es-ES")`.
- La vista previa de juegos usa `GAMES.slice(0, 6)` de `lib/games.ts`; no se duplica.
- Los iconos de features y las siluetas son SVG inline en componentes, no datos.
- `IntersectionObserver` solo se usa en el cliente (efecto), nunca durante el render del servidor.

---

## Plan de implementación

Cada paso deja la app compilando y ejecutable.

1. **Estilos.** Portar a `app/globals.css` las secciones faltantes de `references/home-about/styles.css` (HOME PAGE, ACTIVITY, PRICING, GAMEPAD y temas, `reveal`, `misc`) y comparar la parte de Nav/globales por si hay cambios (p. ej. estilos de `.links a`). No se porta ABOUT PAGE. Comprobación: `npm run lint` y `npm run build` pasan y la app existente se ve igual.
2. **Mover la Biblioteca.** Crear `app/biblioteca/page.tsx` con el contenido actual de `app/page.tsx` (hero + `LibraryBrowser`). Actualizar los enlaces y redirecciones que apuntaban a la Biblioteca en `/`:
   - `app/juegos/[id]/page.tsx` (VOLVER AL VAULT), `components/game-player.tsx` (VOLVER AL VAULT), `components/hall-of-fame.tsx` (VOLVER A LA BIBLIOTECA) → `/biblioteca`.
   - `components/auth-form.tsx`: las dos llamadas `router.push("/")` → `/biblioteca`.
   - `components/nav.tsx`: el enlace "Biblioteca" → `/biblioteca`; `isLibrary` pasa a `pathname.startsWith("/biblioteca") || pathname.startsWith("/juegos")`.
   `app/page.tsx` queda temporalmente sin cambios hasta el paso 5. Comprobación: `/biblioteca` funciona con filtros y búsqueda; los botones de volver y el login llevan a `/biblioteca`.
3. **Nav.** En `components/nav.tsx` añadir "Inicio" (`/`, activo solo con `pathname === "/"`) y "Acerca de" (`/acerca-de`, activo con `startsWith`), en la barra y en el panel móvil, en el orden de la referencia: Inicio · Biblioteca · Salón de la Fama · Acerca de. El logo sigue enlazando a `/`. Comprobación: estados activos correctos en `/`, `/biblioteca`, `/juegos/x`, `/salon`; el menú móvil muestra los 4 enlaces + cuenta.
4. **Datos y componentes de la home.** Crear `lib/home.ts` y los componentes: `components/home/floating-silhouettes.tsx` (8 SVG), `components/home/feature-icon.tsx`, `components/home/mini-card.tsx` (enlace a `/juegos/[id]`), `components/home/reveal.tsx` (cliente: aplica `.reveal` → `.in` con IntersectionObserver, `threshold: 0.12`, desconecta al desmontar) y `components/home/home-ctas.tsx` (cliente, lee la sesión para los CTA). Las secciones estáticas pueden ser componentes de servidor. Seguir la regla `react-hooks/set-state-in-effect`: el observer solo añade clases al DOM, sin `setState`. Comprobación: `npm run lint` y `npm run build` pasan.
5. **Página `/`.** Reemplazar `app/page.tsx` con la home: hero (eyebrow, título de 3 líneas, subtítulo, CTAs, indicador "DESLIZA"), WHY, GAMES PREVIEW, STATS, ACTIVITY, PRICING y FINAL CTA. Enlaces:
   - EXPLORAR JUEGOS, VER TODOS LOS JUEGOS e INSERTAR MONEDA → `/biblioteca`.
   - CREAR CUENTA y EMPEZAR GRATIS → `/acceso` (sin sesión).
   - VER SALÓN → `/salon`.
   - Cada `MiniCard` → `/juegos/[id]`.
   Usar `<Link>`, no `<button onClick>`. `metadata.title`: "Arcade Vault · El arcade clásico está de vuelta". Comprobación: la home se ve equivalente a la referencia y todos los enlaces navegan.
6. **Pulido y verificación.** Revisar responsive (≤ 840 px, y los breakpoints propios de HOME/ACTIVITY/PRICING), comprobar que no hay errores de hidratación, que `reveal` funciona al hacer scroll y que `prefers-reduced-motion` no deja contenido invisible si la referencia lo cubre. Actualizar `CLAUDE.md` (rutas: `/` home, `/biblioteca`, y mención de `lib/home.ts`) y marcar la SPEC 02 como `Implementado`.
   *Hecho:* se verificó en el navegador (escritorio 1280 px y móvil 390 px) comparando con la referencia servida en local; la Nav y el hero coinciden con el prototipo. `CLAUDE.md` actualizado (rutas, home, `lib/home.ts`).
7. **Correcciones detectadas en la verificación (añadido tras el paso 6).** Tres defectos de la Nav/sesión heredados de la SPEC 01, corregidos aquí por decisión del usuario:
   - **Hidratación con sesión.** Con `av_user` en `localStorage`, la Nav daba "Hydration failed" (el servidor pintaba `<a>Iniciar Sesión</a>` y el cliente `<button>`) en todas las rutas. Causa: `SessionProvider` cambiaba su valor justo tras hidratar y la Nav, dentro de un `Suspense` que suspende por `usePathname`, hidrataba ya con el usuario. Corrección: se elimina el contexto; `useSession` pasa a `lib/use-session.ts` y cada componente lee la sesión con su propio `useSyncExternalStore` (snapshot de servidor `null` durante su hidratación). `components/session-provider.tsx` se borra, `app/layout.tsx` ya no monta `SessionProvider` y los 5 componentes que usaban el hook cambian su import (`nav`, `auth-form`, `game-player`, `hall-of-fame`, `home/home-ctas`). `CLAUDE.md` actualizado.
   - **Scroll horizontal a 390 px.** El botón de menú se salía 13 px de la Nav. En `app/globals.css`, dentro de `@media (max-width: 840px)`: `.av-nav { gap: 12px }` y `.av-nav .auth-btn { margin-left: 0 }`. A 390 px el ancho de scroll pasa de 403 a 390.
   - **Alineación del texto de los botones.** Los `<Link className="btn">` alineaban a la izquierda el texto que se parte en dos líneas ("Iniciar Sesión"), a diferencia del `<button>` de la referencia. En `.btn` se añade `text-align: center`.
   *Verificación:* `npm run lint` y `npm run build` pasan; build de producción servido en el puerto 3100, con sesión iniciada, sin errores de hidratación en `/`, `/biblioteca`, `/salon`, `/juegos/caida/jugar` y `/acceso`. La única entrada de error en consola es el 404 de la precarga de `/acerca-de`.

---

## Criterios de aceptación

- [x] `npm run lint` y `npm run build` terminan sin errores.
- [x] No hay errores ni warnings de hidratación en la consola en `/`, `/biblioteca`, `/juegos/<id>`, `/salon` y `/acceso`.
- [x] `/` muestra el hero con el título "EL ARCADE / CLÁSICO ESTÁ / DE VUELTA" y las 8 siluetas decorativas.
- [x] `/` contiene, en este orden: hero, "¿POR QUÉ ARCADE VAULT?" (4 tarjetas), "JUEGOS DISPONIBLES AHORA" (6 mini-tarjetas), 3 estadísticas, "ACTIVIDAD EN VIVO" (7 puntuaciones y 5 top jugadores), "PRECIOS" (plan + 3 FAQ) y "¿LISTO PARA JUGAR?".
- [x] Las 6 mini-tarjetas son los 6 primeros juegos de `GAMES`; clic en una lleva a `/juegos/<id>`.
- [x] EXPLORAR JUEGOS, VER TODOS LOS JUEGOS e INSERTAR MONEDA llevan a `/biblioteca`.
- [x] Sin sesión, CREAR CUENTA (hero) y EMPEZAR GRATIS (precios) llevan a `/acceso`.
- [x] Con sesión iniciada, el CTA CREAR CUENTA del hero no aparece y EMPEZAR GRATIS pasa a ir a `/biblioteca` con el texto "IR A LA BIBLIOTECA →".
- [x] VER SALÓN lleva a `/salon`.
- [x] Las secciones con `.reveal` empiezan ocultas y reciben la clase `in` al entrar en el viewport; las puntuaciones usan formato `es-ES` (p. ej. `+184.220`).
- [x] `/biblioteca` muestra el mismo contenido que antes en `/` (hero, 8 tarjetas, búsqueda "caí" → CAÍDA, chip SHOOTER → 2 juegos, "NO HAY RESULTADOS").
- [x] VOLVER AL VAULT (Detalle y Reproductor) y VOLVER A LA BIBLIOTECA (Salón) llevan a `/biblioteca`.
- [x] Enviar el formulario de `/acceso` o pulsar JUGAR COMO INVITADO redirige a `/biblioteca`.
- [x] La Nav muestra, en este orden, Inicio · Biblioteca · Salón de la Fama · Acerca de; "Inicio" solo está activo en `/`; "Biblioteca" está activo en `/biblioteca`, `/juegos/<id>` y `/juegos/<id>/jugar`.
- [x] El panel móvil (≤ 840 px) lista los 4 enlaces más Iniciar Sesión/Cuenta y se cierra al navegar.
- [x] El enlace "Acerca de" navega a `/acerca-de` (404 esperado hasta la spec de About).
- [x] `app/globals.css` no contiene estilos de la sección ABOUT PAGE.
- [x] La home es visualmente equivalente a `references/home-about/arcade-vault-standalone.html` en escritorio y móvil (comparación lado a lado).
- [x] `CLAUDE.md` refleja las nuevas rutas.
- [x] Con `av_user` en `localStorage` no hay errores de hidratación en `/`, `/biblioteca`, `/salon`, `/juegos/<id>/jugar` ni `/acceso` (paso 7).
- [x] A 390 px de ancho `document.documentElement.scrollWidth` es 390 (sin scroll horizontal) en `/` (paso 7).
- [x] El texto de dos líneas de "Iniciar Sesión" en la Nav va centrado (`text-align: center` en `.btn`) (paso 7).

---

## Decisiones tomadas y descartadas

- **Sí:** la Biblioteca pasa a `/biblioteca` y la home ocupa `/`. Es lo que pidió el usuario; la landing es la puerta de entrada.
- **Sí:** "Acerca de" visible en la Nav apuntando a `/acerca-de`, aunque dé 404 hasta la spec de About. Decisión explícita del usuario; la Nav queda igual a la referencia. Alternativa descartada: añadirlo en la spec de About (evitaba el enlace roto).
- **Sí:** tras login o invitado, y en los botones "VOLVER…", se redirige a `/biblioteca`. Mantiene el flujo de la SPEC 01 (el usuario cae en los juegos, no en la landing).
- **Sí:** portar todos los estilos de la referencia salvo ABOUT PAGE, incluyendo GAMEPAD y temas aunque no se usen todavía. Decisión del usuario; deja `globals.css` alineado con el prototipo. Coste: CSS sin uso hasta la spec de los juegos.
- **Sí:** con sesión, el CTA CREAR CUENTA del hero se oculta y EMPEZAR GRATIS pasa a "IR A LA BIBLIOTECA →" (`/biblioteca`). El comportamiento exacto con sesión lo propuse yo a partir de la respuesta "se ocultan/cambian con sesión"; **pendiente de confirmar al revisar**.
- **No:** preseleccionar la pestaña CREAR CUENTA con query param. Ampliaba el alcance a `auth-form`.
- **Sí:** `<Link>` en vez de `navigate({ name })`. El routing por estado era del prototipo.
- **Sí:** datos mock de la home en `lib/home.ts`, tipados. Mismo criterio que `lib/games.ts` y `lib/scores.ts`; los componentes no llevan arrays incrustados.
- **Sí:** secciones estáticas como componentes de servidor y solo `Reveal` y los CTA dependientes de sesión como cliente. Reduce JS enviado; la sesión solo existe en cliente (`useSyncExternalStore`).
- **No:** `useEffect` + `setState` para el efecto reveal. El observer añade la clase directamente al DOM, compatible con `react-hooks/set-state-in-effect`.
- **Sí:** reutilizar las clases CSS de `globals.css` en vez de utilidades de Tailwind, igual que la SPEC 01.
- **Sí:** las estadísticas ("12+ JUEGOS", etc.) se mantienen tal cual la referencia aunque `GAMES` tenga 8 juegos; son texto de marketing.
- **Sí:** ampliar esta spec con el paso 7 (hidratación con sesión, overflow móvil y alineación de botones), aunque los defectos vengan de la SPEC 01. Decisión del usuario al ver los resultados de la verificación; los tres afectan a pantallas de esta spec (la Nav está en todas).
- **Sí:** eliminar `SessionProvider` y leer la sesión con `useSyncExternalStore` en cada componente (`lib/use-session.ts`). Cada componente hidrata con el snapshot de servidor aunque otro ya haya leído `localStorage`. Es más simple que un contexto y no necesita proveedor en el layout.
- **No:** mantener el contexto y proteger solo la Nav con un indicador de "hidratado". Arreglaba la Nav pero dejaba la misma trampa para cualquier componente nuevo que lea la sesión dentro de un `Suspense`.
- **Sí:** el ajuste móvil de la Nav solo reduce `gap` y quita `margin-left` bajo 840 px; escritorio queda igual que la referencia.
- **Observado, sin tocar:** a 1280 px la Nav de la referencia (y la nuestra) parte en dos líneas "Salón de la Fama", "Acerca de" y "Iniciar Sesión" porque los elementos se comprimen; es idéntico al prototipo, así que se deja como está. Si se quiere evitar, va en otra spec.
- **Pendiente de confirmar al revisar:** nombres de archivos de componentes (`components/home/*`) y de `lib/home.ts`; los propuse yo.

---

## Riesgos identificados

| Riesgo | Mitigación |
| ------ | ---------- |
| Next.js 16.4 / React 19.3 y `cacheComponents` cambian el comportamiento habitual. | Leer la guía en `node_modules/next/dist/docs/` antes de escribir las páginas; la home no lee `params`, pero la Nav usa `usePathname` y ya va en `Suspense`. |
| Enlaces a `/` que se quedan sin actualizar y llevan a la landing en vez de a la Biblioteca. | Plan, paso 2 lista los archivos; verificar con `grep` de `href="/"` y `router.push("/")` tras el cambio. |
| El enlace "Acerca de" da 404. | Aceptado por decisión del usuario; se resuelve en la spec de About. |
| Elementos `.reveal` quedan invisibles si el observer no corre (JS desactivado, `prefers-reduced-motion`). | Comprobar la CSS de la referencia; si hace falta, mostrar el contenido por defecto cuando no hay JS o con movimiento reducido. |
| Diferencias de la Nav/globales de la referencia chocan con estilos ya portados. | Comparar `styles.css` con `globals.css` sección por sección en el paso 1 y verificar que las 5 pantallas existentes no cambian. |
| Mucho CSS sin uso (GAMEPAD, temas). | Aceptado; se usará en la spec de juegos. |
| El hero con siluetas animadas puede desbordar en móvil. | Revisar con el breakpoint ≤ 840 px y evitar scroll horizontal. Comprobado: el contenido de la home no desborda; el único desbordamiento era el botón de menú de la Nav (corregido en el paso 7). |
| El servidor de desarrollo (`next dev`) puede servir CSS antiguo tras editar `app/globals.css` (visto durante el paso 7). | Verificar los cambios de CSS con `npm run build` + `npm run start`, o reiniciar `next dev`. |

---

## Qué **no** está en esta spec

- Página About / Contacto y la ruta `/acerca-de`.
- Uso real de los estilos de GAMEPAD y temas.
- Datos reales de actividad, ranking o estadísticas.
- Puntuaciones de `av_scores` en la home.
- Pestaña CREAR CUENTA preseleccionada.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
