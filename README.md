# Sismo de Panamá · 9 de octubre de 2026 · Video educativo 3D

**Resultado final:** `salida/sismo_panama_2026.mp4`. Es un video vertical 9:16 (1080×1920, 30 fps) de unos 58 s, con narración en español y subtítulos quemados. Es una recreación educativa.

## Qué hay en el repositorio

Son tres entregas distintas:

| Entrega | Archivo | Qué es |
|---|---|---|
| **Video descargable** | `salida/sismo_panama_2026.mp4` | El video final para publicar. |
| **Animación interactiva** | `escena/index.html` | La misma escena en el navegador, con botón de reproducción y barra de tiempo. Se abre con `npm run preview`. |
| **Guion y guía de producción** | `GUION.md` | Escenas, tiempos, cámara, textos en pantalla, narración e instrucciones para rehacerlo en Blender u otra herramienta. |

Material de apoyo: `salida/narracion.wav` (voz), `salida/subtitulos.srt` y `.ass` (subtítulos editables) y `salida/linea_de_tiempo.json` (tiempos de escena).

## Datos verificados

| Dato | Valor en el video | Fuente | Observaciones |
|---|---|---|---|
| Fecha y hora | Viernes 9 oct 2026, 12:56 p. m. hora de Panamá (17:56 UTC) | USGS, evento [us6000u18k](https://earthquake.usgs.gov/earthquakes/eventpage/us6000u18k); IGC-UP | Panamá usa UTC−5 todo el año. |
| Magnitud | 7,7 Mww | USGS (solución revisada) | El USGS empezó con 8,0, luego 7,6 y después 7,7. El IGC-UP dio cifras preliminares de 7,0 y luego 7,5 (OPS) o 7,2. |
| Profundidad | ≈ 12,6 km | USGS | El IGC-UP informó 10 km (preliminar) y luego 4 km. |
| Epicentro | 7,587° N · 80,769° O, península de Azuero | USGS («12 km WSW of Pitaloza Arriba») | Coincide con el IGC-UP («39 km al oeste/noroeste de Tonosí»). |
| Mecanismo | Explicación genérica del rebote elástico | — | Hay medios que citan al USGS y hablan de un desplazamiento de rumbo. No lo confirmé en la fuente primaria, así que no se afirma ni se nombra falla o placa. |
| Daños y tsunami | No aparecen | — | Por pedido explícito. |

**Límite de la verificación:** la red de este entorno bloqueó el acceso directo a `earthquake.usgs.gov` y a Wikipedia. Los valores salen de resultados de búsqueda que citan la página del evento del USGS, del informe de situación 1 de OPS/OMS y de medios panameños, y son coherentes entre sí. **Antes de publicar, abrí la página del USGS y el sitio del IGC-UP para confirmar que no hubo revisiones posteriores.** Si algún valor cambia, editá `escena/index.html`, `narracion/guion.json` y la constante `EPI` en `escena/escena.js`, y volvé a renderizar.

## Cómo reproducir el video

Requisitos: Python 3, Node 18+, ffmpeg (con libass) y Chromium (Playwright).

```bash
pip install numpy pillow piper-tts
npm install                      # three.js + playwright

# 1. Relieve (ya incluido en data/; solo si querés regenerarlo)
python3 data/fetch_dem.py

# 2. Voz y subtítulos (voz Piper es-carlfm-x-low)
curl -LO https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-es-carlfm-x-low.tar.gz
mkdir voz && tar xzf voice-es-carlfm-x-low.tar.gz -C voz
python3 narracion/build_audio.py voz/es-carlfm-x-low.onnx

# 3. Render cuadro por cuadro + mezcla con voz y subtítulos
node render/render.mjs                         # → salida/sismo_panama_2026.mp4
node render/render.mjs --stills 3,15,30,45     # capturas de control
```

El render es determinista: cada cuadro es `renderAt(t)` de la escena three.js, capturado con Chromium sin interfaz y codificado con ffmpeg. Sin GPU tarda unos 30 minutos.

## Créditos de datos

- Sismo: U.S. Geological Survey (USGS) e Instituto de Geociencias de la Universidad de Panamá (IGC-UP).
- Relieve y batimetría: AWS Terrain Tiles (Mapzen), con datos de SRTM, GMTED2010 y ETOPO1.
- Fronteras: Natural Earth (dominio público).
- Voz sintética: Piper TTS (voz `es-carlfm-x-low`).
