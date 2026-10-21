# SPEC 05 — Asteroides jugable en `/juegos/rocas/jugar`

> **Estado:** Aprobado
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-21
> **Objetivo:** Migrar a Next.js el Asteroids de `references/started-games/02-asteroids` como un motor TypeScript en canvas montado en el reproductor de `rocas`, sustituyendo la partida simulada por una jugable con teclado.

---

## Por qué existe esta spec

Hasta ahora `/juegos/[id]/jugar` muestra `GamePlayer`, que sube la puntuación sola sobre una arena decorativa (SPEC 01). Esta es la primera spec con un juego real. `references/started-games/02-asteroids/game.js` es un Asteroids completo en canvas (510 líneas, sin dependencias): nave con inercia, rocas que se dividen, 3 vidas, niveles, partículas y un power-up de triple disparo. Se porta a TypeScript sin cambiar sus mecánicas ni su aspecto. Se conecta a la entrada `rocas` del catálogo y se integra con el reproductor y el guardado simulado de puntuaciones. El patrón (motor sin React + componente que lo monta + registro por id) servirá para Tetris y Arkanoid en specs posteriores.

---

## Alcance

**Dentro:**

- Portar `game.js` a TypeScript en `lib/asteroids/` como módulo sin React: utilidades, constantes, clases `Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`, estado, input, `update`, `draw` y bucle con `requestAnimationFrame` (`dt` limitado a 50 ms).
- Mecánicas y valores idénticos al original: mundo toroidal de 800×600, tamaños, velocidades, puntos (20/50/100), 3 vidas, invencibilidad de 3 s con parpadeo, rocas iniciales `4` y `3 + nivel` al subir, power-up `3x` (15 % de probabilidad, garantizado a la 5ª destrucción, uno por nivel, dura 5 s y caduca a los 12 s).
- Aspecto idéntico al original: vector blanco, power-up cian, llama naranja, HUD del canvas (SCORE, NIVEL, iconos de vidas, contador `3x`) en `monospace`.
- Estados nuevos del motor sobre los del original:
  - `ready`: pantalla "ROCAS" / "PULSA ESPACIO PARA EMPEZAR". Las rocas no se mueven ni hay nave hasta pulsar ESPACIO.
  - Pausa (con `P`, `Escape` o el botón de React): el canvas congela la partida y pinta "EN PAUSA" / "P O ESC PARA CONTINUAR".
  - `gameover`: el canvas pinta "GAME OVER" / "PUNTAJE: {score}". ESPACIO **no** reinicia. A los 1,5 s el motor llama a `onGameOver(score)` una sola vez.
- La partida se pausa sola con `blur` de la ventana o `visibilitychange` a oculto, y las teclas pulsadas se limpian.
- Canvas escalado al `.crt-screen` existente (4:3): resolución interna `800·dpr × 600·dpr`, `ctx.setTransform(dpr, …)` y CSS al 100 %.
- Componente de cliente `components/games/asteroids-player.tsx`:
  - Barra superior: solo el nombre del jugador (sesión o `INVITADO`) y los botones PAUSA/REANUDAR y SALIR. No muestra stats de puntuación, vidas ni nivel (las pinta el canvas) ni el botón FIN.
  - CRT con el canvas dentro de `.crt-screen` y la `.crt-bottom` existente.
  - Línea de ayuda bajo el CRT: `← → ROTAR · ↑ PROPULSAR · ESPACIO DISPARAR · P PAUSA`.
  - Aviso "REQUIERE TECLADO" visible solo con `@media (pointer: coarse)`. No bloquea el canvas.
  - Al recibir `onGameOver`, abre el modal FIN DEL JUEGO (iniciales, GUARDAR PUNTUACIÓN, JUGAR DE NUEVO, VOLVER AL VAULT). Guarda con `saveScore({ game: "rocas", score, name })` en `localStorage` (`av_scores`). JUGAR DE NUEVO cierra el modal y llama a `restart()` (vuelve a `ready`).
- Extraer el modal de `GamePlayer` a `components/game-over-modal.tsx`, compartido por el reproductor simulado y el de Asteroides, sin cambios visuales ni de comportamiento.
- Registro `components/games/registry.ts` (`id → componente`). `/juegos/[id]/jugar` monta el componente registrado y, si no hay ninguno, el `GamePlayer` simulado actual. Solo se registra `rocas`.
- El input ignora las teclas cuando el foco está en un `input`, `textarea` o `contenteditable` (para poder escribir las iniciales en el modal). Con el juego montado, `preventDefault` en flechas y ESPACIO evita el scroll de la página.
- Actualizar el texto `long` de `rocas` en `lib/games.ts` a las mecánicas reales (sin OVNIs). `short`, portada, color, `best` y `plays` no cambian.
- Estilos nuevos en `app/globals.css` reutilizando tokens y clases existentes: `.game-canvas`, `.controls-hint`, `.touch-warning`.
- Documentar en `CLAUDE.md` el motor, el registro y el reproductor de Asteroides.

**Fuera de alcance (para otras specs):**

- Controles táctiles o compatibilidad real con móvil.
- Guardar puntuaciones en Supabase, auth real o ranking global.
- Que `/salon` o el detalle del juego muestren las puntuaciones reales de `av_scores` (siguen con los datos mock).
- Sonido y música.
- OVNIs, hiperespacio o cualquier mecánica que no esté en `game.js`.
- Recolorear el juego con la paleta neón o añadir glow.
- Migrar Tetris (`03-tetris`) y Arkanoid (`04-arkanoid`).
- Renombrar `rocas` o cambiar su URL.
- Cambios en los otros 7 juegos, que siguen simulados.
- Tests automatizados.

---

## Modelo de datos

No se añaden datos persistentes nuevos: se reutiliza `SavedScore` de `lib/session.ts` con `game: "rocas"`.

API pública del motor (`lib/asteroids/engine.ts`, sin `"use client"` y sin importar React):

```ts
export type AsteroidsCallbacks = {
	onPauseChange: (paused: boolean) => void; // también cuando la pausa viene de P/Esc o de blur
	onGameOver: (score: number) => void; // una vez por partida, 1,5 s después del GAME OVER
};

export type AsteroidsHandle = {
	togglePause: () => void; // sin efecto en "ready" y "gameover"
	restart: () => void; // reinicia la partida y vuelve a "ready"
	destroy: () => void; // cancela el rAF y quita todos los listeners
};

export function createAsteroids(
	canvas: HTMLCanvasElement,
	callbacks: AsteroidsCallbacks,
): AsteroidsHandle;
```

Estado interno del motor (no exportado):

```ts
type Phase = "ready" | "playing" | "dead" | "gameover";
// + paused: boolean, que solo puede ser true en "playing" o "dead".
```

Entidades en `lib/asteroids/entities.ts`: las clases del original con tipos, y `draw(ctx: CanvasRenderingContext2D)` recibe el contexto en vez de usar un global. Constantes con los mismos nombres y valores (`W = 800`, `H = 600`, `RADII`, `SPEEDS`, `POINTS`, `POWERUP_DROP_CHANCE`, `POWERUP_DURATION`, `POWERUP_TTL`, `TRIPLE_SPREAD`).

Registro (`components/games/registry.ts`):

```ts
import type { ComponentType } from "react";
import type { Game } from "@/lib/games";

export const PLAYABLE: Partial<Record<string, ComponentType<{ game: Game }>>> = {
	rocas: AsteroidsPlayer,
};
```

Modal compartido (`components/game-over-modal.tsx`, `"use client"`):

```ts
type GameOverModalProps = {
	gameId: string;
	score: number;
	defaultName: string; // nombre de la sesión o "INVITADO"
	onRestart: () => void;
};
```

El modal mantiene dentro el nombre editado (mayúsculas, máx. 10), el estado `saved` y la llamada a `saveScore`, como hoy `GamePlayer`.

Texto `long` propuesto para `rocas`:

> "Tu nave triangular flota en vacío absoluto. Rota, acelera y dispara para partir las rocas en fragmentos cada vez más pequeños. Tienes 3 vidas, y si recoges el power-up 3x tendrás triple disparo durante unos segundos."

---

## Plan de implementación

Cada paso deja la app compilando y ejecutable.

1. **Modal compartido.** Extraer el modal FIN DEL JUEGO de `components/game-player.tsx` a `components/game-over-modal.tsx` y usarlo desde `GamePlayer`. Comprobación: `npm run lint` y `npm run build` pasan, y en `/juegos/caida/jugar` FIN → guardar → JUGAR DE NUEVO funciona igual que antes.
2. **Entidades.** Portar a `lib/asteroids/entities.ts` las utilidades, las constantes y las 5 clases con tipos, con `draw(ctx)`. Comprobación: `npm run lint` y `npm run build` pasan. Nadie importa todavía el módulo.
3. **Motor.** Crear `lib/asteroids/engine.ts` con `createAsteroids`: input en `window` (`keydown`/`keyup` con `justPressed`, filtro de foco editable, `preventDefault` en flechas y ESPACIO), fases `ready`/`playing`/`dead`/`gameover`, pausa, auto-pausa con `blur`/`visibilitychange`, temporizador de 1,5 s para `onGameOver`, HUD y overlays del canvas, escalado con `devicePixelRatio`, y `destroy`. Comprobación: `npm run lint` y `npm run build` pasan.
4. **Reproductor de Asteroides.** Leer antes en `node_modules/next/dist/docs/01-app/` lo relativo a componentes de cliente con `cacheComponents`. Crear `components/games/asteroids-player.tsx`: crea el motor en `useEffect` y lo destruye en el cleanup (seguro con el doble montaje de Strict Mode), con los callbacks en un `ref` para no recrear el motor. Añadir la barra (nombre + PAUSA/REANUDAR sincronizado con `onPauseChange` + SALIR), el CRT con el canvas, la línea de ayuda, el aviso táctil y el `GameOverModal`. Crear `components/games/registry.ts` y hacer que `app/juegos/[id]/jugar/page.tsx` monte `PLAYABLE[id] ?? GamePlayer`. Añadir `.game-canvas`, `.controls-hint` y `.touch-warning` a `app/globals.css`. Comprobación: en `/juegos/rocas/jugar` se juega una partida completa hasta el modal y se guarda la puntuación. `/juegos/caida/jugar` sigue simulado.
5. **Catálogo, pulido y documentación.** Actualizar `long` de `rocas` en `lib/games.ts`. Revisar el responsive (≤ 840 px y el ancho mínimo sin scroll horizontal), la hidratación y la consola. Actualizar `CLAUDE.md` (motor en `lib/asteroids/`, registro `components/games/registry.ts`, modal compartido). Marcar la SPEC 05 como `Implementado`.

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `lib/asteroids/entities.ts` y `lib/asteroids/engine.ts` no importan React ni tienen `"use client"`.
- [ ] `/juegos/rocas/jugar` muestra el canvas dentro del CRT con "PULSA ESPACIO PARA EMPEZAR". Las rocas no se mueven hasta pulsar ESPACIO.
- [ ] Con ESPACIO empieza la partida: ← → rotan, ↑ propulsa (con llama), ESPACIO dispara y los bordes envuelven.
- [ ] Las rocas grandes se parten en 2 medianas, las medianas en 2 pequeñas y las pequeñas desaparecen, con 20/50/100 puntos en el SCORE del canvas.
- [ ] Al chocar se pierde una vida y la nave reaparece a los 2 s parpadeando e invencible 3 s. Al vaciar las rocas sube el NIVEL.
- [ ] El power-up `3x` aparece como mucho una vez por nivel, da triple disparo durante 5 s y el contador se ve en el HUD del canvas.
- [ ] `P`, `Escape` y el botón PAUSA pausan y reanudan. El texto del botón (PAUSA/REANUDAR) coincide siempre con el estado, venga la pausa de donde venga.
- [ ] Cambiar de pestaña o sacar el foco de la ventana pausa la partida y no deja teclas "pegadas" al volver.
- [ ] Las flechas y ESPACIO no hacen scroll de la página mientras el juego está montado.
- [ ] Al perder la 3ª vida el canvas muestra "GAME OVER" con el puntaje y a ~1,5 s se abre el modal FIN DEL JUEGO con esa puntuación. ESPACIO no reinicia la partida.
- [ ] En el modal se pueden escribir las iniciales (incluido el espacio) sin que el juego reaccione. GUARDAR PUNTUACIÓN añade a `av_scores` una entrada `{ game: "rocas", score, name, at }`.
- [ ] JUGAR DE NUEVO cierra el modal y deja el juego en "PULSA ESPACIO PARA EMPEZAR" con SCORE 0, NIVEL 1 y 3 vidas.
- [ ] SALIR lleva a `/juegos/rocas`. Al salir y volver no hay dos bucles en marcha (la velocidad es la normal) ni listeners duplicados.
- [ ] La barra superior muestra el nombre de la sesión, o `INVITADO` sin sesión, y no muestra Puntuación, Vidas, Nivel ni FIN.
- [ ] La línea de ayuda de controles se ve bajo el CRT. El aviso "REQUIERE TECLADO" solo aparece con `pointer: coarse`.
- [ ] El canvas se ve nítido en pantallas con `devicePixelRatio` 2 y se escala sin deformarse (4:3) desde escritorio hasta 360 px de ancho, sin scroll horizontal.
- [ ] `/juegos/caida/jugar` y los demás juegos siguen con el reproductor simulado, con el modal compartido sin cambios visibles.
- [ ] `/juegos/rocas` muestra el nuevo texto `long`, sin OVNIs.
- [ ] No hay errores ni warnings de hidratación en la consola en `/juegos/rocas/jugar`, con y sin `av_user` en `localStorage`.
- [ ] `CLAUDE.md` documenta el motor, el registro y el reproductor de Asteroides.

---

## Decisiones tomadas y descartadas

- **Sí:** conectar el juego a la entrada `rocas` existente. Decisión del usuario: se mantienen el id, la URL, la portada y los mocks.
- **No:** renombrar a `asteroides` ni añadir un 9º juego. Rompería URLs y referencias en `lib/scores.ts` y `lib/home.ts`, o duplicaría el juego.
- **Sí:** canvas autónomo con su propio HUD y sus overlays, como el original. Decisión del usuario.
- **No:** llevar puntuación, vidas y nivel al HUD de React. Se descartó en favor del canvas autónomo, así que la barra de React se reduce a nombre + PAUSA + SALIR para no duplicar datos.
- **No:** botón FIN. Con un juego real, la partida termina al perder las 3 vidas.
- **Sí:** motor TypeScript puro + componente de cliente que lo monta y lo destruye. Tiene tipado, se puede reutilizar para Tetris y Arkanoid y queda claro el ciclo de vida.
- **No:** copiar `game.js` a `public/` y cargarlo en un iframe con `postMessage`. Es más frágil, no tiene tipos y es difícil sincronizar pausa y game over.
- **Sí:** vector blanco idéntico al original. Es una migración fiel y el CRT ya aporta el toque neón.
- **No:** recolorear con la paleta de Arcade Vault. Queda para otra spec si se quiere.
- **Sí:** GAME OVER en el canvas y, a los 1,5 s, el modal existente para guardar. Reutiliza el flujo de iniciales de SPEC 01.
- **No:** guardado automático y reinicio con ESPACIO. Sin modal no se pueden editar las iniciales.
- **Sí:** persistir en `localStorage` (`av_scores`) con el `saveScore` existente. Supabase (tablas, RLS, auth) va en su propia spec.
- **Sí:** pantalla "PULSA ESPACIO PARA EMPEZAR", pausa con P/Esc y auto-pausa al perder el foco. Así nadie pierde una vida mientras carga la página o cambia de pestaña.
- **Sí:** mundo lógico de 800×600 escalado al `.crt-screen` (que ya es 4:3) con `devicePixelRatio`. Las mecánicas no dependen del tamaño de pantalla.
- **No:** controles táctiles. En móvil solo se avisa con "REQUIERE TECLADO"; los táctiles van en otra spec.
- **Sí:** registro `id → componente` y `GamePlayer` simulado como fallback. Los otros 7 juegos no cambian y cada juego futuro solo añade una entrada.
- **No:** mostrar "PRÓXIMAMENTE" en los juegos no migrados. Rompería la demo de SPEC 01.
- **Sí:** corregir el `long` de `rocas` para describir el juego real.
- **Sí:** línea de ayuda de controles bajo el CRT, con las clases existentes.
- **Sí:** extraer el modal a `components/game-over-modal.tsx`. Evita duplicarlo entre los dos reproductores.
- **Pendiente de confirmar al revisar (los propuse yo):**
  - La carpeta `lib/asteroids/` en vez de `lib/games/asteroids/`. Una carpeta `lib/games/` junto a `lib/games.ts` haría ambiguo el import `@/lib/games`.
  - La división en `entities.ts` + `engine.ts`.
  - Los nombres `components/games/asteroids-player.tsx`, `components/games/registry.ts`, `components/game-over-modal.tsx` y las clases `.game-canvas`, `.controls-hint`, `.touch-warning`.
  - Que JUGAR DE NUEVO vuelva a `ready` y no directamente a `playing`.
  - Los textos de los overlays ("ROCAS", "EN PAUSA", "P O ESC PARA CONTINUAR").
  - El texto `long` propuesto.

---

## Riesgos identificados

| Riesgo                                                                                                 | Mitigación                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Strict Mode monta el efecto dos veces y deja dos bucles o listeners duplicados.                        | `destroy()` cancela el rAF y quita todos los listeners. Criterio de aceptación sobre salir y volver.                                        |
| Los listeners de teclado en `window` interfieren con el input de iniciales del modal.                  | Se ignoran las teclas con el foco en un elemento editable. Criterio de aceptación explícito.                                                |
| Flechas y ESPACIO hacen scroll o activan el botón enfocado (p. ej. PAUSA).                             | `preventDefault` en esas teclas mientras el juego está montado, excepto con el foco en un elemento editable.                                |
| Teclas "pegadas" al volver de otra pestaña (no llega el `keyup`).                                      | Limpiar `keys` y `justPressed` en `blur` y `visibilitychange`, y pausar.                                                                    |
| Un salto de `dt` grande al reanudar provoca un salto en la simulación.                                 | Se mantiene el límite de 50 ms del original y se resetea `lastTime` al reanudar.                                                            |
| Next.js 16.4 con `cacheComponents` cambia el renderizado del reproductor.                              | El canvas solo se crea en el cliente dentro de `useEffect`, y la página ya lee `params` dentro de `Suspense`.                               |
| `onGameOver` llama a `setState` desde el motor y choca con la regla `react-hooks/set-state-in-effect`. | El `setState` ocurre en un callback asíncrono del motor, no en el cuerpo del efecto. Si el lint protesta, usar un `ref` para los callbacks. |
| Las scanlines del `.crt-screen` (`::after`) tapan el canvas o capturan eventos.                        | Ya tienen `pointer-events: none`. El canvas no necesita eventos de ratón.                                                                   |
| El servidor de desarrollo (`next dev`) se queda con CSS antiguo al tocar `globals.css`.                | No lanzar `build` con `dev` corriendo; si pasa, `rm -rf .next`.                                                                             |

---

## Qué **no** está en esta spec

- Controles táctiles y soporte real de móvil.
- Puntuaciones en Supabase, auth real o ranking global.
- `/salon` y el detalle del juego con puntuaciones reales.
- Sonido.
- OVNIs, hiperespacio u otras mecánicas nuevas.
- Recolorear el juego o añadir glow.
- Tetris y Arkanoid.
- Renombrar `rocas`.
- Tests automatizados.
