# ¿Por qué tembló Panamá? Guion y escenas

Video vertical 9:16 (1080×1920, 30 fps), **57,6 s**, narración en español y subtítulos.
Recreación educativa del sismo del viernes 9 de octubre de 2026.

Los tiempos salen de `salida/linea_de_tiempo.json`, que se genera a partir de la duración real de la voz.

| # | Tiempo | Escena | Cámara | Gráficos en pantalla | Narración |
|---|--------|--------|--------|----------------------|-----------|
| 1 | 0:00–0:04,6 | **Título** | Vista aérea alta desde el suroeste sobre el istmo en relieve 3D; avanza despacio. | «Sismo del 9 de octubre de 2026» / **«¿Por qué tembló Panamá?»**. Contorno luminoso cian de Panamá. Etiqueta «Océano Pacífico». | «¿Por qué tembló Panamá? Veamos qué pasó bajo nuestros pies.» |
| 2 | 0:04,6–0:20,8 | **Epicentro y datos** | Vuelo suave (2,6 s) hacia la península de Azuero; luego un acercamiento lento. | Señal luminosa en el epicentro: haz ámbar y anillos pulsantes. Tarjeta que se completa al ritmo de la voz: fecha, hora local 12:56 p. m. (17:56 UTC), magnitud 7,7 Mww, profundidad ≈ 12,6 km, coordenadas 7,587° N · 80,769° O. Nota: «Solución revisada del USGS… las cifras preliminares de otras agencias variaron». | «El viernes 9 de octubre de 2026, a las 12:56 del mediodía, un sismo de magnitud 7,7 sacudió Panamá, según el Servicio Geológico de Estados Unidos. El epicentro estuvo en la península de Azuero, y el foco, a unos 12,6 kilómetros de profundidad.» |
| 3 | 0:20,8–0:36,8 | **Corte del terreno** | La cámara baja al nivel del suelo, mirando al norte. Un plano de corte barre el mapa desde el sur hasta la latitud del epicentro. | Pared de estratos con borde superior luminoso y el mar en corte. Punto rojo: **Hipocentro (foco), ≈ 12,6 km bajo tierra**. Línea punteada hasta la superficie: **Epicentro, punto en la superficie**. Ondas: anillo cian (P, más rápida) y anillo ámbar (S, más lenta y fuerte). Al llegar a la superficie, los anillos se propagan sobre el mapa. | «Hagamos un corte del terreno. El hipocentro, o foco, es el punto bajo tierra donde empezó la ruptura. El epicentro es el punto de la superficie justo encima. Del foco salen ondas sísmicas: primero las P, más rápidas; luego las S, que sacuden más.» |
| 4 | 0:36,8–0:49,1 | **Mecanismo (esquema genérico)** | Vuelo hacia un diorama flotante de dos bloques de corteza, con una órbita lenta. | Pasos 1-2-3. Flechas que muestran el esfuerzo. Una franja clara cruza la falla: primero se curva (la roca acumula tensión) y luego se corta y se desplaza de golpe, con destello, sacudida y anillos. Nota: **«Esquema genérico: no representa una falla específica. La falla que originó este sismo sigue en estudio.»** | «¿Y por qué ocurre? Las rocas acumulan tensión durante años. Cuando la tensión supera su resistencia, se rompen y se deslizan de golpe, liberando energía en ondas. Qué falla exacta se movió aún está en estudio.» |
| 5 | 0:49,1–0:57,6 | **Fuentes** | La cámara se eleva sobre Panamá; fundido a negro al final. | Tarjeta de fuentes: USGS (evento us6000u18k), IGC-UP, AWS Terrain Tiles y Natural Earth. «Recreación educativa… no muestran daños reales. Datos consultados el 13 de octubre de 2026.» | «Esta fue una recreación educativa con datos del USGS y del Instituto de Geociencias de la Universidad de Panamá.» |

En todo el video se ven dos avisos: la insignia **«RECREACIÓN EDUCATIVA»** y la nota «Escala vertical exagerada · No representa daños».

## Decisiones editoriales

- **Magnitud y profundidad:** se usa la solución revisada del USGS (7,7 Mww; 12,6 km). El IGC-UP publicó cifras preliminares distintas (7,0 y luego 7,5 o 7,2; 10 km y luego 4 km). Por eso la tarjeta lo advierte.
- **Mecanismo:** algunos medios citan al USGS y hablan de un desplazamiento de rumbo (*strike-slip*). No pude verificarlo en la página del USGS, así que la narración solo explica el rebote elástico en general y aclara que la falla sigue en estudio. No se nombra ninguna falla ni placa.
- **Daños y tsunami:** el video no muestra ni menciona daños, víctimas ni alertas. Según la prensa, el Centro de Alerta de Tsunamis del Pacífico emitió un aviso de amenaza y lo dio por terminado a las 19:40 UTC. Si quieren mencionarlo, primero hay que verificarlo en tsunami.gov.
- **Escala:** el relieve y la profundidad están exagerados ×5 en vertical; la batimetría, ×3. Las ondas van en cámara lenta: en la realidad las P viajan a ~6 km/s y las S a ~3,5 km/s.

## Cómo rehacerlo en otra herramienta 3D (Blender, Cinema 4D, Unreal)

El render de este repositorio ya es el video final. Esta guía sirve para rehacerlo con más calidad visual:

1. **Relieve:** importar `data/panama_dem.bin` (int16, 1240×680, metros, fila 0 = norte; límites en `panama_dem.json`) como mapa de desplazamiento sobre un plano subdividido. Exagerar ×5 la tierra y ×3 el fondo marino. En Blender: *Displace* con una textura de imagen convertida a EXR de 16 bits, o el complemento BlenderGIS con un DEM SRTM.
2. **Océano:** un plano a nivel 0 con material de agua azul semitransparente (*Principled*: transmisión 0,6, rugosidad 0,1). Debajo, el fondo marino en azul oscuro.
3. **Contorno luminoso:** importar `data/panama_frontera.geojson` como curva (BlenderGIS) con emisión cian (#5FF3FF, intensidad 8) y Bloom.
4. **Epicentro:** un cilindro emisivo ámbar (#FFB547) en 7,587° N, 80,769° O, más 3 anillos que escalan de 2 a 28 km con opacidad decreciente, en un ciclo de 1,8 s.
5. **Corte:** un modificador *Boolean* o *Bisect* animado en el plano de latitud 7,587°. La pared de estratos va en marrones (#9B6A3F → #2F1B1C). El hipocentro es una esfera roja (#FF5A3C) a 12,6 km × 5 bajo la superficie.
6. **Ondas:** dos esferas o anillos que crecen desde el hipocentro: P cian a 12 u/s y S ámbar a 7 u/s (cámara lenta), recortados al terreno.
7. **Mecanismo:** dos cajas subdivididas, con una franja clara que cruza la falla. Primero se curva con *Simple Deform* o con una *shape key*; luego se desplaza de golpe en 0,35 s, con sacudida decreciente y un destello rojo en el plano de falla.
8. **Audio y subtítulos:** usar `salida/narracion.wav` y `salida/subtitulos.srt` (o `.ass`, con el estilo ya definido). Ajustar los cortes de escena a `salida/linea_de_tiempo.json`.
9. **Exportar:** 1080×1920, 30 fps, H.264, CRF 18–20, AAC 160 kbps.
