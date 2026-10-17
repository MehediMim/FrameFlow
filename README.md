# FrameFlow Motion Studio

A browser based motion graphics editor with a frame timeline, transform keyframes, easing, layers, playback, and video export. Plain HTML, CSS, and JavaScript; no build step, backend, API key, or paid service is required.

Set **Duration (seconds)** in each studio's settings to choose your project length. Motion, Map, Paper and Scene have no fixed duration cap; playback and export use the duration you choose.

## Host on GitHub Pages

1. Extract this ZIP.
2. Create a GitHub repository, for example `frameflow`. A public repository works with GitHub Free.
3. Upload the **contents inside the `frameflow` folder** to the repository root. `index.html` must be at the root, not inside another folder. Include `.nojekyll` when uploading with Git.
4. Open the repository's **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select **main** and **/(root)**, then click **Save**.
7. Wait for deployment to finish and open the URL shown by GitHub Pages, normally `https://YOUR-USERNAME.github.io/frameflow/`.

Official instructions: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

All application asset paths are relative, so both GitHub project sites and custom domains work.

### Upload with Git instead

Create an empty repository on GitHub first. Run these commands inside the extracted `frameflow` folder; replace the example URL with your repository URL:

```bash
git init
git add .
git commit -m "Add FrameFlow motion editor"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/frameflow.git
git push -u origin main
```

Then enable Pages using the steps above.

## Run locally

Use a local web server because the app imports JavaScript modules. Do not open `index.html` directly with a `file://` URL.

With Python installed, open a terminal in this folder and run:

```bash
python -m http.server 8000
```

On Windows, you can use `py -m http.server 8000` if `python` is unavailable. Open http://localhost:8000. VS Code's Live Server extension is another option.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Editor interface and controls |
| `style.css` | Layout, colors, and typography |
| `app.js` | Canvas renderer, editing interactions, playback, local saving, import/export |
| `engine.mjs` | Keyframe interpolation, easing, and project validation |
| `map-ui.js` | Map Studio editor: animations, camera presets, timeline, export |
| `map-engine.mjs` | Map Studio engine: vector map, camera, plane/border/highlight/pin drawing |
| `map-places.mjs` | Built-in city list and start-view regions |
| `map-objects.mjs` | Objects, effects, arrows and zones (all drawn as vector shapes) |
| `map-country-details.mjs` | Finds and describes country detail packs (`map-data/<country>-detail.json`) |
| `map-data/` | Natural Earth country outlines (via world-atlas, public domain) and country detail packs (`*-detail.json`) |
| `tools/` | `build-myanmar-detail.py`: how the Myanmar pack was produced; a template for other countries |
| `map.css` | Map Studio styles |
| `tests/` | `npm test` checks the map engine |
| `.nojekyll` | Serves the repository as a static site without Jekyll processing |
| `package.json` | Optional JavaScript syntax check; no dependencies |

## Make an animation

1. Add a text, rectangle, ellipse, or image layer.
2. Move to frame 0 and click **Key transform**, or click a property's diamond.
3. Move to a later frame.
4. Drag the layer or edit its transform. With **Auto-key** enabled, changes to animated properties add keyframes.
5. Choose easing at the starting keyframe to control motion toward the next keyframe.
6. Play the composition and select **Export video**.

Drag timeline diamonds to retime all property keys on that layer at that frame. Alt-click a diamond to delete them. Property diamonds add or remove an individual property's key.

Supported animated properties: position X/Y, scale, rotation, opacity, and shape/image width and height. Text content and fill color are static per layer.

## Map Studio

Switch to **Map Studio** with the toggle in the header. It animates a vector world map (the default Earth look; other styles: Night, Paper atlas, Blueprint).

**Animations** (added at the playhead):

- **Border**: draws a country outline (with glow and optional fill), or sweeps every border across the world.
- **Plane**: flies a plane along a great-circle route from one place to another, with a trail and optional place names.
- **Highlight**: lights up a country (optionally dimming the rest) or a place with a radius and pulse.
- **Pin**: marks a location. Choose **Display → Icon + text**, **Icon only**, or **Text only** in Properties; icon pins drop in with ripples.

**Objects, effects and shapes** (for war maps, disasters, logistics and more):

- **Object**: soldier, tank, warship, fighter jet, helicopter, drone, submarine, missile, base, flag, city, camp, checkpoint, factory, airport, storm, volcano. Choose how it **appears** (drop in, fade, grow), what it does **while visible** (pulse, shake, bob, spin) and how it **disappears** (fade, shrink, explode). Set **Position → Move along my path**, draw the path on the map, and it travels along it, turning to face its direction.
- **Effect**: explosion, fire, smoke, shockwave, earthquake rings, blast / danger radius, and **Missile strike** (a missile flies from a launch point to a target, then explodes). Use **Repeat** to loop it inside the bar.
- **Arrow / zone**: attack arrow, retreat arrow, front line (reverse the path to flip the side the teeth face), occupied zone, and hatched no-fly zone. Click points on the map; arrows grow along the path and zones fade in.

The Follow traveler camera works with moving objects too.

**Camera presets** move the camera for you: Fly to, Cinematic swoop, Back to world, Push in, Pull back, Orbit, Tilt, Pan to, Frame flight, Follow plane. Tilt and rotation give a 3D viewing angle.

**Choosing places**: type a city or country, type `lat, lon`, or press the target button and click the map (Shift+click picks a whole country for camera targets).

To attach the existing labels flat to the map, choose **Label style → Start from a style → 2D · Attached to map** in Map settings or an item's custom label style. Place names, route names, pin labels and highlight labels follow the map's tilt and rotation with this preset.

### Country maps (Map area)

Open **Canvas settings → Map area** and choose **One country · detailed map**. Pick any country from the list (Bangladesh, India, United States of America…). The view is framed on that country using the detailed 50 m outlines; neighbouring countries can be dimmed, shown or hidden, and the country name and its main cities can be switched on or off. **Margin around the country** controls how tightly it is framed. Turn off **Frame the view on this country** to place the start view yourself. Switch back to **World map** at any time; nothing else in the project changes.

When a country has a detail pack, a **Boundary level** list appears (for Myanmar: *States / regions* and *Districts*). Border and Highlight can then target any state, region or district, and route names use them. Countries without a pack stay plain country maps.

### Country detail packs

To add detailed boundaries for a country, add **one file** to `map-data/`; no code changes:

`map-data/<country>-detail.json` where `<country>` is the country name exactly as it appears in the Map area list, in lower case with spaces and punctuation turned into `-`. Examples: `myanmar-detail.json`, `bangladesh-detail.json`, `united-states-of-america-detail.json`, `cote-d-ivoire-detail.json`.

Reload the app, choose the country under **Map area**, and it loads automatically. Run `npm test` to validate it: every `*-detail.json` in `map-data/` is checked (names, keys, levels, outline, cities).

```jsonc
{
  "country": "Myanmar",                 // required, must match the Map area name exactly
  "features": [                         // required, GeoJSON Polygon / MultiPolygon, WGS84 lon/lat
    { "type": "Feature",
      "properties": { "key": "Yangon Region", "name": "Yangon", "level": "division" },
      "geometry": { "type": "MultiPolygon", "coordinates": [] } }
  ],
  "defaultLevel": "division",           // optional: level shown first (default: first level)
  "defaultRegion": "Yangon Region",     // optional: key or name new Border / Highlight items start on
  "levelLabels": { "division": "States / regions", "district": "Districts" },   // optional: names and order in the list
  "ready": "Shown under Map area once loaded.",    // optional
  "attribution": "Data source and licence.",       // optional
  "cities": [["Yangon", 16.8409, 96.1735, "Myanmar"]]   // optional: [name, lat, lon, country]
}
```

- Exactly one feature with `"level": "country"` is the outline used to frame the view. Every other feature belongs to a level.
- **Level ids are free-form** (`division`, `district`, `province`, `municipality`, ...). Use `levelLabels` to name them and to set their order.
- **`key` must be unique** across the pack and must not equal a country name (projects store it). `name` is the text shown on the map. Using `"Mandalay Region"` as key and `"Mandalay"` as name is a good pattern.
- Keep the file small: simplify the geometry and round coordinates to 3 or 4 decimals. About 1 MB is fine; GitHub Pages compresses it.
- Older packs without the optional fields still work (Bangladesh uses built-in defaults for them).

### Travel along your own path

Add a **Travel** animation, then set **Travel along → My own path**. Press **Draw path on map** and click the points the icon should pass through, in order. Drag a point to move it, Alt+click (or ✕ in the list) removes it, Backspace removes the last one, Enter finishes. **Path shape** is a smooth curve through the points or straight lines. The icon, trail and optional path points animate along the whole path; camera presets such as *Frame route* and *Follow traveler* work with it. **Start → end (flight arc)** keeps the original great-circle behaviour.

Turn on **Show route region / country names** in Travel properties to label the areas crossed by either route type. Names appear as the traveler enters each region or country and stay visible for the rest of the timeline bar. Choose **Countries**, **Regions** or **Auto regions / countries**. Region names follow the map boundary level and use country names where regional data is unavailable. **Show place names** independently controls the start and end labels.

Drag bars on the map timeline to retime them; drag their edges to change how long an item is visible. Border, Travel, Highlight and Pin appear only during their timeline bars and disappear when their bars end. Set **Animation duration (frames)** in Properties to control how long the drawing, movement or entrance takes, independently of **Visible for (frames)**. A shorter animation holds its completed appearance until the bar ends; a longer animation is cut off at the bar's end. Camera shot lengths still control the duration of the camera move. Projects save as `.framemap.json`. Export uses the same real-time WebM/MP4 recorder as Motion mode.

The map data files are loaded with `fetch`, so serve the folder over http (same as the module imports).

## Shortcuts

- Space: play/pause
- Left/right arrows: previous/next frame
- Shift + left/right arrows: move ten frames
- K: key transform
- Ctrl/Cmd Z: undo
- Ctrl/Cmd Shift Z: redo
- Delete/Backspace: delete selected layer

## Saving and exporting

- The latest project is stored in browser localStorage on that device and site origin.
- **Save project** downloads a portable `.frameflow.json` file, including imported images.
- **Open** restores a saved project. Projects do not automatically transfer between the original hosted app, localhost, and GitHub Pages; download and reopen the project to transfer it.
- **PNG** exports the current frame without editor guides.
- Video export uses the browser's MediaRecorder and canvas capture APIs. The app prefers WebM and falls back to MP4 only when the browser supports it.
- Recording runs in real time; keep the tab visible. Smoothness depends on browser and device performance, so exported video is not guaranteed to contain every timeline frame.

## Current scope and limitations

- Desktop oriented editor; the layout needs a window at least 980 pixels wide.
- No audio tracks, video clip import, account system, or cloud project synchronization.
- Canvas dragging moves layers. Resize and rotate through the property controls.
- Changing canvas dimensions does not automatically reposition layers.
- Maximum composition length: 1800 frames; supported frame rates: 24, 30, and 60 FPS.
- Image import is limited to 10 MB and project import to 30 MB. Large projects can exceed localStorage capacity; use Save project to keep a copy.
- UI fonts are optionally fetched from Google Fonts; fallback fonts are provided. Canvas text uses Arial/sans-serif.

## Validation

JavaScript syntax and keyframe engine behavior were checked during creation: linear interpolation, boundary frames, key replacement, hold easing, and project validation. Browser interaction and video export have not been verified end to end.

Optional syntax check with Node.js installed:

```bash
npm run check
```

No package installation is required.
