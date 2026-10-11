# Managed workspace font

`InterVariable.woff2` is the unmodified normal-style Inter Latin variable subset
served by Google Fonts, retrieved on October 11, 2026. The official stylesheet
declares weights 100–900. Only the Latin subset and normal style are bundled;
characters outside its coverage use the system fallback.

- Font: <https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2>
- Distribution stylesheet: <https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap>
- License source: <https://raw.githubusercontent.com/google/fonts/main/ofl/inter/OFL.txt>
- Font size: 48,256 bytes.
- Font SHA-256: `3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62`.
- License size: 4,377 bytes.
- License SHA-256: `5b9321a4298cfeb6b34354164a1c3afc3db114569984c502b9b35d988fd58c57`.

Keep the distribution's coverage declaration on the local `@font-face`:

```css
unicode-range:
  U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304,
  U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215,
  U+FEFF, U+FFFD;
```

The complete Google Fonts distribution's [SIL Open Font License 1.1](OFL.txt),
including its 2020 Inter Project Authors copyright notice, is retained unchanged.
Keep that notice with distributed copies and available in the client's Software
licenses view.

Load the bundled file through a managed-only font-family name, with system
sans-serif fallbacks and `font-display: swap`. Do not add a runtime font CDN
request, change the local profile's font selection, install the font on the host,
further subset it or silently replace its bytes.
