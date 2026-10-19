# Frontend configuration

The frontend uses Vite's build-time environment variables. Copy `.env.example`
to `web/.env.local` and set `VITE_TLDRAW_LICENSE_KEY` to configure the Whiteboard
editor's tldraw SDK license. Leave it empty when no key is available; the editor
passes `undefined` to tldraw. Local environment files are ignored by Git.

Restart the Vite development server after changing the key. For production,
set the variable in the build process environment or in `web/.env.local` before
running `pnpm build` or `pnpm release` from `web/`. Release builds use Vite mode
`release`, so a mode-specific file must be named `.env.release.local`.

`scripts/build-local-image.sh` runs the frontend release build on the host before
building the Docker image. It inherits exported environment variables, and Vite
also reads `web/.env.local`. `scripts/Dockerfile` embeds the previously built
`server/frontend/dist` assets; it does not build the frontend. Set the key before
that frontend build, rather than as a Docker build argument or container runtime
variable. Changing the key requires rebuilding the frontend and the image.

For CI builds, supply `VITE_TLDRAW_LICENSE_KEY` in the environment of the frontend
`pnpm release` step. The existing release and canary workflows build frontend
artifacts before packaging binaries and Docker images; a GitHub repository
variable alone is not automatically passed to that step.

The key is public frontend configuration and is included in browser assets. Do
not commit a real key or expose backend secrets through `VITE_*` variables.

## Whiteboard preferences

Whiteboard title, tags, save status, background, and local settings appear in the
main Memos sidebar. The centered arrow collapses/expands it on Whiteboard routes;
mobile continues to use the navigation drawer.

Toolbar and color/style panel positions are stored as JSON strings under
`memos-whiteboard-toolbar-position` (default `bottom`) and
`memos-whiteboard-style-panel-position` (default `right`). Both support `top`,
`bottom`, `left`, and `right`. Choosing the same edge groups them in one dock.
Narrow screens retain tldraw's native color popover.

The [Writing Pen](src/components/Whiteboard/writingPen/README.md) has a separate
local profile. These preferences stay in the browser; the selected background
layout belongs to the board and is saved through the Whiteboard API.
