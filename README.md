# PixelForge v0.4 — PSD interoperability preview

Free MIT-licensed iPad-focused painting and photo editing web app. No server, accounts, or CDN needed.

## PSD support

**Import:** classic `.psd` files (not PSB), 8-bit/channel RGB (3 or 4-channel); reads layer names, visibility, opacity, normal/multiply/screen/overlay/darken/lighten blending, and common RAW / PackBits-RLE encoded layer and flattened image channels. Supports up to 4096×4096 px and 200 layers. Unsupported layer effects, type/vector layers, smart objects, groups and native masks are **not preserved**. Unsupported ZIP-compressed channels are rejected with an explanation. Where there are no raster layers, opens the flattened image.

**Export:** PSD v1 with RGBA uncompressed raster layers, names, visibility, opacity and common blend modes, plus flattened composite image. Layer masks are **baked into raster layer pixels** on PSD export. The internal JSON project format preserves masks. Color profile/ICC/EXIF, adjustment layers, editable text/vector shapes and Photoshop effects are not included. Large exports may consume substantial memory on iPad Safari.

## Run

Keep `index.html` and `psd.js` together in the same folder and open `index.html` in a modern web browser, or host both on GitHub Pages. Existing image editing features from v0.3 remain included.

## Testing

The JavaScript and archive are syntax/integrity checked, but imported/exported PSDs have **not** been round-tripped in Adobe Photoshop or tested on an actual iPad. Treat this as a compatibility preview and keep backups of originals.

## License

MIT — see LICENSE.
