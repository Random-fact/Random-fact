# Сайт розробника на GitHub Pages (безкоштовно)

Потрібен для двох речей: публічна **політика конфіденційності** (обов'язкова в Play Console) і **app-ads.txt**
(AdMob читає його лише з кореня сайту, вказаного в Play Console).

1. Заміни заглушки `[...]` у `privacy-policy.html` та `index.html` (ім'я/назва розробника, країна, email, дата).
2. На github.com створи **публічний** репозиторій з назвою точно `<твій-логін>.github.io`.
3. Завантаж у нього файли з цієї папки: `index.html`, `privacy-policy.html`, `app-ads.txt` (Add file → Upload files → Commit).
4. Settings → Pages → Source: «Deploy from a branch», гілка `main`, папка `/ (root)` → Save. Зачекай 1–2 хвилини.
5. Перевір у браузері:
   * `https://<логін>.github.io/` — сторінка гри;
   * `https://<логін>.github.io/privacy-policy.html` — це посилання вписати в Play Console (App content → Privacy policy);
   * `https://<логін>.github.io/app-ads.txt` — має показати рядок `google.com, pub-7389308732042512, DIRECT, f08c47fec0942fa0`.
6. У Play Console (Store settings → Website) вкажи `https://<логін>.github.io`.
