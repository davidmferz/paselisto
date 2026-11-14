# PaseListo: paquete de entrega

Verificado el 2026-11-14 contra el código (`rg`), `curl` y las reglas en https://hackatonmexico.com/reglas.

- Entrega local (Cursor Hackatón México · CDMX): domingo 2026-11-15 13:00 CDMX, formulario https://forms.gle/dfXTnL8ethxoGNk49
- Hackatón nacional: postulación cierra 2026-12-10 23:59; entrega final 2026-12-12 23:59 (hora CDMX); resultados 2026-12-14. Se recomienda mantener demos en línea hasta 2027-01-31.

## 1. Checklist

### A) Formulario local (Cursor Hackatón México · CDMX)

| Requisito | Estado | Evidencia | Qué debe hacer el humano |
| --- | --- | --- | --- |
| Nombre del equipo | ⚠️ falta | README "Equipo y licencia" dice `[Completar]` | Definir el nombre del equipo |
| Descripción del proyecto | ✅ listo | Sección 2.3 de este archivo (78 palabras) | Pegar en el formulario |
| Repositorio público (obligatorio) | ✅ listo | https://github.com/davidmferz/paselisto responde 200 | Confirmar que el último commit esté subido (ver riesgo R1) |
| Link de la app en vivo (preferido) | ✅ listo | https://paselisto.vercel.app: `/` redirige (307) a `/e/taller-demo` y responde 200; `/e/taller-demo` 200; `/admin/login` 200 | Reprobar 10 min antes de enviar |
| Video demo (opcional) | ⚠️ falta | Guion en `docs/DEMO.md`; no hay video grabado ni URL | Grabar (≤3 min), subir como "no listado" y pegar el link |
| Correos de los integrantes | ⚠️ falta | No existe lista en el repo | Reunir los correos |

### B) Hackatón nacional (pey / CoDi)

| Requisito | Estado | Evidencia | Qué debe hacer el humano |
| --- | --- | --- | --- |
| Integra pey: al menos una solicitud CoDi y reacciona al resultado | ✅ listo | `POST /codi/qr` en `src/shared/adapters/pey-client.ts:63`; webhook en `src/features/webhook/handle-payment.ts`; respaldo `GET /transaction/codi/qr/{id}` en `pey-client.ts:76` | Nada |
| Funciona en producción | ✅ listo | Vercel producción; README documenta pago real de $0.01 MXN con webhook y polling a 0.6 s | Hacer un pago de prueba final antes de enviar. Memoria de deploy decía que la cuenta "Prueba hackaton" estaba en Pendiente (verificar que el cobro siga funcionando) |
| Integración nueva durante el periodo | ✅ listo | README: historial de git inicia 2026-11-14 | Nada |
| Nombre y descripción ≤500 palabras con uso de pey | ✅ listo | Sección 2.2 (conteo al final) | Pegar en el portal |
| Nombre no sugiere producto oficial de pey/Banxico | ✅ listo | "PaseListo"; README aclara que es independiente | Nada |
| Demo público sin invitación | ✅ listo | `/e/taller-demo` 200 sin login | Mantener en línea hasta 2027-01-31 (R4) |
| Credenciales de prueba si hay login | ⚠️ falta | `/admin` exige contraseña; README la remite al formulario | Definir cómo se entregan al jurado (R3) |
| Video demo ≤3 min con cobro CoDi completo | ⚠️ falta | Guion en `docs/DEMO.md` (3:00 exactos, sin margen) | Grabar con margen (apuntar a 2:45) |
| Declaración de componentes previos/terceros | ✅ listo | README "Componentes de terceros"; sección 2.5 | Pegar en el portal |
| Instrucciones de prueba ≤1000 palabras | ✅ listo | Sección 2.4 (conteo al final) | Pegar; completar credenciales |
| Lista final de integrantes (igual al Portal) | ⚠️ falta | README "[Completar]" | Registrar y vincular a todos en el Portal antes del 2026-12-10 |
| Postulación (nombre, descripción, categoría, miembros, actividad sensible) | ⚠️ falta | Sin evidencia de postulación | Postular antes del 2026-12-10 23:59 |
| Declarar actividad de negocio sensible / consultar zona gris | ⚠️ falta | Ver R5 (agregación de pagos) | Escribir a legal@pey.mx antes de postular |
| Credenciales no expuestas en repo/cliente | ✅ listo | `.env*` en `.gitignore`; `PEY_API_KEY` solo en servidor (`src/shared/config.ts`) | Revisar historial por si hubo un secreto commiteado |
| Datos ficticios o propios en demo y repo | ✅ listo | Taller seed `taller-demo`; sin CLABEs en README | No mostrar CLABE/teléfonos ajenos en el video |
| Materiales en español o inglés | ✅ listo | Todo en español | Nada |
| Repositorio (opcional en B) | ✅ listo | Público | Nada |

Criterios de evaluación (para orientar el texto y el video): uso de CoDi/pey 30%, impacto 25%, ejecución técnica 15%, experiencia y diseño 15%, originalidad 15%. Por eso la descripción y el video dedican más espacio a webhook firmado, idempotencia y respaldo.

## 2. Campos listos para copiar y pegar

### 2.1 Nombre del proyecto

PaseListo

Línea corta: "Dejamos de aceptar capturas como prueba de pago."

### 2.2 Descripción (nacional, ≤500 palabras)

PaseListo cobra talleres y eventos pequeños con CoDi y confirma el pago automáticamente, sin capturas de pantalla.

El problema: los organizadores independientes cobran por transferencia y validan con una captura que cualquiera puede falsificar. Conciliar contra el estado de cuenta es manual, y en la puerta no hay forma rápida de saber si un boleto es válido o ya se usó.

Qué hace: cada taller tiene una página pública con precio, fecha y lugar. La persona compradora escribe su correo y recibe un QR de CoDi con cuenta regresiva. Paga desde su app bancaria. En segundos la pantalla confirma el pago y entrega un pase QR único, descargable, con archivo de calendario y correo de confirmación. El organizador entra a un panel protegido con contraseña, ve pagados, pendientes, en revisión y cupo, y escanea los pases con la cámara en la puerta. Cada pase se canjea una sola vez con una actualización atómica en la base de datos; un pase de otro taller se rechaza sin consumirse.

Cómo usamos la API de pey (en producción):

1. POST /codi/qr crea el cobro. Enviamos el monto en pesos (convertido desde centavos enteros), una expiración de al menos 360 segundos, el identificador de la orden en metadata.orderId y generateImage en falso. Con el qrString devuelto, dibujamos el QR nosotros.
2. Webhook codi.qr.payment_received en /api/webhooks/pey. Verificamos la firma con el estándar Standard Webhooks (webhook-id, webhook-timestamp y webhook-signature) sobre el cuerpo crudo, antes de interpretarlo. Una firma inválida responde 401. Con un evento válido, correlacionamos por metadata.orderId, comprobamos el monto y marcamos la orden como pagada.
3. Idempotencia: el webhook-id se registra dentro de la misma transacción que marca el pago. Si pey reintenta, la respuesta es duplicado y no se emite un segundo pase. Los pagos con monto distinto, tardíos o sin cupo pasan a revisión en lugar de emitir pase.
4. Respaldo con GET /transaction/codi/qr/{id}: si pasan 45 segundos sin webhook, la pantalla de la orden consulta el estado a pey. El webhook y el respaldo llaman a la misma función idempotente, así que no importa cuál llegue primero.
5. Tenemos listo un adaptador para POST /codi/pn (cobro por notificación push) pensado para venta en puerta; todavía no está expuesto en la interfaz.

Probamos el flujo en producción con un pago real de 0.01 MXN: el polling y el webhook llegaron con 0.6 segundos de diferencia y el resultado fue un solo pase.

Tecnología: Next.js 16 en Vercel, Neon Postgres con SQL directo, arquitectura hexagonal ligera, desarrollo con TDD estricto (unas 285 pruebas). El dinero se maneja en centavos enteros y la conversión a pesos ocurre solo en el cliente de pey. Las credenciales viven únicamente en variables de entorno del servidor.

Modelo de negocio previsto: SaaS por capacidad para organizadores (plan gratuito de prueba y planes de pago por evento o mensuales). PaseListo es un proyecto independiente; no es un producto oficial de pey, de Banxico ni de ningún banco.

### 2.3 Descripción corta (formulario local, ≤80 palabras)

PaseListo deja de aceptar capturas como prueba de pago. El organizador comparte el link de su taller; la persona compradora recibe un QR de CoDi generado con la API de pey (POST /codi/qr) y, al pagar, un webhook firmado confirma el cobro y emite un pase QR único. Si el webhook tarda, consultamos el estado a pey. En la puerta, el organizador escanea el pase desde el celular y se canjea una sola vez. En producción en https://paselisto.vercel.app.

### 2.4 Instrucciones de prueba (≤1000 palabras)

Todo se prueba en producción. No existe sandbox de pey, así que el pago es real y mínimo: 0.01 MXN. Se necesita un celular con una app bancaria que soporte CoDi.

Parte 1: flujo del comprador (sin credenciales)

1. Abre https://paselisto.vercel.app. Redirige al taller de demostración (https://paselisto.vercel.app/e/taller-demo). No requiere cuenta ni invitación.
2. Revisa los datos del taller: precio de 0.01 MXN, fecha, lugar, organizador y cupo (20 lugares).
3. Escribe tu correo real y pulsa comprar. La pantalla de la orden muestra un QR de CoDi y una cuenta regresiva (la orden expira a los 15 minutos).
4. Paga con CoDi. Desde el celular, abre tu app bancaria y escanea el QR; si usas el mismo celular, la pantalla incluye una guía para pegar o abrir el cobro en la app bancaria.
5. En unos segundos la pantalla confirma el pago sola, sin recargar, y muestra tu pase QR. Aquí se ejercita el webhook firmado codi.qr.payment_received. Si el webhook no llegara en 45 segundos, la pantalla consulta GET /transaction/codi/qr/{id} y llega al mismo resultado.
6. Descarga el pase y prueba "Agregar al calendario" (archivo .ics o enlace de Google Calendar).
7. Recibirás un correo con el pase, con una limitación: el correo se envía con Resend en su plan gratuito, que solo entrega a direcciones permitidas en su sandbox. Si no te llega, no es un fallo del pago: el pase siempre está en pantalla.

Parte 2: flujo del organizador (con credenciales)

Usuario/contraseña de organizador: [se comparten en el formulario]

1. Entra a https://paselisto.vercel.app/admin/login e ingresa la contraseña de organizador.
2. En "Mis talleres" abre el taller de demostración. El panel muestra pagados, pendientes, en revisión y cupo. Tu orden aparece como pagada y los contadores se actualizan solos (el panel consulta cada 3 segundos).
3. Abre /admin/scan y permite el acceso a la cámara. Escanea tu pase (o pega el código a mano en el campo de ingreso manual). La primera vez el resultado es "válido". Escanéalo otra vez: dice "ya usado". El canje es una actualización atómica en Postgres, así que no hay forma de usar un pase dos veces.
4. Opcional: un pase de otro taller muestra "Otro taller" y no se consume.
5. La creación de talleres nuevos está detrás de un flag de servidor (FEATURE_CREATE_EVENTS) y puede estar desactivada en producción.

Qué observar sobre el uso de pey

- Cobro: se crea con POST /codi/qr, con metadata.orderId para correlacionar.
- Resultado: llega por webhook firmado (Standard Webhooks, verificación sobre el cuerpo crudo; una petición sin firma responde 401).
- Idempotencia: el webhook-id se deduplica en la misma transacción que marca el pago; un reintento no genera un segundo pase.
- Respaldo: GET /transaction/codi/qr/{id} tras 45 segundos sin webhook, con la misma función idempotente.
- Casos a revisión: monto distinto, pago tardío o sin cupo no emiten pase y quedan "en revisión".

Pruebas automatizadas y ejecución local (opcional)

El repositorio (https://github.com/davidmferz/paselisto) incluye unas 285 pruebas con Vitest. Para correrlas: `pnpm install` y `pnpm vitest run`. Las pruebas de integración contra Postgres solo corren si existe DATABASE_URL. Para ejecutar la app local se requieren las variables listadas en el README (PEY_API_KEY, PEY_WEBHOOK_SECRET, DATABASE_URL, ORGANIZER_PASSWORD, SESSION_SECRET, APP_URL y las de evento), `pnpm db:migrate` y `pnpm dev`. Cada API key de pey admite un solo webhook, por lo que un entorno local necesita una URL pública y su propia key; para el jurado recomendamos probar directamente en producción.

Notas

- Es un solo taller de demostración con 20 lugares; si se agotan, la compra queda en revisión o se rechaza por cupo. Pedimos al jurado no agotar el cupo innecesariamente; el equipo puede reiniciarlo si es necesario.
- Los datos son de demostración. No se muestran CLABEs ni teléfonos de terceros.

### 2.5 Declaración de componentes previos y de terceros

No usamos código previo al hackatón: el historial de git comienza el 2026-11-14 y toda la integración con pey se construyó durante el periodo del hackatón. Se usaron herramientas de IA para asistir el desarrollo; el equipo es responsable del resultado.

Componentes de terceros (todos con licencia permisiva):

- Next.js 16 y React 19 (framework): MIT
- Tailwind CSS 4, shadcn/ui, @base-ui/react (estilos y UI): MIT
- @neondatabase/serverless y ws (cliente Postgres): MIT
- qrcode y @zxing/browser (generar y leer QR): MIT
- standardwebhooks (verificación de firmas): MIT
- resend (correo transaccional): MIT
- vitest y tsx (pruebas y scripts): MIT

Servicios de terceros: API de pey y CoDi de Banxico (cobros CoDi), Vercel (hosting), Neon (base de datos), Resend (correo). Tipografías: Bricolage Grotesque, DM Sans y JetBrains Mono (SIL Open Font License). PaseListo es un proyecto independiente y no es un producto oficial de pey, Banxico ni ningún banco.

### 2.6 Enlaces

- App en vivo: https://paselisto.vercel.app (demo: https://paselisto.vercel.app/e/taller-demo; organizador: https://paselisto.vercel.app/admin/login)
- Repositorio público: https://github.com/davidmferz/paselisto
- Video demo: [pegar URL del video, ≤3 min]
- Guion del video: `docs/DEMO.md`

### 2.7 Integrantes

- Nombre del equipo: [Completar]
- Representante: [Completar nombre y correo]
- Integrantes (1 a 5): [Completar: nombre, correo, usuario del Portal]

La lista debe coincidir exactamente con el Portal en la entrega nacional.

## 3. Riesgos antes de la entrega

| # | Riesgo | Gravedad | Mitigación |
| --- | --- | --- | --- |
| R1 | El árbol de trabajo tiene cambios sin commitear: `git status` muestra `src/app/admin/page.tsx`, `src/app/admin/scan/page.tsx`, `src/app/admin/talleres/nuevo/page.tsx` y `src/app/admin/talleres/page.tsx` como eliminados, y `src/features/organizer/server-auth.ts` modificado. Si eso es una reorganización a medias, el repo público y lo desplegado pueden diferir, o `/admin` romperse. | Alta | Confirmar qué se movió, correr pruebas, commit, push y verificar `/admin`, `/admin/scan` en producción antes de enviar. |
| R2 | README termina con "[Completar]" en Equipo y licencia; no hay archivo de licencia. | Media | Completar equipo y elegir licencia (o declarar que no se open-sourcea; las reglas no lo exigen). |
| R3 | Contraseña de organizador: hay una sola contraseña (`ORGANIZER_PASSWORD`) para todos. Compartirla con el jurado la expone a quien la vea en el formulario, y el panel permite escanear/canjear pases. Recomendación (sin implementarla): usar una contraseña distinta para el periodo de evaluación y rotarla tras los resultados, o una cuenta/rol de solo lectura para el jurado. No guardarla nunca en el repo ni en este archivo. | Media | Cambiar `ORGANIZER_PASSWORD` en Vercel antes de compartirla, rotarla después del 2026-12-14. Si se entrega a evaluadores externos, valorar el rol de solo lectura. |
| R4 | Disponibilidad: la demo debe estar accesible al menos hasta los resultados (2026-12-14) y se recomienda hasta 2027-01-31. Depende de Vercel, Neon y la API key de pey (las credenciales sin uso pueden desactivarse a los 90 días). Un taller de 20 lugares puede agotarse. | Media | Revisar límites de los planes gratuitos, subir el cupo o reiniciar el taller antes de la evaluación, programar una revisión semanal de la URL. |
| R5 | Posible agregación de pagos: la regla prohíbe "agregar pagos de otros negocios" y el modelo de negocio cobra por organizador. Hoy el dinero entra a la cuenta del titular de la credencial. | Alta | Escribir a legal@pey.mx antes de postular y declarar en la postulación; en el texto de la demo mantener el alcance como taller propio de demostración. La respuesta escrita es vinculante. |
| R6 | Resend en plan gratuito solo entrega a correos permitidos (el dueño de la cuenta). El jurado probablemente no recibirá el correo. | Baja | Ya documentado en README y en las instrucciones. Para mitigarlo, verificar un dominio en Resend o avisar en el video; el pase siempre se muestra en pantalla. |
| R7 | Cada API key de pey admite un solo webhook; la memoria de deploy registra dos keys creadas por error (terminaciones M3yQ y XGoh) y que el webhook debe estar en la misma key cargada en Vercel. | Alta | Antes de la grabación, hacer un pago real de 0.01 MXN y confirmar que llega el webhook (no solo el polling). No cambiar el webhook después. |
| R8 | La cuenta bancaria "Prueba hackaton" figuraba como Pendiente en la memoria de deploy; el README afirma un pago real exitoso. Estado actual no verificado por mí. | Media | Confirmar en el Portal de pey que la cuenta está validada y que el cobro de producción sigue activo. |
| R9 | Video de 3:00 exactos en el guion y sin margen; el límite es 3 min. Pago real durante la grabación puede tardar. | Media | Grabar con corte a 2:45, tener plan B (video previo) como indica `docs/DEMO.md`. Evitar mostrar datos bancarios de terceros. |
| R10 | Entrega local tiene hora límite 2026-11-15 13:00 CDMX (el formulario es distinto al Portal nacional). Enviar en uno no postula en el otro. | Media | Enviar el formulario local temprano; el cierre nacional es independiente (2026-12-10 postulación, 2026-12-12 entrega). |
| R11 | Un solo envío por proyecto y la versión al cierre queda congelada; una demo o video caído al cierre cuenta como no entregado. | Media | Probar enlaces y acceso en ventana de incógnito justo antes de enviar. |

## 4. Conteos

Palabras (`wc -w` sobre el texto de cada sección):

- 2.2 Descripción nacional: 488 palabras (límite 500)
- 2.3 Descripción corta (local): 78 palabras (límite 80)
- 2.4 Instrucciones de prueba: 623 palabras (límite 1000)
- 2.5 Declaración de terceros: 150 palabras

Si se edita algún texto, volver a contar antes de pegar.
