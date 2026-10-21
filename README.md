# FrameFlow Map Studio

A browser based map animation editor with terrain relief, map styles, regions, animated routes, objects, camera keyframes, audio, and video export. Plain HTML, CSS, and JavaScript; no build step or backend required.

## Run locally

Serve this directory with a static web server, for example `python -m http.server 8000`, then open http://localhost:8000. Select **Open Map Studio** to enter the editor.

## Make an animated map

1. Create a project and choose the canvas size, frame rate, duration, and map style in Canvas settings.
2. Add regions, routes, pins, labels, objects, or effects.
3. Animate items and the camera using timeline keyframes.
4. Preview, save a project backup, or export video or PNG.

Project duration has no fixed cap. Existing Map Studio projects and local saves remain supported. Old Motion, Paper, and Scene URLs redirect to Map Studio.

## Files

- `map-ui.js`, `map-engine.mjs`, and `map-*.mjs`: map editing, rendering, animation, and export.
- `map-data/` and `assets/`: map geography and visual assets.
- `fonts.mjs`, `audio-reference.mjs`, `timeline-*.mjs`, and the panel/UI modules: editor utilities.
- `index.html`, `style.css`, `map.css`, and landing files: interface and homepage.
- `tests/`: Map Studio unit and browser tests.

## Validation

Run `npm test` for map unit tests and `npm run check` for JavaScript syntax checks. Browser checks use a local Chrome or Edge installation; set `CHROME_PATH` if necessary. Run `npm run test:landing:browser` and the `test:map-*:browser` scripts for editor workflows.

## GitHub Pages

Publish this directory from your chosen branch and repository root in Settings → Pages. Include `.nojekyll`. All application asset paths are relative and work with GitHub project sites or custom domains. Map and terrain attribution is in `terrain-credits.html`.
