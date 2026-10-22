// One stroke-based icon family for editor actions and guide playback.
const paths = {
  firstFrame:'<path d="M5 4v16m14-16L8 12l11 8Z"/>',
  previousFrame:'<path d="m15 5-7 7 7 7"/>',
  nextFrame:'<path d="m9 5 7 7-7 7"/>',
  lastFrame:'<path d="M19 4v16M5 4l11 8-11 8Z"/>',
  loop:'<path d="M19 7H7a4 4 0 0 0-4 4m13-7 3 3-3 3M5 17h12a4 4 0 0 0 4-4M8 14l-3 3 3 3"/>',
  audio:'<path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>',
  scene:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h6M7 16h8"/>',
  border:'<path d="m4 8 5-4 6 3 5-1-1 12-7 2-7-4Z" stroke-dasharray="3 3"/>',
  highlight:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  pin:'<path d="M18 9c0 5-6 11-6 11S6 14 6 9a6 6 0 1 1 12 0Z"/><circle cx="12" cy="9" r="2"/>',
  object:'<path d="m12 3 8 5v8l-8 5-8-5V8Zm0 9 8-4M4 8l8 4v9"/>',
  effect:'<path d="m13 2-8 12h6l-1 8 9-13h-7Z"/>',
  shape:'<path d="M3 19c5 0 4-11 10-11h7m-5-5 5 5-5 5"/>',
  keyframed:'<path d="m12 3 8 9-8 9-8-9Z"/>',
  flyTo:'<path d="M4 5c11 0 4 14 15 14m-5-5 5 5 2-7"/>',
  swoop:'<path d="M4 17C1 5 19 1 20 11c0 6-8 9-10 4m5 0h-5v5"/>',
  worldView:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  pushIn:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M7 10h6m-3-3v6"/>',
  pullBack:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M7 10h6"/>',
  orbit:'<circle cx="12" cy="12" r="3"/><path d="M20 10C17 0 2 4 3 13c0 7 13 11 18 2m-1-9v4h-4"/>',
  tilt:'<path d="m3 17 6-9 12 4-6 9ZM12 3v3m-3-1 3-2 3 2"/>',
  panTo:'<path d="M3 12h18m-5-5 5 5-5 5M8 7l-5 5 5 5"/>',
  framePlane:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5M7 16l10-8m-5 0h5v5"/>',
  followPlane:'<path d="m5 12 15-8-6 16-2-7Zm-3 6h5m-3 3h5"/>',
  play:'<path d="m8 4 12 8-12 8Z"/>',
  pause:'<path d="M8 4v16M16 4v16"/>',
  replay:'<path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/>'
};
export function interfaceIcon(name) {
  return `<svg class="ff-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.object}</svg>`;
}
