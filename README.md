# Hamilton property zoning

A static web app: no build step, no server code. It reads City of Hamilton and Ontario GIS services directly from the browser.

## Put it online
Upload this whole folder to any static host. The simplest options:
- **Netlify**: drag the folder onto app.netlify.com/drop. You get an https link in under a minute.
- **GitHub Pages**: push the folder to a repository, then Settings > Pages > deploy from the main branch.
- **Cloudflare Pages / Vercel**: connect the repository, no build command, output directory `/`.

It must be served over https. Opening `index.html` from disk also works for trying it out.

## Layout
- `index.html`: page structure and script order
- `css/tokens.css`: Vanderlinde colours, fonts and radii (light and dark)
- `css/layout.css`: top bar, panel, tabs, viewports
- `css/components.css`: lists, tags, buttons, overlays
- `js/config.js`: service URLs, By-law 05-200 zones and dwelling types
- `js/gis.js`, `js/lookup.js`: network calls, address search, parcel lookup
- `js/lot.js`, `js/buildings.js`: lot lines, setbacks, envelope, existing building checks
- `js/law.js`, `js/provisions.js`: applicable law review and Section 4 rules
- `js/sidebar.js`, `js/tabs.js`: panel rendering and tabs
- `js/plan.js`, `js/map.js`, `js/scene3d.js`: plan, map and 3D views
- `js/report.js`: PDF letter and Word export
- `js/app.js`: render loop, theme, startup

To change a zoning rule, edit `js/config.js`. To change the look, edit `css/tokens.css`.
