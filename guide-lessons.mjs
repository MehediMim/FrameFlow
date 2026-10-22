// Keep lesson content independent of playback so the whole guide is searchable.
const lesson = (id, category, title, description, steps, coverage, demo = id) => ({id, category, title, description, steps, coverage, demo});
export const LESSONS = [
  lesson('workspace','Getting started','Meet your map studio','Build a story with layers on a map, then decide when each moment appears on the timeline.',[
    ['Add a layer','Choose a tool in the left panel. Objects, pins, highlights, shapes and effects each become a layer.'],
    ['Place it on the map','Click the map to place your new item. Select it to reveal its controls in Properties.'],
    ['Preview your story','Move the playhead or press Space. The map shows the layers visible at that moment.']
  ],['Add tools','Layers','Properties','Space to play','Load demo']),
  lesson('canvas','Getting started','Set up your canvas','Choose the format and timing before composing a landscape film, square post or vertical story.',[
    ['Open Map settings','Use Map settings above the canvas to set the project width, height and frame rate.'],
    ['Choose the format','Pick landscape, square or portrait dimensions, then set the total project duration.'],
    ['Compose your shot','Use preview zoom or Fullscreen to give yourself room to work. Preview zoom only changes your workspace view.']
  ],['Full HD','Square','Portrait','24 / 30 / 60 fps','Project duration','Preview zoom','Fullscreen']),
  lesson('styles','Map & geography','Find your map style','Give the same geography a different mood with map themes, colors and textures.',[
    ['Choose a theme','Open Map settings and choose an Earth, paper atlas, blueprint, night or documentary map style.'],
    ['Tune the details','Adjust land, water, borders and graticule styling to make your subject readable.'],
    ['Add texture','Choose a paper, film grain, linen, halftone, abstract or brush texture and adjust its strength.']
  ],['Earth vector','Natural terrain','Satellite imagery','Night','Paper atlas','Blueprint','War documentary','Textures','Vignette']),
  lesson('terrain','Map & geography','Bring the landscape to life','Use relief and light to explain why geography matters to the story.',[
    ['Enable terrain relief','Choose a relief map style in Map settings to reveal elevation and coastlines.'],
    ['Set the palette and light','Adjust elevation colors, bathymetry, sun direction and terrain shadows.'],
    ['Choose a view','Combine terrain with a camera zoom or tilt to give the audience a sense of the landscape.']
  ],['Cartographic relief','Elevation palette','Bathymetry','Sun direction','Terrain shadows']),
  lesson('places','Map & geography','Find places & local details','Move from a world view to the places and administrative boundaries your story needs.',[
    ['Find a location','Use city or country search, enter coordinates, or pick a location directly on the map.'],
    ['Load country details','In Map settings, enable the country detail packs you need and choose an administrative level.'],
    ['Work at a closer scale','Zoom in to use regional outlines and town labels. Several country packs can be enabled together.']
  ],['City search','Country search','Coordinates','Map picking','Start views','Country detail packs','Administrative levels','Town labels']),
  lesson('regions','Map & geography','Select & draw regions','Focus on existing countries and regions, or draw a custom area for your own geography.',[
    ['Select your geography','Click a region, Shift-click to extend the selection, or choose regions by search and checkboxes.'],
    ['Draw a selection area','Use an area selection to include region centers or only fully enclosed outlines.'],
    ['Create the region layer','Combine selected regions into one outline or separate items. A drawn polygon can also become a named custom region.']
  ],['Multiple regions','Area selection','Combined outlines','Separate layers','Custom polygons','Replace a selection']),
  lesson('borders','Map & geography','Trace a border','Reveal a boundary progressively so viewers can follow its shape.',[
    ['Add a Border layer','Choose a country, a region or a custom area. Use all countries for a world border sweep.'],
    ['Style the outline','Set the border color, width, glow and optional fill to suit the map.'],
    ['Control the reveal','Set the start and end of a partial border, reverse its direction, and time the reveal on the timeline.']
  ],['Country outlines','World border sweep','Partial segments','Start / end picking','Reverse direction','Glow','Fill']),
  lesson('highlights','Map & geography','Highlight what matters','Use color, flags or a radius to lead attention to a place or territory.',[
    ['Add a Highlight','Choose a country, several regions, a custom area or a place radius.'],
    ['Choose the emphasis','Set the fill color or flag image. Adjust coverage, exclusions, labels and the fill origin where available.'],
    ['Focus the audience','Add a pulse or dim the surrounding map. Fill and region text can be controlled independently.']
  ],['Color fill','Flag fill','Percentage coverage','Radius','Excluded areas','Fill origin','Region labels','Pulse','Surrounding dim']),
  lesson('pins','Map & geography','Place a pin or picture marker','Make a location recognizable with an icon, a name or your own image.',[
    ['Add a Pin / label','Click the map to set the anchor, then enter a place name or a custom label.'],
    ['Pick a marker style','Show an icon and text together, just the icon, or just text. Use an image badge for a picture marker.'],
    ['Give it movement','Use the drop entrance and location ripple, or choose movement between places on the timeline.']
  ],['Icon + text','Icon only','Text only','Image badges','Drop entrance','Location ripples','Moving pins']),
  lesson('labels','Map & geography','Write on the map','Name countries, oceans and historical territories with lettering that belongs to your scene.',[
    ['Choose your text','Use automatic atlas labels, region text or a custom Pin / label. Enter the name your story needs.'],
    ['Style the lettering','Set font, size, color, outline and spacing. Use curved lettering where appropriate.'],
    ['Choose the placement','Anchor labels geographically and adjust how they follow map tilt and rotation. Reuse a label style for consistency.']
  ],['Country names','Ocean names','Historical labels','Curved lettering','Text outlines','Spacing','Geographic anchors','Reusable styles']),
  lesson('routes','Movement','Animate a journey','Connect places and let a traveler carry the audience from one stop to the next.',[
    ['Define the journey','Select an object and choose Move to another place or Move along my path. Pick the destination or draw waypoints.'],
    ['Shape the route','Adjust the waypoints, choose smooth curves or straight segments, and set the traveler and trail.'],
    ['Time the trip','Set movement timing on the timeline. Add place labels and use a route-framing or traveler-following camera.']
  ],['Great-circle travel','Drawn paths','Waypoints','Traveler icons','Trails','Start / end labels','Visited region names','Follow traveler']),
  lesson('networks','Movement','Draw roads, railways & rivers','Build a transport network or show how a current moves through a landscape.',[
    ['Draw the network','Add an Arrow / zone layer and choose a road, railway or river. Click to draw its geographic path.'],
    ['Refine its appearance','Edit the points and adjust width, road edges, railway sleepers or river banks.'],
    ['Set the flow','Choose a static path, a progressive reveal, moving flow or both. Set speed and reverse the direction as needed.']
  ],['Roads','Railways','Rivers','Editable points','Progressive reveal','Moving flow','Speed','Reverse flow']),
  lesson('objects','Movement','Bring objects into the story','Populate the map with people, landmarks, vehicles, infrastructure and historical units.',[
    ['Choose an object','Add an Object and browse the type menu for troops, vehicles, ships, people, landmarks and more.'],
    ['Make it fit','Set color, size and rotation. Drag the anchor to move it, or use the size and direction handles.'],
    ['Animate its presence','Choose an entrance, idle and exit animation. Keep it still, move it to a place, or draw a path.']
  ],['Historic units','Modern vehicles','Ships & aircraft','Landmarks','People & occupations','Civilian infrastructure','Time props','Enter / idle / exit']),
  lesson('artwork','Movement','Use your own images & flags','Bring custom visuals into your map through artwork, image badges, portraits and hanging flags.',[
    ['Choose an image object','Select an SVG / PNG image, image badge, portrait or hanging image flag from Object types.'],
    ['Load your artwork','Use the image control in Properties and adjust size, placement and the available image settings.'],
    ['Animate the result','Move and key the object like other layers. Hanging flags add an animated wind effect.']
  ],['SVG / PNG artwork','Image badges','Portraits','Hanging image flags','Wind','Position & scale keys']),
  lesson('formations','Movement','Build an army formation','Coordinate a collection of units without placing every soldier individually.',[
    ['Choose a formation','Add an army object and select a formation or army preset.'],
    ['Mix your units','Adjust the unit types and counts to combine infantry, cavalry, artillery and other units.'],
    ['Save and move together','Save a reusable army preset, then give the formation a location, route, direction and timing.']
  ],['Mixed armies','Formation presets','Unit counts','Saved army presets','Coordinated movement']),
  lesson('groups','Movement','Move layers as a group','Keep a set of objects together while preserving each member’s own animation.',[
    ['Select several objects','Shift-click objects on the map or in Layers, then use Group or Ctrl/Cmd+G.'],
    ['Transform the group','Move, scale or rotate the group. Key position, scale, rotation and opacity on the shared group.'],
    ['Manage the members','Collapse or hide the group, duplicate it, or ungroup at the playhead with Ctrl/Cmd+Shift+G.']
  ],['Shared transforms','Group keys','Child animation','Collapsible groups','Visibility','Duplicate','Split','Ungroup']),
  lesson('walls','Movement','Build along a wall path','Lay out a defensive line with repeated structures that follow the map.',[
    ['Choose a wall object','Add a defensive structure and choose its wall-path placement mode.'],
    ['Draw the line','Pick points on the map and edit the path to follow your chosen boundary.'],
    ['Add the details','Adjust repeated structures, tower spacing and gates to create the line you need.']
  ],['Defensive structures','Wall paths','Repeated segments','Towers','Gates']),
  lesson('effects','Storytelling','Add effects & targeted attacks','Show an event at a location, or connect an attacker with a target.',[
    ['Choose an Effect','Pick an explosion, fire, smoke, shockwave, earthquake ring or danger radius.'],
    ['Set the action','For a missile or targeted volley, choose its launch/source and target. Set size, color and repeat count.'],
    ['Time the event','Place the effect bar at the event’s moment and preview it alongside the objects and camera.']
  ],['Explosions','Fire & smoke','Shockwaves','Earthquakes','Danger radii','Missile strikes','Cannon shots','Musket / arrow volleys','Repeat effects']),
  lesson('damage','Storytelling','Animate damage & destruction','Let the scene show what happens after an impact, with damage that persists over time.',[
    ['Start with a standing object','Add an object and set an earlier damage keyframe to Intact, Damaged or Burning.'],
    ['Set the destruction moment','Move the playhead and key the damage state to Destroyed. The object collapses with debris and dust over 0.9 seconds.'],
    ['Hold the aftermath','After the collapse the rubble remains. Scrub backwards to replay; an object that begins Destroyed is already settled rubble.']
  ],['Intact','Cracks','Animated flames','Smoke','Damage keyframes','Collapse','Falling debris','Dust','Persistent rubble']),
  lesson('shapes','Storytelling','Explain fronts, arrows & zones','Show direction, territory and shifting fronts with shapes on the map.',[
    ['Choose the shape','Add an attack arrow, retreat arrow, front line, occupied zone or restricted area.'],
    ['Draw and style','Click the map to define its points. Set width, color, fill, hatching and front-line teeth where available.'],
    ['Animate the change','Reveal an arrow along its path or add shape keyframes to interpolate between changing front lines.']
  ],['Attack arrows','Retreat arrows','Front lines','Occupied zones','No-fly areas','Hatching','Shape keys','Flip front teeth']),
  lesson('measurements','Storytelling','Measure a path or area','Put distance and area on screen, or resize a shape to a specific measurement.',[
    ['Draw a path or zone','Add a distance, area, arrow or zone shape and place its points geographically.'],
    ['Show the measurement','In Properties → Measurements, choose kilometres/km² or miles/mi² and show the length or area label.'],
    ['Set an exact value','Enter Length or Area and press Apply. Paths keep their first point fixed; zones resize around their center.']
  ],['Path length','Zone area','km / km²','mi / mi²','Exact resizing','Animated measurements','Exported labels']),
  lesson('camera','Storytelling','Direct the camera','Move the audience between places with deliberate pans, zooms, tilts and cinematic shots.',[
    ['Compose a view','Pan and zoom the map, set tilt and rotation, and move the playhead to the shot’s start.'],
    ['Capture or choose a preset','Use the camera capture button or choose Fly to, Swoop, Push in, Pull back, Orbit or another movement.'],
    ['Refine the shot','Set duration and easing on the camera track. Presets create paired endpoints; deleting either removes the pair.']
  ],['Manual camera keys','Fly to','Swoop','Back to start','Push in / pull back','Orbit','Tilt','Pan','Frame route','Follow traveler','Easing']),
  lesson('keyframes','Editing & delivery','Animate with keyframes','Change a property at two moments and let FrameFlow fill in the motion between them.',[
    ['Set the first pose','Select an object and set its starting size, angle and damage state at the playhead.'],
    ['Change a later pose','Move the playhead, then key a new size or rotation. Use the object keyframe controls or enable automatic keys.'],
    ['Adjust the timing','Drag keyframe diamonds on the timeline and preview. Size and angle interpolate; damage changes at its key.']
  ],['Sparse property keys','Size','Rotation','Damage states','Automatic keys','Draggable diamonds','Easing']),
  lesson('timeline','Editing & delivery','Edit your timeline','Control visibility, movement and pacing with frame-based editing.',[
    ['Arrange the layers','Move and trim timeline bars to choose when each layer is visible. Toggle visibility in Layers.'],
    ['Time the animation','Adjust animation diamonds separately from the visible bar. Use snapping and split a regular layer with S.'],
    ['Review and revise','Scrub the playhead or press Space. Use Undo / Redo to revise, and drag keys to tune the pacing.']
  ],['Playback','Scrubbing','Clip trimming','Split (S)','Snapping','Animation length','Visibility duration','Undo / redo']),
  lesson('selection','Editing & delivery','Select, edit & duplicate','Work directly on the map, whether you are editing one item or a whole selection.',[
    ['Make a selection','Click a layer on the map or in Layers. Shift-click to add or remove layers from the selection.'],
    ['Edit on the canvas','Drag to move anchors; use size and direction handles. The selection bar edits common fields and Properties holds full controls.'],
    ['Use batch actions','Right-click for Duplicate, Hide/Show or Delete. Ctrl/Cmd+D duplicates, Delete removes, and Esc clears selection.']
  ],['Multi-selection','Canvas handles','Properties','Selection bar','Context menu','Batch actions','Keyboard shortcuts','Single-step batch undo']),
  lesson('scenes','Storytelling','Add a documentary chapter','Give viewers a date, a title and the context for what they are about to see.',[
    ['Add a Scene panel','Create a scene layer and enter the year, event title and descriptive text.'],
    ['Style the chapter','Adjust typography and panel appearance. The side gradient keeps the rest of the map visible.'],
    ['Time the entrance','Place the panel beside the relevant map event and camera shot on the timeline.']
  ],['Animated year','Event title','Description','Side gradients','Typography','Scene timing']),
  lesson('audio','Editing & delivery','Bring in your soundtrack','Use reference audio to pace your story, then retain the included audio parts in the video export.',[
    ['Load reference audio','Open the audio controls and choose a local audio file to accompany the project.'],
    ['Match your timing','Preview the timeline and place camera moves, panels and effects alongside your narration or music.'],
    ['Export the film','Use Export video to render the animation with the retained audio parts. Preview the downloaded file.']
  ],['Local audio','Reference playback','Narration timing','Music','Audio in video export']),
  lesson('export','Editing & delivery','Export your finished story','Turn the composition into a video or a clean map still.',[
    ['Check the composition','Review the canvas format, frame rate and duration, then play through the finished scene.'],
    ['Choose video or still','Use Export video for a frame-by-frame WebM file, or PNG above the canvas for a snapshot.'],
    ['Download and review','Wait for rendering to finish, then open the downloaded file and check your map, labels, animation and audio.']
  ],['WebM video','PNG snapshots','Frame-by-frame render','Landscape','Square','Vertical','Audio','Export progress']),
  lesson('projects','Editing & delivery','Save & reopen your work','Keep a downloadable project backup so you can continue editing later.',[
    ['Name the project','Enter a recognizable name in the top bar. The editor also keeps a local browser save.'],
    ['Save a project file','Choose Save project to download a .framemap.json backup. Keep it with the files for your story.'],
    ['Open and continue','Choose Open and select your project file. Use Empty map to begin a new story, or Load demo to explore an example.']
  ],['Project name','Local browser save','.framemap.json','Save project','Open','Empty map','Load demo'])
];
