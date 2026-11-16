plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "iq.aldiwan.diwan_mobile"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "iq.aldiwan.pharmacy.flutter"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = maxOf(flutter.minSdkVersion, 23)
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    // التوقيع: نفس مفتاح تطبيق الديوان الحالي (SIGNING_BUNDLE) إن وُجد، فتتحدّث النسخ فوق بعضها
    // بدون تعارض؛ وإلا يُوقَّع بمفتاح debug (للتجربة المحلية فقط).
    val ksPath = System.getenv("DIWAN_KEYSTORE")
    if (ksPath != null && file(ksPath).exists()) {
        signingConfigs {
            create("diwan") {
                storeFile = file(ksPath)
                storePassword = System.getenv("DIWAN_STORE_PASS")
                keyAlias = System.getenv("DIWAN_KEY_ALIAS") ?: "diwan"
                keyPassword = System.getenv("DIWAN_KEY_PASS") ?: System.getenv("DIWAN_STORE_PASS")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (ksPath != null && file(ksPath).exists())
                signingConfigs.getByName("diwan") else signingConfigs.getByName("debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
