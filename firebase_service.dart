import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'dart:io';

class FirebaseService {
  static final FirebaseService _instance = FirebaseService._internal();
  factory FirebaseService() => _instance;
  FirebaseService._internal();

  final FirebaseFirestore _db = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseStorage _storage = FirebaseStorage.instance;
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;

  // ═══════════════════════════════════
  //  COLLECTIONS
  // ═══════════════════════════════════
  CollectionReference get users => _db.collection('users');
  CollectionReference get orders => _db.collection('orders');
  CollectionReference get services => _db.collection('services');
  CollectionReference get chats => _db.collection('chats');
  CollectionReference get notifications => _db.collection('notifications');
  CollectionReference get portfolio => _db.collection('portfolio');
  CollectionReference get reviews => _db.collection('reviews');
  CollectionReference get payments => _db.collection('payments');
  CollectionReference get offers => _db.collection('offers');

  // ═══════════════════════════════════
  //  AUTH
  // ═══════════════════════════════════
  User? get currentUser => _auth.currentUser;
  Stream<User?> get authStateChanges => _auth.authStateChanges();

  Future<UserCredential> signInWithEmail(String email, String password) async {
    return await _auth.signInWithEmailAndPassword(
      email: email,
      password: password,
    );
  }

  Future<UserCredential> registerWithEmail(String email, String password) async {
    return await _auth.createUserWithEmailAndPassword(
      email: email,
      password: password,
    );
  }

  Future<void> sendPasswordResetEmail(String email) async {
    await _auth.sendPasswordResetEmail(email: email);
  }

  Future<void> signOut() async {
    await _auth.signOut();
  }

  Future<void> verifyPhoneNumber({
    required String phoneNumber,
    required Function(PhoneAuthCredential) onAutoVerified,
    required Function(FirebaseAuthException) onFailed,
    required Function(String, int?) onCodeSent,
  }) async {
    await _auth.verifyPhoneNumber(
      phoneNumber: phoneNumber,
      verificationCompleted: onAutoVerified,
      verificationFailed: onFailed,
      codeSent: onCodeSent,
      codeAutoRetrievalTimeout: (_) {},
    );
  }

  // ═══════════════════════════════════
  //  USER OPERATIONS
  // ═══════════════════════════════════
  Future<void> createUserProfile({
    required String uid,
    required String name,
    required String email,
    required String phone,
    required String role, // client | admin | employee
  }) async {
    await users.doc(uid).set({
      'uid': uid,
      'name': name,
      'email': email,
      'phone': phone,
      'role': role,
      'photoUrl': '',
      'fcmToken': await _messaging.getToken(),
      'createdAt': FieldValue.serverTimestamp(),
      'isActive': true,
      'totalOrders': 0,
      'completedOrders': 0,
    });
  }

  Future<Map<String, dynamic>?> getUserProfile(String uid) async {
    final doc = await users.doc(uid).get();
    return doc.exists ? doc.data() as Map<String, dynamic> : null;
  }

  Future<void> updateFcmToken(String uid) async {
    final token = await _messaging.getToken();
    if (token != null) {
      await users.doc(uid).update({'fcmToken': token});
    }
  }

  // ═══════════════════════════════════
  //  ORDERS
  // ═══════════════════════════════════
  Future<String> createOrder({
    required String clientId,
    required String serviceId,
    required String serviceName,
    required double price,
    required String notes,
    List<String> attachments = const [],
  }) async {
    final ref = orders.doc();
    await ref.set({
      'orderId': ref.id,
      'clientId': clientId,
      'serviceId': serviceId,
      'serviceName': serviceName,
      'price': price,
      'notes': notes,
      'attachments': attachments,
      'status': 'new', // new | in_progress | review | completed | cancelled
      'progress': 0,
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
      'assignedTo': null,
      'completedAt': null,
      'isPaid': false,
      'paymentMethod': null,
      'invoiceUrl': null,
    });
    return ref.id;
  }

  Stream<QuerySnapshot> getClientOrders(String clientId) {
    return orders
        .where('clientId', isEqualTo: clientId)
        .orderBy('createdAt', descending: true)
        .snapshots();
  }

  Stream<QuerySnapshot> getAllOrders() {
    return orders.orderBy('createdAt', descending: true).snapshots();
  }

  Future<void> updateOrderStatus({
    required String orderId,
    required String status,
    required int progress,
  }) async {
    await orders.doc(orderId).update({
      'status': status,
      'progress': progress,
      'updatedAt': FieldValue.serverTimestamp(),
      if (status == 'completed') 'completedAt': FieldValue.serverTimestamp(),
    });
  }

  // ═══════════════════════════════════
  //  SERVICES
  // ═══════════════════════════════════
  Future<void> seedServices() async {
    final servicesList = [
      {
        'id': 'social_management',
        'nameAr': 'إدارة صفحات التواصل الاجتماعي',
        'nameEn': 'Social Media Management',
        'descriptionAr': 'إدارة احترافية لجميع منصات التواصل الاجتماعي',
        'descriptionEn': 'Professional management of all social media platforms',
        'icon': 'social',
        'price': 250000,
        'duration': '30 يوم',
        'isActive': true,
        'category': 'social',
      },
      {
        'id': 'post_design',
        'nameAr': 'تصميم منشورات السوشيال ميديا',
        'nameEn': 'Social Media Post Design',
        'descriptionAr': 'تصميم منشورات إبداعية واحترافية',
        'descriptionEn': 'Creative and professional post designs',
        'icon': 'design',
        'price': 50000,
        'duration': '3-5 أيام',
        'isActive': true,
        'category': 'design',
      },
      {
        'id': 'brand_identity',
        'nameAr': 'تصميم الهويات البصرية',
        'nameEn': 'Brand Identity Design',
        'descriptionAr': 'هوية بصرية متكاملة ومميزة لعلامتك التجارية',
        'descriptionEn': 'Complete and distinctive visual identity for your brand',
        'icon': 'brand',
        'price': 500000,
        'duration': '7-14 يوم',
        'isActive': true,
        'category': 'design',
      },
      {
        'id': 'logo_design',
        'nameAr': 'تصميم الشعارات',
        'nameEn': 'Logo Design',
        'descriptionAr': 'شعار فريد ومميز يعكس هوية علامتك التجارية',
        'descriptionEn': 'Unique logo reflecting your brand identity',
        'icon': 'logo',
        'price': 150000,
        'duration': '5-7 أيام',
        'isActive': true,
        'category': 'design',
      },
      {
        'id': 'video_production',
        'nameAr': 'إنتاج الفيديو والمونتاج',
        'nameEn': 'Video Production & Editing',
        'descriptionAr': 'إنتاج فيديوهات إعلانية احترافية',
        'descriptionEn': 'Professional advertising video production',
        'icon': 'video',
        'price': 300000,
        'duration': '7-10 أيام',
        'isActive': true,
        'category': 'media',
      },
      {
        'id': 'photography',
        'nameAr': 'التصوير الاحترافي',
        'nameEn': 'Professional Photography',
        'descriptionAr': 'جلسات تصوير احترافية لمنتجاتك وأعمالك',
        'descriptionEn': 'Professional photo sessions for products and businesses',
        'icon': 'camera',
        'price': 200000,
        'duration': '1-3 أيام',
        'isActive': true,
        'category': 'media',
      },
      {
        'id': 'paid_ads',
        'nameAr': 'الحملات الإعلانية الممولة',
        'nameEn': 'Paid Advertising Campaigns',
        'descriptionAr': 'حملات إعلانية ممولة على جميع المنصات',
        'descriptionEn': 'Paid advertising campaigns on all platforms',
        'icon': 'ads',
        'price': 400000,
        'duration': '30 يوم',
        'isActive': true,
        'category': 'marketing',
      },
      {
        'id': 'web_design',
        'nameAr': 'تصميم المواقع الإلكترونية',
        'nameEn': 'Website Design',
        'descriptionAr': 'تصميم وتطوير مواقع إلكترونية احترافية',
        'descriptionEn': 'Professional website design and development',
        'icon': 'web',
        'price': 1000000,
        'duration': '30-60 يوم',
        'isActive': true,
        'category': 'tech',
      },
      {
        'id': 'app_development',
        'nameAr': 'تطوير تطبيقات الهاتف',
        'nameEn': 'Mobile App Development',
        'descriptionAr': 'تطوير تطبيقات Android و iOS احترافية',
        'descriptionEn': 'Professional Android & iOS app development',
        'icon': 'app',
        'price': 3000000,
        'duration': '60-120 يوم',
        'isActive': true,
        'category': 'tech',
      },
      {
        'id': 'seo',
        'nameAr': 'تحسين محركات البحث SEO',
        'nameEn': 'Search Engine Optimization',
        'descriptionAr': 'تحسين ظهور موقعك في نتائج البحث',
        'descriptionEn': 'Improve your website visibility in search results',
        'icon': 'seo',
        'price': 350000,
        'duration': '30-90 يوم',
        'isActive': true,
        'category': 'marketing',
      },
    ];

    final batch = _db.batch();
    for (final service in servicesList) {
      final ref = services.doc(service['id'] as String);
      batch.set(ref, {
        ...service,
        'createdAt': FieldValue.serverTimestamp(),
        'orderCount': 0,
      });
    }
    await batch.commit();
  }

  Stream<QuerySnapshot> getServices() {
    return services.where('isActive', isEqualTo: true).snapshots();
  }

  // ═══════════════════════════════════
  //  CHAT
  // ═══════════════════════════════════
  String getChatId(String userId) => 'chat_$userId';

  Stream<QuerySnapshot> getChatMessages(String chatId) {
    return chats
        .doc(chatId)
        .collection('messages')
        .orderBy('createdAt', descending: false)
        .snapshots();
  }

  Future<void> sendMessage({
    required String chatId,
    required String senderId,
    required String senderName,
    required String content,
    String type = 'text', // text | image | file | audio
    String? fileUrl,
  }) async {
    final chatRef = chats.doc(chatId);
    final msgRef = chatRef.collection('messages').doc();

    final batch = _db.batch();
    batch.set(msgRef, {
      'messageId': msgRef.id,
      'senderId': senderId,
      'senderName': senderName,
      'content': content,
      'type': type,
      'fileUrl': fileUrl,
      'createdAt': FieldValue.serverTimestamp(),
      'isRead': false,
    });

    batch.set(chatRef, {
      'chatId': chatId,
      'lastMessage': content,
      'lastMessageTime': FieldValue.serverTimestamp(),
      'lastSenderId': senderId,
      'unreadCount': FieldValue.increment(1),
    }, SetOptions(merge: true));

    await batch.commit();
  }

  // ═══════════════════════════════════
  //  FILE UPLOAD
  // ═══════════════════════════════════
  Future<String> uploadFile(File file, String path) async {
    final ref = _storage.ref().child(path);
    final uploadTask = await ref.putFile(file);
    return await uploadTask.ref.getDownloadURL();
  }

  // ═══════════════════════════════════
  //  NOTIFICATIONS
  // ═══════════════════════════════════
  Future<void> createNotification({
    required String userId,
    required String title,
    required String body,
    required String type,
    String? orderId,
  }) async {
    await notifications.add({
      'userId': userId,
      'title': title,
      'body': body,
      'type': type,
      'orderId': orderId,
      'isRead': false,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }

  Stream<QuerySnapshot> getUserNotifications(String userId) {
    return notifications
        .where('userId', isEqualTo: userId)
        .orderBy('createdAt', descending: true)
        .limit(50)
        .snapshots();
  }

  // ═══════════════════════════════════
  //  PORTFOLIO
  // ═══════════════════════════════════
  Stream<QuerySnapshot> getPortfolio({String? category}) {
    if (category != null && category != 'all') {
      return portfolio
          .where('category', isEqualTo: category)
          .orderBy('createdAt', descending: true)
          .snapshots();
    }
    return portfolio.orderBy('createdAt', descending: true).snapshots();
  }

  // ═══════════════════════════════════
  //  REVIEWS
  // ═══════════════════════════════════
  Future<void> submitReview({
    required String orderId,
    required String clientId,
    required String clientName,
    required double rating,
    required String comment,
  }) async {
    await reviews.add({
      'orderId': orderId,
      'clientId': clientId,
      'clientName': clientName,
      'rating': rating,
      'comment': comment,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }

  // ═══════════════════════════════════
  //  STATISTICS (Admin)
  // ═══════════════════════════════════
  Future<Map<String, dynamic>> getAdminStats() async {
    final usersSnap = await users.where('role', isEqualTo: 'client').count().get();
    final ordersSnap = await orders.count().get();
    final completedSnap =
        await orders.where('status', isEqualTo: 'completed').count().get();
    final paymentsSnap = await payments.get();

    double totalRevenue = 0;
    for (final doc in paymentsSnap.docs) {
      final data = doc.data() as Map<String, dynamic>;
      totalRevenue += (data['amount'] as num?)?.toDouble() ?? 0;
    }

    return {
      'totalClients': usersSnap.count,
      'totalOrders': ordersSnap.count,
      'completedOrders': completedSnap.count,
      'totalRevenue': totalRevenue,
    };
  }
}
