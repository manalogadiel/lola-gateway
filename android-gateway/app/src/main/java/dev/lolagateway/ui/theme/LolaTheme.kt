package dev.lolagateway.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val cream = lightColorScheme(
    primary = Color(0xFF4A55C8), onPrimary = Color.White, primaryContainer = Color(0xFFE9EAFC),
    onPrimaryContainer = Color(0xFF2D348F), secondary = Color(0xFF116647), secondaryContainer = Color(0xFFE1F5EC),
    onSecondaryContainer = Color(0xFF116647), tertiaryContainer = Color(0xFFFFF3D1), onTertiaryContainer = Color(0xFF7F4F00),
    background = Color(0xFFF8F5EF), surface = Color.White, surfaceVariant = Color(0xFFEEEAE1),
    onBackground = Color(0xFF1A1826), onSurface = Color(0xFF1A1826), onSurfaceVariant = Color(0xFF5B566E),
    error = Color(0xFFA32634), errorContainer = Color(0xFFFDECEF), onErrorContainer = Color(0xFFA32634),
)

private val twilight = darkColorScheme(
    primary = Color(0xFFA5ACFF), onPrimary = Color(0xFF181E61), primaryContainer = Color(0xFF292D5C),
    onPrimaryContainer = Color(0xFFDDE0FF), secondary = Color(0xFF6EE7B7), secondaryContainer = Color(0xFF143629),
    onSecondaryContainer = Color(0xFF6EE7B7), tertiaryContainer = Color(0xFF3C3019), onTertiaryContainer = Color(0xFFFAD975),
    background = Color(0xFF0E0D16), surface = Color(0xFF171524), surfaceVariant = Color(0xFF221F34),
    onBackground = Color(0xFFF5F3FA), onSurface = Color(0xFFF5F3FA), onSurfaceVariant = Color(0xFFABA5C2),
    error = Color(0xFFFDA4AE), errorContainer = Color(0xFF4B212B), onErrorContainer = Color(0xFFFDA4AE),
)

@Composable
fun LolaTheme(mode: String, content: @Composable () -> Unit) {
    val dark = mode == "DARK" || (mode == "SYSTEM" && isSystemInDarkTheme())
    MaterialTheme(colorScheme = if (dark) twilight else cream, content = content)
}
