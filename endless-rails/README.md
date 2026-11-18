# ENDLESS RAILS

Endless train-driving game in one HTML5/WebGL page (three.js r128) plus its music files.

| Path | What |
|---|---|
| `src/game.html` | the complete game (all code, styles and the 10 languages) — serve the `src/` folder over http(s) or wrap it (see `../android`); opened as a local file the game runs without music |
| `src/music/` | the music: prepared seamless loops (Ogg Opus) loaded by the game; `music.json` lists lengths and loudness |
| `tools/music/` | `render.js` + `render.html` re-render the music files from their composition code (`theme_source.js`, `legacy_tracks.js`); see its README |
| `i18n/` | translation catalogue: `source_uk.json` (609 Ukrainian source strings) and `<lang>.json` per language, `TRANSLATOR_BRIEF.md` (rules + glossary), `check.py` (validator) |
| `tools/build_i18n.py` | merges the translations into `src/game.html` — run it after editing any `i18n/*.json` |
| `docs/` | `TEST_REPORT.md`, `GOOGLE_PLAY_CHECKLIST.md`, `privacy-policy.html` (fill in and host before publishing) |

Adding or changing a text: write the Ukrainian string in the code through `_T('…')` (or `data-t` in HTML), add it to
`i18n/source_uk.json` and every `i18n/<lang>.json`, run `python3 i18n/check.py en ru zh ro pt es fr de ja` and
`python3 tools/build_i18n.py`. Missing translations fall back to English, then to the source.
