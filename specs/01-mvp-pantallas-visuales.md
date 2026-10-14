# SPEC 01 — MVP visual de Arcade Vault (todas las pantallas)

> **Estado:** Aprobado
> **Depende de:** ninguna
> **Fecha:** 2026-10-14
> **Objetivo:** Implementar en Next.js, con datos mock y sin ningún juego real, las cinco pantallas de `references/` (Biblioteca, Detalle, Reproductor, Acceso y Salón de la Fama) con su navegación, para tener el MVP visual navegable.

---

## Por qué existe esta spec

`references/` es un prototipo en React + Babel con routing por hash y estilos globales. Esta spec lo traslada a la app real (App Router, TypeScript) sin cambiar el diseño. El tema (`app/globals.css`) y las fuentes (`app/layout.tsx`) ya están portados; lo que falta es la UI, los datos mock y las rutas.

---

## Alcance

**Dentro:**

- Cinco pantallas fieles a `references/`: Biblioteca, Detalle de juego, Reproductor, Acceso (iniciar sesión / crear cuenta) y Salón de la Fama.
- Componentes compartidos: `Nav` (con menú móvil), footer y tarjeta de juego (`GameCard`) con efecto tilt.
- Rutas reales del App Router (ver Plan).
- Datos mock tipados: los 8 juegos de `references/data.jsx` y puntuaciones deterministas con semilla.
- Sesión simulada en `localStorage` (`av_user`): cualquier usuario/contraseña entra; la Nav muestra el nombre y permite cerrar sesión.
- Reproductor "de mentira": HUD, marco CRT con arena decorativa, puntuación simulada que sube sola, pausa, fin de partida y modal "FIN DEL JUEGO" con guardado de puntuación en `localStorage` (`av_scores`).
- Búsqueda por nombre y filtro por categoría en la Biblioteca (estado local de cliente).
- Responsive según los breakpoints ya definidos en `app/globals.css`.
- Metadata (`title`) por pantalla, en español.

**Fuera de alcance (para otras specs):**

- Cualquier juego real (lógica, canvas, input de teclado o táctil dentro de la arena).
- Backend, base de datos y autenticación real (validación, hash, OAuth, recuperación de contraseña).
- Botones de Google y GitHub: se renderizan pero no hacen nada.
- Mostrar en Detalle o Salón las puntuaciones guardadas en `av_scores`; los rankings son siempre los mock.
- Sistema de créditos real: el contador `CRÉDITOS · 03` es un texto fijo.
- Tests automatizados (no hay runner configurado).
- Internacionalización: la UI queda solo en español.

---

## Modelo de datos

Estructuras nuevas, todas en `lib/`:

```ts
// lib/games.ts
export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type AccentColor = "cyan" | "magenta" | "green" | "yellow";

export type Game = {
  id: string;          // slug de la URL, p. ej. "bloque-buster"
  title: string;       // "BLOQUE BUSTER"
  short: string;       // descripción corta (tarjeta)
  long: string;        // descripción larga (detalle)
  cat: Category;
  cover: string;       // clase CSS existente en globals.css, p. ej. "cover-bricks"
  color: AccentColor;  // color del botón JUGAR de la tarjeta
  best: number;        // mejor puntuación global (mock)
  plays: string;       // "12.4K" (mock, ya formateado)
};

export const GAMES: Game[];                 // los 8 juegos de references/data.jsx
export const CATEGORIES: ("TODOS" | Category)[];
export function getGame(id: string): Game | undefined;
```

```ts
// lib/scores.ts
export type ScoreRow = { rank: number; name: string; score: number; date: string }; // date "DD/MM/2026"

// Misma lógica determinista que seededScores de references/data.jsx.
export function seededScores(seed: number, count?: number): ScoreRow[];
```

```ts
// lib/session.ts — solo cliente
export type User = { name: string };            // MAYÚSCULAS, máx. 10 caracteres
// localStorage "av_user": JSON de User, o ausente si no hay sesión
// localStorage "av_scores": JSON de { game: string; score: number; name: string; at: number }[]
```

Convenciones:

- Formato de números: `toLocaleString("es-ES")`.
- Las claves de `localStorage` son exactamente `av_user` y `av_scores`, como en la referencia.
- Los rankings usan las mismas semillas que la referencia (`id.length * 17 + 3` en Detalle; `id.length * 23 + 7` en Salón) para que los datos coincidan con el prototipo.
- Todo acceso a `localStorage` va en componentes de cliente y dentro de manejadores, efectos o `useSyncExternalStore`, nunca durante el render del servidor.

---

## Plan de implementación

Cada paso deja la app compilando y ejecutable.

1. **Datos y utilidades.** Crear `lib/games.ts` y `lib/scores.ts` portando `references/data.jsx` a TypeScript. Comprobación: `npm run lint` y `npm run build` pasan. En `eslint.config.mjs` se añadió `"references/**"` a `globalIgnores` para que `npm run lint` no de errores.
2. **Sesión.** Crear `lib/session.ts` y un `SessionProvider` de cliente (`components/session-provider.tsx`) con `user`, `login(user)` y `logout()`, que lee y escribe `av_user`. Leer `localStorage` con `useSyncExternalStore` (snapshot de servidor `null`) para no provocar errores de hidratación; `lib/session.ts` expone `subscribeUser`, `getUserSnapshot`, `getServerUserSnapshot`, `parseUser`, `writeUser` y `saveScore`. Comprobación: `npm run lint` y `npm run build` pasan.
3. **Layout compartido.** Crear `components/nav.tsx` (logo, enlaces Biblioteca y Salón de la Fama, contador de créditos, botón de sesión, panel móvil) y `components/footer.tsx`. Montarlos en `app/layout.tsx` dentro del `SessionProvider`, con `<main className="av-main">`. Reutilizar `av-bg` si ya está en el layout. Comprobación: `npm run dev` y la Nav se ve y navega a rutas que aún no existen.
4. **Biblioteca (`/`).** Reemplazar `app/page.tsx` con hero, buscador, chips de categoría y rejilla. Crear `components/game-card.tsx` (cliente, con tilt) y un componente cliente para filtros. Estado vacío "NO HAY RESULTADOS". Clic en tarjeta o en JUGAR navega a `/juegos/[id]`. Comprobación: filtrar y buscar funciona.
5. **Detalle (`/juegos/[id]`).** Crear `app/juegos/[id]/page.tsx` con portada, etiquetas, estadísticas, leaderboard (10 filas) y botones JUGAR AHORA y VOLVER AL VAULT. Usar `generateStaticParams` con los 8 ids y `notFound()` para ids inexistentes. Comprobación: las 8 rutas cargan y `/juegos/xyz` da 404.
6. **Reproductor (`/juegos/[id]/jugar`).** Crear `app/juegos/[id]/jugar/page.tsx` y `components/game-player.tsx` (cliente): HUD (jugador, puntuación, vidas, nivel), PAUSA/REANUDAR, FIN, SALIR (vuelve al Detalle), marco CRT, overlay "EN PAUSA", modal "FIN DEL JUEGO" con input de iniciales (MAYÚSCULAS, máx. 10), GUARDAR PUNTUACIÓN (escribe `av_scores` y muestra el toast), JUGAR DE NUEVO y VOLVER AL VAULT. Nombre inicial: usuario en sesión o `INVITADO`. Comprobación: la puntuación sube, pausa la detiene, FIN abre el modal y guardar añade una entrada a `av_scores`.
7. **Acceso (`/acceso`).** Crear `app/acceso/page.tsx` y `components/auth-form.tsx` (cliente): pestañas INICIAR SESIÓN y CREAR CUENTA (la segunda añade el campo de correo), botón de envío, JUGAR COMO INVITADO, botones sociales sin acción y texto legal. Al enviar: `login({ name })` con `(usuario || "PLAYER1")` en mayúsculas y recortado a 10, y redirige a `/`. Invitado: cierra sesión y redirige a `/`. Comprobación: tras entrar, la Nav muestra el nombre y se mantiene al recargar.
8. **Salón de la Fama (`/salon`).** Crear `app/salon/page.tsx` y componente cliente con pestañas por juego (estado local, primera pestaña `GAMES[0]`), podio (2º, 1º, 3º), tabla de 12 filas con animación escalonada y, si hay sesión, la fila "TU MEJOR MARCA" con datos mock. Botón VOLVER A LA BIBLIOTECA. Comprobación: cambiar de pestaña cambia los datos.
9. **Pulido de navegación y metadata.** Estado activo de la Nav (Biblioteca activa también en Detalle y Reproductor), `metadata` por ruta, scroll al inicio al cambiar de ruta, y revisión responsive (menú móvil abre y cierra). Actualizar la sección de arquitectura de `CLAUDE.md` si cambia algo relevante.

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] No hay errores ni warnings de hidratación en la consola del navegador en ninguna de las 5 pantallas.
- [ ] `/` muestra el hero "ARCADE VAULT" y 8 tarjetas de juego.
- [ ] Escribir "caí" en el buscador deja solo la tarjeta CAÍDA (búsqueda sin distinguir mayúsculas).
- [ ] El chip SHOOTER muestra exactamente 2 juegos (INVASORES y ROCAS).
- [ ] Una búsqueda sin coincidencias muestra "NO HAY RESULTADOS".
- [ ] Clic en una tarjeta lleva a `/juegos/<id>` con título, descripción larga, 3 estadísticas y 10 filas de leaderboard.
- [ ] `/juegos/no-existe` muestra la página 404.
- [ ] JUGAR AHORA lleva a `/juegos/<id>/jugar`; SALIR en el reproductor vuelve a `/juegos/<id>`.
- [ ] En el reproductor la puntuación aumenta sola; PAUSA la detiene y muestra "EN PAUSA"; REANUDAR la retoma.
- [ ] FIN abre el modal "FIN DEL JUEGO" con la puntuación final formateada en `es-ES`.
- [ ] GUARDAR PUNTUACIÓN añade una entrada `{ game, score, name, at }` a `localStorage["av_scores"]` y muestra "PUNTUACIÓN GUARDADA".
- [ ] JUGAR DE NUEVO reinicia puntuación, vidas y nivel, y cierra el modal.
- [ ] En `/acceso`, enviar el formulario con usuario "px_kai" guarda `{"name":"PX_KAI"}` en `av_user`, redirige a `/` y la Nav muestra `PX_KAI`.
- [ ] Tras recargar la página la sesión se mantiene; "Cerrar sesión" borra `av_user` y la Nav vuelve a mostrar "Iniciar Sesión".
- [ ] La pestaña CREAR CUENTA muestra el campo de correo; INICIAR SESIÓN lo oculta.
- [ ] `/salon` muestra podio, 12 filas y cambia el contenido al seleccionar otro juego.
- [ ] Con sesión iniciada, `/salon` muestra la fila "TU MEJOR MARCA"; sin sesión no aparece.
- [ ] En ancho < 768 px aparece el botón de menú; el panel móvil abre, enlaza a todas las secciones y se cierra al navegar.
- [ ] Las cinco pantallas son visualmente equivalentes a `references/Arcade Vault.html` (comparación lado a lado).

---

## Decisiones tomadas y descartadas

- **Sí:** rutas reales del App Router (`/`, `/juegos/[id]`, `/juegos/[id]/jugar`, `/acceso`, `/salon`). URLs compartibles y es lo idiomático en Next.js.
- **No:** routing por hash con un único estado `route`, como en la referencia. Era una solución de prototipo.
- **Sí:** URLs en español (`/acceso`, `/salon`, `/jugar`), coherentes con la UI.
- **Sí:** sesión simulada en `localStorage` (`av_user`), como en la referencia. Permite ver la Nav y el Salón en sus dos estados sin backend.
- **No:** formulario estático sin sesión. Dejaría sin cubrir el estado "con sesión" de Nav y Salón.
- **Sí:** reproductor como en la referencia, con puntuación simulada y modal de fin. Valida el flujo completo Detalle → Jugar → Guardar.
- **No:** juegos reales en esta spec; cada uno merece su propia spec.
- **Sí:** guardar en `av_scores` pero no mostrar esas puntuaciones en los rankings. Mantiene el MVP visual y evita lógica de merge y ordenación.
- **No:** mezclar puntuaciones guardadas con los rankings mock. Se hará cuando exista backend.
- **Sí:** mock tipado en `lib/` con puntuaciones deterministas por semilla. Los datos son estables entre renders y no provocan desajustes de hidratación.
- **Sí:** `useSyncExternalStore` para leer la sesión de `localStorage`. Evita errores de hidratación, cumple la regla `react-hooks/set-state-in-effect` del lint y sincroniza pestañas. Si `localStorage` está bloqueado, la sesión vive en memoria.
- **No:** `useEffect` + `setState` para leer la sesión. Era la propuesta inicial, pero el lint la rechaza (`react-hooks/set-state-in-effect`).
- **Sí:** ignorar `references/**` en `eslint.config.mjs`. Son prototipos con `React` global y hacían fallar `npm run lint`.
- **Sí:** reutilizar las clases de `app/globals.css` ya portadas en vez de reescribir los estilos en utilidades de Tailwind. Se mantiene fidelidad con el prototipo.
- **Sí:** el filtro de Biblioteca y las pestañas del Salón son estado local de cliente, sin query params. Igual que la referencia.
- **Pendiente de confirmar al revisar:** las URLs exactas y los nombres de archivos de componentes los propuse yo; no se confirmaron con el usuario en la fase de preguntas.

---

## Riesgos identificados

| Riesgo | Mitigación |
| ------ | ---------- |
| Next.js 16.4 / React 19.3 tiene cambios incompatibles con lo habitual (p. ej. `params` asíncrono, `cacheComponents`). | Leer la guía correspondiente en `node_modules/next/dist/docs/` antes de escribir cada página. Prestar atención a `generateStaticParams` y a las páginas con `cacheComponents`. |
| Leer `localStorage` en el render provoca errores de hidratación. | Leerlo con `useSyncExternalStore` en `SessionProvider`; el snapshot de servidor es `null`, así que el primer render asume "sin sesión". |
| Parpadeo de la Nav (muestra "Iniciar Sesión" y luego el nombre). | Aceptado para el MVP; reservar el espacio del botón para evitar saltos de layout. |
| `Math.random` en la puntuación simulada del reproductor. | Se ejecuta solo en un efecto de cliente, nunca durante el render. |
| Las clases CSS de `globals.css` no cubren todo lo que usa la referencia. | Contrastar con `references/styles.css` al implementar cada pantalla y portar solo lo que falte. |
| Las `localStorage` bloqueadas (modo privado) lanzan excepciones. | Envolver lecturas y escrituras en `try/catch`; la app funciona sin persistir. |

---

## Qué **no** está en esta spec

- Ningún juego real ni su input.
- Backend, autenticación real u OAuth.
- Puntuaciones guardadas visibles en los rankings.
- Créditos funcionales.
- Tests automatizados.
- Internacionalización.

Cada uno, si llega, va en su propia spec.
