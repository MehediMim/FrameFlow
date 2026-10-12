# FrameFlow Motion Studio

A browser based motion graphics editor with a frame timeline, transform keyframes, easing, layers, playback, and video export. Plain HTML, CSS, and JavaScript; no build step, backend, API key, or paid service is required.

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
