# FrameFlow Map Studio

A browser based map animation editor with terrain relief, map styles, regions, animated routes, objects, camera keyframes, audio, and video export. Plain HTML, CSS, and JavaScript; no build step or backend required.

## Run locally

Serve this directory with a static web server, for example `python -m http.server 8000`, then open http://localhost:8000. Select **Open Map Studio** to enter the editor.

## Make an animated map

Open [the animated feature guide](guide.html) from the home navigation or the editor sidebar for 31 searchable lessons. Each has a playable, scrubbable demonstration, three practical steps, a toolkit overview, and a direct lesson URL. The guide respects reduced-motion preferences and leaves editor projects untouched. Run `npm run test:guide:browser` to check all lessons and player interactions.

1. Create a project and choose the canvas size, frame rate, duration, and map style in Canvas settings.
2. Add regions, routes, pins, labels, objects, or effects.
3. Animate items and the camera using timeline keyframes.
4. Preview, save a project backup, or export video or PNG.

Project duration has no fixed cap. Existing Map Studio projects and local saves remain supported. Old Motion, Paper, and Scene URLs redirect to Map Studio.

To animate destruction, add an object damage keyframe for Intact, Damaged, or Burning, then a later Destroyed keyframe. The object collapses with falling debris and fading dust over 0.9 seconds, then remains rubble. Scrubbing and video export use the same animation. Objects that begin Destroyed appear as settled rubble.

Every object has **Properties → Object type → Object view → Normal / Isometric**. Isometric uses separate miniature models built from world-space geometry. Detailed materials include tiled and thatched roofs, masonry, timber grain, glass reflections and metal trim. Figures have tapered limbs, facial details and seated riding poses; vehicles have shaped bodywork and wheel rims; sailing ships have curved hulls, billowed cloth and rigging. Layered foliage, irregular mountain ridges, soft ground contact shadows and continuous lighting on rounded forms add depth. Static artwork is cached at the current output scale with a bounded pixel budget. Uploaded images appear on modeled frames, portrait stands or hanging standards. View selection is saved in the project, reflected in picker and Layers thumbnails, and rendered in PNG and video exports. Existing objects default to Normal.

Normal view uses a compact oval contact shadow. Isometric view projects the model geometry onto the ground using the same sun direction as its surface lighting. Shadows preserve silhouette gaps, grow softer with height, stay darker at contact points and shorten during collapse. Turning an object preserves the light direction. Airborne shadows stay on the ground during movement and entry animation. Shadow masks and artwork use separate bounded caches for playback and export.

Overlapping highlights now reveal over the previous highlight without clearing the unrevealed area first. The newer fill replaces the older one only where its animation has reached, while exclusions keep showing the layer underneath. Timeline bars still control each highlight's visibility.

For an illustrated strategy map, choose **Canvas settings → Appearance → Kingdom strategy · illustrated**. In **Object type → Kingdom strategy · settlements & resources**, choose from 24 original settlement buildings, units, trees and resources, including a town center, castle, windmill, mining camp and village worker. These use the normal object movement, size, rotation and damage controls.

For landscape areas, add **Arrow / zone → Zone / occupied area**, draw at least three corners, then choose **Properties → Landscape → Zone landscape**. Fill the zone with grassland, jungle, woodland, pine forest, mountains, hills, river water, a lake, desert, snow, marsh or farmland. Set detail density, terrain size, opacity and a seed to rearrange scenery. A **River** path remains available for narrow waterways. Landscape details are clipped to the zone and included in PNG and video exports; existing plain zones keep their appearance. This is original strategy-inspired artwork and uses no game assets.

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

Visual tokens live in `design-tokens.css`; `interface.css` applies shared controls, cards, neutral secondary actions and selection states across the homepage, editor and guide. Stroke icons live in `interface-icons.mjs`. Properties are organized into Essentials and expandable Advanced sections, and section expansion choices persist across edits within the session. Shared layer duplication/deletion live in `map-layer-actions.mjs`. Run `npm run test:map-layer-actions`, `npm run test:map-editor-consistency:browser`, and `npm run test:map-direct-edit:browser` to check the shared behavior.


Pakistan provincial detail is included in `map-data/pakistan-detail.json`. Enable Pakistan under Canvas settings ? Country details, then choose Provinces / territories. The pack contains Punjab, Sindh, Balochistan, Khyber Pakhtunkhwa, Islamabad Capital Territory, Azad Kashmir and Gilgit-Baltistan. It uses the public-domain [geoBoundaries PAK ADM1 dataset](https://www.geoboundaries.org/api/current/gbOpen/PAK/ADM1/) representing 2019; administrative and disputed boundaries follow that source. The country outline is dissolved from the same seven regions, and region keys are country-qualified so Pakistan's Punjab remains distinct from India's Punjab.


Camera movements share the permanent keyframed camera layer. Preset buttons add a linked start/end pair with the preset motion curve; they do not add timeline layers. Delete/Backspace on a camera marker, right-click ? Delete, or Properties ? Delete camera keyframe removes that key. For a preset endpoint, either deletion removes both members of its pair. Captured/manual keys remain independent, including frame zero and keys that share a frame with a preset endpoint. Saved separate camera preset layers are converted to pairs when opened. Blue markers identify paired movements; green markers are manual keys.
