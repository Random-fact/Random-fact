# ENDLESS RAILS — translation brief

`source_uk.json` is the list of every user-visible string of the game, in Ukrainian (the source language).
Each target language lives in `<code>.json`: a JSON **object** whose keys are exactly the Ukrainian source
strings and whose values are the translations. `tools/build_i18n.py` merges them into `src/game.html`.

Languages: `en` English, `ru` Русский, `zh` 简体中文, `ro` Română, `pt` Português (Brasil), `es` Español,
`fr` Français, `de` Deutsch, `ja` 日本語 (Ukrainian is the source, it needs no file).

## The game
A calm, realistic train-driving simulator with an endless procedurally generated world: double-track main line,
stations 6–100 km apart, signals, speed limits, ATP (automatic train protection), weather, day/night, rare natural
and sky events (rocket launches, aurora, volcano…), a driver-training mode with six lessons about braking physics,
a schedule mode and a precise-stop challenge. Tone: friendly, clear, professional; never slangy.

## Hard rules
1. Keep every placeholder `{0}` `{1}` `{2}` `{3}` `{4}` exactly once each, as in the source; you may reorder them.
2. Keep emoji, arrows and symbols (`·` `▼` `▲` `↑` `≈` `±` `—` `–` `%`), numbers, keyboard letters (H, L, K, X, J), and "Wi‑Fi", "FPS", "HS", "AdMob", "Google", "three.js", "MIT".
3. ALL‑CAPS source → ALL‑CAPS translation in languages that have letter case (en, ru, ro, pt, es, fr, de). zh/ja: normal text.
4. Short UI labels (buttons, tabs, table headers, departure-board columns, cab-display texts) must stay short —
   roughly the length of the English word. Board column headers ≤ 10 characters; `ВАШ` (the player's train in the
   train-number column of a departure board) ≤ 5 characters (en `YOU`).
5. Units: км → km, км/год → km/h, м → m, м/с² → m/s², бар → bar, с → s (seconds), хв → min, т → t (tonnes), кН → kN, кВ → kV, тис. → thousand abbreviation of the language (en `k`).
   ru keeps Cyrillic units (км, км/ч, м, бар, с, мин, т, кН, кВ, тыс.). zh: 公里, 公里/小时, 米, 巴, 秒, 分钟, 吨, 千牛, 千伏, 千 (or km/h style if clearer on small displays: use `km/h` only in ALL-CAPS cab display strings). ja: km, km/h, m, bar, 秒, 分, t, kN, kV, 千.
6. Typographic quotes of the language: en “…”, de „…“, fr « … » (with narrow spaces), es/pt «…» or “…”, ro „…”, ru «…», zh “…”, ja 「…」.
7. Output must be valid JSON (UTF‑8, no comments, no trailing commas), same key set as `source_uk.json`, no empty values.

## Glossary (use these consistently; on-screen button names that appear inside lesson texts MUST match the button translations)
| Ukrainian | English | meaning |
|---|---|---|
| ТЯГА / тяга | THROTTLE / throttle (power) | traction lever |
| ГАЛЬМО / гальмо | BRAKE / brake | train brake lever |
| Сигнал | Horn | button: sound the horn |
| Фари | Lights | button: headlights |
| Двірники | Wipers | button: windscreen wipers |
| Камера | Camera | button |
| Екстрено / екстрене гальмування | Emergency / emergency braking | button / emergency brake application |
| Меню | Menu | button |
| Реверс | Reverse | change direction (only when stopped) |
| службове гальмування | service braking | normal brake application (50% = half service) |
| ТИСК / тиск у гальмівній магістралі / Магістраль | PRESSURE / brake-pipe pressure / Brake pipe | in bar; 5.0 bar = released |
| АЗШ | ATP | automatic train protection (keep the language's usual abbreviation if one exists, else "ATP") |
| ступінчаста / плавна тяга | notched / continuous throttle | |
| склад, вагонів | consist / train, cars (coaches) | |
| мітка зупинки (жовто-чорна) | stop mark (yellow-and-black) | board on the platform where the train front must stop |
| перон, платформа | platform | |
| колія (номер) | track (number) | "з колії 2" = from track 2 |
| стрілка, розвилка | switch (points), junction | |
| Помічник гальмування | Braking assistant | HUD panel |
| Ідеальна / Відмінна / Хороша / Погана зупинка; Перон пропущено | Perfect / Excellent / Good / Poor stop; Platform missed | stop grades |
| Додатково | Extras | menu section with optional rewarded-ad unlocks |
| Подорож | Journey | |
| Вільна подорож | Free ride | mode |
| Розклад | Schedule | mode |
| Мальовнича подорож | Scenic journey | mode |
| У кабіні | Cab ride | mode |
| Фоторежим / Фото-режим | Photo mode | mode / camera |
| Точна зупинка | Precise stop | challenge mode |
| Режим подій (пісочниця) | Event mode (sandbox) | mode |
| Навчання машиніста | Driver training | menu section |
| Поїзд «Класик» / КЛАСИК | “Classic” train / CLASSIC | translate the word Classic (de Klassik, fr Classique, es Clásico, pt Clássico, ro Clasic, ru Классик, zh 经典, ja クラシック) |
| «Стріла HS» / СТРІЛА HS | “Strela HS” / STRELA HS | product name: keep Latin "Strela HS" (ru «Стрела HS») |
| ліврея / розфарбування | livery | |
| АЗШ: вимк / попер. / авто | ATP: off / warn / auto | short |
| реклама, рекламне відео | ad, video ad (rewarded) | voluntary rewarded video |

Ad/privacy texts (`Політика конфіденційності`, `PRIVACY…`, reward/consent strings) are user-facing legal
information: translate them accurately and completely, without adding or removing claims.
