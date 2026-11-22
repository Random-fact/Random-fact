// usage: node soak_report.js <before agg.json> <after agg.json> <out.html>
const fs = require('fs');
const B = JSON.parse(fs.readFileSync(process.argv[2])), A = JSON.parse(fs.readFileSync(process.argv[3])), out = process.argv[4];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => n == null ? '—' : Number(n).toLocaleString('uk-UA');
const EV_UK = { birds: 'Зграя птахів', roadworks: 'Ремонт колії', freight: 'Довгий вантажний потяг', express: 'Швидкісний експрес', retro: 'Ретро-потяг', rainbow: 'Веселка', aurora: 'Полярне сяйво', meteors: 'Метеорний потік', fireball: 'Яскравий болід', hail: 'Град', dust: 'Пилова буря', wildfire: 'Лісова пожежа', tornado: 'Торнадо', landslide: 'Зсув', rockfall: 'Каменепад', avalanche: 'Лавина', quake: 'Землетрус', tree: 'Повалене дерево', festive: 'Святкова станція', fireworks: 'Святковий феєрверк', airshow: 'Авіашоу', balloons: 'Повітряні кулі', meteorite: 'Падіння метеорита', eclipse: 'Сонячне затемнення', rocket: 'Старт ракети', volcano: 'Виверження вулкана', tsunami: 'Цунамі' };
const SYS_UK = { 'World generation': 'Генерація світу', 'Events': 'Події', 'AI trains': 'Інші потяги', 'Road traffic': 'Автомобілі', 'Stations and passengers': 'Станції й пасажири', 'Cameras': 'Камери', 'Station cat': 'Кіт на станції', 'Audio': 'Звук', 'Interface': 'Інтерфейс', 'Weather, sky, light': 'Погода, небо, світло', 'Train, physics, signals': 'Потяг, фізика, сигнали', 'Saves and profile': 'Збереження й профіль', 'Animals': 'Тварини й птахи', 'three.js (engine)': 'Графічний рушій', 'Other (unknown)': 'Браузер (без місця в коді)' };
const SYS_ORDER = ['World generation', 'Events', 'Stations and passengers', 'AI trains', 'Road traffic', 'Train, physics, signals', 'Cameras', 'Weather, sky, light', 'Station cat', 'Animals', 'Audio', 'Interface', 'Saves and profile', 'three.js (engine)', 'Other (unknown)'];
const inv = (R, name, id) => { const v = R.invariants[name]; if (!v) return 0; return id ? (v.by[id] || 0) : v.n; };
const evp = (R, id) => R.events[id] || { started: 0, place: {} };
/* the bugs the soak found, with the "before" numbers taken from the first run and the "after" from the second */
const camB = k => inv(B, 'camera below the ground', k), camA = k => inv(A, 'camera below the ground', k);
const slideB = ['rockfall', 'landslide', 'avalanche'].reduce((a, k) => a + (evp(B, k).place.track || 0) + (evp(B, k).place.bed || 0), 0), slideRunsB = ['rockfall', 'landslide', 'avalanche'].reduce((a, k) => a + (evp(B, k).place.checked || 0), 0);
const slideA = ['rockfall', 'landslide', 'avalanche'].reduce((a, k) => a + (evp(A, k).place.track || 0) + (evp(A, k).place.bed || 0), 0), slideRunsA = ['rockfall', 'landslide', 'avalanche'].reduce((a, k) => a + (evp(A, k).place.checked || 0), 0);
const roErrB = B.errors.filter(e => /ResizeObserver/.test(e.msg)).reduce((a, e) => a + e.n, 0), roErrA = A.errors.filter(e => /ResizeObserver/.test(e.msg)).reduce((a, e) => a + e.n, 0);
const tB = evp(B, 'tree'), tA = evp(A, 'tree'), rB = evp(B, 'roadworks'), rA = evp(A, 'roadworks');
const trackA = inv(A, 'track geometry broken (line winds into loops)');
const BUGS = [
  { sys: 'Генерація світу', name: 'Колія позаду точки старту закручувалась у вузли', why: 'Поправка, що тримає напрям колії рівним, при побудові колії назад від точки старту мала той самий знак, що й уперед, і розгойдувала напрям за експонентою: на −20 км колія вже робила 2–3 повні оберти, на −40 км закручувалась у петлі розміром кілька метрів. Туди потрапляє гравець, що розвернув потяг і їде назад за точку старту.', fix: 'Позаду точки старту поправка має протилежний знак. Колія попереду точки старту не змінилась, тож світи наявних збережень ті самі.', b: 'напрям колії на −40 км: 260–1380 рад (має бути до ±1); світ із розворотом у 1-му прогоні 99 % часу їхав такою колією', a: `${trackA} випадків; напрям на −40…−150 км у межах ±1 рад`, bad: 1, good: trackA },
  { sys: 'Події', name: 'Повалене дерево лежало поперек колії', why: 'Стовбур малювався від точки за 12 м від колії назад, через обидві колії (циліндр рушія росте від основи в протилежний бік). Ще й висота бралася від рейок, а не від землі.', fix: 'Корінь за ~25 м від колії, верхівка за 9,5 м від крайньої рейки, дерево лежить на землі; місце обирається подалі від переїздів, доріг, стрілок, мостів, тунелів і станцій.', b: `${tB.place.track || 0} на рейках + ${tB.place.bed || 0} на баласті з ${tB.place.checked || 0}; ${inv(B, 'fallen tree mostly under the ground')} у землі`, a: `${(tA.place.track || 0) + (tA.place.bed || 0)} з ${tA.place.checked || 0}; найближче ${tA.place.minRailMin ?? '—'} м від рейки`, bad: (tB.place.track || 0) + (tB.place.bed || 0), good: (tA.place.track || 0) + (tA.place.bed || 0) },
  { sys: 'Події', name: 'Ремонт колії: робітники й конуси на сусідній колії', why: 'Розставлялися за 3,4–5,4 м по обидва боки, як для однієї колії; з боку другої колії це прямо на її рейках, де їздять інші потяги.', fix: 'З того боку все стоїть за другою колією; техніка вирівняна по лінії і стоїть на землі.', b: `${rB.place.track || 0} з ${rB.place.checked || 0}`, a: `${rA.place.track || 0} з ${rA.place.checked || 0} (конуси й ліхтарі на узбіччі, ${rA.place.minRailMin ?? '—'} м від рейки)`, bad: rB.place.track || 0, good: rA.place.track || 0 },
  { sys: 'Події', name: 'Зсув, каменепад, лавина: камені пролітали крізь колії', why: 'Крива руху закінчувалася на 1,8 замість 1, тож кожен камінь пролітав на 80 % далі за точку зупинки: через обидві колії в землю з іншого боку. З боку другої колії точка зупинки була за 3,4 м від неї.', fix: 'Плавна крива, що закінчується точно на місці; камені зупиняються за 9,5–20 м від колії з будь-якого боку, на землі.', b: `${slideB} з ${slideRunsB} (виміряно на рейках/баласті в кінці; пролітали всі)`, a: `${slideA} з ${slideRunsA}`, bad: slideB, good: slideA },
  { sys: 'Камери', name: 'Камера «Кінець складу» під землею', why: 'Її, на відміну від інших зовнішніх камер, ніщо не тримало над землею: на кривих у виїмках точка за 11,5 м позаду складу опинялася в схилі.', fix: 'Камера тримається над землею; пошук землі ведеться від хвоста складу.', b: `${camB('rear')} випадків`, a: `${camA('rear')} випадків`, bad: camB('rear'), good: camA('rear') },
  { sys: 'Камери', name: 'Кінематографічна, фото й вільна камери іноді під землею', why: 'Перевірялася лише кінцева точка кадру, а плавний шлях до неї міг пройти крізь пагорб; пошук землі сягав лише ±290 м, менше за довгий склад разом із відстанню вільної камери.', fix: 'Висота перевіряється на всьому шляху; пошук землі сягає ~1,1 км.', b: `${camB('cine') + camB('photo') + camB('orbit')} випадків`, a: `${camA('cine') + camA('photo') + camA('orbit')} випадків`, bad: camB('cine') + camB('photo') + camB('orbit'), good: camA('cine') + camA('photo') + camA('orbit') },
  { sys: 'Інтерфейс', name: 'Помилка браузера «ResizeObserver loop»', why: 'Під час зміни мови й розкладки панелі змінювали розмір прямо всередині спостерігача розміру, і браузер повідомляв про помилку.', fix: 'Розкладка оновлюється в наступному кадрі.', b: `${roErrB} разів`, a: `${roErrA} разів`, bad: roErrB, good: roErrA },
];
const sysRows = SYS_ORDER.map(k => ({ k, b: B.bySystem[k] || {}, a: Object.assign({}, A.bySystem[k] || {}) }));
/* the roadworks cones and lamps on the ballast shoulder (2 m from the rail) are intended, not a fault */
{ const ev = sysRows.find(r => r.k === 'Events'); if (ev && ev.a.invariants) ev.a.invariants -= inv(A, 'event object on the track bed (ballast)', 'roadworks'); }
const totErr = R => R.errors.filter(e => !/warn/.test(e.kind)).reduce((a, e) => a + e.n, 0), totWarn = R => R.errors.filter(e => /warn/.test(e.kind)).reduce((a, e) => a + e.n, 0);
const realInvA = Object.entries(A.invariants).filter(([k]) => !/ballast/.test(k)).reduce((a, [, v]) => a + v.n, 0);
const ids = Object.keys(EV_UK);
const spark = (arr, w = 120, h = 26) => { arr = (arr || []).filter(x => x != null); if (arr.length < 2) return ''; const lo = Math.min(...arr), hi = Math.max(...arr), sx = w / (arr.length - 1), sy = hi > lo ? (h - 4) / (hi - lo) : 0; const pts = arr.map((v, i) => `${(i * sx).toFixed(1)},${(h - 2 - (v - lo) * sy).toFixed(1)}`).join(' '); return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="${((arr.length - 1) * sx).toFixed(1)}" cy="${(h - 2 - (arr[arr.length - 1] - lo) * sy).toFixed(1)}" r="2.2" fill="currentColor"/></svg>`; };
const html = `<title>Стрес-тест ENDLESS RAILS</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Space+Grotesk:wght@500;700&display=swap">
<style>
/* layout: a timetable-style report — summary strip, then the fixes as a signal list, then per-system and per-event boards */
:root { --bg: #f4f5f2; --panel: #ffffff; --fg: #1d2421; --muted: #5d6863; --line: #d9ddd8; --accent: #c7781a; --ok: #2f7d4f; --bad: #b8432f; --warn: #a87a12;
  --disp: 'Space Grotesk', 'Segoe UI', system-ui, sans-serif; --body: 'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif; --mono: 'IBM Plex Mono', ui-monospace, Menlo, monospace; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #141917; --panel: #1c2320; --fg: #e6ebe7; --muted: #9aa69f; --line: #2e3833; --accent: #e8a33d; --ok: #5fc287; --bad: #f07a63; --warn: #e3b84c; color-scheme: dark } }
:root[data-theme="dark"] { --bg: #141917; --panel: #1c2320; --fg: #e6ebe7; --muted: #9aa69f; --line: #2e3833; --accent: #e8a33d; --ok: #5fc287; --bad: #f07a63; --warn: #e3b84c; color-scheme: dark }
body { background: var(--bg); color: var(--fg); font: 15px/1.55 var(--body); padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 28px 48px; }
main { max-width: 1060px; margin: 0 auto; display: grid; gap: 34px; }
h1, h2 { font-family: var(--disp); text-wrap: balance; margin: 0; }
h1 { font-size: clamp(28px, 4.4vw, 42px); letter-spacing: -.01em; }
h2 { font-size: 21px; display: flex; gap: 10px; align-items: baseline; }
h2 small { font: 500 12px var(--mono); color: var(--muted); letter-spacing: .06em; text-transform: uppercase; }
p { margin: 0; max-width: 68ch; }
.lead { color: var(--muted); }
.strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.strip div { background: var(--panel); padding: 14px 16px; display: grid; gap: 2px; }
.strip b { font: 600 24px var(--disp); font-variant-numeric: tabular-nums; }
.strip span { font: 500 11.5px var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .07em; }
.bugs { display: grid; gap: 12px; }
.bug { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 16px 18px; display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 6px 22px; }
.bug h3 { margin: 0; font: 600 16.5px var(--body); grid-column: 1 / -1; display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
.tag { font: 500 11px var(--mono); text-transform: uppercase; letter-spacing: .07em; color: var(--accent); }
.bug .txt { display: grid; gap: 6px; min-width: 0; color: var(--fg); }
.bug .txt p span { color: var(--muted); }
.ba { display: grid; gap: 6px; align-content: start; font: 13px var(--mono); }
.ba div { display: grid; grid-template-columns: 52px 1fr; gap: 8px; align-items: baseline; }
.ba em { font-style: normal; font-size: 11px; text-transform: uppercase; letter-spacing: .07em; color: var(--muted); }
.pill { display: inline-block; padding: 3px 8px; border-radius: 5px; font: 500 12px/1.4 var(--mono); }
.pill.bad { color: var(--bad); border: 1px solid var(--bad); } .pill.ok { color: var(--ok); border: 1px solid var(--ok); }
.tablewrap { overflow-x: auto; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; }
table { border-collapse: collapse; width: 100%; font-size: 13.5px; font-variant-numeric: tabular-nums; }
th, td { padding: 8px 12px; border-bottom: 1px solid var(--line); text-align: right; white-space: nowrap; }
th:first-child, td:first-child { text-align: left; }
thead th { font: 500 11px var(--mono); text-transform: uppercase; letter-spacing: .07em; color: var(--muted); background: var(--bg); position: sticky; top: 0; }
tbody tr:last-child td { border-bottom: 0; }
td.z { color: var(--muted); } td.n { color: var(--bad); font-weight: 600; } td.g { color: var(--ok); font-weight: 600; }
.spark { color: var(--accent); vertical-align: middle; }
.notes { display: grid; gap: 8px; color: var(--muted); font-size: 14px; }
.notes li { max-width: 80ch; }
@media (max-width: 720px) { .bug { grid-template-columns: 1fr; } }
</style>
<main>
<header style="display:grid;gap:10px">
  <span class="tag">ENDLESS RAILS · стрес-тест</span>
  <h1>Стрес-тест ENDLESS RAILS</h1>
  <p class="lead">Чотири світи паралельно (вільна подорож, мальовнича, режим подій із розворотами, розклад), кожна подія запускалась щонайменше 100 разів. Перший прогін — версія до виправлень, другий — після.</p>
</header>
<section class="strip" aria-label="Підсумок">
  <div><b>${fmt(A.totals.days)}</b><span>ігрових днів (після)</span></div>
  <div><b>${fmt(B.totals.days)}</b><span>ігрових днів (до)</span></div>
  <div><b>${fmt(B.totals.km + A.totals.km)}</b><span>км проїхано разом</span></div>
  <div><b>${fmt(B.totals.starts + A.totals.starts)}</b><span>запусків подій</span></div>
  <div><b>${BUGS.length}</b><span>вад знайдено й виправлено</span></div>
  <div><b>${fmt(totErr(A))}</b><span>помилок JS після</span></div>
</section>
<section style="display:grid;gap:14px">
  <h2>Що знайдено <small>до → після</small></h2>
  <div class="bugs">
  ${BUGS.map(b => `<article class="bug"><h3><span class="tag">${esc(b.sys)}</span>${esc(b.name)}</h3>
    <div class="txt"><p><span>Причина: </span>${esc(b.why)}</p><p><span>Виправлення: </span>${esc(b.fix)}</p></div>
    <div class="ba"><div><em>до</em><span><span class="pill ${b.bad ? 'bad' : 'ok'}">${esc(b.b)}</span></span></div><div><em>після</em><span><span class="pill ${b.good ? 'bad' : 'ok'}">${esc(b.a)}</span></span></div></div></article>`).join('')}
  </div>
</section>
<section style="display:grid;gap:14px">
  <h2>Помилки по системах <small>до / після</small></h2>
  <p class="lead">Помилки JavaScript (винятки, повідомлення про помилки, необроблені збої) і порушення перевірок стану: предмети на рейках, камера під землею, значення NaN, залишки об'єктів після подій, обмеження швидкості, що лишились після подій.</p>
  <div class="tablewrap"><table><thead><tr><th>Система</th><th>Помилки JS до</th><th>після</th><th>Попередження до</th><th>після</th><th>Порушення стану до</th><th>після</th></tr></thead><tbody>
  ${sysRows.map(r => { const c = (v, good) => `<td class="${v ? (good ? 'n' : 'n') : 'z'}">${fmt(v || 0)}</td>`; return `<tr><td>${esc(SYS_UK[r.k] || r.k)}</td>${c(r.b.errors)}${c(r.a.errors)}${c(r.b.warnings)}${c(r.a.warnings)}${c(r.b.invariants)}${c(r.a.invariants)}</tr>`; }).join('')}
  </tbody></table></div>
  <p class="lead">«Порушення стану до» для подій містить і хибні спрацювання першої версії перевірки (частини веселки й полярного сяйва під землею далеко від колії, повітряні кулі й авіашоу до першого кадру, святкова станція через неточний пошук точки колії); у другому прогоні перевірка виправлена. Конуси й ліхтарі ремонту колії на узбіччі баласту за 2 м від рейки (${fmt(inv(A, 'event object on the track bed (ballast)', 'roadworks'))} запусків) — так задумано, тому в таблицю «після» не пораховані. Перевірку зламаної колії додано лише в другому прогоні, тому для генерації світу в стовпці «до» нуль, хоча вада була (див. вище).</p>
</section>
<section style="display:grid;gap:14px">
  <h2>Кожна подія <small>після виправлень</small></h2>
  <div class="tablewrap"><table><thead><tr><th>Подія</th><th>Запусків до</th><th>Запусків після</th><th>Помилки</th><th>Залишки об'єктів</th><th>На рейках до</th><th>На рейках після</th><th>Мін. відстань до рейки, м</th><th>Тривалість, с (медіана)</th></tr></thead><tbody>
  ${ids.map(id => { const b = evp(B, id), a = evp(A, id), real = ['tree', 'roadworks', 'rockfall', 'landslide', 'avalanche'].includes(id); const bt = real ? (b.place.track || 0) : null, at = a.place.track || 0;
    return `<tr><td>${esc(EV_UK[id])}</td><td>${fmt(b.started)}</td><td>${fmt(a.started)}</td><td class="${a.errored ? 'n' : 'z'}">${fmt(a.errored || 0)}</td><td class="${a.leftovers ? 'n' : 'z'}">${fmt(a.leftovers || 0)}</td><td class="${bt ? 'n' : 'z'}">${bt == null ? '—' : fmt(bt)}</td><td class="${at ? 'n' : 'z'}">${fmt(at)}</td><td>${a.place.checked ? (a.place.minRailMin != null && a.place.minRailMin < 1e8 ? a.place.minRailMin : 'далеко') : '—'}</td><td>${fmt(a.durMed)}</td></tr>`; }).join('')}
  </tbody></table></div>
</section>
<section style="display:grid;gap:14px">
  <h2>Стабільність <small>після виправлень</small></h2>
  <div class="tablewrap"><table><thead><tr><th>Світ</th><th>Днів</th><th>Км</th><th>Зупинок</th><th>Розворотів</th><th>Перезапусків зі збереження</th><th>Пам'ять JS, МБ</th><th>Геометрії на GPU</th><th>Об'єктів у сцені</th></tr></thead><tbody>
  ${A.worlds.map(w => { const p = A.perf[w.name] || {}; return `<tr><td>${esc(w.name)}</td><td>${fmt(w.days)}</td><td>${fmt(w.km)}</td><td>${fmt(w.acts.stops)}</td><td>${fmt(w.acts.reverse)}</td><td>${fmt(w.acts.reload)}</td><td>${spark(p.heap)} ${fmt(Math.min(...(p.heap || [0])))}–${fmt(Math.max(...(p.heap || [0])))}</td><td>${spark(p.geo)} ${fmt(Math.min(...(p.geo || [0])))}–${fmt(Math.max(...(p.geo || [0])))}</td><td>${spark(p.children)} ${fmt(Math.min(...(p.children || [0])))}–${fmt(Math.max(...(p.children || [0])))}</td></tr>`; }).join('')}
  </tbody></table></div>
  <p class="lead">Пам'ять, кількість геометрій і об'єктів у сцені коливаються в межах, але не ростуть безупинно — витоків не видно. Жодного падіння сторінки, жодного значення NaN у потягу, камері чи погоді.</p>
</section>
<section style="display:grid;gap:10px">
  <h2>Як тестувалось</h2>
  <ul class="notes">
    <li>Гра крутилась без малювання кадрів (крім вибіркових справжніх кадрів для підрахунку ресурсів відеокарти), час ішов кроками по 50 мс. Щоб умістити 1000+ днів, ігровий день тривав 2 хвилини ігрового часу; логіка та сама, що й на звичайній довжині дня.</li>
    <li>Автоводій: круїз, зупинки на станціях із дверима й пасажирами, розвороти, зміна складу й потяга на зупинках, зміна камер кожні ~45 с, погода по черзі, зміна мови, перезапуск зі збереження.</li>
    <li>Подію, для якої поблизу немає умов, тест запускав стрибком уперед, як кнопка в режимі подій; деякі нічні й небесні події запускались примусово без умов, як у режимі подій.</li>
    <li>Старт ракети можливий лише біля космодрому, а космодром є приблизно в кожному третьому районі (30 км), тож за обидва прогони ракета стартувала ${fmt(evp(B, 'rocket').started + evp(A, 'rocket').started)} разів (жодної помилки); «невдалі» спроби в таблиці — це примусові запуски тесту там, де космодрому поблизу немає.</li>
    <li>Повалене дерево не стартує, якщо попереду немає придатного місця (стрілка, станція, міст); тест повторював спроби на тому самому місці, тому невдач у ньому багато. На маршруті місце знаходиться у 86 % випадків, коли лісова умова виконана; у грі після невдачі подія чекає 25 с.</li>
    <li>У першому прогоні світ із розворотом (режим подій) 99 % часу їхав позаду точки старту, тобто зламаною колією; його вимірювання розташування подій тоді були неточні. У другому прогоні цей світ і світ із розкладом перезапущено вже з виправленою колією.</li>
    <li>Тест не замінює перевірку на телефоні: звук не відтворювався, графіка — програмна.</li>
  </ul>
</section>
</main>`;
fs.writeFileSync(out, '<!doctype html>\n<html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + html.replace('<main>', '</head><body><main>') + '\n</body></html>\n');
console.log('written', out, html.length);
