# Web editor

A web UI to edit the presets of the DNAfx GiT, on top of the HTTP/WebSocket API
of `dnafx-editor`. It's a static page (no build step, no dependencies): start the
editor as a backend, then open `index.html` in a browser.

```
./dnafx-editor -H 8000
```

By default the page connects to `ws://<host>:8000/` (`ws://127.0.0.1:8000/` when
opened as a file): this can be changed in the settings, or with `?ws=...` in the URL.

## Features

- List of the presets on the device; clicking one selects it on the device too.
- The 9 blocks of the effect chain, with their on/off state (double click to toggle),
  the list of effects of each block, and knobs for their parameters (drag, mouse
  wheel, arrows, or double click to type a value).
- Renaming presets, and sending them to the device, manually or automatically
  after each change.
- Before a preset is overwritten for the first time, the version on the device
  is saved (binary) in a folder on the backend side (`backups` by default,
  relative to the folder the editor runs in; it must exist).
- Import/export of the preset being edited as `.phb`.
- Export of all presets as a `.zip` (`.phb` and binary `.bhb` files), import of
  many presets at once (`.zip`, `.phb`, `.bhb`; the slot comes from the number
  the file name starts with, e.g., `015-BLACKNIGHT.phb`).
- The initial configuration of the device is captured the first time (and kept
  in the browser), so that a preset, or all of them, can be restored later.
- Drag and drop in the list of presets swaps them (copies with Ctrl).

## Notes

- The UI is in English, and is translated automatically when the browser uses a language
  there are translations for (only French, for now: see `i18n.js`). Use `?lang=xx` in the
  URL to force a language.
- The ranges of the parameters that don't go from 0 to 100 were guessed from the
  factory presets, and are marked with a `?`: they need checking.
