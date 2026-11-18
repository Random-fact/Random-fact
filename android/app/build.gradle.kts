import groovy.json.JsonSlurper
import java.util.Base64
import java.util.Properties

plugins {
    id("com.android.application")
}

fun prop(k: String): String = (findProperty(k) as String?)?.trim().orEmpty()

/* Google's public test IDs: always used in debug builds, never earn money */
val testAppId = "ca-app-pub-3940256099942544~3347511713"
val testRewardedId = "ca-app-pub-3940256099942544/5224354917"

/** Builds assets/index.html from the game page: three.js and the fonts are inlined, so the app runs fully offline. */
abstract class GameAssetTask : DefaultTask() {
    @get:InputFile abstract val gameHtml: RegularFileProperty
    @get:InputDirectory abstract val vendorDir: DirectoryProperty
    @get:OutputDirectory abstract val outputDir: DirectoryProperty

    @TaskAction
    fun build() {
        var html = gameHtml.get().asFile.readText(Charsets.UTF_8)
        val vendor = vendorDir.get().asFile
        val three = File(vendor, "three.min.js").readText(Charsets.UTF_8)
        check(!three.lowercase().contains("</script")) { "three.min.js must not contain </script" }
        @Suppress("UNCHECKED_CAST")
        val faces = JsonSlurper().parse(File(vendor, "fonts/fonts.json")) as List<Map<String, Any>>
        val cache = HashMap<String, String>()
        val rules = StringBuilder()
        for (f in faces) {
            val file = f["file"] as String
            val b64 = cache.getOrPut(file) { Base64.getEncoder().encodeToString(File(vendor, "fonts/$file").readBytes()) }
            rules.append("@font-face{font-family:'").append(f["fam"]).append("';font-style:normal;font-weight:").append(f["w"])
                .append(";font-display:swap;src:url(data:font/woff2;base64,").append(b64).append(") format('woff2');unicode-range:").append(f["ur"]).append("}")
        }
        val pre = "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n"
        val i = html.indexOf("<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com")
        check(i >= 0 && html.contains(pre)) { "font links not found in game.html" }
        val j = html.indexOf('>', i)
        html = html.substring(0, i) + "<style>" + rules + "</style>" + html.substring(j + 1)
        html = html.replace(pre, "")
        // three.js as data: the page's start-up script runs it after the loading screen has been painted
        val mark = "<!--@THREE@-->"
        check(html.contains(mark)) { "three.js placeholder not found in game.html" }
        html = html.replace(mark, "<script>window.IS_APK=true;</script><script type=\"text/plain\" id=\"er-three\">$three</script>")
        val out = outputDir.get().asFile
        out.mkdirs()
        File(out, "index.html").writeText(html, Charsets.UTF_8)
    }
}

val generateGameAsset = tasks.register<GameAssetTask>("generateGameAsset") {
    gameHtml.set(rootProject.layout.projectDirectory.file("../endless-rails/src/game.html"))
    vendorDir.set(rootProject.layout.projectDirectory.dir("vendor"))
    outputDir.set(layout.buildDirectory.dir("generated/gameAssets"))
}

android {
    namespace = "com.endlessrails.game"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.endlessrails.game"
        minSdk = 24
        targetSdk = 36
        versionCode = 20000
        versionName = "2.0.0"
        buildConfigField("String", "UMP_TEST_DEVICE", "\"${prop("ump.testDevice")}\"")
    }

    buildFeatures { buildConfig = true }

    /* release signing: create keystore.properties next to settings.gradle.kts (never commit it):
       storeFile=/path/to/upload-keystore.jks  storePassword=...  keyAlias=upload  keyPassword=... */
    val ksFile = rootProject.file("keystore.properties")
    signingConfigs {
        create("release") {
            if (ksFile.exists()) {
                val p = Properties().apply { ksFile.inputStream().use { load(it) } }
                storeFile = file(p.getProperty("storeFile"))
                storePassword = p.getProperty("storePassword")
                keyAlias = p.getProperty("keyAlias")
                keyPassword = p.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        getByName("debug") {
            applicationIdSuffix = ".debug"
            manifestPlaceholders["admobAppId"] = testAppId
            buildConfigField("String", "REWARDED_ID", "\"$testRewardedId\"")
        }
        getByName("release") {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            manifestPlaceholders["admobAppId"] = prop("admob.appId").ifEmpty { testAppId }
            buildConfigField("String", "REWARDED_ID", "\"${prop("admob.rewardedId").ifEmpty { testRewardedId }}\"")
            if (ksFile.exists()) signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    /* the game ships its own 10 languages inside the page; keep every language resource in every device split */
    bundle { language { enableSplit = false } }
}

androidComponents {
    onVariants { variant ->
        variant.sources.assets?.addGeneratedSourceDirectory(generateGameAsset, GameAssetTask::outputDir)
    }
}

/* a release must never go out with the test ad units */
tasks.configureEach {
    if (name == "preReleaseBuild") doFirst {
        if (prop("admob.appId").isEmpty() || prop("admob.rewardedId").isEmpty())
            throw GradleException("Set admob.appId and admob.rewardedId in gradle.properties before building a release (debug builds use Google's test IDs).")
    }
}

dependencies {
    implementation("com.google.android.gms:play-services-ads:25.4.0")
    implementation("com.google.android.ump:user-messaging-platform:4.0.0")
}
