# SPEC 03 — Página About (`/acerca-de`) con formulario de contacto enviado por Resend

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-10-16
> **Objetivo:** Crear la página `/acerca-de` fiel a `references/home-about/about.jsx` y hacer que su formulario de contacto envíe un correo real al equipo mediante Resend desde una Server Action.

---

## Por qué existe esta spec

La SPEC 02 dejó el enlace "Acerca de" de la Nav apuntando a `/acerca-de`, que da 404. El prototipo de `references/home-about/about.jsx` define esa página: hero con misión, tres destacados, un divisor animado y un formulario de contacto que en la referencia solo simula el envío. Esta spec porta la página y es la primera que añade código de servidor real (Server Action + API externa), así que fija cómo se validan los datos y cómo se gestionan los secretos.

---

## Alcance

**Dentro:**

- Ruta `/acerca-de` fiel a `about.jsx`: hero ("▸ ACERCA DE", título, misión), 3 destacados con iconos pixel (HEART, BROWSER, PLANT), divisor con 24 píxeles animados y sección de contacto (intro + 3 tips + formulario).
- Animación `reveal` en el divisor y la sección de contacto, reutilizando `components/home/reveal.tsx`.
- Portar a `app/globals.css` la sección ABOUT PAGE de `references/home-about/styles.css` (incluye `.contact-form`, `.shake`, `.terminal-success` y sus breakpoints).
- Formulario de contacto (NOMBRE, CORREO ELECTRÓNICO, MENSAJE) como componente de cliente con `useActionState`.
- Server Action que valida los datos y envía **un** correo al equipo con el SDK `resend`.
- Remitente `Arcade Vault <onboarding@resend.dev>`, destinatario en `CONTACT_TO_EMAIL` y `replyTo` con el correo del usuario.
- Cuerpo del correo en HTML mínimo (datos escapados) y versión en texto plano.
- Validación en cliente (campos vacíos → animación `shake`, sin llamar al servidor) y en servidor (obligatorios, formato de email, longitudes máximas).
- Honeypot anti-spam: campo oculto `website`.
- Estados: inicial, enviando (botón deshabilitado con "▶ TRANSMITIENDO…"), error (aviso bajo el botón + errores por campo, conserva lo escrito) y éxito (terminal "VAULT-OS // TERMINAL" con "GRACIAS, {NOMBRE}." y botón "ENVIAR OTRO MENSAJE").
- `metadata` de la página en español.
- Documentar en `CLAUDE.md` la ruta y las variables de entorno.

**Fuera de alcance (para otras specs):**

- Correo de confirmación (acuse) a la persona que escribe.
- Dominio propio verificado en Resend; mientras se use `onboarding@resend.dev` solo se puede enviar al correo dueño de la cuenta Resend.
- Plantillas con React Email u otras librerías de plantillas.
- Rate limiting, CAPTCHA o cualquier anti-spam distinto del honeypot.
- Guardar los mensajes en base de datos o en `localStorage`.
- Prerrellenar el formulario con la sesión simulada (`av_user`).
- Validación con zod u otra librería de esquemas.
- Tests automatizados.

---

## Modelo de datos

Estructuras nuevas en `lib/contact.ts` (sin `"use server"`, importable desde cliente y servidor):

```ts
// lib/contact.ts
export const CONTACT_LIMITS = { name: 60, email: 254, msg: 2000 } as const;

export type ContactField = "name" | "email" | "msg";

export type ContactInput = { name: string; email: string; msg: string };

export type ContactState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Partial<Record<ContactField, string>>; values: ContactInput }
  | { status: "sent"; name: string };

export function validateContact(input: ContactInput): Partial<Record<ContactField, string>>;
export function buildContactEmail(input: ContactInput): { subject: string; html: string; text: string };
```

Server Action en `app/acerca-de/actions.ts`:

```ts
"use server";
export async function sendContact(prev: ContactState, formData: FormData): Promise<ContactState>;
```

Nombres de campos del `FormData`: `name`, `email`, `msg` y `website` (honeypot).

Variables de entorno (en `.env`, ya ignorado por git):

```bash
RESEND_API_KEY=re_...           # ya existe
CONTACT_TO_EMAIL=equipo@...     # nuevo; debe ser el correo dueño de la cuenta Resend
```

Convenciones:

- Los valores se recortan con `trim()` antes de validar y enviar.
- Formato de email: una expresión regular simple (`algo@algo.algo`), sin librería.
- Asunto: `[Arcade Vault] Nuevo mensaje de {name}`.
- El HTML escapa `& < > " '` de los tres campos; los saltos de línea del mensaje se conservan.
- Mensajes de error en español y en MAYÚSCULAS, en el tono de la UI (p. ej. "✖ NO SE PUDO ENVIAR. INTÉNTALO DE NUEVO.").
- `RESEND_API_KEY` y `CONTACT_TO_EMAIL` solo se leen en la Server Action; nunca con prefijo `NEXT_PUBLIC_`.

---

## Plan de implementación

Cada paso deja la app compilando y ejecutable.

1. **Estilos.** Portar a `app/globals.css` la sección `/* ===== ABOUT PAGE ===== */` de `references/home-about/styles.css`. Comprobación: `npm run lint` y `npm run build` pasan y las pantallas existentes no cambian.
2. **Página estática.** Leer antes la guía de Server Actions / formularios en `node_modules/next/dist/docs/01-app/`. Crear `components/about/highlight-icon.tsx` (los 3 SVG de la referencia) y `app/acerca-de/page.tsx` (componente de servidor) con hero, destacados, divisor, intro de contacto y `<Reveal />`. El hueco del formulario lleva de momento un marcador vacío. `metadata.title`: "Acerca de · Arcade Vault". Comprobación: `/acerca-de` ya no da 404, la Nav marca "Acerca de" como activo y `reveal` funciona al hacer scroll.
3. **Lógica de contacto.** Crear `lib/contact.ts` con `CONTACT_LIMITS`, los tipos, `validateContact` y `buildContactEmail`. Comprobación: `npm run lint` y `npm run build` pasan.
4. **Formulario de cliente sin envío real.** Crear `components/about/contact-form.tsx` (`"use client"`) con los 3 campos, el honeypot `website` (oculto visualmente y con `tabIndex={-1}` y `autoComplete="off"`), la validación de vacíos con `shake` y los estados de error y éxito de la referencia. Montarlo en la página. Usar `useActionState` con una acción temporal que devuelve `sent`. Comprobación: campos vacíos → shake; relleno → terminal de éxito; "ENVIAR OTRO MENSAJE" vuelve al formulario vacío.
5. **Server Action con Resend.** Instalar `resend` (`npm install resend`). Crear `app/acerca-de/actions.ts` con `sendContact`:
   - Honeypot relleno → devuelve `sent` sin llamar a Resend.
   - `validateContact` con errores → devuelve `error` con `fieldErrors` y los valores.
   - Falta `RESEND_API_KEY` o `CONTACT_TO_EMAIL` → `console.error` en servidor y devuelve `error` genérico.
   - Llama a `resend.emails.send({ from, to, replyTo, subject, html, text })`; si la respuesta trae `error` o lanza, `console.error` y devuelve `error` genérico.
   - Éxito → `{ status: "sent", name }`.
   Conectar el formulario a `sendContact` y mostrar "▶ TRANSMITIENDO…" con el botón deshabilitado mientras `isPending`. Añadir `CONTACT_TO_EMAIL` a `.env`. Comprobación: envío real recibido en `CONTACT_TO_EMAIL`.
6. **Pulido y documentación.** Revisar responsive (≤ 840 px y breakpoints propios de ABOUT PAGE), hidratación y comparación visual con `references/home-about/arcade-vault-standalone.html`. Actualizar `CLAUDE.md` (ruta `/acerca-de` ya existe, `lib/contact.ts`, la Server Action y las variables `RESEND_API_KEY` / `CONTACT_TO_EMAIL`) y marcar la SPEC 03 como `Implementado`.

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `/acerca-de` responde 200 y la Nav marca "Acerca de" como activo (escritorio y panel móvil).
- [ ] No hay errores ni warnings de hidratación en la consola en `/acerca-de`, con y sin `av_user` en `localStorage`.
- [ ] La página muestra, en este orden: hero con "ACERCA DE ARCADE VAULT" y el texto de misión, 3 destacados (HECHO CON ❤️ PARA JUGADORES, JUEGOS EN HTML — CORREN EN CUALQUIER NAVEGADOR, PROYECTO EN CONSTANTE CRECIMIENTO), divisor con 24 píxeles y la sección "CONTÁCTANOS" con 3 tips y el formulario.
- [ ] El divisor y la sección de contacto empiezan ocultos y reciben la clase `in` al entrar en el viewport.
- [ ] Pulsar "▶ ENVIAR MENSAJE" con algún campo vacío aplica la clase `shake` al formulario y no hace ninguna petición al servidor.
- [ ] Un email con formato inválido (p. ej. `jugador@vault`) devuelve un error del servidor junto al campo y el formulario conserva los tres valores.
- [ ] Un mensaje de más de 2000 caracteres (o nombre de más de 60) devuelve un error del servidor junto al campo.
- [ ] Mientras se envía, el botón muestra "▶ TRANSMITIENDO…" y está deshabilitado.
- [ ] Con datos válidos y `.env` correcto, llega un correo real a `CONTACT_TO_EMAIL` desde `onboarding@resend.dev`, con asunto `[Arcade Vault] Nuevo mensaje de {nombre}`, el nombre, el email y el mensaje en el cuerpo, y "Responder" va al correo del usuario.
- [ ] Tras el envío correcto se ve la terminal con "MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {NOMBRE}." y "ENVIAR OTRO MENSAJE" vuelve al formulario vacío.
- [ ] Un mensaje con `<b>hola</b>` llega en el correo como texto literal, no como negrita.
- [ ] Sin `RESEND_API_KEY` (o sin `CONTACT_TO_EMAIL`), enviar muestra el aviso de error bajo el botón, conserva lo escrito y registra el motivo en la consola del servidor.
- [ ] Con el campo `website` relleno (manipulado desde DevTools) se muestra la terminal de éxito y no se envía ningún correo (no aparece en el panel de Resend).
- [ ] La API key no aparece en el bundle de cliente (`grep -r "re_" .next/static` no encuentra la clave).
- [ ] La página es visualmente equivalente a la About de `references/home-about/arcade-vault-standalone.html` en escritorio y móvil, y a 390 px no hay scroll horizontal.
- [ ] `CLAUDE.md` documenta `/acerca-de`, `lib/contact.ts` y las variables `RESEND_API_KEY` y `CONTACT_TO_EMAIL`.

---

## Decisiones tomadas y descartadas

- **Sí:** Server Action (`app/acerca-de/actions.ts`) con `useActionState`. Es lo nativo de App Router y da el estado pendiente y de error sin endpoint público.
- **No:** Route Handler `POST /api/contacto`. Obliga a gestionar JSON y estados a mano y deja un endpoint expuesto sin necesidad.
- **Sí:** remitente `onboarding@resend.dev` y destinatario en `CONTACT_TO_EMAIL`. No hace falta verificar dominio. Limitación aceptada: solo se puede enviar al correo dueño de la cuenta Resend.
- **No:** dominio propio verificado. Va en otra spec si se quiere enviar a direcciones arbitrarias.
- **Sí:** un único correo al equipo con `replyTo` del usuario. Permite responder directamente.
- **No:** acuse de recibo al usuario. Necesita dominio verificado y una segunda plantilla.
- **Sí:** HTML mínimo escapado + texto plano generado en `buildContactEmail`. Solo añade la dependencia `resend`.
- **No:** React Email. Dependencias extra para un correo interno de tres campos.
- **Sí:** validación en cliente (vacíos → `shake`, como la referencia) y en servidor (obligatorios, formato, longitudes). El servidor nunca confía en el cliente.
- **No:** zod. Tres campos no justifican una dependencia.
- **Sí:** errores mostrados bajo el botón, conservando lo escrito, más errores por campo.
- **No:** terminal en modo error con REINTENTAR. Más estados y peor para corregir un campo concreto.
- **Sí:** honeypot `website`; si llega relleno se responde éxito sin enviar, para no dar pistas al bot.
- **No:** rate limit en memoria. No funciona bien en serverless (cada instancia tiene su propio estado).
- **Sí:** estado pendiente con botón deshabilitado y "▶ TRANSMITIENDO…".
- **No:** terminal con líneas en progreso durante el envío. Más fiel al tono, pero más estados que gestionar.
- **Sí:** página de servidor + un único componente de cliente (`contact-form.tsx`); reutiliza `Reveal` de la home. Menos JS enviado, igual criterio que la SPEC 02.
- **No:** prerrellenar el nombre con `av_user`. La sesión es simulada y no tiene email; el formulario queda igual que la referencia.
- **Sí:** verificación con un envío real como criterio de aceptación, más el caso sin API key.
- **Pendiente de confirmar al revisar:** nombres de archivos (`components/about/*`, `lib/contact.ts`, `app/acerca-de/actions.ts`), los límites de longitud (60 / 254 / 2000), el texto del asunto y el `metadata.title`; los propuse yo.
- **Pendiente de confirmar al revisar:** no se crea `.env.example` porque `.gitignore` ignora `.env*`; las variables se documentan en `CLAUDE.md`. Alternativa: añadir `!.env.example` al `.gitignore`.

---

## Riesgos identificados

| Riesgo | Mitigación |
| ------ | ---------- |
| Con `onboarding@resend.dev`, Resend rechaza destinatarios que no sean el dueño de la cuenta. | `CONTACT_TO_EMAIL` debe ser ese correo; documentado en `CLAUDE.md`. El error de Resend se registra en servidor y el usuario ve el aviso genérico. |
| Filtrar la API key al cliente. | Solo se lee en `actions.ts` (`"use server"`), sin `NEXT_PUBLIC_`; criterio de aceptación con `grep` sobre `.next/static`. |
| Inyección de HTML en el correo a partir del mensaje del usuario. | `buildContactEmail` escapa los tres campos; criterio de aceptación con `<b>hola</b>`. |
| Next.js 16.4 / React 19.3 y `cacheComponents` cambian el comportamiento de formularios y Server Actions respecto a lo habitual. | Leer la guía en `node_modules/next/dist/docs/01-app/` antes del paso 2. |
| Spam o abuso del formulario (coste de la cuota de Resend). | Honeypot en esta spec; rate limit o CAPTCHA en otra si hace falta. |
| `next dev` sirve CSS antiguo tras editar `app/globals.css`. | Verificar con `npm run build` + `npm run start` o reiniciar `next dev`; no lanzar `build` con `dev` corriendo (si pasa, `rm -rf .next`). |

---

## Qué **no** está en esta spec

- Acuse de recibo al usuario.
- Dominio propio verificado en Resend.
- React Email u otras plantillas.
- Rate limiting o CAPTCHA.
- Persistencia de los mensajes.
- Prerrelleno con la sesión simulada.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
