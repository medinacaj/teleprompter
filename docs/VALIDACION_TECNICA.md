# Validación técnica antes de fusionar

## Alcance
Este PR mejora persistencia local, teclado, temporizador, desplazamiento y metadatos. No implementa cuentas ni pagos. GitHub Pages sigue sirviendo archivos públicos: **no representa un control de acceso comercial**.

## Pruebas manuales obligatorias
- [ ] Safari en iPhone: abrir, reproducir, pausar, cambiar velocidad, espejo y cerrar.
- [ ] Chrome en Android: repetir lectura, reanudar y comprobar controles táctiles.
- [ ] Escritorio: verificar Espacio/Intro/flechas sin interferir con entradas ni controles.
- [ ] Ocultar la pestaña durante la cuenta atrás: no debe comenzar a leer.
- [ ] Ocultar la pestaña durante reproducción: debe quedar pausada.
- [ ] Editar guion y salir rápidamente: comprobar recuperación del borrador.
- [ ] Guardar, exportar JSON, importar y eliminar guiones; comprobar persistencia tras recargar.
- [ ] Simular almacenamiento bloqueado/lleno y comprobar advertencias.
- [ ] Validar sincronización opcional únicamente en entorno que realmente la habilite.
- [ ] Verificar metadatos SEO: no anunciar gratuidad ni precio no disponible.

## Riesgos y evidencia
| Riesgo | Evidencia | Control | Prueba | Responsable | Estado |
|---|---|---|---|---|---|
| Pérdida de guiones | `localStorage` puede fallar o ser eliminado | Exportación y advertencias de persistencia | Prueba de bloqueo/cuota | Mantenedor | Pendiente de validación |
| Inicio no deseado | Cuenta atrás activa al ocultar pestaña | Cancelación por `visibilitychange` | Prueba de segundo plano | Mantenedor | Implementado, sin prueba de navegador |
| Acceso no autorizado a producto pago | GitHub Pages publica HTML/JS | Backend y control de acceso futuro | Prueba de autorización | Mantenedor | Fuera de alcance |
| Datos y jurisdicción | Guiones locales; sincronización opcional dependiente de entorno | Revisar privacidad, retención y terceros antes de activar nube | Auditoría de datos | Mantenedor | Abierto |

**Validación ejecutada:** inspección estática de código y confirmación de commits. **No ejecutado:** navegador real, test E2E, auditoría legal, validación de pagos.
