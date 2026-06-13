# 🚀 اصعد للإعلانات والتسويق الرقمي
### **Asaad Digital Marketing App - Flutter + Firebase**

---

## 📱 نظرة عامة على المشروع

تطبيق موبايل احترافي متكامل مخصص لشركة **اصعد للإعلانات والتسويق الرقمي** في العراق.

| التفصيل | القيمة |
|---------|--------|
| 🛠️ Framework | Flutter 3.x |
| 🔥 Backend | Firebase (Firestore + Auth + Storage + FCM) |
| 📐 Architecture | Clean Architecture |
| 🎨 Design | Material 3 + Custom Theme |
| 🌐 Languages | Arabic (RTL) + English |
| 🌙 Theme | Light + Dark Mode |
| 📦 State | Provider |

---

## 🏗️ هيكل المجلدات

```
asaad_app/
├── lib/
│   ├── main.dart                          # نقطة البداية
│   ├── firebase_options.dart              # إعدادات Firebase
│   ├── core/
│   │   ├── theme/
│   │   │   └── app_theme.dart             # ألوان + خطوط + ثيم
│   │   ├── routes/
│   │   │   └── app_router.dart            # التنقل بين الشاشات
│   │   ├── services/
│   │   │   └── firebase_service.dart      # كل عمليات Firebase
│   │   ├── providers/
│   │   │   ├── theme_provider.dart        # إدارة الثيم
│   │   │   └── language_provider.dart     # إدارة اللغة
│   │   ├── localization/
│   │   │   └── app_localizations.dart     # ترجمة النصوص
│   │   └── widgets/
│   │       ├── custom_button.dart         # زر مخصص
│   │       ├── custom_text_field.dart     # حقل إدخال مخصص
│   │       └── loading_overlay.dart       # شاشة التحميل
│   └── features/
│       ├── splash/
│       │   └── splash_screen.dart         # شاشة البداية
│       ├── auth/
│       │   ├── login_screen.dart          # تسجيل الدخول
│       │   ├── register_screen.dart       # إنشاء حساب
│       │   └── forgot_password_screen.dart # استعادة كلمة المرور
│       ├── main/
│       │   └── main_nav_screen.dart       # شريط التنقل السفلي
│       ├── home/
│       │   └── home_screen.dart           # الصفحة الرئيسية
│       ├── services/
│       │   ├── services_screen.dart       # قائمة الخدمات
│       │   └── service_detail_screen.dart # تفاصيل الخدمة
│       ├── orders/
│       │   ├── orders_screen.dart         # قائمة الطلبات
│       │   ├── order_detail_screen.dart   # تفاصيل الطلب
│       │   └── create_order_screen.dart   # إنشاء طلب جديد
│       ├── chat/
│       │   ├── chat_list_screen.dart      # قائمة المحادثات
│       │   └── chat_detail_screen.dart    # المحادثة
│       ├── portfolio/
│       │   └── portfolio_screen.dart      # معرض الأعمال
│       ├── payment/
│       │   └── payment_screen.dart        # الدفع الإلكتروني
│       ├── notifications/
│       │   └── notifications_screen.dart  # الإشعارات
│       ├── profile/
│       │   └── profile_screen.dart        # الملف الشخصي
│       ├── ai_assistant/
│       │   └── ai_assistant_screen.dart   # Asaad AI
│       └── admin/
│           ├── admin_dashboard_screen.dart # لوحة التحكم
│           ├── admin_clients_screen.dart   # إدارة العملاء
│           ├── admin_orders_screen.dart    # إدارة الطلبات
│           ├── admin_employees_screen.dart # إدارة الموظفين
│           └── admin_reports_screen.dart   # التقارير
├── firestore.rules                         # قواعد Firestore
├── storage.rules                           # قواعد Storage
├── pubspec.yaml                            # المكتبات
└── README.md                               # هذا الملف
```

---

## 🗄️ هيكل قاعدة البيانات (Firestore)

### 📋 Collections:

```
firestore/
├── users/{uid}
│   ├── uid: string
│   ├── name: string
│   ├── email: string
│   ├── phone: string
│   ├── role: "client" | "admin" | "employee"
│   ├── photoUrl: string
│   ├── fcmToken: string
│   ├── createdAt: timestamp
│   ├── isActive: boolean
│   ├── totalOrders: number
│   └── completedOrders: number
│
├── orders/{orderId}
│   ├── orderId: string
│   ├── clientId: string (ref → users)
│   ├── serviceId: string (ref → services)
│   ├── serviceName: string
│   ├── price: number
│   ├── notes: string
│   ├── attachments: string[]
│   ├── status: "new"|"in_progress"|"review"|"completed"|"cancelled"
│   ├── progress: number (0-100)
│   ├── assignedTo: string (ref → users)
│   ├── isPaid: boolean
│   ├── paymentMethod: string
│   ├── invoiceUrl: string
│   ├── createdAt: timestamp
│   ├── updatedAt: timestamp
│   └── completedAt: timestamp
│
├── services/{serviceId}
│   ├── id: string
│   ├── nameAr: string
│   ├── nameEn: string
│   ├── descriptionAr: string
│   ├── descriptionEn: string
│   ├── icon: string
│   ├── price: number
│   ├── duration: string
│   ├── category: string
│   ├── isActive: boolean
│   └── orderCount: number
│
├── chats/{chatId}
│   ├── chatId: string
│   ├── lastMessage: string
│   ├── lastMessageTime: timestamp
│   ├── lastSenderId: string
│   ├── unreadCount: number
│   └── messages/{messageId}
│       ├── messageId: string
│       ├── senderId: string
│       ├── senderName: string
│       ├── content: string
│       ├── type: "text"|"image"|"file"|"audio"
│       ├── fileUrl: string
│       ├── createdAt: timestamp
│       └── isRead: boolean
│
├── notifications/{notifId}
│   ├── userId: string
│   ├── title: string
│   ├── body: string
│   ├── type: string
│   ├── orderId: string
│   ├── isRead: boolean
│   └── createdAt: timestamp
│
├── portfolio/{itemId}
│   ├── title: string
│   ├── category: string
│   ├── type: "image"|"video"
│   ├── mediaUrl: string
│   ├── thumbnailUrl: string
│   ├── description: string
│   └── createdAt: timestamp
│
├── reviews/{reviewId}
│   ├── orderId: string
│   ├── clientId: string
│   ├── clientName: string
│   ├── rating: number (1-5)
│   ├── comment: string
│   └── createdAt: timestamp
│
├── payments/{paymentId}
│   ├── orderId: string
│   ├── clientId: string
│   ├── amount: number
│   ├── method: "zain_cash"|"ki_card"|"mastercard"|"cash"
│   ├── status: "pending"|"completed"|"failed"
│   ├── invoiceNumber: string
│   └── createdAt: timestamp
│
└── offers/{offerId}
    ├── titleAr: string
    ├── titleEn: string
    ├── discount: number
    ├── expiresAt: timestamp
    └── isActive: boolean
```

---

## 🚀 خطوات التشغيل

### المتطلبات الأساسية:
```bash
✅ Flutter SDK 3.x
✅ Dart SDK 3.x
✅ Android Studio / VS Code
✅ حساب Firebase
✅ Node.js (لـ Firebase CLI)
```

### 1️⃣ إعداد Firebase:
```bash
# تثبيت Firebase CLI
npm install -g firebase-tools

# تسجيل الدخول
firebase login

# تثبيت FlutterFire CLI
dart pub global activate flutterfire_cli

# إعداد المشروع (في مجلد المشروع)
flutterfire configure --project=your-project-id
```

### 2️⃣ تفعيل Firebase Services:
```
Firebase Console → your project:
✅ Authentication → Enable: Email/Password, Google, Phone
✅ Firestore Database → Create database (production mode)
✅ Storage → Enable
✅ Cloud Messaging → Enable
```

### 3️⃣ تشغيل المشروع:
```bash
# تثبيت المكتبات
flutter pub get

# تشغيل على المحاكي أو الجهاز
flutter run

# تشغيل في وضع Release
flutter run --release
```

### 4️⃣ رفع قواعد Firestore:
```bash
firebase deploy --only firestore:rules
firebase deploy --only storage
```

---

## 📤 النشر على المتاجر

### Google Play Store:
```bash
# بناء APK
flutter build apk --release

# بناء App Bundle (مفضل)
flutter build appbundle --release

# الملف: build/app/outputs/bundle/release/app-release.aab
```

### App Store (iOS):
```bash
# بناء IPA
flutter build ios --release

# ثم استخدم Xcode لرفع التطبيق
open ios/Runner.xcworkspace
```

### إعدادات pubspec.yaml مهمة:
```yaml
# تأكد من تحديث:
version: 1.0.0+1  # رقم الإصدار

# Android: android/app/build.gradle
applicationId "com.asaad.digitalmarketing"

# iOS: ios/Runner/Info.plist
CFBundleIdentifier: com.asaad.digitalmarketing
```

---

## 🔔 إعداد Firebase Cloud Messaging (FCM)

### Android:
```
android/app/google-services.json  ← من Firebase Console
```

### iOS:
```
ios/Runner/GoogleService-Info.plist  ← من Firebase Console
```

### إرسال إشعار من Admin:
```dart
// في firebase_service.dart
await createNotification(
  userId: targetUserId,
  title: 'عنوان الإشعار',
  body: 'نص الإشعار',
  type: 'order_update',
);
```

---

## 🤖 تفعيل Asaad AI

التطبيق يحتوي على ردود محلية ذكية. لتفعيل AI حقيقي:

```dart
// في ai_assistant_screen.dart
// استبدل _generateAiResponse بـ:

Future<String> _callOpenAI(String prompt) async {
  final response = await http.post(
    Uri.parse('https://api.openai.com/v1/chat/completions'),
    headers: {
      'Authorization': 'Bearer YOUR_OPENAI_KEY',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      'model': 'gpt-4',
      'messages': [
        {'role': 'system', 'content': 'أنت مساعد تسويقي خبير في السوق العراقي'},
        {'role': 'user', 'content': prompt},
      ],
    }),
  );
  final data = jsonDecode(response.body);
  return data['choices'][0]['message']['content'];
}
```

---

## 🎨 هوية التطبيق

| العنصر | القيمة |
|--------|--------|
| الاسم | اصعد للإعلانات والتسويق الرقمي |
| اللون الرئيسي | `#FF6B00` (برتقالي) |
| اللون الثانوي | `#0A0A0A` (أسود) |
| الخلفية | أبيض / أسود |
| الخط | Cairo |
| الاتجاه | RTL (عربي) |

---

## 📞 التواصل والدعم

```
شركة اصعد للإعلانات والتسويق الرقمي
📍 العراق - بغداد
📱 [رقم الهاتف]
📧 [البريد الإلكتروني]
🌐 [الموقع الإلكتروني]
```

---

## 📄 الترخيص

هذا المشروع مملوك بالكامل لشركة **اصعد للإعلانات والتسويق الرقمي**
جميع الحقوق محفوظة © 2024

---

> **تطوير:** Claude AI - Anthropic  
> **إصدار:** 1.0.0  
> **تاريخ:** 2024
