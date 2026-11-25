# ENDLESS RAILS — готові відповіді для Google Play Console

Назви полів подано англійською, як у Play Console. Якщо екран виглядає інакше (Google часто змінює інтерфейс),
відповідай за змістом. Для пунктів, яких тут немає, — спершу питай.

## 1. Create app
| Поле | Відповідь |
|---|---|
| App name | `Endless Rails: Train Driver` (en) або `Endless Rails: машиніст` (uk), повний список — `store/listing/*.txt` |
| Default language | English (United States) – en-US (або Ukrainian – uk) |
| App or game | **Game** |
| Free or paid | **Free** (змінити на платну потім неможливо) |
| Declarations | Developer Program Policies ✔, US export laws ✔ — **ставить власник акаунта сам** |

## 2. App content (Policy → App content)
| Розділ | Відповідь |
|---|---|
| Privacy policy | `https://<логін>.github.io/privacy-policy.html` (після кроку з сайтом) |
| App access | **All functionality is available without any access restrictions** |
| Ads | **Yes, my app contains ads** |
| Content rating | анкета нижче (§3) |
| Target audience and content | Вік: **13–15, 16–17, 18+** (не обирати групи до 13 років). «Could your store listing unintentionally appeal to children?» → **No** |
| News apps | **No** |
| COVID-19 apps | My app is not a publicly available COVID-19 app |
| Data safety | §4 |
| Government apps | **No** |
| Financial features | **My app doesn't provide any financial features** |
| Health | **My app doesn't have any health features** |
| Advertising ID | **Yes**. Цілі: **Advertising or marketing**; **Fraud prevention, security, and compliance**; **Analytics** |
| Інші декларації (foreground service, photo/video, exact alarms, accessibility тощо) | Не застосовуються: таких дозволів у застосунку немає. Якщо Play Console усе ж питає — показати мені |

## 3. Content rating (анкета IARC)
* Email: контактний email розробника. Category: **Game**.
* Violence — **No** (людей і тварин ніхто не кривдить; вулкан, цунамі, торнадо, метеорити — лише візуальні природні явища без постраждалих).
* Fear / horror — **No**. Sexuality / nudity — **No**. Language (profanity) — **No**. Controlled substances (drugs, alcohol, tobacco) — **No**. Crude humour — **No**.
* Gambling / simulated gambling / loot boxes — **No**.
* Users can interact or exchange content (chat, UGC) — **No**. Shares user's current physical location — **No**.
* Digital purchases (in-app purchases) — **No**. Unrestricted internet / web browser — **No**.
* Очікуваний результат: «Everyone» / PEGI 3 / USK 0 — рейтинг визначає анкета, не ми.

## 4. Data safety
Сама гра нічого не збирає й не надсилає. Дані обробляє лише **Google Mobile Ads SDK** (AdMob) і UMP. Перед відправкою
звір відповіді з актуальною сторінкою Google «Google Mobile Ads SDK — Data disclosure».
| Питання | Відповідь |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** |
| Do you provide a way for users to request that their data is deleted? | **No** (облікових записів немає; рекламний ID скидається в налаштуваннях Android; про це сказано в політиці) |
| **Location → Approximate location** | Collected **and** shared · Required · Advertising or marketing; Fraud prevention, security, and compliance |
| **App activity → App interactions** | Collected **and** shared · Required · Advertising or marketing; Analytics |
| **App info and performance → Crash logs; Diagnostics** | Collected **and** shared · Required · Analytics; Fraud prevention, security, and compliance |
| **Device or other IDs** (advertising ID, app set ID) | Collected **and** shared · Required · Advertising or marketing; Fraud prevention, security, and compliance; Analytics |
| Усе інше (ім'я, email, контакти, фото, файли, точне місцезнаходження, здоров'я, фінанси, повідомлення…) | **Not collected** |
| Is the data processed ephemerally? | **No** |

## 5. Main store listing (Grow → Store presence → Main store listing)
| Поле | Звідки |
|---|---|
| App name / Short description / Full description | `store/listing/en.txt` (мова за замовчуванням) |
| Translations (Add translations) | uk, ru, de, fr, es-ES, pt-BR, ro, ja, zh-CN → відповідні файли `store/listing/*.txt` |
| App icon 512×512 | `store/icon-512.png` |
| Feature graphic 1024×500 | `store/feature-graphic-1024x500.png` |
| Phone screenshots (2–8) | `store/screenshots/` (свіжі з версії 2.0.0, 1920×1080); резерв — `store/screenshots-old/` |
| Tablet screenshots | необов'язково; можна ті самі 1920×1080 |
| Video | необов'язково (YouTube) |

**Store settings:** App category **Game → Simulation**; Tags — Simulation, Trains (з переліку Google); Contact email —
публічний email розробника; Website — `https://<логін>.github.io`; External marketing — дозволити.

## 6. Closed testing (Testing → Closed testing)
* Create track → Countries/regions: усі доступні (або хоча б країни тестувальників).
* Testers: Email list (≥ 12 адрес, краще 15–20) або Google Group. Feedback URL / email — контактний email.
* Create new release → **App integrity: Play App Signing — Use Google-generated key** → Upload `upload/ENDLESS_RAILS.aab`.
* Release name: `2.0.0 (20000)`.
* Release notes:
  ```
  <en-US>
  First release: endless double-track railway, two trains (classic and high-speed), 10 cameras, weather, day and night,
  driver training, events and 10 languages.
  </en-US>
  <uk>
  Перший випуск: нескінченна двоколійна магістраль, два потяги (класичний і швидкісний), 10 камер, погода, день і ніч,
  навчання машиніста, події та 10 мов.
  </uk>
  ```
* Review release → **Start rollout to Closed testing** — тільки після мого «так».
* Особистий акаунт: ≥ 12 тестувальників підписані **14 днів поспіль**; не призупиняти трек. Потім Dashboard → **Apply for production**.

## 7. AdMob (admob.google.com)
1. Apps → ENDLESS RAILS (Android, `com.endlessrails.game`) — перевірити, що App ID `ca-app-pub-7389308732042512~6246758735` і rewarded-блок `…/4275201510` існують.
2. **Privacy & messaging → European regulations → Create message** → застосунок ENDLESS RAILS → мови (en + інші) → Publish.
3. Після появи гри в Google Play: App settings → **Add app store details** (знайти `com.endlessrails.game`).
4. **app-ads.txt**: сайт розробника в Play Console має бути `https://<логін>.github.io`, а файл має відкриватися за адресою `https://<логін>.github.io/app-ads.txt`. Перевірка AdMob триває до 24 годин.
5. Перевіряти рекламу лише через `upload/ENDLESS_RAILS_debug.apk` (тестова реклама). У живій версії рекламу не натискати.

## 8. Production (після схвалення доступу)
Production → Create new release → **Add from library** (той самий AAB 2.0.0) → Countries → (за бажанням staged rollout 20 %) →
Review → **Send for review** — тільки після мого «так». Наступні оновлення: потрібен новий AAB із versionCode > 20000.
