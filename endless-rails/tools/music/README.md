# Music files

The game plays prepared music files: `src/music/*.ogg` (Ogg Opus, 48 kHz stereo, ~128 kbit/s). Nothing is synthesized
while the game runs. The Android build copies them to `assets/music/` (Gradle task `generateGameAsset`,
`android/tools/make_asset.py` for the test APK).

| file | title | length | source |
|---|---|---|---|
| `theme.ogg` | Endless Rails (main theme, default music) | 75.000 s (30 bars, 96 BPM) | `theme_source.js` — the composition code as written by the game's author |
| `drift.ogg` | Ambient Drift | 71.111 s (16 bars, 54 BPM) | `legacy_tracks.js` |
| `lofi.ogg` | Lo-fi Station | 77.838 s (24 bars, 74 BPM) | `legacy_tracks.js` |
| `night.ogg` | Midnight Synth | 76.364 s (28 bars, 88 BPM) | `legacy_tracks.js` |
| `cine.ogg` | Horizon | 66.207 s (16 bars, 58 BPM) | `legacy_tracks.js` |

All tracks are original music made for Endless Rails (no third-party material), so there are no licence restrictions
from outside sources.

## Seamless loops
Each track is rendered offline for its loop length plus a tail (note releases, reverb, echoes). The tail is added onto
the beginning of the loop, so the file played in a loop sounds exactly like the music going on. Chromium decodes Ogg Opus
sample-exactly (pre-skip and end trimming are applied: a test impulse at sample 1000 decodes at sample 1000, and the
decoded lengths equal the rendered lengths), so the player just loops the whole buffer. All tracks are scaled to the same
loudness (−20 dBFS RMS, peaks below −1 dBFS).

## Regenerating
```
cd endless-rails/tools/music
node render.js            # needs Playwright (Chromium) and ffmpeg with libopus; writes ../../src/music/*.ogg
```
`music.json` records the length in samples, loudness, peak and size of each file.
