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

### Country details and region selection

The world map stays visible. In **Canvas settings → Country details**, choose a country and press **Add country details** to load its administrative boundaries. Add several countries, set each country's **Boundary level**, and pan, zoom or use camera shots to explore them. Detail packs load only when explicitly enabled or needed by saved region items. **Remove details** removes that country's background overlay; existing region animations keep their geometry. Town and regional labels appear when zoomed in enough to read them.

Use **Region selection** in the left panel to search and check several countries or administrative regions. **Select regions on map** lets you click repeatedly to toggle selections; Shift-click selects a whole country. Choose **Together as one region** for one timeline item and shared appearance, or **Separately as different regions** for independently editable items, then press **Add border** or **Add highlight**. **Use selection on current item** replaces an existing border or highlight's target. Shared matching boundary edges are removed from a combined outline. Countries without a detail pack keep their world outline.

For a border segment, enable **Animate part of the border** in its properties. Set **From (%)** and **To (%)**, or use **Pick start on border** and **Pick end on border** to snap map clicks to the same outline. **Reverse direction** draws the other way around it. Each island has its own outline; pick the start on the island you want. The item's animation duration controls how long the segment takes to draw.

### Country detail packs

To add detailed boundaries for a country, add **one file** to `map-data/`; no code changes:

`map-data/<country>-detail.json` where `<country>` is the country name exactly as it appears in the Map area list, in lower case with spaces and punctuation turned into `-`. Examples: `myanmar-detail.json`, `bangladesh-detail.json`, `united-states-of-america-detail.json`, `cote-d-ivoire-detail.json`.

Reload the app, choose the country under **Country details**, and press **Add country details**. Run `node tests/map-country-details.test.mjs` to validate every `*-detail.json` in `map-data/` (names, keys, levels, outline, cities).

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
- Video export encodes timeline frames with WebCodecs and downloads WebM with retained audio.
- Export waits for each frame to render, including any video source seeking, before encoding it.

## Motion videos and movement paths

- Press **Video** in Motion Studio to import a browser-supported MP4, WebM, or other video file up to 50 MB. The video becomes a layer that can be positioned, scaled, animated, and trimmed on the timeline.
- Original sound is included in playback and video export. Select the video and enable **Mute video sound** to silence it. **Source start (s)** skips the beginning of the source. The Properties panel reports if the browser cannot decode an audio track.
- Select any Motion layer, open **Movement path**, and press **Draw path**. Click to add points, drag points to adjust them, and Alt+click to remove one. Press Enter or **Finish path** when done. Choose a straight or smooth path and set its start and duration in seconds.
- A movement path replaces the layer's X and Y keyframes. Use **Edit path** and its timing controls to adjust movement. Other transforms and effects remain available.
- Downloaded Motion projects embed video data, sound, and movement paths. Large projects may exceed browser local storage; **Save project** keeps a portable copy. Motion project imports support files up to 100 MB.
- PNG and video exports seek each source video to the requested timeline frame. Preview zoom does not change export resolution.

## Current scope and limitations

- Desktop oriented editor; the layout needs a window at least 980 pixels wide.
- No account system or cloud project synchronization. Imported audio layers remain session-only; video layers retain their original embedded sound in saved Motion projects.
- Canvas dragging moves layers. Resize and rotate through the property controls.
- Changing canvas dimensions does not automatically reposition layers.
- Composition duration is set in canvas settings; supported frame rates are 24, 30, and 60 FPS.
- Image import is limited to 10 MB. Large projects can exceed localStorage capacity; use Save project to keep a copy.
- UI fonts are optionally fetched from Google Fonts; fallback fonts are provided. Canvas text uses Arial/sans-serif.

## Validation

Focused tests cover Motion video timing, movement paths, validation, and project round trips. The browser test imports a generated video with sound, checks mute and frame seeking, draws a path, and verifies video export with audio.

Optional syntax check with Node.js installed:

```bash
npm run check
npm run test:motion-media
npm run test:motion-media:browser
```

No package installation is required. The browser test uses an installed Chrome or Edge; set `CHROME_PATH` if its executable is elsewhere.

## Cartographic Relief

Object animation now includes sparse **Size**, **Rotation**, and **Damage state** tracks. In an Object inspector, turn on **Auto-key edits at the playhead**, move inside the object's timeline bar, and edit its size, rotation or damage state. The first later edit seeds an initial key at the clip start. Size and rotation interpolate with the item's easing; damage changes instantly at its key. Key buttons add/remove values at the playhead. Choose the property track above the inspector to view its timeline diamonds, then drag them or use the arrow keys to retime them. Moving/trimming a clip also moves/clamps its object keys. Image badges support keyed size and rotation too.

For a curved wall, choose a wall/palisade/defensive object and set **Position → Walls along a drawn path**. Click points on the map, then finish drawing. Segment spacing controls overlap; towers repeat at a chosen interval (0 disables them), and a gate can be placed in the middle. Segments follow the projected path tangent and share the object's keyed size, extra rotation and damage state. Smooth/straight paths and waypoint editing use the existing path editor. Rendering is bounded to 1,200 segments and skips offscreen segments.

**Damage state** offers intact, damaged, burning and destroyed. Cracks, flames/smoke, rubble and ship wreckage are rendered in code and work in PNG/video output. Set the state directly or key several changes along the bar; damage does not change the object's movement route.

Choose **Army groups → Mixed army formation** to combine unit types. Start with a pike-and-shot company, siege army or cavalry wing, then change each unit type, count and color. **Save formation** stores a named roster in the project for reuse by another army object. Up to 100 total units and 20 roster rows are supported; a project can save 30 custom formations. Movement, arrangement, keyframes and damage apply to the group.

For cannon fire, musket volleys or arrow volleys, enable **Attack from source to target** in the Effect inspector. Pick or type both locations, or link either endpoint to an Object item. Linked moving objects are followed at each frame. Direction and reach are derived from the endpoints, and projectiles converge on the target instead of using the freeform angle spread. Deleting a linked object falls back to the manual location. Damage changes remain independently controlled by the target's state keys.

Run `npm run test:map-object-workflows` and `npm run test:map-object-workflows:browser` for sparse animation, retiming, wall geometry, army presets, targeted attacks, UI save/reload, and PNG/video rendering checks.

**Defenses & walls** in the Object picker adds stone wall segments, wooden palisades, watchtowers, gatehouses, star bastions, earthworks and cannon batteries. In **Formation**, set Count and choose a row, column, grid, staggered ranks, wedge or circle. **Joined wall segments** uses adjoining spacing and rotates each segment with the formation; facing adds an extra angle in this mode. Columns, last-row alignment, gaps and angles are saved per item. Spacing is measured in pixels at size 1 and follows the chosen screen or map sizing mode.

To arrange mixed types, add separate Object items and expand **Arrange separate objects** in an Object inspector. Select the items, then align their starting anchors, distribute them, or place them in a row, column, grid or circle. Arrangement uses the current camera view and shifts movement destinations and waypoints with each anchor. Undo/redo restores the whole operation. These controls align geographic anchors rather than the visible edges of differently sized illustrations.

The Effect picker has a **Battle & siege** group with cannon fire, musket volleys, arrow volleys, artillery barrages, sword clashes, battlefield smoke and siege fire/embers. Direction, intensity, reach, volley spread, repeats, color and size are adjustable. They render deterministically for timeline scrubbing and PNG/video export. Run `npm run test:map-formations` and `npm run test:map-battle:browser` to verify formations, alignment, saved settings and effect rendering.

The Object picker includes **Exploration — Age of Sail** and **Warfare — 1500s–1600s** groups: caravel, galleon, oared galley, explorer with spyglass, mariner’s compass, parchment sea chart, treasure chest, supply wagon, field cannon, musketeer, pikeman, armored cavalry and stone fort. These are stylized vector illustrations with editable accent colors. They support the existing size, count, travel paths, trails, labels, and entry/exit controls. Sails, oars, compass needles and cavalry have subtle animation timed in seconds. Run `npm run test:map-historic-objects:browser` to check the picker, project saves, ship movement and a rendered gallery.

For an animated historical banner, add an **Object**, then choose **Hanging image flag**. Choose your own image in Flag artwork; its proportions set the cloth width/height automatically. The image bends with a cloth mesh beneath a rigid crossbar. Wind animation, strength, speed, wooden pole, wood color and a title plaque are adjustable. Standard object positioning, travel paths, appearance/exit animations, size and count remain available. Uploaded artwork is saved in the project and preloaded for PNG/video export. Wind uses elapsed seconds, so it runs at the same speed at different frame rates. Verify with `npm run test:map-banner` and `npm run test:map-banner:browser`.

Map settings also include **Country & Ocean Labels**. Enable country names or oceans and major seas independently. The outlined serif names are anchored to geographic positions. Country labels fit their mainland polygons by default, using smaller text for smaller countries and angled baselines for narrow or diagonal shapes. The Country size multiplier scales all fitted names together (30 is normal); disable Fit label size to each country to use uniform text sizes. Follow country and ocean angles can also be disabled. New settings default to scaling with the map; saved fixed-size choices remain available. **Keep text size fixed** preserves the font size through camera zoom; **Scale with the map** measures the size at a chosen reference zoom and doubles it for each additional zoom level. **Flat on map** follows ground rotation and perspective; **Upright** keeps text facing the viewer. Font, size, outline, color, spacing and opacity are adjustable. Overlap reduction favors larger countries; disable it to display every visible country name. Names use the existing country dataset and a curated set of ocean/sea anchors.

Choose **Map label** in the Add panel for custom historical names. It starts at the current map center with the outlined atlas serif style. Edit its text, pick a geographic position, or change its anchor to canvas coordinates. Its Label Style controls include size (up to 240), orientation and zoom sizing. Automatic label settings and custom labels are saved with the project and used by PNG and video exports. Run `node tests/map-labels.test.mjs` and `npm run test:map-atlas-labels:browser` to verify them.

In Map settings, choose **Cartographic Relief**, then expand **Terrain & Relief**. Tune the sun, shading strength, terrain depth, elevation colors (0 / 1,800 / 6,000 metres), water colors, and golden country/region highlights. Individual highlights can override the relief color and opacity in their inspector. Hard-light blending creates warm gold over dark land while retaining ridge and valley shading. NASA and Esri imagery remain separate styles/sources.

The renderer decodes [Mapzen Terrarium elevation tiles](https://registry.opendata.aws/terrain-tiles/) and shades geographic slopes using latitude-corrected ground spacing. It interpolates elevation colors, adds directional or multidirectional lighting and subtle curvature shading, and colors negative elevations by depth. Lighting represents local slopes, rather than cast shadows. Very small areas below sea level can inherit the ocean color because the DEM has no separate water mask.

Only visible XYZ tiles and their immediate parents are requested, up to zoom 14. Relief requests one extra DEM zoom level for crisp ridges, within the 140-tile visible-area budget. Zoom-dependent resolution, parent fallback, and a 240 ms preview fade keep navigation progressive. Caches hold at most 220 completed height tiles and 220 styled tiles; concurrency is four. Offscreen queued work is discarded when the view changes. Palette changes reuse decoded elevations; normal HTTP caching reuses downloads. Data coverage and native resolution vary; additional zoom cannot create more source detail. Offline tiles fall back to available parents or the base color, with a status message in terrain settings.

Terrain settings survive project saves, undo/redo, PNG snapshots and video export. Exports wait for requested tiles to settle and disable preview fades. Source requests use a 20-second timeout and one retry before settling as failed. Required dataset credits are linked from settings in [terrain-credits.html](terrain-credits.html); include appropriate credits with published exports.

Run `npm run test:map-relief` for deterministic rendering/cache tests and `npm run test:map-relief:browser` for persisted UI settings, live DEM loading, canvas export safety and a Spain/Portugal highlight preview. The browser test needs network access and writes `frameflow-relief-review.png` to the system temp directory.

Object **Sizing** offers **Fixed on screen** (the existing default) and **Scale with map**. Map sizing records the camera zoom when enabled; zooming in one level doubles the object and its formation gaps. Change Reference zoom to adjust its map footprint. Size keyframes multiply this zoom scaling for previews and exports.

Choose **Object > SVG / PNG image**, then **Choose image** for transparent artwork without a badge or frame. Proportions are preserved. SVG artwork is rasterized at up to 1,024 pixels and embedded in the project; SVGs must be self-contained, without linked external resources. PNG transparency is retained. Movement, rotation and size keyframes work with uploaded objects.

When highlights overlap, the active highlight with the latest start time wins within its boundary; later list order breaks a tie. Older color is excluded rather than blended underneath. Outside that boundary other highlights remain visible, and an older active highlight returns when the newer one ends.

Run `npm run test:map-object-sizing` and `npm run test:map-object-images:browser` to check sizing, image imports, highlight precedence, saving and PNG/WebM exports.

Add **Scene panel** from the Map Studio left panel for a screen-fixed side gradient, large year, event name and description. Choose left/right, width, text position, colors, opacity, text size and fade duration. **Advance year automatically** interpolates between starting and ending years as the timeline plays or is scrubbed; the animation diamonds define the year progression. Turn it off for a fixed year. CE/BCE suffixes and decreasing year ranges are supported. `{year}` in the event name or description follows the displayed year. Use consecutive Scene panel clips to tell successive events. Panels are saved in the project and rendered in PNG and WebM exports.

Run `npm run test:map-scene-panel` and `npm run test:map-scene-panel:browser` for year/timing validation, editor persistence, gradient placement, wrapping, and PNG/video checks.

For curved map names, choose **Label style > Text path > Circular arc**, or start from **Curved atlas text**. Adjust Arc bend from -360 to 360 degrees; negative values bend the other way. Letter spacing, outlines, map attachment and zoom sizing still apply. Automatic country/ocean labels have the same controls in their settings. Curved text uses individual grapheme clusters, so scripts requiring joined shaping work best with straight labels.

For a flag inside a boundary, select a country/region **Highlight**, choose **Highlight fill > Uploaded flag / image**, then **Upload flag** (PNG, SVG or another image). Tune opacity, cover/stretch, zoom and position. Mainland and remote islands have separate fitted placements. The image follows the map camera, reveal/invert timing and latest-highlight precedence; the terrain style can retain relief shading. Image data is embedded for saved projects and PNG/WebM exports.

Run `npm run test:map-cartography` and `npm run test:map-cartography:browser` for arc geometry, flag cropping, uploads/persistence, country/region clipping, holes, camera tilt, overlap and export checks.
