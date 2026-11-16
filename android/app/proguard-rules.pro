# Methods called from JavaScript must keep their names.
-keepattributes JavascriptInterface
-keepclassmembers class com.endlessrails.game.** {
    @android.webkit.JavascriptInterface <methods>;
}
