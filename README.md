# JzfShrinkPic

A lightweight, privacy-focused Progressive Web App (PWA) to compress images offline.

## Features

- **100% Offline:** Runs entirely in the browser using the HTML5 Canvas API.
- **Privacy Focused:** No images are ever uploaded to a server.
- **Smart Compression:** Choose between "Quality" (resize) and "Resolution" (quality drop) modes.
- **Metadata Stripping:** Automatically removes EXIF data.
- **PWA Ready:** Installable on mobile and desktop.

## How to Use

1. Open the app.
2. Drag & drop an image or paste from clipboard.
3. Adjust the target size slider.
4. Download or Share the compressed result.

## Development

To run locally:

```bash
python3 -m http.server
```

Then open `http://localhost:8000`.

## License

MIT
