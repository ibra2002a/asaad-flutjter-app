import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/services/firebase_service.dart';

class PortfolioScreen extends StatefulWidget {
  const PortfolioScreen({super.key});

  @override
  State<PortfolioScreen> createState() => _PortfolioScreenState();
}

class _PortfolioScreenState extends State<PortfolioScreen>
    with SingleTickerProviderStateMixin {
  String _selectedCategory = 'all';
  late AnimationController _animController;

  final _categories = [
    {'id': 'all', 'label': 'الكل'},
    {'id': 'design', 'label': 'تصميم'},
    {'id': 'social', 'label': 'سوشيال ميديا'},
    {'id': 'video', 'label': 'فيديو'},
    {'id': 'web', 'label': 'مواقع'},
    {'id': 'brand', 'label': 'هوية بصرية'},
  ];

  // Static portfolio items (in production load from Firestore)
  final _items = [
    {'title': 'هوية بصرية - مطعم الرافدين', 'category': 'brand', 'type': 'image', 'gradient': [0xFFFF6B00, 0xFFCC5500]},
    {'title': 'موقع عيادة طبية', 'category': 'web', 'type': 'image', 'gradient': [0xFF2196F3, 0xFF0D47A1]},
    {'title': 'ريلز إعلاني - متجر ملابس', 'category': 'video', 'type': 'video', 'gradient': [0xFF9C27B0, 0xFF4A148C]},
    {'title': 'إدارة سوشيال ميديا - كافيه', 'category': 'social', 'type': 'image', 'gradient': [0xFF4CAF50, 0xFF1B5E20]},
    {'title': 'شعار شركة مقاولات', 'category': 'design', 'type': 'image', 'gradient': [0xFFF44336, 0xFFB71C1C]},
    {'title': 'حملة رمضان - سوبرماركت', 'category': 'social', 'type': 'image', 'gradient': [0xFFFF9800, 0xFFE65100]},
    {'title': 'موشن جرافيك - منتج عراقي', 'category': 'video', 'type': 'video', 'gradient': [0xFF00BCD4, 0xFF006064]},
    {'title': 'هوية مكتب محاماة', 'category': 'brand', 'type': 'image', 'gradient': [0xFF607D8B, 0xFF263238]},
    {'title': 'تطبيق توصيل', 'category': 'web', 'type': 'image', 'gradient': [0xFFE91E63, 0xFF880E4F]},
    {'title': 'بوستات رمضان', 'category': 'design', 'type': 'image', 'gradient': [0xFF3F51B5, 0xFF1A237E]},
    {'title': 'فيديو منتج تجميل', 'category': 'video', 'type': 'video', 'gradient': [0xFFFF5722, 0xFFBF360C]},
    {'title': 'صفحة انستغرام صالون', 'category': 'social', 'type': 'image', 'gradient': [0xFF009688, 0xFF004D40]},
  ];

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    )..forward();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> get _filteredItems {
    if (_selectedCategory == 'all') return _items;
    return _items.where((i) => i['category'] == _selectedCategory).toList();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppTheme.black : AppTheme.whiteOff,
      appBar: AppBar(
        backgroundColor: isDark ? AppTheme.black : AppTheme.white,
        title: const Text(
          'معرض أعمالنا',
          style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w800),
        ),
      ),
      body: Column(
        children: [
          // Stats bar
          Container(
            padding: const EdgeInsets.symmetric(vertical: 16),
            color: isDark ? AppTheme.blackCard : Colors.white,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _QuickStat(label: 'مشروع', value: '${_items.length}+'),
                _Divider(),
                const _QuickStat(label: 'عميل راضٍ', value: '500+'),
                _Divider(),
                const _QuickStat(label: 'تصنيف', value: '5 ⭐'),
              ],
            ),
          ),

          // Category filter
          SizedBox(
            height: 50,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              itemCount: _categories.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final cat = _categories[i];
                final isSelected = _selectedCategory == cat['id'];
                return GestureDetector(
                  onTap: () {
                    setState(() => _selectedCategory = cat['id']!);
                    _animController
                      ..reset()
                      ..forward();
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    decoration: BoxDecoration(
                      color: isSelected ? AppTheme.primaryOrange : Colors.transparent,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: isSelected
                            ? AppTheme.primaryOrange
                            : AppTheme.grey.withOpacity(0.3),
                      ),
                    ),
                    child: Text(
                      cat['label']!,
                      style: TextStyle(
                        fontFamily: 'Cairo',
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: isSelected ? Colors.white : AppTheme.grey,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),

          // Grid
          Expanded(
            child: AnimatedBuilder(
              animation: _animController,
              builder: (_, child) => FadeTransition(
                opacity: _animController,
                child: child,
              ),
              child: GridView.builder(
                padding: const EdgeInsets.all(16),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  childAspectRatio: 0.85,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                ),
                itemCount: _filteredItems.length,
                itemBuilder: (_, i) =>
                    _PortfolioCard(item: _filteredItems[i]),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PortfolioCard extends StatelessWidget {
  final Map<String, dynamic> item;

  const _PortfolioCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final colors = (item['gradient'] as List)
        .map((c) => Color(c as int))
        .toList();
    final isVideo = item['type'] == 'video';

    return GestureDetector(
      onTap: () => _showPreview(context),
      child: Hero(
        tag: item['title']!,
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: colors,
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: colors[0].withOpacity(0.3),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Stack(
            children: [
              // Pattern overlay
              Positioned.fill(
                child: CustomPaint(painter: _CardPatternPainter()),
              ),

              // Video indicator
              if (isVideo)
                const Center(
                  child: Icon(
                    Icons.play_circle_filled_rounded,
                    color: Colors.white70,
                    size: 48,
                  ),
                ),

              // Category badge
              Positioned(
                top: 12,
                right: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.4),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    isVideo ? '🎬 فيديو' : '🖼️ تصميم',
                    style: const TextStyle(
                        fontFamily: 'Cairo', fontSize: 10, color: Colors.white),
                  ),
                ),
              ),

              // Title
              Positioned(
                bottom: 12,
                left: 12,
                right: 12,
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.5),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    item['title'] as String,
                    style: const TextStyle(
                      fontFamily: 'Cairo',
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showPreview(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: Container(
                height: 300,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: (item['gradient'] as List)
                        .map((c) => Color(c as int))
                        .toList(),
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        item['type'] == 'video'
                            ? Icons.play_circle_filled_rounded
                            : Icons.image_rounded,
                        color: Colors.white,
                        size: 60,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        item['title'] as String,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontFamily: 'Cairo',
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                ElevatedButton.icon(
                  onPressed: () => Navigator.pop(ctx),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryOrange,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  icon: const Icon(Icons.close, color: Colors.white, size: 18),
                  label: const Text('إغلاق',
                      style: TextStyle(fontFamily: 'Cairo', color: Colors.white)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _CardPatternPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withOpacity(0.06)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    for (int i = 0; i < 3; i++) {
      canvas.drawCircle(
        Offset(size.width * 0.8, size.height * 0.2),
        30.0 + i * 25,
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _QuickStat extends StatelessWidget {
  final String label;
  final String value;
  const _QuickStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) => Column(
        children: [
          Text(value,
              style: const TextStyle(
                  fontFamily: 'Cairo',
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AppTheme.primaryOrange)),
          Text(label,
              style: const TextStyle(
                  fontFamily: 'Cairo', fontSize: 11, color: AppTheme.grey)),
        ],
      );
}

class _Divider extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
        width: 1,
        height: 30,
        color: AppTheme.grey.withOpacity(0.2),
      );
}
