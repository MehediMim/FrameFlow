/** Build a self-contained authoring prompt from the same guide/catalogue used by the app. */
export function buildStoryboardAIPrompt({guide,reference,example}){
  return `Write a complete, importable FrameFlow storyboard JSON using the story brief below and the full documentation included in this message.

MY STORY BRIEF — replace the bracketed text before sending:
[Paste my story, narration or research here. Include total video duration, dates, locations, events, sides/forces, troop counts, and the intended outcome.]
Desired presentation: [cinematic map documentary; canvas size; FPS; map source/era; colors; camera style; object size changes; labels; effects]
Available supporting files: [list exact image/audio filenames, their purpose, and audio source lengths; or say none]
Existing map script to preserve, if any: [attach an exported current-map script or say none]

YOUR TASK AND OUTPUT CONTRACT
1. Read the entire brief, format guide, option reference, and example. Use all relevant FrameFlow capabilities to tell my story: cameras, movement, resizing, groups, formations, attacks, damage, front lines, conquest, paths, lighting, landscapes, labels, panels, images, and audio. The full feature set is available; do not force unrelated features into a story. If I request a feature showcase, demonstrate the toolkit categories within the editor's limits.
2. If essential story facts or duration are missing, ask concise questions. Do not invent historical facts, unsupported property names, IDs, map territories, or available media. Use explicit coordinates for places absent from the built-in names. Uploaded filenames must match the files I actually have.
3. Once sufficient information is available, return ONE valid JSON object ready to save as a .json file. No JavaScript, comments, ellipses, trailing commas, Markdown fences, or prose outside the JSON. Supply actual scene/action instructions: narration alone is not an executable command.
4. Match the requested duration exactly. Cover the video clock deliberately; order scenes by start time, fit actions and keys inside their scene/action, and avoid conflicting camera directions. Storyboard start/end/at values use absolute video seconds or timestamps, including keys inside scenes. Native layers, cameraTracks, and native *Keys arrays use integer FRAME numbers. Do not mix these clocks. Use FPS 24, 30, or 60.
5. Use root and action fields exactly as listed in reference.format. Put layer-specific properties in action.options. reference.project is a NATIVE example: inside the storyboard project block use only reference.format.projectSettings. Put name, fps, and duration at the root; put native actions in layers and native shots in cameraTracks. Do not put native frames/actions/shots inside project.
6. Prefer explicit type: custom scenes with actions for complex choreography, so shorthand does not accidentally create duplicate units or effects. Use stable unique action IDs for groups and linked attacks. Group memberIds must refer to real object IDs; an object belongs to at most one group. Keep the full story within 100 scenes, 200 map layers, and the editor's other documented limits. Visible object count is at most 100; use troopCount as a label for a larger real force.
7. Keep the map visually active where appropriate: continuous zoom/pan, follow shots, orbit/tilt, moving units, sizeFrom/sizeTo or size keys, attacks, and changing paths/lighting. Use deliberate holds only when they serve the story. Follow mode spans its scene and does not accept duration or a destination. Use camera.keys, camera.preset with native options, or cameraTracks for precise direction. Do not combine incompatible camera forms.
8. Honor explicit colors, sizes, object views, fonts, borders, fills, visibility, and stacking. Use only valid enum values from the catalogue. Defaults are examples, not instructions to place every default field on every layer. All native fields remain available through layers/cameraTracks for exact editor control, including split source clocks and paired camera samples.
9. Do not claim narration is automatically voiced. Use the audio list only for supplied source files, with correct trim offsets and source/video bounds. Use asset:filename image references only for supplied supporting files; I will select those files in the importer. Omit audio to preserve existing session clips; [] clears them. Audio buffers are session-only.
10. Check the final JSON against the guide, allowed fields, enum IDs, numeric limits, time bounds, group/attack references, camera rules, source-file requirements, and total layer count before returning it. I will run Preview storyboard in FrameFlow before building.

COMPLETE FRAMEFLOW STORYBOARD FORMAT GUIDE
${guide.trim()}

COMPLETE EDITOR PROPERTY / ID / DEFAULT REFERENCE (JSON)
${JSON.stringify(reference,null,2)}

VALID FULL-CONTROL WORKED EXAMPLE (JSON; fictional events, replace with my brief)
${JSON.stringify(example,null,2)}

Now use MY STORY BRIEF above to produce the storyboard. If the bracketed brief has not been filled in, ask me for the story and total video duration first.
`;
}

export function storyboardGuideText(html){
  return html.replace(/<(script|style|nav)\b[^>]*>[\s\S]*?<\/\1>/gi,'')
    .replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/(?:p|h[1-6]|pre|tr|li|section|div)>/gi,'\n\n')
    .replace(/<\/(?:td|th)>/gi,' | ').replace(/<[^>]+>/g,'')
    .replace(/&#(x[0-9a-f]+|\d+);/gi,(_,value)=>String.fromCodePoint(value[0].toLowerCase()==='x'?parseInt(value.slice(1),16):Number(value)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g,(_,key)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[key])
    .replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
