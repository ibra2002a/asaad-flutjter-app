import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'dart:io';
import '../../core/theme/app_theme.dart';
import '../../core/routes/app_router.dart';
import '../../core/services/firebase_service.dart';
import '../../core/widgets/custom_button.dart';
import '../../core/widgets/custom_text_field.dart';
import '../../core/widgets/loading_overlay.dart';

class CreateOrderScreen extends StatefulWidget {
  const CreateOrderScreen({super.key});

  @override
  State<CreateOrderScreen> createState() => _CreateOrderScreenState();
}

class _CreateOrderScreenState extends State<CreateOrderScreen> {
  final _formKey = GlobalKey<FormState>();
  final _notesController = TextEditingController();
  final _firebase = FirebaseService();

  String? _selectedServiceId;
  String? _selectedServiceName;
  double _selectedPrice = 0;
  bool _isLoading = false;
  final List<File> _attachedImages = [];
  final List<PlatformFile> _attachedFiles = [];

  final _services = [
    {'id': 'social_management', 'name': 'إدارة صفحات التواصل الاجتماعي', 'price': 250000.0},
    {'id': 'post_design', 'name': 'تصميم منشورات السوشيال ميديا', 'price': 50000.0},
    {'id': 'brand_identity', 'name': 'تصميم الهويات البصرية', 'price': 500000.0},
    {'id': 'logo_design', 'name': 'تصميم الشعارات', 'price': 150000.0},
    {'id': 'video_production', 'name': 'إنتاج الفيديو والمونتاج', 'price': 300000.0},
    {'id': 'photography', 'name': 'التصوير الاحترافي', 'price': 200000.0},
    {'id': 'paid_ads', 'name': 'الحملات الإعلانية الممولة', 'price': 400000.0},
    {'id': 'web_design', 'name': 'تصميم المواقع الإلكترونية', 'price': 1000000.0},
    {'id': 'app_development', 'name': 'تطوير تطبيقات الهاتف', 'price': 3000000.0},
    {'id': 'seo', 'name': 'تحسين محركات البحث SEO', 'price': 350000.0},
  ];

  Future<void> _pickImages() async {
    final picker = ImagePicker();
    final picked = await picker.pickMultiImage();
    setState(() {
      _attachedImages.addAll(picked.map((x) => File(x.path)));
    });
  }

  Future<void> _pickFiles() async {
    final result = await FilePicker.platform.pickFiles(allowMultiple: true);
    if (result != null) {
      setState(() => _attachedFiles.addAll(result.files));
    }
  }

  Future<void> _submitOrder() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedServiceId == null) {
      _showError('الرجاء اختيار الخدمة');
      return;
    }

    setState(() => _isLoading = true);
    try {
      final uid = _firebase.currentUser!.uid;

      // Upload files
      List<String> attachmentUrls = [];
      for (final img in _attachedImages) {
        final url = await _firebase.uploadFile(
          img,
          'orders/$uid/${DateTime.now().millisecondsSinceEpoch}.jpg',
        );
        attachmentUrls.add(url);
      }

      // Create order
      final orderId = await _firebase.createOrder(
        clientId: uid,
        serviceId: _selectedServiceId!,
        serviceName: _selectedServiceName!,
        price: _selectedPrice,
        notes: _notesController.text,
        attachments: attachmentUrls,
      );

      // Send notification to admin
      await _firebase.createNotification(
        userId: 'admin',
        title: 'طلب جديد',
        body: 'طلب جديد: $_selectedServiceName',
        type: 'new_order',
        orderId: orderId,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('تم إرسال طلبك بنجاح! ✅',
                style: TextStyle(fontFamily: 'Cairo')),
            backgroundColor: AppTheme.success,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
        Navigator.pushReplacementNamed(
          context,
          AppRouter.orderDetail,
          arguments: orderId,
        );
      }
    } catch (e) {
      _showError('حدث خطأ، حاول مرة أخرى');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg, style: const TextStyle(fontFamily: 'Cairo')),
        backgroundColor: AppTheme.error,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return LoadingOverlay(
      isLoading: _isLoading,
      child: Scaffold(
        backgroundColor: isDark ? AppTheme.black : AppTheme.whiteOff,
        appBar: AppBar(
          backgroundColor: isDark ? AppTheme.black : AppTheme.white,
          title: const Text(
            'إنشاء طلب جديد',
            style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w800),
          ),
        ),
        body: Form(
          key: _formKey,
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Step 1 - Service selection
                _buildStepHeader('1', 'اختر الخدمة'),
                const SizedBox(height: 12),
                ...(_services.map((s) => _ServiceTile(
                      name: s['name'] as String,
                      price: s['price'] as double,
                      isSelected: _selectedServiceId == s['id'],
                      onTap: () => setState(() {
                        _selectedServiceId = s['id'] as String;
                        _selectedServiceName = s['name'] as String;
                        _selectedPrice = s['price'] as double;
                      }),
                    ))),

                const SizedBox(height: 24),

                // Step 2 - Price summary
                if (_selectedServiceId != null) ...[
                  _buildStepHeader('2', 'ملخص الطلب'),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [
                          Color(0xFF1A0A00),
                          Color(0xFF2D1500),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                          color: AppTheme.primaryOrange.withOpacity(0.3)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _selectedServiceName ?? '',
                              style: const TextStyle(
                                fontFamily: 'Cairo',
                                fontSize: 14,
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const Text(
                              'السعر الابتدائي',
                              style: TextStyle(
                                  fontFamily: 'Cairo',
                                  fontSize: 11,
                                  color: Colors.white54),
                            ),
                          ],
                        ),
                        Text(
                          '${_selectedPrice.toStringAsFixed(0)} د.ع',
                          style: const TextStyle(
                            fontFamily: 'Cairo',
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: AppTheme.primaryOrange,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                ],

                // Step 3 - Notes
                _buildStepHeader('3', 'الملاحظات والتفاصيل'),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: _notesController,
                  label: 'اكتب تفاصيل طلبك هنا...',
                  maxLines: 5,
                  prefixIcon: Icons.notes_outlined,
                ),

                const SizedBox(height: 24),

                // Step 4 - Attachments
                _buildStepHeader('4', 'المرفقات'),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _AttachButton(
                        icon: Icons.image_outlined,
                        label: 'رفع صور',
                        count: _attachedImages.length,
                        onTap: _pickImages,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _AttachButton(
                        icon: Icons.attach_file_outlined,
                        label: 'رفع ملفات',
                        count: _attachedFiles.length,
                        onTap: _pickFiles,
                      ),
                    ),
                  ],
                ),

                // Image preview
                if (_attachedImages.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 80,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: _attachedImages.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 8),
                      itemBuilder: (_, i) => Stack(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Image.file(
                              _attachedImages[i],
                              width: 80,
                              height: 80,
                              fit: BoxFit.cover,
                            ),
                          ),
                          Positioned(
                            top: 2,
                            right: 2,
                            child: GestureDetector(
                              onTap: () => setState(
                                  () => _attachedImages.removeAt(i)),
                              child: Container(
                                width: 20,
                                height: 20,
                                decoration: const BoxDecoration(
                                  color: AppTheme.error,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.close,
                                    color: Colors.white, size: 12),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],

                const SizedBox(height: 32),

                // Submit button
                CustomButton(
                  label: 'إرسال الطلب',
                  icon: Icons.send_rounded,
                  onPressed: _submitOrder,
                ),

                const SizedBox(height: 40),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStepHeader(String step, String title) {
    return Row(
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppTheme.primaryOrange, AppTheme.primaryOrangeDark],
            ),
            borderRadius: BorderRadius.circular(10),
          ),
          alignment: Alignment.center,
          child: Text(
            step,
            style: const TextStyle(
              fontFamily: 'Cairo',
              color: Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: 14,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Text(
          title,
          style: const TextStyle(
            fontFamily: 'Cairo',
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

class _ServiceTile extends StatelessWidget {
  final String name;
  final double price;
  final bool isSelected;
  final VoidCallback onTap;

  const _ServiceTile({
    required this.name,
    required this.price,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected
              ? AppTheme.primaryOrange.withOpacity(0.1)
              : (isDark ? AppTheme.blackCard : Colors.white),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected
                ? AppTheme.primaryOrange
                : (isDark
                    ? const Color(0xFF2A2A2A)
                    : const Color(0xFFE8E8E8)),
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isSelected ? AppTheme.primaryOrange : Colors.transparent,
                border: Border.all(
                  color: isSelected ? AppTheme.primaryOrange : AppTheme.grey,
                  width: 2,
                ),
              ),
              child: isSelected
                  ? const Icon(Icons.check, color: Colors.white, size: 14)
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                name,
                style: TextStyle(
                  fontFamily: 'Cairo',
                  fontSize: 13,
                  fontWeight:
                      isSelected ? FontWeight.w700 : FontWeight.w500,
                  color: isSelected ? AppTheme.primaryOrange : null,
                ),
              ),
            ),
            Text(
              '${price.toStringAsFixed(0)} د.ع',
              style: TextStyle(
                fontFamily: 'Cairo',
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: isSelected ? AppTheme.primaryOrange : AppTheme.grey,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AttachButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final int count;
  final VoidCallback onTap;

  const _AttachButton({
    required this.icon,
    required this.label,
    required this.count,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final hasItems = count > 0;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: hasItems
              ? AppTheme.primaryOrange.withOpacity(0.1)
              : (isDark ? AppTheme.blackCard : Colors.white),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: hasItems ? AppTheme.primaryOrange : AppTheme.grey.withOpacity(0.3),
            style: BorderStyle.solid,
          ),
        ),
        child: Column(
          children: [
            Icon(
              icon,
              color: hasItems ? AppTheme.primaryOrange : AppTheme.grey,
              size: 28,
            ),
            const SizedBox(height: 6),
            Text(
              hasItems ? '$label ($count)' : label,
              style: TextStyle(
                fontFamily: 'Cairo',
                fontSize: 12,
                color: hasItems ? AppTheme.primaryOrange : AppTheme.grey,
                fontWeight:
                    hasItems ? FontWeight.w700 : FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
