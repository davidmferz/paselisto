# Guion de demo (3 minutos)

App en vivo: https://paselisto.vercel.app

## Checklist previo

- [ ] Abrir la app en vivo y confirmar que carga el taller de demostración.
- [ ] Saldo y app bancaria con CoDi lista en el celular (el pago real es de $0.01).
- [ ] Correo real para la compra; revisar que esté permitido en el sandbox de Resend.
- [ ] Sesión de organizador abierta en una segunda pestaña (`/admin`), credenciales a la mano (no están en el repo).
- [ ] Permiso de cámara concedido para `/admin/scan`.
- [ ] Calendario por defecto listo para abrir el `.ics`.
- [ ] Video grabado del flujo completo descargado en local (plan B).
- [ ] Un código de pase de respaldo anotado para ingresarlo manualmente.
- [ ] Recordar: un solo webhook por API key; no cambiarlo antes de la demo.
- [ ] Pantalla del celular espejada o segunda cámara apuntando al teléfono.

## Guion

**0:00 - 0:25 · El problema.** Mostrar la landing del taller.
Decir: "Hoy los organizadores validan pagos con capturas de pantalla. Cualquiera las falsifica. PaseListo deja de aceptarlas."

**0:25 - 1:05 · Compra.** Escribir correo y pulsar comprar. Mostrar el QR de CoDi y la cuenta regresiva.
Decir: "Creamos el cobro con la API de pey, con el orderId en la metadata; el QR lo dibujamos nosotros."

**1:05 - 1:40 · Pago.** Pagar $0.01 desde la app bancaria. Mostrar la pantalla confirmando sola y el pase QR.
Decir: "pey nos avisa con un webhook firmado. Verificamos la firma sobre el cuerpo crudo, deduplicamos por webhook-id y emitimos un único pase. En producción probamos que el polling y el webhook llegaron con 0.6 s de diferencia y salió un solo pase."

**1:40 - 2:00 · Extras del pase.** Descargar el pase, abrir calendario (.ics / Google), mencionar el correo de confirmación.

**2:00 - 2:25 · Organizador.** Cambiar a `/admin`: Mis talleres, panel del taller con la orden pagada y los contadores.
Decir: "Contadores coherentes: lo pagado, lo pendiente y lo que quedó en revisión."

**2:25 - 2:55 · Puerta.** En `/admin/scan` escanear el pase: válido. Escanearlo de nuevo: ya usado. Si hay pase de otro taller, mostrar "Otro taller" sin consumirlo.
Decir: "El canje es un UPDATE atómico; no hay forma de usarlo dos veces."

**2:55 - 3:00 · Cierre.** "Pagos que se confirman solos, pases que no se falsifican. Gracias."

## Plan B

- **Pago falla o la red cae:** reproducir el video grabado del flujo completo y narrar encima.
- **Webhook tarda:** esperar el respaldo (consulta a los 45 s) y explicarlo como característica: el mismo `applyPayment` idempotente.
- **Cámara no escanea:** usar el ingreso manual del código del pase.
- **Correo no llega:** mostrar el pase en pantalla; explicar la limitación del sandbox gratuito de Resend.
- **App caída:** abrir el video y el repo en GitHub.
