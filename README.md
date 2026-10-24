# Prompter — Lector de guiones

Teleprompter web mobile-first en español: pega tu guion, fija la velocidad en palabras por minuto (ppm) y léelo frente a la cámara con cuenta atrás, línea guía y modo espejo.

**En línea:** https://medinacaj.github.io/teleprompter/ (requiere GitHub Pages activo, ver abajo).

## Ejecutar

- **Local:** descarga `index.html` y ábrelo en el navegador. No necesita instalación ni servidor.
- **GitHub Pages:** Settings → Pages → *Build and deployment* → Source: **Deploy from a branch** → rama `main`, carpeta `/ (root)` → Save.

Fuera de claude.ai los guiones se guardan en el navegador (localStorage); usa **Mis guiones → Exportar** para respaldarlos. La app no usa cuentas, analítica ni fuentes o scripts de terceros.

## Pruebas

```sh
node tests/smoke.cjs
```

GitHub Actions (`.github/workflows/quality.yml`) ejecuta la misma comprobación en cada push y PR. Al modificar `index.html`, incrementa la versión de caché en `sw.js` (`prompter-static-vN`) y en la prueba.

## Archivos

| Archivo | Uso |
|---|---|
| `index.html` | La app completa (HTML + CSS + JS, sin dependencias) |
| `sw.js`, `manifest.webmanifest`, `icon.svg` | Instalación como app (PWA) y uso sin conexión |
| `tests/smoke.cjs` | Comprobaciones estáticas sin dependencias |
| `docs/` | Validación, auditoría, revisión jurídico-tecnológica y flujo multi-IA |
| `og-image.png` | Imagen para redes sociales (1200×630) |
| `sitemap.xml`, `robots.txt` | Rastreo e indexación |
| `.nojekyll` | Publica los archivos tal cual en Pages |
