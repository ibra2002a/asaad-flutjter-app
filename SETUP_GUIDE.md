# 🚀 دليل إعداد وتشغيل مشروع اصعد

## ⚠️ خطوات مهمة قبل التشغيل

### 1️⃣ تحميل خط Cairo (مطلوب)
```bash
cd assets/fonts
# حمّل الملفات من:
# https://fonts.google.com/specimen/Cairo
# ثم ضع الملفات:
# Cairo-Regular.ttf, Cairo-Medium.ttf, Cairo-SemiBold.ttf
# Cairo-Bold.ttf, Cairo-ExtraBold.ttf, Cairo-Black.ttf
```

### 2️⃣ إعداد Firebase (مطلوب)
```bash
# 1. ثبّت Firebase CLI
npm install -g firebase-tools

# 2. سجّل الدخول
firebase login

# 3. ثبّت FlutterFire CLI
dart pub global activate flutterfire_cli

# 4. في مجلد المشروع نفّذ:
flutterfire configure --project=YOUR_PROJECT_ID

# سيولّد هذا الأمر:
# - lib/firebase_options.dart (تلقائياً)
# - android/app/google-services.json
# - ios/Runner/GoogleService-Info.plist
```

### 3️⃣ تفعيل خدمات Firebase
في Firebase Console افتح مشروعك وفعّل:
- ✅ Authentication → Email/Password + Google + Phone
- ✅ Firestore Database → Create (production mode)
- ✅ Storage → Enable
- ✅ Cloud Messaging → Enable (FCM)

### 4️⃣ تثبيت المكتبات
```bash
flutter pub get
```

### 5️⃣ رفع قواعد Firestore
```bash
firebase deploy --only firestore:rules
firebase deploy --only storage
firebase deploy --only firestore:indexes
```

### 6️⃣ تشغيل المشروع
```bash
# Android
flutter run

# iOS (على Mac فقط)
cd ios && pod install && cd ..
flutter run

# Debug mode
flutter run --debug

# Release mode
flutter run --release
```

---

## 📱 بناء للنشر

### Android (Google Play):
```bash
flutter build appbundle --release
# الملف: build/app/outputs/bundle/release/app-release.aab
```

### iOS (App Store):
```bash
flutter build ios --release
# افتح Xcode وارفع عبر Xcode
```

---

## 🔑 إضافة بيانات أولية لـ Firestore

بعد تشغيل التطبيق أول مرة، اتصل بـ:
```dart
await FirebaseService().seedServices();
```

أو في Firestore Console أضف مجموعة `services` يدوياً.

---

## 📞 للمساعدة
راجع ملف README.md الكامل.
