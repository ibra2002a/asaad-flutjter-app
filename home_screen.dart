import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../core/theme/app_theme.dart';
import '../../core/routes/app_router.dart';
import '../../core/services/firebase_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _firebase = FirebaseService();
  Map<String, dynamic>? _userProfile;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    final uid = _firebase.currentUser?.uid;
    if (uid != null) {
      final profile = await _firebase.getUserProfile(uid);
      if (mounted) setState(() => _userProfile = profile);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppTheme.black : AppTheme.whiteOff,
      body: CustomScrollView(
        slivers: [
          _buildSliverAppBar(isDark),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildOffersSection(),
                  const SizedBox(height: 24),
                  _buildServicesSection(),
                  const SizedBox(height: 24),
                  _buildRecentWorksSection(),
                  const SizedBox(height: 24),
                  _buildAiAssistantBanner(),
                  const SizedBox(height: 24),
                  _buildStatsSection(),
                  const SizedBox(height: 100),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSliverAppBar(bool isDark) {
    return SliverAppBar(
      expandedHeight: 200,
      floating: false,
      pinned: true,
      backgroundColor: AppTheme.black,
      flexibleSpace: FlexibleSpaceBar(
        background: Container(
          decoration: const BoxDecoration(gradient: AppTheme.splashGradient),
          child: Stack(
            children: [
              Positioned.fill(
                child: CustomPaint(painter: _HomeHeaderPainter()),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 60, 20, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'مرحباً، ${_userProfile?['name'] ?? 'عميلنا العزيز'} 👋',
                              style: const TextStyle(
                                fontFamily: 'Cairo',
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            ),
                            const Text(
                              'ماذا تحتاج اليوم؟',
                              style: TextStyle(
                                fontFamily: 'Cairo',
                                fontSize: 13,
                                color: Colors.white60,
                              ),
                            ),
                          ],
                        ),
                        GestureDetector(
                          onTap: () =>
                              Navigator.pushNamed(context, AppRouter.notifications),
                          child: Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(
                              Icons.notifications_outlined,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 16),

                    // Search bar
                    GestureDetector(
                      onTap: () =>
                          Navigator.pushNamed(context, AppRouter.services),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                              color: Colors.white.withOpacity(0.2)),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.search, color: Colors.white60, size: 20),
                            SizedBox(width: 8),
                            Text(
                              'ابحث عن خدمة...',
                              style: TextStyle(
                                fontFamily: 'Cairo',
                                color: Colors.white60,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildOffersSection() {
    final offers = [
      {
        'title': 'خصم 30% على تصميم الهوية البصرية',
        'subtitle': 'عرض محدود لعملاء جدد',
        'color': AppTheme.primaryOrange,
      },
      {
        'title': 'باقة السوشيال ميديا الشاملة',
        'subtitle': 'إدارة + تصميم + ريلز',
        'color': const Color(0xFF1A1A2E),
      },
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionHeader('العروض الخاصة 🔥', onSeeAll: null),
        const SizedBox(height: 12),
        SizedBox(
          height: 140,
          child: PageView.builder(
            itemCount: offers.length,
            controller: PageController(viewportFraction: 0.9),
            itemBuilder: (_, i) => Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      offers[i]['color'] as Color,
                      (offers[i]['color'] as Color).withOpacity(0.7),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: (offers[i]['color'] as Color).withOpacity(0.3),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      offers[i]['title']!,
                      style: const TextStyle(
                        fontFamily: 'Cairo',
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          offers[i]['subtitle']!,
                          style: const TextStyle(
                            fontFamily: 'Cairo',
                            fontSize: 12,
                            color: Colors.white70,
                          ),
                        ),
                        ElevatedButton(
                          onPressed: () =>
                              Navigator.pushNamed(context, AppRouter.services),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: AppTheme.primaryOrange,
                            padding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 8),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                            elevation: 0,
                          ),
                          child: const Text(
                            'اطلب الآن',
                            style: TextStyle(
                              fontFamily: 'Cairo',
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildServicesSection() {
    final services = [
      {'icon': Icons.people_alt_outlined, 'label': 'إدارة السوشيال', 'color': const Color(0xFF4CAF50)},
      {'icon': Icons.brush_outlined, 'label': 'تصميم المنشورات', 'color': const Color(0xFF2196F3)},
      {'icon': Icons.diamond_outlined, 'label': 'الهوية البصرية', 'color': const Color(0xFF9C27B0)},
      {'icon': Icons.play_circle_outline, 'label': 'إنتاج الفيديو', 'color': const Color(0xFFF44336)},
      {'icon': Icons.campaign_outlined, 'label': 'حملات ممولة', 'color': AppTheme.primaryOrange},
      {'icon': Icons.web_outlined, 'label': 'تصميم مواقع', 'color': const Color(0xFF00BCD4)},
      {'icon': Icons.phone_android_outlined, 'label': 'تطوير تطبيقات', 'color': const Color(0xFFFF5722)},
      {'icon': Icons.search_outlined, 'label': 'SEO', 'color': const Color(0xFF607D8B)},
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionHeader(
          'خدماتنا',
          onSeeAll: () => Navigator.pushNamed(context, AppRouter.services),
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 4,
            childAspectRatio: 0.85,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
          ),
          itemCount: services.length,
          itemBuilder: (_, i) => GestureDetector(
            onTap: () => Navigator.pushNamed(context, AppRouter.services),
            child: Column(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: (services[i]['color'] as Color).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: (services[i]['color'] as Color).withOpacity(0.2),
                    ),
                  ),
                  child: Icon(
                    services[i]['icon'] as IconData,
                    color: services[i]['color'] as Color,
                    size: 26,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  services[i]['label'] as String,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  style: const TextStyle(
                    fontFamily: 'Cairo',
                    fontSize: 10,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildRecentWorksSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionHeader(
          'أحدث أعمالنا',
          onSeeAll: () => Navigator.pushNamed(context, AppRouter.portfolio),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 200,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: 5,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (_, i) => Container(
              width: 160,
              decoration: BoxDecoration(
                color: AppTheme.blackCard,
                borderRadius: BorderRadius.circular(16),
                gradient: LinearGradient(
                  colors: [
                    AppTheme.primaryOrange.withOpacity(0.2),
                    AppTheme.black,
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    bottom: 12,
                    left: 12,
                    right: 12,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _getWorkTitle(i),
                          style: const TextStyle(
                            fontFamily: 'Cairo',
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                        Text(
                          _getWorkCategory(i),
                          style: const TextStyle(
                            fontFamily: 'Cairo',
                            fontSize: 10,
                            color: AppTheme.primaryOrange,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Positioned(
                    top: 12,
                    right: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryOrange,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Text(
                        'مكتمل',
                        style: TextStyle(
                          fontFamily: 'Cairo',
                          fontSize: 9,
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                  Center(
                    child: Icon(
                      _getWorkIcon(i),
                      size: 60,
                      color: AppTheme.primaryOrange.withOpacity(0.3),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildAiAssistantBanner() {
    return GestureDetector(
      onTap: () => Navigator.pushNamed(context, AppRouter.aiAssistant),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF1A0A00), Color(0xFF2D1500)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: AppTheme.primaryOrange.withOpacity(0.3),
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppTheme.primaryOrange, AppTheme.primaryOrangeDark],
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(Icons.auto_awesome, color: Colors.white, size: 28),
            ),
            const SizedBox(width: 16),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Asaad AI 🤖',
                    style: TextStyle(
                      fontFamily: 'Cairo',
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.primaryOrange,
                    ),
                  ),
                  Text(
                    'مساعدك الذكي للتسويق - اكتب كابشنات، أفكار محتوى، خطط تسويقية',
                    style: TextStyle(
                      fontFamily: 'Cairo',
                      fontSize: 12,
                      color: Colors.white60,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.arrow_forward_ios,
                color: AppTheme.primaryOrange, size: 16),
          ],
        ),
      ),
    );
  }

  Widget _buildStatsSection() {
    return Row(
      children: [
        _StatCard(label: 'عميل راضٍ', value: '+500', icon: Icons.people),
        const SizedBox(width: 12),
        _StatCard(label: 'مشروع مكتمل', value: '+1200', icon: Icons.check_circle),
        const SizedBox(width: 12),
        _StatCard(label: 'سنة خبرة', value: '5+', icon: Icons.star),
      ],
    );
  }

  Widget _buildSectionHeader(String title, {VoidCallback? onSeeAll}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontFamily: 'Cairo',
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
        if (onSeeAll != null)
          GestureDetector(
            onTap: onSeeAll,
            child: const Text(
              'عرض الكل',
              style: TextStyle(
                fontFamily: 'Cairo',
                fontSize: 13,
                color: AppTheme.primaryOrange,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
      ],
    );
  }

  String _getWorkTitle(int i) {
    const titles = [
      'هوية بصرية - مطعم بغداد',
      'حملة تسويقية - شركة كهرباء',
      'موقع إلكتروني - عيادة طبية',
      'ريلز - منتج عراقي',
      'شعار - مكتب محاماة',
    ];
    return titles[i];
  }

  String _getWorkCategory(int i) {
    const cats = ['هوية بصرية', 'تسويق رقمي', 'تصميم ويب', 'فيديو', 'تصميم شعار'];
    return cats[i];
  }

  IconData _getWorkIcon(int i) {
    const icons = [
      Icons.diamond_outlined,
      Icons.campaign_outlined,
      Icons.web_outlined,
      Icons.video_camera_back_outlined,
      Icons.brush_outlined,
    ];
    return icons[i];
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;

  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? AppTheme.blackCard : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: AppTheme.primaryOrange.withOpacity(0.2),
          ),
        ),
        child: Column(
          children: [
            Icon(icon, color: AppTheme.primaryOrange, size: 28),
            const SizedBox(height: 8),
            Text(
              value,
              style: const TextStyle(
                fontFamily: 'Cairo',
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppTheme.primaryOrange,
              ),
            ),
            Text(
              label,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontFamily: 'Cairo',
                fontSize: 10,
                color: AppTheme.grey,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HomeHeaderPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppTheme.primaryOrange.withOpacity(0.06)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    for (int i = 1; i <= 4; i++) {
      canvas.drawCircle(
        Offset(size.width + 20, -20),
        i * 50.0,
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
