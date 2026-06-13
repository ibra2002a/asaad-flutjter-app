import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:math';
import '../../core/theme/app_theme.dart';

class AiAssistantScreen extends StatefulWidget {
  const AiAssistantScreen({super.key});

  @override
  State<AiAssistantScreen> createState() => _AiAssistantScreenState();
}

class _AiAssistantScreenState extends State<AiAssistantScreen>
    with TickerProviderStateMixin {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  final List<_ChatMessage> _messages = [];
  bool _isTyping = false;
  String _selectedCategory = 'all';

  late AnimationController _pulseController;
  late Animation<double> _pulseAnim;

  final _categories = [
    {'id': 'all', 'label': 'الكل', 'icon': Icons.grid_view_rounded},
    {'id': 'caption', 'label': 'كابشن', 'icon': Icons.edit_note},
    {'id': 'content', 'label': 'أفكار محتوى', 'icon': Icons.lightbulb_outline},
    {'id': 'scenario', 'label': 'سيناريو', 'icon': Icons.movie_creation_outlined},
    {'id': 'campaign', 'label': 'حملة', 'icon': Icons.campaign_outlined},
    {'id': 'hashtag', 'label': 'هاشتاقات', 'icon': Icons.tag},
    {'id': 'plan', 'label': 'خطة تسويق', 'icon': Icons.calendar_month_outlined},
  ];

  final _quickPrompts = [
    'اكتب كابشن إعلاني لمطعم عراقي',
    'أعطني 10 أفكار محتوى لصالون تجميل',
    'اكتب سيناريو فيديو إعلاني 30 ثانية لمتجر ملابس',
    'أنشئ خطة تسويقية شهرية لمقهى',
    'اقترح هاشتاقات لمنتج عراقي',
    'اكتب حملة تسويقية لعيد الأضحى',
  ];

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    _pulseAnim = Tween<double>(begin: 0.8, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    _addWelcomeMessage();
  }

  void _addWelcomeMessage() {
    _messages.add(_ChatMessage(
      content:
          'مرحباً! أنا Asaad AI 🤖\n\nمساعدك الذكي في التسويق الرقمي. يمكنني مساعدتك في:\n\n✅ كتابة كابشنات إعلانية احترافية\n✅ توليد أفكار محتوى إبداعية\n✅ كتابة سيناريوهات فيديو\n✅ تصميم حملات تسويقية\n✅ اقتراح هاشتاقات مناسبة\n✅ إنشاء خطط تسويق كاملة\n\nبماذا يمكنني مساعدتك اليوم؟',
      isUser: false,
      timestamp: DateTime.now(),
    ));
  }

  Future<void> _sendMessage(String content) async {
    if (content.trim().isEmpty) return;

    setState(() {
      _messages.add(_ChatMessage(
        content: content,
        isUser: true,
        timestamp: DateTime.now(),
      ));
      _isTyping = true;
    });

    _messageController.clear();
    _scrollToBottom();

    // Simulate AI response (in production, connect to actual AI API)
    await Future.delayed(
        Duration(milliseconds: 1000 + Random().nextInt(1500)));

    final response = _generateAiResponse(content);

    if (mounted) {
      setState(() {
        _isTyping = false;
        _messages.add(_ChatMessage(
          content: response,
          isUser: false,
          timestamp: DateTime.now(),
        ));
      });
      _scrollToBottom();
    }
  }

  String _generateAiResponse(String input) {
    final lower = input.toLowerCase();

    if (lower.contains('كابشن') || lower.contains('caption')) {
      return _generateCaption(input);
    } else if (lower.contains('سيناريو') || lower.contains('فيديو')) {
      return _generateScenario(input);
    } else if (lower.contains('هاشتاق') || lower.contains('hashtag')) {
      return _generateHashtags(input);
    } else if (lower.contains('خطة') || lower.contains('plan')) {
      return _generateMarketingPlan(input);
    } else if (lower.contains('حملة') || lower.contains('campaign')) {
      return _generateCampaign(input);
    } else if (lower.contains('أفكار') || lower.contains('محتوى')) {
      return _generateContentIdeas(input);
    } else {
      return _generateGenericResponse(input);
    }
  }

  String _generateCaption(String input) {
    return '''✨ كابشن إعلاني احترافي:

---

🔥 **النسخة الأولى - المشاعرية:**
"بين كل لقمة وأخرى... قصة من الدفء العراقي الأصيل 🇮🇶
تعال وجرب الفرق الحقيقي!
📍 نحن ننتظرك
📞 احجز طاولتك الآن"

---

💡 **النسخة الثانية - العروض:**
"وجبتك المفضلة + مشروب مجاناً 🎁
عرض لفترة محدودة فقط!
لا تفوّت الفرصة ⏰"

---

🎯 **النسخة الثالثة - FOMO:**
"الكل يتكلم عنّا... والسبب واضح! 😍
ليش ما جربت بعد؟
كمّن مكانك الآن 👇"

---
🏷️ هاشتاقات مقترحة:
#العراق #بغداد #مطعم_عراقي #أكل_عراقي''';
  }

  String _generateScenario(String input) {
    return '''🎬 سيناريو فيديو إعلاني (30 ثانية):

---

**المشهد الأول (0-5 ثانية):**
📸 لقطة قريبة للمنتج مع إضاءة درامية
🎵 موسيقى هادئة تصاعدية
نص: "تخيل..."

**المشهد الثاني (5-15 ثانية):**
👤 شخص يستخدم المنتج مع ابتسامة واسعة
📍 مشهد سريع للحياة اليومية
نص: "هذا هو الفرق الحقيقي"

**المشهد الثالث (15-25 ثانية):**
✨ مزايا المنتج بتصاميم رسوم متحركة
🔥 عرض الأسعار أو الخدمات

**الخاتمة (25-30 ثانية):**
🎯 لوغو الشركة + CTA واضح
نص: "تواصل معنا الآن!"
📱 معلومات التواصل

---
💡 ملاحظة: يُنصح بإضافة نص عربي واضح مع خلفية غامقة للقراءة الأفضل.''';
  }

  String _generateHashtags(String input) {
    return '''#️⃣ هاشتاقات مقترحة:

**🇮🇶 هاشتاقات عراقية عامة:**
#العراق #بغداد #الموصل #البصرة #أربيل
#العراق_الحبيب #Made_in_Iraq

**🎯 هاشتاقات تخصصية:**
#تسويق_رقمي #إعلانات #سوشيال_ميديا
#تصميم_إبداعي #محتوى_عربي

**🔥 هاشتاقات ترندينج (2024):**
#رمضان_كريم #العيد #الصيف_العراقي
#يوم_الجمعة #عروض_حصرية

**📊 نصائح الاستخدام:**
• استخدم 5-10 هاشتاقات لكل منشور
• مزج بين الهاشتاقات الكبيرة والصغيرة
• ضع الهاشتاقات في التعليق وليس المنشور
• تجنب الهاشتاقات المحظورة''';
  }

  String _generateMarketingPlan(String input) {
    return '''📅 خطة تسويق شهرية احترافية:

---

**الأسبوع الأول - بناء الوعي:**
• الإثنين: منشور تعريفي بالعلامة التجارية
• الأربعاء: ريلز إبداعي (30-60 ثانية)
• الجمعة: قصص تفاعلية (استطلاع + أسئلة)
• السبت: محتوى خلف الكواليس

**الأسبوع الثاني - التفاعل:**
• 3 منشورات تثقيفية عن الخدمة
• مسابقة أو هدية للمتابعين
• بث مباشر أو Q&A

**الأسبوع الثالث - الحملات الممولة:**
• إطلاق إعلان Meta Ads (Facebook + Instagram)
• Google Ads للكلمات المفتاحية المستهدفة
• تتبع النتائج وتعديل الاستهداف

**الأسبوع الرابع - التحويل:**
• عروض محدودة + FOMO
• Testimonials من العملاء
• إعادة الاستهداف (Retargeting)

---
📊 **KPIs المقترحة:**
• الوصول الأسبوعي: 10,000+
• التفاعل: 5%+
• الرسائل اليومية: 20+
• نسبة التحويل: 2-5%''';
  }

  String _generateCampaign(String input) {
    return '''🚀 حملة تسويقية متكاملة:

---

**اسم الحملة:** ارتقِ معنا 🔝

**الهدف:** زيادة المبيعات بنسبة 30% خلال 30 يوماً

**الجمهور المستهدف:**
• العمر: 18-45 سنة
• الاهتمامات: [حسب مجالك]
• الموقع: بغداد والمحافظات

**المنصات:**
📱 Instagram - للمحتوى البصري
👥 Facebook - للإعلانات والتفاعل
🎵 TikTok - للريلز الإبداعية

**المحتوى المطلوب:**
• 12 منشور تصميم احترافي
• 4 ريلز (فيديو قصير)
• 2 فيديو إعلاني رئيسي

**الميزانية المقترحة:**
• إنتاج المحتوى: 200,000 دينار
• إعلانات مدفوعة: 300,000 دينار
• المجموع: 500,000 دينار

**التقييم:**
• تقرير أسبوعي للنتائج
• تعديل الاستراتيجية حسب الأداء''';
  }

  String _generateContentIdeas(String input) {
    return '''💡 10 أفكار محتوى إبداعية:

1️⃣ **خلف الكواليس** - أرِ جمهورك كيف تعمل يومياً

2️⃣ **قبل وبعد** - قارن النتائج قبل وبعد خدمتك

3️⃣ **سؤال وجواب** - أجب على أسئلة جمهورك الشائعة

4️⃣ **آراء العملاء** - شارك شهادات عملائك الراضين

5️⃣ **نصيحة يومية** - تلميح مفيد في مجالك كل يوم

6️⃣ **مقارنة** - قارن بين خدماتك ومميزاتها

7️⃣ **قصة نجاح** - شارك قصة عميل نجح معك

8️⃣ **تحدي** - أطلق تحدياً يتفاعل معه جمهورك

9️⃣ **بودكاست مصور** - حلقة قصيرة عن موضوع في مجالك

🔟 **محتوى موسمي** - ربط منتجك بالمناسبات والمواسم

---
💰 **نصيحة:** المحتوى التثقيفي + الترفيهي = أكثر تفاعلاً وبيعاً!''';
  }

  String _generateGenericResponse(String input) {
    return '''شكراً على سؤالك! 😊

كمساعد تسويقي ذكي، يمكنني مساعدتك في:

🎯 **اختر ما تريد:**
• 📝 "اكتب كابشن لـ [نوع النشاط]"
• 🎬 "سيناريو فيديو لـ [المنتج]"
• 💡 "أفكار محتوى لـ [المجال]"
• 📅 "خطة تسويقية لـ [النشاط]"
• 🚀 "حملة تسويقية لـ [المناسبة]"
• #️⃣ "هاشتاقات لـ [النوع]"

كلما كانت تفاصيلك أكثر، كان جوابي أدق وأكثر احترافية! 🚀''';
  }

  void _scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppTheme.black : AppTheme.whiteOff,
      appBar: AppBar(
        backgroundColor: isDark ? AppTheme.black : AppTheme.white,
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedBuilder(
              animation: _pulseAnim,
              builder: (_, __) => Transform.scale(
                scale: _pulseAnim.value,
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppTheme.primaryOrange, AppTheme.primaryOrangeDark],
                    ),
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.primaryOrange.withOpacity(0.4),
                        blurRadius: 8,
                      ),
                    ],
                  ),
                  child: const Icon(Icons.auto_awesome, color: Colors.white, size: 18),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Asaad AI',
                  style: TextStyle(
                    fontFamily: 'Cairo',
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  'مساعدك التسويقي الذكي',
                  style: TextStyle(
                    fontFamily: 'Cairo',
                    fontSize: 10,
                    color: AppTheme.primaryOrange,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () {
              setState(() {
                _messages.clear();
                _addWelcomeMessage();
              });
            },
          ),
        ],
      ),
      body: Column(
        children: [
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
                  onTap: () => setState(() => _selectedCategory = cat['id'] as String),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? AppTheme.primaryOrange
                          : (isDark ? AppTheme.blackCard : Colors.white),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: isSelected
                            ? AppTheme.primaryOrange
                            : AppTheme.grey.withOpacity(0.3),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          cat['icon'] as IconData,
                          size: 14,
                          color: isSelected ? Colors.white : AppTheme.grey,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          cat['label'] as String,
                          style: TextStyle(
                            fontFamily: 'Cairo',
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: isSelected ? Colors.white : AppTheme.grey,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),

          // Messages
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              itemCount: _messages.length + (_isTyping ? 1 : 0),
              itemBuilder: (_, i) {
                if (_isTyping && i == _messages.length) {
                  return _TypingIndicator();
                }
                return _MessageBubble(message: _messages[i]);
              },
            ),
          ),

          // Quick prompts
          if (_messages.length <= 1)
            SizedBox(
              height: 40,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: _quickPrompts.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) => GestureDetector(
                  onTap: () => _sendMessage(_quickPrompts[i]),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryOrange.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                          color: AppTheme.primaryOrange.withOpacity(0.3)),
                    ),
                    child: Text(
                      _quickPrompts[i],
                      style: const TextStyle(
                        fontFamily: 'Cairo',
                        fontSize: 12,
                        color: AppTheme.primaryOrange,
                      ),
                    ),
                  ),
                ),
              ),
            ),

          // Input field
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark ? AppTheme.blackCard : Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 10,
                  offset: const Offset(0, -2),
                ),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _messageController,
                    maxLines: 3,
                    minLines: 1,
                    textDirection: TextDirection.rtl,
                    decoration: InputDecoration(
                      hintText: 'اكتب رسالتك هنا...',
                      hintStyle: const TextStyle(fontFamily: 'Cairo'),
                      filled: true,
                      fillColor: isDark ? AppTheme.black : AppTheme.whiteOff,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(20),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 10),
                    ),
                    style: const TextStyle(fontFamily: 'Cairo', fontSize: 14),
                    onSubmitted: _sendMessage,
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: () => _sendMessage(_messageController.text),
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppTheme.primaryOrange, AppTheme.primaryOrangeDark],
                      ),
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: AppTheme.primaryOrange.withOpacity(0.4),
                          blurRadius: 8,
                        ),
                      ],
                    ),
                    child: const Icon(Icons.send_rounded, color: Colors.white, size: 20),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ChatMessage {
  final String content;
  final bool isUser;
  final DateTime timestamp;

  _ChatMessage({
    required this.content,
    required this.isUser,
    required this.timestamp,
  });
}

class _MessageBubble extends StatelessWidget {
  final _ChatMessage message;

  const _MessageBubble({required this.message});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Align(
      alignment: message.isUser ? Alignment.centerLeft : Alignment.centerRight,
      child: Container(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.8,
        ),
        margin: const EdgeInsets.symmetric(vertical: 6),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          gradient: message.isUser
              ? const LinearGradient(
                  colors: [AppTheme.primaryOrange, AppTheme.primaryOrangeDark],
                )
              : null,
          color: message.isUser
              ? null
              : (isDark ? AppTheme.blackCard : Colors.white),
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(message.isUser ? 16 : 4),
            bottomRight: Radius.circular(message.isUser ? 4 : 16),
          ),
          border: message.isUser
              ? null
              : Border.all(
                  color: AppTheme.primaryOrange.withOpacity(0.1),
                ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (!message.isUser) ...[
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppTheme.primaryOrange, AppTheme.primaryOrangeDark],
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.auto_awesome,
                    color: Colors.white, size: 14),
              ),
              const SizedBox(width: 8),
            ],
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SelectableText(
                    message.content,
                    style: TextStyle(
                      fontFamily: 'Cairo',
                      fontSize: 14,
                      color: message.isUser ? Colors.white : null,
                      height: 1.6,
                    ),
                    textDirection: TextDirection.rtl,
                  ),
                  if (!message.isUser)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: GestureDetector(
                        onTap: () => Clipboard.setData(
                            ClipboardData(text: message.content)),
                        child: Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.copy_rounded,
                                  size: 12, color: AppTheme.grey),
                              const SizedBox(width: 4),
                              Text(
                                'نسخ',
                                style: TextStyle(
                                  fontFamily: 'Cairo',
                                  fontSize: 11,
                                  color: AppTheme.grey,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TypingIndicator extends StatefulWidget {
  @override
  State<_TypingIndicator> createState() => _TypingIndicatorState();
}

class _TypingIndicatorState extends State<_TypingIndicator>
    with TickerProviderStateMixin {
  late List<AnimationController> _controllers;
  late List<Animation<double>> _animations;

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(
      3,
      (i) => AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 400),
      )..repeat(reverse: true),
    );

    for (int i = 0; i < 3; i++) {
      Future.delayed(Duration(milliseconds: i * 150), () {
        if (mounted) _controllers[i].forward();
      });
    }

    _animations = _controllers
        .map((c) => Tween<double>(begin: 0, end: -8).animate(
              CurvedAnimation(parent: c, curve: Curves.easeInOut),
            ))
        .toList();
  }

  @override
  void dispose() {
    for (final c in _controllers) c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Align(
      alignment: Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 6),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: isDark ? AppTheme.blackCard : Colors.white,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(16),
            topRight: Radius.circular(16),
            bottomLeft: Radius.circular(4),
            bottomRight: Radius.circular(16),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(
            3,
            (i) => AnimatedBuilder(
              animation: _animations[i],
              builder: (_, __) => Transform.translate(
                offset: Offset(0, _animations[i].value),
                child: Container(
                  width: 8,
                  height: 8,
                  margin: const EdgeInsets.symmetric(horizontal: 2),
                  decoration: const BoxDecoration(
                    color: AppTheme.primaryOrange,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
