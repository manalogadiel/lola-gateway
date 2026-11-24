package dev.lolagateway.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.lolagateway.ui.theme.LocalLolaColors

@Composable
fun ScreenHeading(title: String, context: String? = null) {
    val lola = LocalLolaColors.current
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(title, style = MaterialTheme.typography.headlineLarge, color = lola.ink)
        if (context != null) Text(context, style = MaterialTheme.typography.bodyMedium, color = lola.inkSecondary)
    }
}

@Composable
fun StatusDot(color: Color, size: Dp = 7.dp) =
    Box(Modifier.size(size).background(color, CircleShape))

@Composable
fun StatusInline(dotColor: Color, label: String) {
    val lola = LocalLolaColors.current
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        StatusDot(dotColor)
        Text(label, style = MaterialTheme.typography.labelMedium, color = lola.inkSecondary)
    }
}

@Composable
fun SoftTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    singleLine: Boolean = true,
    maxLines: Int = if (singleLine) 1 else 4,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    containerColor: Color = LocalLolaColors.current.surface,
    leading: (@Composable () -> Unit)? = null,
) {
    val lola = LocalLolaColors.current
    Surface(
        modifier = modifier.defaultMinSize(minHeight = 46.dp),
        shape = RoundedCornerShape(14.dp),
        color = containerColor,
        shadowElevation = if (containerColor == lola.surface && !lola.dark) 1.dp else 0.dp,
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 15.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (leading != null) leading()
            Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
                if (value.isEmpty()) {
                    Text(placeholder, style = MaterialTheme.typography.bodyLarge, color = lola.inkMuted)
                }
                BasicTextField(
                    value = value,
                    onValueChange = onValueChange,
                    singleLine = singleLine,
                    maxLines = maxLines,
                    keyboardOptions = keyboardOptions,
                    textStyle = MaterialTheme.typography.bodyLarge.copy(color = lola.ink),
                    cursorBrush = SolidColor(lola.periwinkle),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

@Composable
fun BridgeStatusStrip(paused: Boolean, network: String, permission: Boolean, toggle: () -> Unit) {
    val lola = LocalLolaColors.current
    val (bg, dot, title, sub, action) = when {
        paused -> BridgeVisual(lola.coralSoft, lola.coral, "SMS Bridge Paused", "Incoming texts held locally", "Resume")
        !permission -> BridgeVisual(lola.coralSoft, lola.coral, "SMS Permission Needed", "Grant access to relay SMS", "Fix")
        network == "NONE" -> BridgeVisual(lola.marigoldBubble, lola.marigold, "Waiting for Network", "Messages stay queued safely", "Pause")
        network == "CELLULAR" -> BridgeVisual(lola.marigoldBubble, lola.marigold, "Bridge on 4G Backup", "4G LTE · Relay active", "Pause")
        else -> BridgeVisual(lola.mintSoft, lola.mint, "SMS Bridge Active", "Wi-Fi · Relay ready", "Pause")
    }
    Surface(
        color = bg,
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp))
            .clickable(role = Role.Button, onClickLabel = action, onClick = toggle),
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(
                Modifier.weight(1f),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                StatusDot(dot, size = 8.dp)
                Column {
                    Text(title, style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold), color = lola.ink)
                    Text(sub, style = MaterialTheme.typography.labelSmall, color = lola.inkSecondary)
                }
            }
            Text(action, style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold), color = lola.ink.copy(alpha = 0.82f))
        }
    }
}

private data class BridgeVisual(val bg: Color, val dot: Color, val title: String, val sub: String, val action: String)

@Composable
fun PastelInitialAvatar(name: String, index: Int, size: Dp = 50.dp, online: Boolean = false, ringColor: Color = LocalLolaColors.current.canvas) {
    val lola = LocalLolaColors.current
    val (bg, fg) = when (index % 4) {
        0 -> lola.periwinkleSoft to lola.periwinkle
        1 -> lola.coralSoft to lola.coralInk
        2 -> lola.mintSoft to lola.mintInk
        else -> lola.marigoldBubble to lola.marigoldInk
    }
    Box(Modifier.size(size)) {
        Box(Modifier.fillMaxSize().background(bg, CircleShape), contentAlignment = Alignment.Center) {
            Text(
                name.firstOrNull()?.uppercase().orEmpty().ifEmpty { "?" },
                fontSize = (size.value * 0.34f).sp,
                fontWeight = FontWeight.Bold,
                color = fg,
            )
        }
        if (online) {
            Box(
                Modifier.align(Alignment.BottomEnd).size(13.dp)
                    .background(ringColor, CircleShape)
                    .padding(2.dp)
                    .background(lola.mint, CircleShape),
            )
        }
    }
}

enum class GatewayTab(val label: String) {
    HOME("Chats"), CHAT("Compose"), PEOPLE("People"), SETTINGS("Settings")
}

@Composable
fun IconBottomDock(selected: GatewayTab, select: (GatewayTab) -> Unit) {
    val lola = LocalLolaColors.current
    Row(
        Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 18.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Surface(
            modifier = Modifier.weight(1f).height(56.dp)
                .shadow(elevation = if (lola.dark) 10.dp else 6.dp, shape = CircleShape, ambientColor = Color.Black.copy(alpha = 0.12f)),
            shape = CircleShape,
            color = lola.surface.copy(alpha = 0.94f),
        ) {
            Row(
                Modifier.fillMaxSize().padding(6.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                DockIcon(GatewayTab.HOME, Icons.Default.Email, selected == GatewayTab.HOME || selected == GatewayTab.CHAT, select)
                DockIcon(GatewayTab.PEOPLE, Icons.Default.Person, selected == GatewayTab.PEOPLE, select)
                DockIcon(GatewayTab.SETTINGS, Icons.Default.Settings, selected == GatewayTab.SETTINGS, select)
            }
        }
        Surface(
            onClick = { select(GatewayTab.CHAT) },
            modifier = Modifier.size(56.dp)
                .shadow(elevation = if (lola.dark) 10.dp else 6.dp, shape = CircleShape, ambientColor = lola.periwinkle.copy(alpha = 0.35f)),
            shape = CircleShape,
            color = lola.periwinkle,
            contentColor = Color.White,
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(Icons.Default.Edit, contentDescription = "Compose message", modifier = Modifier.size(21.dp))
            }
        }
    }
}

@Composable
private fun RowScope.DockIcon(tab: GatewayTab, image: ImageVector, selected: Boolean, select: (GatewayTab) -> Unit) {
    val lola = LocalLolaColors.current
    Box(
        modifier = Modifier.weight(1f).fillMaxHeight()
            .clip(CircleShape)
            .background(if (selected) lola.periwinkleSoft else Color.Transparent)
            .clickable(role = Role.Tab, onClick = { select(tab) }),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            image,
            contentDescription = tab.label,
            tint = if (selected) lola.periwinkle else lola.inkMuted,
            modifier = Modifier.size(22.dp),
        )
    }
}
