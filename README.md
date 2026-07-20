# adapt-authoring-coursetheme

Manages per-course theming for the Adapt authoring tool — the theme settings and customisations applied when a course is built.

Extends `AbstractApiModule` from [adapt-authoring-core](../adapt-authoring-core).

## Theme customiser support

A client (e.g. the UI's theme customiser panel) can fetch a theme's variable schema to render an editor for it:

```
GET /api/coursethemepresets/theme-schema/:themeName   (scope: read:content)
```

`:themeName` is the theme plugin's folder name (the config's `_theme`, e.g. `adapt-contrib-vanilla`). The handler reads that theme's `theme.schema.json` straight from the framework source (`<frameworkDir>/src/theme/<themeName>/schema/theme.schema.json`) — theme schemas, unlike core schemas, are not registered with the `jsonschema` module — and returns it verbatim (404 `NO_SCHEMA_DEF` if absent). Values edited against it are saved to the course document's `themeVariables`; an **empty** value is omitted at build time, so the theme's own LESS default applies.

### Optional editor metadata

A theme's `theme.schema.json` may carry extra, build-safe metadata that richer editors read (plain JSON Schema ignores it, so builds and validation are unaffected):

- A top-level `_themeEditor` block: `{ baseTheme, brand: [<leafKey>…], categories: [{ key, title, order }] }` — `brand` is the ordered set of "driver" colours; `categories` are the editor's filter groups.

Preset `displayName` is enforced **unique per `parentTheme`** (case-insensitive, whitespace-trimmed) on create and rename; a clash throws `COURSETHEMEPRESET_NAME_EXISTS` (400). Different themes may reuse the same preset name. This is backed by a compound **unique index** on `{ parentTheme, displayName }` with a case-insensitive collation (`{ locale: 'en', strength: 2 }`) as the DB-level guarantee. (Index creation is guarded: on a DB with pre-existing duplicates it logs a warning instead of failing boot — dedupe, then it builds on next start.)
- Per-variable `_adapt`: `{ inputType: "ColourPicker", category, row, slot, order, derive?, contrast? }` — `row`+`slot` cluster related variables (e.g. default/inverted) onto one editor row; `derive` (`{ from, transform, amount }`) is a display-only hint for the AUTO value; `contrast` (`{ against, text? }`) declares a known foreground↔background pair for optional WCAG checks.
