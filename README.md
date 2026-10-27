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

Repo público a propósito: en repos públicos GitHub Actions no gasta minutos. No hay nada privado aquí; las claves van
en *Settings → Secrets* (no se ven aunque el repo sea público).

Las tareas programadas de la app (cancelar impagos, recordatorios, limpieza…) NO van aquí: las hace el trabajador del
servidor (`scripts/worker-outbox.mjs` en el repo de FastFood).
