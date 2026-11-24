package dev.lolagateway.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

@Immutable
data class LolaColors(
    val dark: Boolean,
    val canvas: Color,
    val surface: Color,
    val surfaceSoft: Color,
    val ink: Color,
    val inkSecondary: Color,
    val inkMuted: Color,
    val periwinkle: Color,
    val periwinkleSoft: Color,
    val marigold: Color,
    val marigoldBubble: Color,
    val marigoldInk: Color,
    val coral: Color,
    val coralSoft: Color,
    val coralInk: Color,
    val mint: Color,
    val mintSoft: Color,
    val mintInk: Color,
    val divider: Color,
    val chatWashA: Color,
    val chatWashB: Color,
    val chatBase: Color,
)

private val LightLolaColors = LolaColors(
    dark = false,
    canvas = Color(0xFFF8F5EF),
    surface = Color(0xFFFFFFFF),
    surfaceSoft = Color(0xFFEEEAE1),
    ink = Color(0xFF1A1826),
    inkSecondary = Color(0xFF5B566E),
    inkMuted = Color(0xFF7C7790),
    periwinkle = Color(0xFF5E69DC),
    periwinkleSoft = Color(0xFFE9EAFC),
    marigold = Color(0xFFF4BD33),
    marigoldBubble = Color(0xFFFFF3D1),
    marigoldInk = Color(0xFF7F4F00),
    coral = Color(0xFFE86874),
    coralSoft = Color(0xFFFDECEF),
    coralInk = Color(0xFFA32634),
    mint = Color(0xFF1D9468),
    mintSoft = Color(0xFFE1F5EC),
    mintInk = Color(0xFF116647),
    divider = Color(0x0F1A1826),
    chatWashA = Color(0x22F27D84),
    chatWashB = Color(0x225E69DC),
    chatBase = Color(0xFFFBF8F6),
)

private val DarkLolaColors = LolaColors(
    dark = true,
    canvas = Color(0xFF0E0D16),
    surface = Color(0xFF171524),
    surfaceSoft = Color(0xFF221F34),
    ink = Color(0xFFF5F3FA),
    inkSecondary = Color(0xFFABA5C2),
    inkMuted = Color(0xFF847E9E),
    periwinkle = Color(0xFF7E87F5),
    periwinkleSoft = Color(0x2E7E87F5),
    marigold = Color(0xFFF5C84B),
    marigoldBubble = Color(0x29F5C84B),
    marigoldInk = Color(0xFFFAD975),
    coral = Color(0xFFF27986),
    coralSoft = Color(0x29F27986),
    coralInk = Color(0xFFFDA4AE),
    mint = Color(0xFF34D399),
    mintSoft = Color(0x2934D399),
    mintInk = Color(0xFF6EE7B7),
    divider = Color(0x12FFFFFF),
    chatWashA = Color(0x18F27986),
    chatWashB = Color(0x1F7E87F5),
    chatBase = Color(0xFF110F1B),
)

val LocalLolaColors = staticCompositionLocalOf { LightLolaColors }

private val CreamScheme = lightColorScheme(
    primary = Color(0xFF5E69DC),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE9EAFC),
    onPrimaryContainer = Color(0xFF2D348F),
    secondary = Color(0xFF1D9468),
    secondaryContainer = Color(0xFFE1F5EC),
    onSecondaryContainer = Color(0xFF116647),
    tertiaryContainer = Color(0xFFFFF3D1),
    onTertiaryContainer = Color(0xFF7F4F00),
    background = Color(0xFFF8F5EF),
    surface = Color.White,
    surfaceVariant = Color(0xFFEEEAE1),
    onBackground = Color(0xFF1A1826),
    onSurface = Color(0xFF1A1826),
    onSurfaceVariant = Color(0xFF5B566E),
    error = Color(0xFFA32634),
    errorContainer = Color(0xFFFDECEF),
    onErrorContainer = Color(0xFFA32634),
)

private val TwilightScheme = darkColorScheme(
    primary = Color(0xFF7E87F5),
    onPrimary = Color.White,
    primaryContainer = Color(0xFF25233E),
    onPrimaryContainer = Color(0xFFDDE0FF),
    secondary = Color(0xFF34D399),
    secondaryContainer = Color(0xFF153429),
    onSecondaryContainer = Color(0xFF6EE7B7),
    tertiaryContainer = Color(0xFF3A311D),
    onTertiaryContainer = Color(0xFFFAD975),
    background = Color(0xFF0E0D16),
    surface = Color(0xFF171524),
    surfaceVariant = Color(0xFF221F34),
    onBackground = Color(0xFFF5F3FA),
    onSurface = Color(0xFFF5F3FA),
    onSurfaceVariant = Color(0xFFABA5C2),
    error = Color(0xFFFDA4AE),
    errorContainer = Color(0xFF4B212B),
    onErrorContainer = Color(0xFFFDA4AE),
)

private val LolaTypography = Typography(
    headlineLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 26.sp,
        lineHeight = 30.sp,
        letterSpacing = (-0.7).sp,
    ),
    headlineMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 21.sp,
        lineHeight = 26.sp,
        letterSpacing = (-0.4).sp,
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 17.sp,
        lineHeight = 22.sp,
        letterSpacing = (-0.25).sp,
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 15.sp,
        lineHeight = 20.sp,
        letterSpacing = (-0.15).sp,
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 15.sp,
        lineHeight = 21.sp,
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 13.5.sp,
        lineHeight = 19.sp,
    ),
    labelLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 13.sp,
        lineHeight = 17.sp,
    ),
    labelMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 12.sp,
        lineHeight = 15.sp,
    ),
    labelSmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 11.sp,
        lineHeight = 14.sp,
    ),
)

@Composable
fun LolaTheme(mode: String, content: @Composable () -> Unit) {
    val dark = mode == "DARK" || (mode == "SYSTEM" && isSystemInDarkTheme())
    val palette = if (dark) DarkLolaColors else LightLolaColors
    CompositionLocalProvider(LocalLolaColors provides palette) {
        MaterialTheme(
            colorScheme = if (dark) TwilightScheme else CreamScheme,
            typography = LolaTypography,
            content = content,
        )
    }
}
