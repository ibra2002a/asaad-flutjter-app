import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // ═══════════════════════════════════
  //  Brand Colors
  // ═══════════════════════════════════
  static const Color primaryOrange = Color(0xFFFF6B00);
  static const Color primaryOrangeLight = Color(0xFFFF8C3A);
  static const Color primaryOrangeDark = Color(0xFFCC5500);

  static const Color black = Color(0xFF0A0A0A);
  static const Color blackCard = Color(0xFF141414);
  static const Color blackSurface = Color(0xFF1E1E1E);

  static const Color white = Color(0xFFFFFFFF);
  static const Color whiteOff = Color(0xFFF5F5F5);
  static const Color whiteMuted = Color(0xFFE0E0E0);

  static const Color grey = Color(0xFF9E9E9E);
  static const Color greyLight = Color(0xFFBDBDBD);
  static const Color greyDark = Color(0xFF616161);

  static const Color success = Color(0xFF4CAF50);
  static const Color warning = Color(0xFFFFC107);
  static const Color error = Color(0xFFF44336);
  static const Color info = Color(0xFF2196F3);

  // ═══════════════════════════════════
  //  Gradients
  // ═══════════════════════════════════
  static const LinearGradient orangeGradient = LinearGradient(
    colors: [primaryOrange, primaryOrangeDark],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient darkGradient = LinearGradient(
    colors: [black, blackSurface],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  static const LinearGradient splashGradient = LinearGradient(
    colors: [Color(0xFF0A0A0A), Color(0xFF1A1A1A), Color(0xFF0A0A0A)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // ═══════════════════════════════════
  //  Light Theme
  // ═══════════════════════════════════
  static ThemeData get lightTheme => ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        primaryColor: primaryOrange,
        scaffoldBackgroundColor: whiteOff,
        colorScheme: const ColorScheme.light(
          primary: primaryOrange,
          secondary: black,
          surface: white,
          error: error,
          onPrimary: white,
          onSecondary: white,
          onSurface: black,
          onError: white,
        ),
        textTheme: _buildTextTheme(Colors.black87),
        appBarTheme: _buildAppBarTheme(white, black),
        bottomNavigationBarTheme: _buildBottomNavTheme(white, black),
        cardTheme: _buildCardTheme(white),
        elevatedButtonTheme: _buildElevatedButtonTheme(),
        inputDecorationTheme: _buildInputDecorationTheme(false),
        dividerTheme: const DividerThemeData(color: Color(0xFFE0E0E0)),
      );

  // ═══════════════════════════════════
  //  Dark Theme
  // ═══════════════════════════════════
  static ThemeData get darkTheme => ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        primaryColor: primaryOrange,
        scaffoldBackgroundColor: black,
        colorScheme: const ColorScheme.dark(
          primary: primaryOrange,
          secondary: primaryOrangeLight,
          surface: blackCard,
          error: error,
          onPrimary: white,
          onSecondary: white,
          onSurface: white,
          onError: white,
        ),
        textTheme: _buildTextTheme(Colors.white),
        appBarTheme: _buildAppBarTheme(black, white),
        bottomNavigationBarTheme: _buildBottomNavTheme(blackCard, white),
        cardTheme: _buildCardTheme(blackCard),
        elevatedButtonTheme: _buildElevatedButtonTheme(),
        inputDecorationTheme: _buildInputDecorationTheme(true),
        dividerTheme: const DividerThemeData(color: Color(0xFF2A2A2A)),
      );

  static TextTheme _buildTextTheme(Color color) => TextTheme(
        displayLarge: GoogleFonts.cairo(
          fontSize: 32,
          fontWeight: FontWeight.w800,
          color: color,
        ),
        displayMedium: GoogleFonts.cairo(
          fontSize: 28,
          fontWeight: FontWeight.w700,
          color: color,
        ),
        headlineLarge: GoogleFonts.cairo(
          fontSize: 24,
          fontWeight: FontWeight.w700,
          color: color,
        ),
        headlineMedium: GoogleFonts.cairo(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: color,
        ),
        titleLarge: GoogleFonts.cairo(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: color,
        ),
        titleMedium: GoogleFonts.cairo(
          fontSize: 16,
          fontWeight: FontWeight.w500,
          color: color,
        ),
        bodyLarge: GoogleFonts.cairo(
          fontSize: 16,
          fontWeight: FontWeight.w400,
          color: color,
        ),
        bodyMedium: GoogleFonts.cairo(
          fontSize: 14,
          fontWeight: FontWeight.w400,
          color: color,
        ),
        bodySmall: GoogleFonts.cairo(
          fontSize: 12,
          fontWeight: FontWeight.w400,
          color: color.withOpacity(0.7),
        ),
        labelLarge: GoogleFonts.cairo(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      );

  static AppBarTheme _buildAppBarTheme(Color bg, Color fg) => AppBarTheme(
        backgroundColor: bg,
        foregroundColor: fg,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: GoogleFonts.cairo(
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: fg,
        ),
        iconTheme: IconThemeData(color: fg),
      );

  static BottomNavigationBarThemeData _buildBottomNavTheme(Color bg, Color fg) =>
      BottomNavigationBarThemeData(
        backgroundColor: bg,
        selectedItemColor: primaryOrange,
        unselectedItemColor: grey,
        elevation: 8,
        type: BottomNavigationBarType.fixed,
        selectedLabelStyle: GoogleFonts.cairo(
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
        unselectedLabelStyle: GoogleFonts.cairo(
          fontSize: 11,
          fontWeight: FontWeight.w400,
        ),
      );

  static CardTheme _buildCardTheme(Color bg) => CardTheme(
        color: bg,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
      );

  static ElevatedButtonThemeData _buildElevatedButtonTheme() =>
      ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryOrange,
          foregroundColor: white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: GoogleFonts.cairo(
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
      );

  static InputDecorationTheme _buildInputDecorationTheme(bool isDark) =>
      InputDecorationTheme(
        filled: true,
        fillColor: isDark ? blackSurface : white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE0E0E0),
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE0E0E0),
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: primaryOrange, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: error),
        ),
        labelStyle: GoogleFonts.cairo(color: grey),
        hintStyle: GoogleFonts.cairo(color: grey),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      );
}
