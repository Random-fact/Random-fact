# ENDLESS RAILS — APK / AAB signing

| Build | Signed with | Scheme | Certificate SHA-256 |
|---|---|---|---|
| `ENDLESS_RAILS.apk`, `ENDLESS_RAILS.aab` (release) | project release key `release.keystore`, alias `endlessrails`, `CN=Endless Rails, O=Endless Rails`, valid until 2054 | APK Signature Scheme v2 (min SDK 24) | `01:BA:CD:9E:CC:95:99:87:B3:0E:46:57:46:6A:25:2D:9B:24:85:22:10:9D:E1:84:F4:F7:2C:D9:0A:BD:B9:4E` |
| `ENDLESS_RAILS_debug.apk` | the standard Android debug key | v2 | `4E:BC:1E:65:B6:CA:A1:63:F3:C8:31:0B:E5:64:5A:74:31:BF:FA:96:92:76:79:32:C1:17:08:29:AB:F9:AF:A2` |

* The release key is the same one that signed every APK handed out while the game was developed, so the release
  installs over them as an update and keeps the player's saved journey.
* **The keystore is not in the repository and not in the release ZIP** (`*.keystore`, `*.jks` and `keystore.properties`
  are git-ignored). It was handed over separately. Keep two offline copies; without it no update can be signed with
  the same key.
* Its password is a development password. Before you use it as your Google Play **upload key**, change it:
  `keytool -storepasswd -keystore release.keystore` and `keytool -keypasswd -alias endlessrails -keystore release.keystore`,
  then update `android/keystore.properties`. Alternatively create a new upload key (`keytool -genkeypair -v -keystore
  upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`) and rebuild the AAB.
* Google Play: enrol in **Play App Signing** (default for new apps). Google then keeps the app-signing key and you upload
  with the upload key; a lost upload key can be reset through Play Console support. APKs installed outside Play (like
  `ENDLESS_RAILS.apk`) keep the release-key signature; the Play-delivered app will carry Google's app-signing key, so a
  side-loaded copy and the Play copy cannot update each other — uninstall one before installing the other.
* Verify a file: `apksigner verify --print-certs ENDLESS_RAILS.apk`.
