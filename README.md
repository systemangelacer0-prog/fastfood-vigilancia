# Vigilancia de FastFood

Revisa cada 5 minutos, desde afuera del servidor, que FastFood responda:

| Revisión | Ruta |
|---|---|
| App viva | `/api/health/live` |
| Base de datos alcanzable | `/api/health/ready` |
| Tareas programadas del servidor (impagos, recordatorios, domicilios, CRM, limpieza, buzón de WhatsApp) | `/api/health/cron` |
| La tienda de **cada negocio activo** (con el secreto; sin él, solo Portobello) | `/r/<negocio>` |
| WhatsApp por negocio (con el secreto) | `/api/health/waha` |

- Cada revisión se intenta 3 veces (20 s entre intentos) antes de dar alarma.
- Si algo cae: la corrida queda en rojo (GitHub manda correo a esta cuenta) y se abre un aviso en **Issues** con la
  etiqueta `caido`. Mientras siga caído, cada corrida comenta ahí. Cuando vuelve, el aviso se cierra solo.
- Cada corrida deja una tabla con códigos y tiempos en la pestaña **Actions** → la corrida → *Summary*.
- Una revisión nueva que todavía no está desplegada (responde 404) se anota «sin desplegar» y no alarma.
- `mantener-activo.yml` evita que GitHub apague la vigilancia a los 60 días.

## Recorrido de la tienda (`recorrido.yml`, cada hora)

Un teléfono simulado (390 × 844) recorre la tienda de cada negocio como un cliente: portada → menú → abre un plato y
espera a que salga su precio. **Solo mira**: nunca toca el carrito, el perfil ni el pago (no crea clientes ni pedidos).
Falla si hay errores de JavaScript, respuestas 5xx, un menú sin platos o una ficha que no abre o se queda cargando.
Reintenta una vez a los 60 s; si sigue fallando abre un aviso con la etiqueta `recorrido` (se cierra solo al volver).
Los tiempos de cada paso quedan en el *Summary*. El navegador se guarda en caché entre corridas.

## Resumen diario (`resumen-diario.yml`, 7:00 en Colombia)

- **Certificado SSL**: días que le quedan; con menos de 15 abre un aviso `certificado` (se cierra al renovarse).
- **Resumen de 24 h** en un Issue `resumen` (llega por correo): revisiones y recorridos bien / con falla y avisos
  abiertos. El del día anterior se cierra solo.

Repo público a propósito: en repos públicos GitHub Actions no gasta minutos. No hay nada privado aquí; las claves van
en *Settings → Secrets* (no se ven aunque el repo sea público).

Las tareas programadas de la app (cancelar impagos, recordatorios, limpieza…) NO van aquí: las hace el trabajador del
servidor (`scripts/worker-outbox.mjs` en el repo de FastFood).
