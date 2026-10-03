# Prompter — Lector de guiones

Teleprompter web mobile-first en español: pega tu guion, fija la velocidad en palabras por minuto (ppm) y léelo frente a la cámara con cuenta atrás, línea guía y modo espejo.

**En línea:** https://medinacaj.github.io/teleprompter/ (requiere GitHub Pages activo, ver abajo).

## Ejecutar

- **Local:** descarga `index.html` y ábrelo en el navegador. No necesita instalación ni servidor.
- **GitHub Pages:** Settings → Pages → *Build and deployment* → Source: **Deploy from a branch** → rama `main`, carpeta `/ (root)` → Save.

Fuera de claude.ai los guiones se guardan en el navegador (localStorage); usa **Mis guiones → Exportar** para respaldarlos.

## Archivos

| Archivo | Uso |
|---|---|
| `index.html` | La app completa (HTML + CSS + JS, sin dependencias) |
| `og-image.png` | Imagen para redes sociales (1200×630) |
| `sitemap.xml`, `robots.txt` | Rastreo e indexación |
| `.nojekyll` | Publica los archivos tal cual en Pages |
