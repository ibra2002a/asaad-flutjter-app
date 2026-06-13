import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/theme/app_theme.dart';
import '../../core/routes/app_router.dart';
import '../../core/services/firebase_service.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _firebase = FirebaseService();

  final _tabs = [
    {'label': 'الكل', 'status': 'all'},
    {'label': 'جديد', 'status': 'new'},
    {'label': 'قيد التنفيذ', 'status': 'in_progress'},
    {'label': 'مراجعة', 'status': 'review'},
    {'label': 'مكتمل', 'status': 'completed'},
    {'label': 'ملغي', 'status': 'cancelled'},
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final uid = _firebase.currentUser?.uid ?? '';

    return Scaffold(
      backgroundColor: isDark ? AppTheme.black : AppTheme.whiteOff,
      appBar: AppBar(
        backgroundColor: isDark ? AppTheme.black : AppTheme.white,
        title: const Text(
          'طلباتي',
          style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w800),
        ),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          labelColor: AppTheme.primaryOrange,
          unselectedLabelColor: AppTheme.grey,
          indicatorColor: AppTheme.primaryOrange,
          indicatorWeight: 3,
          labelStyle: const TextStyle(
              fontFamily: 'Cairo', fontWeight: FontWeight.w700, fontSize: 12),
          unselectedLabelStyle:
              const TextStyle(fontFamily: 'Cairo', fontSize: 12),
          tabs: _tabs.map((t) => Tab(text: t['label'])).toList(),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.pushNamed(context, AppRouter.createOrder),
        backgroundColor: AppTheme.primaryOrange,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text(
          'طلب جديد',
          style: TextStyle(
              fontFamily: 'Cairo', color: Colors.white, fontWeight: FontWeight.w700),
        ),
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: _firebase.getClientOrders(uid),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(
                child: CircularProgressIndicator(color: AppTheme.primaryOrange));
          }

          final allDocs = snapshot.data?.docs ?? [];

          return TabBarView(
            controller: _tabController,
            children: _tabs.map((tab) {
              final filtered = tab['status'] == 'all'
                  ? allDocs
                  : allDocs
                      .where((d) =>
                          (d.data() as Map)['status'] == tab['status'])
                      .toList();

              if (filtered.isEmpty) {
                return _EmptyOrders(status: tab['label']!);
              }

              return ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: filtered.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (_, i) {
                  final data = filtered[i].data() as Map<String, dynamic>;
                  return _OrderCard(
                    data: data,
                    onTap: () => Navigator.pushNamed(
                      context,
                      AppRouter.orderDetail,
                      arguments: data['orderId'] ?? filtered[i].id,
                    ),
                  );
                },
              );
            }).toList(),
          );
        },
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  final Map<String, dynamic> data;
  final VoidCallback onTap;

  const _OrderCard({required this.data, required this.onTap});

  Color _statusColor(String status) {
    switch (status) {
      case 'new':
        return AppTheme.info;
      case 'in_progress':
        return AppTheme.warning;
      case 'review':
        return const Color(0xFF9C27B0);
      case 'completed':
        return AppTheme.success;
      case 'cancelled':
        return AppTheme.error;
      default:
        return AppTheme.grey;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'new':
        return 'جديد';
      case 'in_progress':
        return 'قيد التنفيذ';
      case 'review':
        return 'بانتظار المراجعة';
      case 'completed':
        return 'مكتمل';
      case 'cancelled':
        return 'ملغي';
      default:
        return status;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final status = data['status'] ?? 'new';
    final progress = (data['progress'] ?? 0) as int;
    final color = _statusColor(status);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? AppTheme.blackCard : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: color.withOpacity(0.2)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          data['serviceName'] ?? 'خدمة غير محددة',
                          style: const TextStyle(
                            fontFamily: 'Cairo',
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: color.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          _statusLabel(status),
                          style: TextStyle(
                            fontFamily: 'Cairo',
                            fontSize: 11,
                            color: color,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Icon(Icons.monetization_on_outlined,
                          size: 14, color: AppTheme.grey),
                      const SizedBox(width: 4),
                      Text(
                        '${data['price']?.toString() ?? '0'} د.ع',
                        style: const TextStyle(
                          fontFamily: 'Cairo',
                          fontSize: 13,
                          color: AppTheme.grey,
                        ),
                      ),
                      const SizedBox(width: 16),
                      Icon(Icons.calendar_today_outlined,
                          size: 14, color: AppTheme.grey),
                      const SizedBox(width: 4),
                      Text(
                        _formatDate(data['createdAt']),
                        style: const TextStyle(
                          fontFamily: 'Cairo',
                          fontSize: 13,
                          color: AppTheme.grey,
                        ),
                      ),
                    ],
                  ),
                  if (data['notes'] != null &&
                      (data['notes'] as String).isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      data['notes'],
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontFamily: 'Cairo',
                        fontSize: 12,
                        color: AppTheme.grey,
                      ),
                    ),
                  ],
                ],
              ),
            ),

            // Progress bar
            if (status != 'cancelled') ...[
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'نسبة الإنجاز',
                      style: TextStyle(
                        fontFamily: 'Cairo',
                        fontSize: 11,
                        color: AppTheme.grey,
                      ),
                    ),
                    Text(
                      '$progress%',
                      style: TextStyle(
                        fontFamily: 'Cairo',
                        fontSize: 11,
                        color: color,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: progress / 100,
                    backgroundColor: color.withOpacity(0.1),
                    valueColor: AlwaysStoppedAnimation<Color>(color),
                    minHeight: 6,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatDate(dynamic ts) {
    if (ts == null) return '';
    try {
      final dt = (ts as Timestamp).toDate();
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return '';
    }
  }
}

class _EmptyOrders extends StatelessWidget {
  final String status;
  const _EmptyOrders({required this.status});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 100,
            height: 100,
            decoration: BoxDecoration(
              color: AppTheme.primaryOrange.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.assignment_outlined,
              size: 50,
              color: AppTheme.primaryOrange,
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'لا توجد طلبات',
            style: const TextStyle(
              fontFamily: 'Cairo',
              fontSize: 18,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'اضغط على "طلب جديد" لإنشاء طلبك الأول',
            style: const TextStyle(
              fontFamily: 'Cairo',
              fontSize: 13,
              color: AppTheme.grey,
            ),
          ),
        ],
      ),
    );
  }
}
