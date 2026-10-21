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

Add an **Object**, then use **Object type** in Properties to choose **Famous landmarks & infrastructure** or **People & occupations**. The library includes 16 landmarks (including Padma Bridge and Bangladesh National Parliament) and 16 occupations. These objects support color changes, labels, movement, size and rotation keyframes, and video export.

In **Arrow / zone → Properties → Measurements**, show the full path length or zone area on the map. Choose kilometres/km² or miles/mi², enter a **Length** or **Area**, and press **Apply** to resize. Arrows keep their first point fixed; zones resize around their center. Resizing a keyed shape adds a shape keyframe at the playhead. Measurements follow the drawn curve and update with shape animation; labels are included in PNG and video exports.

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


### Consistent editor interactions

Click a spatial layer on the canvas or in Layers to select it. Shift-click adds or removes layers from the selection in either place. Common canvas fields apply to the selection; controls specific to one kind of layer appear for selections of that kind. Dragging moves the start anchor of an object, pin or traveler, the location of an effect or label, or the entire geometry of an arrow/zone. The Size handle resizes objects, groups, pins, effects and text; direction handles apply to objects and groups.

The selection bar and camera capture stay pinned to the viewport during zoom and scroll. Right-click offers Duplicate, Hide/Show and Delete for selected layers. Region selections additionally offer Highlight, Border and Label, with independent fill/text settings. Right-click without a selection offers placement tools. Ctrl/Cmd+D duplicates; Ctrl/Cmd+G groups eligible objects; Ctrl/Cmd+Shift+G ungroups. Groups stay intact until explicitly ungrouped. Batch actions create one undo step.

Visual tokens live in `design-tokens.css`; shared layer duplication/deletion live in `map-layer-actions.mjs`. Run `npm run test:map-layer-actions`, `npm run test:map-editor-consistency:browser`, and `npm run test:map-direct-edit:browser` to check the shared behavior.


Pakistan provincial detail is included in `map-data/pakistan-detail.json`. Enable Pakistan under Canvas settings ? Country details, then choose Provinces / territories. The pack contains Punjab, Sindh, Balochistan, Khyber Pakhtunkhwa, Islamabad Capital Territory, Azad Kashmir and Gilgit-Baltistan. It uses the public-domain [geoBoundaries PAK ADM1 dataset](https://www.geoboundaries.org/api/current/gbOpen/PAK/ADM1/) representing 2019; administrative and disputed boundaries follow that source. The country outline is dissolved from the same seven regions, and region keys are country-qualified so Pakistan's Punjab remains distinct from India's Punjab.


Camera movements share the permanent keyframed camera layer. Preset buttons add a linked start/end pair with the preset motion curve; they do not add timeline layers. Delete/Backspace on a camera marker, right-click ? Delete, or Properties ? Delete camera keyframe removes that key. For a preset endpoint, either deletion removes both members of its pair. Captured/manual keys remain independent, including frame zero and keys that share a frame with a preset endpoint. Saved separate camera preset layers are converted to pairs when opened. Blue markers identify paired movements; green markers are manual keys.
