"""Descarga el relieve (topografía + batimetría) de Panamá desde AWS Terrain Tiles
(formato Terrarium) y lo guarda como una cuadrícula de alturas para la escena 3D.

Uso: python3 data/fetch_dem.py
Salida: data/panama_dem.bin (int16, metros, fila 0 = norte) y data/panama_dem.json
"""
import io, json, math, os, urllib.request
import numpy as np
from PIL import Image

LON_MIN, LON_MAX = -83.2, -77.0
LAT_MIN, LAT_MAX = 6.6, 10.0
ZOOM = 9
OUT_W = 1240  # columnas de la cuadrícula de salida (~550 m por celda)
URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
HERE = os.path.dirname(os.path.abspath(__file__))


def tile_xy(lon, lat, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def main():
    x0, y0 = tile_xy(LON_MIN, LAT_MAX, ZOOM)
    x1, y1 = tile_xy(LON_MAX, LAT_MIN, ZOOM)
    tx0, ty0, tx1, ty1 = int(x0), int(y0), int(x1), int(y1)
    mosaic = np.zeros(((ty1 - ty0 + 1) * 256, (tx1 - tx0 + 1) * 256), np.float32)
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            url = URL.format(z=ZOOM, x=tx, y=ty)
            with urllib.request.urlopen(url, timeout=60) as r:
                img = np.asarray(Image.open(io.BytesIO(r.read())).convert("RGB"), np.float32)
            h = img[..., 0] * 256 + img[..., 1] + img[..., 2] / 256 - 32768
            mosaic[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] = h
            print("tile", tx, ty)

    # Remuestreo a una cuadrícula regular en lon/lat (equirectangular).
    out_h = round(OUT_W * (LAT_MAX - LAT_MIN) / (LON_MAX - LON_MIN))
    lons = np.linspace(LON_MIN, LON_MAX, OUT_W)
    lats = np.linspace(LAT_MAX, LAT_MIN, out_h)
    px = (np.array([tile_xy(lo, 0, ZOOM)[0] for lo in lons]) - tx0) * 256
    py = (np.array([tile_xy(0, la, ZOOM)[1] for la in lats]) - ty0) * 256
    grid = mosaic[np.clip(py.astype(int), 0, mosaic.shape[0] - 1)[:, None],
                  np.clip(px.astype(int), 0, mosaic.shape[1] - 1)[None, :]]
    grid.round().astype("<i2").tofile(os.path.join(HERE, "panama_dem.bin"))
    meta = dict(width=OUT_W, height=out_h, lon_min=LON_MIN, lon_max=LON_MAX,
                lat_min=LAT_MIN, lat_max=LAT_MAX, units="m", dtype="int16-le",
                source="AWS Terrain Tiles (Terrarium), Mapzen/Linux Foundation; "
                       "incluye SRTM, GMTED2010, ETOPO1 y otras fuentes abiertas",
                zoom=ZOOM, min=float(grid.min()), max=float(grid.max()))
    json.dump(meta, open(os.path.join(HERE, "panama_dem.json"), "w"), indent=2)
    print(meta)


if __name__ == "__main__":
    main()
