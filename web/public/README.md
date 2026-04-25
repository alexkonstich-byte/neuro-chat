# PWA icons

Replace `icon-192.png`, `icon-512.png`, `icon-maskable.png` with real PNGs (use `favicon.svg`/`icon-192.svg` as a source).
Quick generation on Linux:

```bash
sudo apt install -y librsvg2-bin
rsvg-convert -w 192 -h 192 icon-192.svg > icon-192.png
rsvg-convert -w 512 -h 512 icon-192.svg > icon-512.png
rsvg-convert -w 512 -h 512 icon-192.svg > icon-maskable.png
```
