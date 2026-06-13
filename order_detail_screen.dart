import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/theme/app_theme.dart';
import '../../core/routes/app_router.dart';
import '../../core/services/firebase_service.dart';
import '../../core/widgets/custom_button.dart';

class OrderDetailScreen extends StatelessWidget {
  final String orderId;
  const OrderDetailScreen({super.key, required this.orderId});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final firebase = FirebaseService();

    return Scaffold(
      backgroundColor: isDark ? AppTheme.black : AppTheme.whiteOff,
      appBar: AppBar(
        backgroundColor: isDark ? AppTheme.black : AppTheme.white,
        title: const Text(
          'تفاصيل الطلب',
          style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w800),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.chat_outlined, color: AppTheme.primaryOrange),
            onPressed: () => Navigator.pushNamed(
              context,
              AppRouter.chatDetail,
              arguments: {
                'chatId': 'chat_${firebase.currentUser?.uid}',
                'name': 'الدعم الفني',
              },
            ),
          ),
        ],
      ),
      body: StreamBuilder<DocumentSnapshot>(
        stream: firebase.orders.doc(orderId).snapshots(),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(
                child: CircularProgressIndicator(color: AppTheme.primaryOrange));
          }
          final data = snapshot.data!.data() as Map<String, dynamic>? ?? {};
          return _OrderDetailBody(data: data, orderId: orderId);
        },
      ),
    );
  }
}

class _OrderDetailBody extends StatelessWidget {
  final Map<String, dynamic> data;
  final String orderId;

  const _OrderDetailBody({required this.data, required this.orderId});

  Color _statusColor(String s) {
    switch (s) {
      case 'new': return AppTheme.info;
      case 'in_progress': return AppTheme.warning;
      case 'review': return const Color(0xFF9C27B0);
      case 'completed': return AppTheme.success;
      case 'cancelled': return AppTheme.error;
      default: return AppTheme.grey;
    }
  }

  String _statusLabel(String s) {
    switch (s) {
      case 'new': return 'جديد';
      case 'in_progress': return 'قيد التنفيذ';
      case 'review': return 'بانتظار المراجعة';
      case 'completed': return 'مكتمل ✅';
      case 'cancelled': return 'ملغي ❌';
      default: return s;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final status = data['status'] ?? 'new';
    final progress = (data['progress'] ?? 0) as int;
    final color = _statusColor(status);
    final isPaid = data['isPaid'] ?? false;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Status header
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [color.withOpacity(0.15), color.withOpacity(0.05)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: color.withOpacity(0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        data['serviceName'] ?? '',
                        style: const TextStyle(
                          fontFamily: 'Cairo',
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: color,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        _statusLabel(status),
                        style: const TextStyle(
                          fontFamily: 'Cairo',
                          fontSize: 12,
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                // Progress bar
                if (status != 'cancelled') ...[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('نسبة الإنجاز',
                          style: TextStyle(fontFamily: 'Cairo', fontSize: 13, color: AppTheme.grey)),
                      Text(
                        '$progress%',
                        style: TextStyle(
                          fontFamily: 'Cairo',
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: color,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: LinearProgressIndicator(
                      value: progress / 100,
                      backgroundColor: color.withOpacity(0.1),
                      valueColor: AlwaysStoppedAnimation<Color>(color),
                      minHeight: 10,
                    ),
                  ),
                ],
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Info cards row
          Row(
            children: [
              Expanded(child: _InfoCard(icon: Icons.monetization_on_outlined, label: 'السعر', value: '${data['price']?.toStringAsFixed(0) ?? 0} د.ع', color: AppTheme.success)),
              const SizedBox(width: 10),
              Expanded(child: _InfoCard(icon: isPaid ? Icons.check_circle : Icons.pending_outlined, label: 'الدفع', value: isPaid ? 'مدفوع' : 'معلق', color: isPaid ? AppTheme.success : AppTheme.warning)),
            ],
          ),

          const SizedBox(height: 20),

          // Order timeline
          const Text('مراحل الطلب', style: TextStyle(fontFamily: 'Cairo', fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          _OrderTimeline(status: status),

          const SizedBox(height: 20),

          // Notes
          if ((data['notes'] ?? '').isNotEmpty) ...[
            const Text('ملاحظات الطلب', style: TextStyle(fontFamily: 'Cairo', fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isDark ? AppTheme.blackCard : Colors.white,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(
                data['notes'],
                style: const TextStyle(fontFamily: 'Cairo', fontSize: 14, height: 1.6),
                textDirection: TextDirection.rtl,
              ),
            ),
            const SizedBox(height: 20),
          ],

          // Attachments
          if ((data['attachments'] as List?)?.isNotEmpty == true) ...[
            const Text('المرفقات', style: TextStyle(fontFamily: 'Cairo', fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            SizedBox(
              height: 90,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: (data['attachments'] as List).length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) => ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Image.network(
                    (data['attachments'] as List)[i],
                    width: 90,
                    height: 90,
                    fit: BoxFit.cover,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 20),
          ],

          // Action buttons
          if (status == 'completed' && !isPaid)
            CustomButton(
              label: 'الدفع الآن',
              icon: Icons.payment_rounded,
              onPressed: () => Navigator.pushNamed(
                context,
                AppRouter.payment,
                arguments: {'orderId': orderId, 'amount': data['price']},
              ),
            ),

          if (status == 'completed' && (data['hasReview'] != true))
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: OutlinedButton.icon(
                onPressed: () => _showReviewDialog(context),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppTheme.primaryOrange),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  minimumSize: const Size(double.infinity, 0),
                ),
                icon: const Icon(Icons.star_outline, color: AppTheme.primaryOrange),
                label: const Text('تقييم الخدمة', style: TextStyle(fontFamily: 'Cairo', color: AppTheme.primaryOrange, fontWeight: FontWeight.w700)),
              ),
            ),

          if (status == 'new')
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: OutlinedButton.icon(
                onPressed: () => _cancelOrder(context),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppTheme.error),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  minimumSize: const Size(double.infinity, 0),
                ),
                icon: const Icon(Icons.cancel_outlined, color: AppTheme.error),
                label: const Text('إلغاء الطلب', style: TextStyle(fontFamily: 'Cairo', color: AppTheme.error, fontWeight: FontWeight.w700)),
              ),
            ),

          const SizedBox(height: 40),
        ],
      ),
    );
  }

  void _showReviewDialog(BuildContext context) {
    double rating = 5;
    final commentController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('تقييم الخدمة ⭐', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700)),
        content: StatefulBuilder(
          builder: (ctx, setS) => Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(5, (i) => GestureDetector(
                  onTap: () => setS(() => rating = i + 1.0),
                  child: Icon(
                    i < rating ? Icons.star_rounded : Icons.star_outline_rounded,
                    color: AppTheme.warning,
                    size: 36,
                  ),
                )),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: commentController,
                maxLines: 3,
                decoration: const InputDecoration(
                  hintText: 'اكتب تعليقك هنا...',
                  hintStyle: TextStyle(fontFamily: 'Cairo'),
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء', style: TextStyle(fontFamily: 'Cairo'))),
          ElevatedButton(
            onPressed: () async {
              final firebase = FirebaseService();
              await firebase.submitReview(
                orderId: orderId,
                clientId: firebase.currentUser!.uid,
                clientName: 'عميل',
                rating: rating,
                comment: commentController.text,
              );
              if (ctx.mounted) Navigator.pop(ctx);
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryOrange),
            child: const Text('إرسال', style: TextStyle(fontFamily: 'Cairo', color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _cancelOrder(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('تأكيد الإلغاء', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700)),
        content: const Text('هل أنت متأكد من إلغاء الطلب؟', style: TextStyle(fontFamily: 'Cairo')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('لا', style: TextStyle(fontFamily: 'Cairo'))),
          ElevatedButton(
            onPressed: () async {
              await FirebaseService().updateOrderStatus(orderId: orderId, status: 'cancelled', progress: 0);
              if (ctx.mounted) Navigator.pop(ctx);
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.error),
            child: const Text('نعم، إلغاء', style: TextStyle(fontFamily: 'Cairo', color: Colors.white)),
          ),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _InfoCard({required this.icon, required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.blackCard : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(fontFamily: 'Cairo', fontSize: 11, color: AppTheme.grey)),
              Text(value, style: TextStyle(fontFamily: 'Cairo', fontSize: 14, fontWeight: FontWeight.w700, color: color)),
            ],
          ),
        ],
      ),
    );
  }
}

class _OrderTimeline extends StatelessWidget {
  final String status;
  const _OrderTimeline({required this.status});

  @override
  Widget build(BuildContext context) {
    final steps = [
      {'label': 'تم استلام الطلب', 'status': 'new', 'icon': Icons.assignment_turned_in_outlined},
      {'label': 'قيد التنفيذ', 'status': 'in_progress', 'icon': Icons.build_outlined},
      {'label': 'بانتظار المراجعة', 'status': 'review', 'icon': Icons.visibility_outlined},
      {'label': 'مكتمل', 'status': 'completed', 'icon': Icons.check_circle_outline},
    ];

    final statusOrder = ['new', 'in_progress', 'review', 'completed'];
    final currentIndex = statusOrder.indexOf(status);

    return Column(
      children: List.generate(steps.length, (i) {
        final isCompleted = i <= currentIndex && status != 'cancelled';
        final isCurrent = i == currentIndex && status != 'cancelled';
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Column(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isCompleted ? AppTheme.primaryOrange : AppTheme.grey.withOpacity(0.2),
                    boxShadow: isCurrent ? [BoxShadow(color: AppTheme.primaryOrange.withOpacity(0.4), blurRadius: 8)] : null,
                  ),
                  child: Icon(
                    steps[i]['icon'] as IconData,
                    color: isCompleted ? Colors.white : AppTheme.grey,
                    size: 18,
                  ),
                ),
                if (i < steps.length - 1)
                  Container(
                    width: 2,
                    height: 30,
                    color: i < currentIndex ? AppTheme.primaryOrange : AppTheme.grey.withOpacity(0.2),
                  ),
              ],
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: 8, bottom: 24),
                child: Text(
                  steps[i]['label'] as String,
                  style: TextStyle(
                    fontFamily: 'Cairo',
                    fontSize: 14,
                    fontWeight: isCurrent ? FontWeight.w700 : FontWeight.w400,
                    color: isCompleted ? null : AppTheme.grey,
                  ),
                ),
              ),
            ),
          ],
        );
      }),
    );
  }
}
