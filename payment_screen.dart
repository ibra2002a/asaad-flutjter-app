import 'package:flutter/material.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/routes/app_router.dart';
import '../../core/services/firebase_service.dart';
import '../../core/widgets/custom_button.dart';
import '../../core/widgets/loading_overlay.dart';

class PaymentScreen extends StatefulWidget {
  final Map<String, dynamic> orderData;
  const PaymentScreen({super.key, required this.orderData});

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  String _selectedMethod = '';
  bool _isLoading = false;
  final _firebase = FirebaseService();

  final _methods = [
    {
      'id': 'zain_cash',
      'name': 'زين كاش',
      'nameEn': 'ZainCash',
      'icon': Icons.phone_android_rounded,
      'color': const Color(0xFF1B5E20),
      'description': 'ادفع عبر تطبيق زين كاش',
    },
    {
      'id': 'ki_card',
      'name': 'كي كارد',
      'nameEn': 'Ki Card',
      'icon': Icons.credit_card_rounded,
      'color': const Color(0xFF0D47A1),
      'description': 'ادفع عبر بطاقة كي كارد',
    },
    {
      'id': 'mastercard',
      'name': 'ماستر كارد',
      'nameEn': 'MasterCard',
      'icon': Icons.payment_rounded,
      'color': const Color(0xFFB71C1C),
      'description': 'ادفع ببطاقة ماستر كارد',
    },
    {
      'id': 'cash',
      'name': 'الدفع النقدي',
      'nameEn': 'Cash',
      'icon': Icons.attach_money_rounded,
      'color': const Color(0xFF4CAF50),
      'description': 'ادفع نقداً عند التسليم',
    },
  ];

  Future<void> _processPayment() async {
    if (_selectedMethod.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('اختر طريقة الدفع أولاً',
              style: TextStyle(fontFamily: 'Cairo')),
          backgroundColor: AppTheme.error,
        ),
      );
      return;
    }

    setState(() => _isLoading = true);
    try {
      final orderId = widget.orderData['orderId'] ?? '';
      final amount = widget.orderData['amount'] ?? 0.0;
      final uid = _firebase.currentUser!.uid;

      // Record payment
      await _firebase.payments.add({
        'orderId': orderId,
        'clientId': uid,
        'amount': amount,
        'method': _selectedMethod,
        'status': _selectedMethod == 'cash' ? 'pending' : 'completed',
        'createdAt': DateTime.now(),
        'invoiceNumber':
            'INV-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}',
      });

      // Update order payment status
      await _firebase.orders.doc(orderId).update({
        'isPaid': _selectedMethod != 'cash',
        'paymentMethod': _selectedMethod,
      });

      // Generate PDF invoice
      await _generateInvoice(amount, orderId);

      if (mounted) {
        _showSuccessDialog();
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('حدث خطأ في الدفع',
              style: TextStyle(fontFamily: 'Cairo')),
          backgroundColor: AppTheme.error,
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _generateInvoice(double amount, String orderId) async {
    final pdf = pw.Document();
    final invoiceNum =
        'INV-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}';
    final date =
        '${DateTime.now().day}/${DateTime.now().month}/${DateTime.now().year}';

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        build: (pw.Context context) => pw.Container(
          padding: const pw.EdgeInsets.all(40),
          child: pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              // Header
              pw.Container(
                width: double.infinity,
                padding: const pw.EdgeInsets.all(20),
                decoration: pw.BoxDecoration(
                  color: PdfColor.fromHex('#FF6B00'),
                  borderRadius: const pw.BorderRadius.all(pw.Radius.circular(8)),
                ),
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.center,
                  children: [
                    pw.Text(
                      'Asaad Digital Marketing',
                      style: pw.TextStyle(
                        fontSize: 22,
                        fontWeight: pw.FontWeight.bold,
                        color: PdfColors.white,
                      ),
                    ),
                    pw.SizedBox(height: 4),
                    pw.Text(
                      'اصعد للإعلانات والتسويق الرقمي - العراق',
                      style: const pw.TextStyle(
                        fontSize: 12,
                        color: PdfColors.white,
                      ),
                    ),
                  ],
                ),
              ),

              pw.SizedBox(height: 30),

              // Invoice title
              pw.Text(
                'INVOICE - فاتورة',
                style: pw.TextStyle(
                    fontSize: 24, fontWeight: pw.FontWeight.bold),
              ),

              pw.SizedBox(height: 20),

              // Invoice details
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text('Invoice #: $invoiceNum',
                          style: const pw.TextStyle(fontSize: 12)),
                      pw.Text('Date: $date',
                          style: const pw.TextStyle(fontSize: 12)),
                      pw.Text('Order ID: $orderId',
                          style: const pw.TextStyle(fontSize: 12)),
                    ],
                  ),
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.end,
                    children: [
                      pw.Text('Payment Method: $_selectedMethod',
                          style: const pw.TextStyle(fontSize: 12)),
                      pw.Text(
                        'Status: ${_selectedMethod == 'cash' ? 'Pending' : 'Paid'}',
                        style: const pw.TextStyle(fontSize: 12),
                      ),
                    ],
                  ),
                ],
              ),

              pw.SizedBox(height: 30),
              pw.Divider(),
              pw.SizedBox(height: 20),

              // Service table
              pw.Table(
                border: pw.TableBorder.all(color: PdfColors.grey300),
                children: [
                  pw.TableRow(
                    decoration:
                        const pw.BoxDecoration(color: PdfColors.grey200),
                    children: [
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(8),
                        child: pw.Text('Service / الخدمة',
                            style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
                      ),
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(8),
                        child: pw.Text('Amount / المبلغ',
                            style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
                      ),
                    ],
                  ),
                  pw.TableRow(
                    children: [
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(8),
                        child: pw.Text(
                            widget.orderData['serviceName'] ?? 'Service'),
                      ),
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(8),
                        child: pw.Text('${amount.toStringAsFixed(0)} IQD'),
                      ),
                    ],
                  ),
                ],
              ),

              pw.SizedBox(height: 20),

              // Total
              pw.Container(
                alignment: pw.Alignment.centerRight,
                child: pw.Container(
                  padding: const pw.EdgeInsets.all(16),
                  decoration: pw.BoxDecoration(
                    color: PdfColor.fromHex('#FF6B00'),
                    borderRadius:
                        const pw.BorderRadius.all(pw.Radius.circular(8)),
                  ),
                  child: pw.Text(
                    'Total: ${amount.toStringAsFixed(0)} IQD',
                    style: pw.TextStyle(
                        fontSize: 18,
                        fontWeight: pw.FontWeight.bold,
                        color: PdfColors.white),
                  ),
                ),
              ),

              pw.Spacer(),

              // Footer
              pw.Center(
                child: pw.Text(
                  'شكراً لثقتكم بنا • Thank you for your business',
                  style: const pw.TextStyle(
                      fontSize: 12, color: PdfColors.grey),
                ),
              ),
            ],
          ),
        ),
      ),
    );

    await Printing.layoutPdf(
      onLayout: (PdfPageFormat format) async => pdf.save(),
      name: 'Invoice_$invoiceNum.pdf',
    );
  }

  void _showSuccessDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: const BoxDecoration(
                color: AppTheme.success,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_rounded, color: Colors.white, size: 44),
            ),
            const SizedBox(height: 16),
            const Text(
              'تم الدفع بنجاح! ✅',
              style: TextStyle(
                  fontFamily: 'Cairo', fontSize: 18, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            const Text(
              'تم إنشاء الفاتورة وإرسالها إليك',
              textAlign: TextAlign.center,
              style: TextStyle(fontFamily: 'Cairo', fontSize: 13, color: AppTheme.grey),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  Navigator.pushReplacementNamed(context, AppRouter.main);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primaryOrange,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('الرئيسية',
                    style: TextStyle(
                        fontFamily: 'Cairo',
                        color: Colors.white,
                        fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final amount = widget.orderData['amount'] ?? 0.0;

    return LoadingOverlay(
      isLoading: _isLoading,
      child: Scaffold(
        backgroundColor: isDark ? AppTheme.black : AppTheme.whiteOff,
        appBar: AppBar(
          backgroundColor: isDark ? AppTheme.black : AppTheme.white,
          title: const Text('الدفع الإلكتروني',
              style:
                  TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w800)),
        ),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Amount display
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppTheme.primaryOrange, AppTheme.primaryOrangeDark],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(
                      color: AppTheme.primaryOrange.withOpacity(0.3),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    const Text(
                      'المبلغ المطلوب',
                      style: TextStyle(
                          fontFamily: 'Cairo', fontSize: 14, color: Colors.white70),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${amount.toStringAsFixed(0)} د.ع',
                      style: const TextStyle(
                        fontFamily: 'Cairo',
                        fontSize: 36,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      widget.orderData['serviceName'] ?? '',
                      style: const TextStyle(
                          fontFamily: 'Cairo', fontSize: 13, color: Colors.white70),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 28),

              const Text(
                'اختر طريقة الدفع',
                style: TextStyle(
                    fontFamily: 'Cairo', fontSize: 18, fontWeight: FontWeight.w700),
              ),

              const SizedBox(height: 16),

              ..._methods.map((method) => _PaymentMethodCard(
                    method: method,
                    isSelected: _selectedMethod == method['id'],
                    onTap: () => setState(
                        () => _selectedMethod = method['id'] as String),
                  )),

              // ZainCash instructions
              if (_selectedMethod == 'zain_cash') ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1B5E20).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                        color: const Color(0xFF1B5E20).withOpacity(0.3)),
                  ),
                  child: const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('تعليمات زين كاش:',
                          style: TextStyle(
                              fontFamily: 'Cairo',
                              fontWeight: FontWeight.w700,
                              fontSize: 14)),
                      SizedBox(height: 8),
                      Text('1. افتح تطبيق زين كاش',
                          style: TextStyle(fontFamily: 'Cairo', fontSize: 13)),
                      Text('2. اختر "تحويل"',
                          style: TextStyle(fontFamily: 'Cairo', fontSize: 13)),
                      Text('3. أدخل الرقم: 07801234567',
                          style: TextStyle(fontFamily: 'Cairo', fontSize: 13)),
                      Text('4. أدخل المبلغ المطلوب',
                          style: TextStyle(fontFamily: 'Cairo', fontSize: 13)),
                      Text('5. أرسل لقطة الشاشة للدعم الفني',
                          style: TextStyle(fontFamily: 'Cairo', fontSize: 13)),
                    ],
                  ),
                ),
              ],

              // MasterCard form
              if (_selectedMethod == 'mastercard') ...[
                const SizedBox(height: 16),
                _buildCardForm(isDark),
              ],

              const SizedBox(height: 32),

              CustomButton(
                label: 'تأكيد الدفع',
                icon: Icons.lock_rounded,
                onPressed: _selectedMethod.isNotEmpty ? _processPayment : null,
              ),

              const SizedBox(height: 12),

              const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.lock_outline, size: 14, color: AppTheme.grey),
                  SizedBox(width: 4),
                  Text(
                    'معاملاتك محمية ومشفرة بالكامل',
                    style: TextStyle(
                        fontFamily: 'Cairo', fontSize: 12, color: AppTheme.grey),
                  ),
                ],
              ),

              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCardForm(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.blackCard : Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          TextFormField(
            decoration: const InputDecoration(
              labelText: 'رقم البطاقة',
              labelStyle: TextStyle(fontFamily: 'Cairo'),
              prefixIcon: Icon(Icons.credit_card),
              hintText: '•••• •••• •••• ••••',
            ),
            keyboardType: TextInputType.number,
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  decoration: const InputDecoration(
                    labelText: 'تاريخ الانتهاء',
                    labelStyle: TextStyle(fontFamily: 'Cairo'),
                    hintText: 'MM/YY',
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextFormField(
                  decoration: const InputDecoration(
                    labelText: 'CVV',
                    labelStyle: TextStyle(fontFamily: 'Cairo'),
                    hintText: '•••',
                  ),
                  keyboardType: TextInputType.number,
                  obscureText: true,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextFormField(
            decoration: const InputDecoration(
              labelText: 'اسم حامل البطاقة',
              labelStyle: TextStyle(fontFamily: 'Cairo'),
            ),
          ),
        ],
      ),
    );
  }
}

class _PaymentMethodCard extends StatelessWidget {
  final Map<String, dynamic> method;
  final bool isSelected;
  final VoidCallback onTap;

  const _PaymentMethodCard(
      {required this.method, required this.isSelected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final color = method['color'] as Color;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected
              ? color.withOpacity(0.08)
              : (isDark ? AppTheme.blackCard : Colors.white),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? color : AppTheme.grey.withOpacity(0.2),
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(method['icon'] as IconData, color: color, size: 24),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    method['name'] as String,
                    style: TextStyle(
                      fontFamily: 'Cairo',
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: isSelected ? color : null,
                    ),
                  ),
                  Text(
                    method['description'] as String,
                    style: const TextStyle(
                        fontFamily: 'Cairo', fontSize: 12, color: AppTheme.grey),
                  ),
                ],
              ),
            ),
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isSelected ? color : Colors.transparent,
                border: Border.all(
                    color: isSelected ? color : AppTheme.grey, width: 2),
              ),
              child: isSelected
                  ? const Icon(Icons.check, color: Colors.white, size: 14)
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}
