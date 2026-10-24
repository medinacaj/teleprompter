# Auditoría técnica — 2026-10-24

**Base:** `main` @ `9c8860c`. **Alcance:** `index.html`, `sw.js`, `manifest.webmanifest`, `sitemap.xml`, `tests/smoke.cjs` y las ramas remotas. No se revisaron PayPal en profundidad, la sincronización en claude.ai ni dispositivos reales.

## Hallazgos corregidos en esta rama
| Prioridad | Hallazgo | Evidencia | Corrección |
|---|---|---|---|
| P2 | Los avisos del lector («Marcador guardado», «Este guion no tiene marcador», errores de pantalla completa) no se veían: se escribían en `#flash`, que pertenece a la configuración y está oculto durante la lectura. | Chromium: texto presente, `isVisible('#flash') === false`. | `flash()` usa `#rMsg` (`role="status"`) sobre los controles mientras se lee. |
| P2 | La app cargaba IBM Plex Mono desde Google Fonts. Cada visita enviaba la IP a terceros, aunque la documentación presenta la app como local. | Se registraron 4 solicitudes a `fonts.googleapis.com` y `fonts.gstatic.com`. | Se eliminó la carga; se usa la monoespaciada del sistema. Ahora la página no hace ninguna solicitud externa. |
| P3 | Un `savedAt` futuro en un JSON importado fijaba el guion arriba y bloqueaba sus actualizaciones posteriores. | `parseImport` aceptaba cualquier número. | `validSavedAt` limita la fecha a un valor > 0 y ≤ ahora. |
| P3 | Los guiones remotos no se acotaban como los locales (nombre de 80 caracteres como máximo, contenido de 200 000 como máximo). | `syncCloud`. | Se aplican los mismos límites. |
| P3 | Si el borrador no cabía en `localStorage`, el fallo pasaba en silencio. | `saveDraft` ignoraba el resultado. | Se avisa una vez hasta que vuelva a guardarse. |
| P2 | Al cargar un guion desde la biblioteca se reemplazaba el editor sin aviso y se perdían los cambios no guardados (pendiente del PR #5). | `loadScript` sobrescribía `S.text`. | Ahora pide confirmación si el editor tiene un texto que no coincide con ningún guion guardado. |
| P2 | Guardar con un título existente sobrescribía en silencio otro guion (pendiente del PR #5). | `saveScript` buscaba por nombre. | Se registra qué guion está abierto (`loadedId`, persistido con el borrador). Si el título coincide con otro guion, se pide confirmación; al cancelar, se guarda como «Título (2)». |
| P3 | Un `.txt` que empezaba con una indicación (`[pausa] …`) fallaba con «El archivo .json no es válido» (pendiente del PR #5). | `parseImport` decidía el formato por el primer carácter. | `.txt` siempre es texto. `.json` siempre es JSON. Sin extensión, solo se trata como JSON si el contenido es JSON válido. |
| P3 | Había metadatos desactualizados: `sitemap.xml` (lastmod 2026-10-03) y una descripción del manifiesto que no coincidía con el nombre. | — | Se actualizaron; la caché del SW pasa a v11. |

## Pendientes (no implementados)
| Riesgo | Estado | Siguiente acción |
|---|---|---|
| Autoría y licencia: no hay `LICENSE` ni autor en el README ni en el JSON-LD. | Abierto | El titular define el nombre y la licencia (o «todos los derechos reservados»). |
| PR #4 PayPal: le faltan 50 commits de `main` y no tiene backend, webhooks ni autenticación. | Abierto | Actualizar con `main`, decidir el hosting del backend y confirmar la cuenta Business. GitHub Pages no protege el contenido de pago. |
| Ramas ya integradas o superadas: `chore/multi-ai-handoff-2026-10`, `fix/reader-keyboard-accessibility`, `feature/reader-resume-and-offline`, `governance/legal-tech-review-20261018` (esta última revertiría `AGENTS.md`/`CLAUDE.md`). | Abierto | El responsable decide si se borran. **No fusionar `governance/...`.** |
| Pruebas manuales en iPhone o Android y E2E automatizado en CI. | Abierto | Ver `docs/VALIDACION_TECNICA.md`. |
| Hay CSS duplicado por capas (estilos base sobrescritos dos veces). | Deuda | Consolidar cuando haya cambio visual, no por sí solo. |
| Al iniciar, la recuperación de sesión usa `confirm()`, que bloquea la página. | Deuda | Reemplazar por un aviso en la página si se vuelve molesto. |

## Pruebas ejecutadas
- `node tests/smoke.cjs`: todas OK.
- Chromium (Playwright, 390×800): aviso del marcador visible en lectura, 0 errores JS, 0 solicitudes externas, fecha de importación futura normalizada.
- Chromium: importación de `.txt` con `[pausa]` inicial; confirmación por título repetido, y al cancelar se guarda como «Demo (2)»; editar el guion abierto no pregunta; al cargar con cambios sin guardar, cancelar conserva el borrador y aceptar lo reemplaza.
- **No ejecutado:** Safari iOS, Chrome Android, sincronización en claude.ai, auditoría legal.
