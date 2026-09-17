# h2dev_flow

## Project Shape

- This is a plain Manifest V3 Chrome extension loaded unpacked; there is no build step, package manager, test runner, or linter.
- `manifest.json` is the runtime entry-point map and permission contract. Keep permissions and host matches minimal and update them when behavior changes.
- `sidepanel.js` owns the queue, settings persistence, Flow-tab selection, image downloads, and user-facing run/stop state.
- `content.js` owns Google Flow DOM integration: prompt and Generate discovery, image completion polling, stop handling, and blob-to-data-URL conversion.
- `background.js` owns the `chrome.debugger` lifecycle and CDP keyboard input. Keep debugger attach/detach and single-tab tracking here.
- `sidepanel.html` and `sidepanel.css` define the Vietnamese side-panel UI; preserve the existing DOM ids used by `sidepanel.js`.

## Working Rules

- Use plain browser JavaScript with `const`/`let`, semicolons, two-space indentation, and small local helpers. Match the existing Vietnamese UI text and `[h2dev_flow]` console-log prefix.
- Keep Flow-specific selectors and timing values in the `CONFIG` object at the top of `content.js`. Prefer defensive fallback detection because Google can change the Flow DOM.
- Preserve the message boundaries: side panel -> content script for page inspection/waiting, side panel -> service worker for downloads, and side panel -> background debugger for real input.
- Validate message payloads and tab ownership when adding new message types. The debugger implementation supports one attached Flow tab and currently selects the first matching tab.
- Do not assume synthetic DOM input is equivalent to real input: Flow's Slate editor depends on actual keyboard input through `chrome.debugger`.
- Do not add dependencies or generated build output without first establishing a project build strategy.

## Validation

- Read [README.md](README.md) for installation, usage, known limitations, and selector repair steps before changing Flow automation.
- After source changes, reload the unpacked extension from `chrome://extensions`, open one Google Flow tab, and run a small batch.
- Close DevTools on the Flow tab before testing debugger input, leave Chrome's debugger warning bar active, and inspect the extension/service-worker and Flow console logs for `[h2dev_flow]` messages.
- Check both a successful download and Stop behavior. For image-detection changes, test existing images, a newly rendered image, timeout behavior, and `blob:` results when available.

## Documentation Map

- [README.md](README.md): setup, usage, limitations, repair instructions, and file structure.
- [manifest.json](manifest.json): permissions, host access, and runtime registrations.
- [content.js](content.js): Flow selectors, timing configuration, DOM automation, and image detection.
- [sidepanel.js](sidepanel.js): queue orchestration, persistence, tab selection, downloads, and stop behavior.
- [background.js](background.js): debugger attach/detach and CDP input.