package dev.lolagateway.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Composable
fun ScreenHeading(title: String, context: String? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(title, style = MaterialTheme.typography.headlineLarge, fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold)
        if (context != null) Text(context, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun StatusDot(color: Color) = Box(Modifier.size(9.dp).background(color, CircleShape))

@Composable
fun BridgeStatusStrip(paused: Boolean, network: String, permission: Boolean, toggle: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    val label = when {
        paused -> "SMS bridge paused"
        !permission -> "SMS permission required"
        network == "NONE" -> "Offline · messages queued"
        network == "WIFI" -> "SMS bridge active · Wi-Fi"
        network == "CELLULAR" -> "SMS bridge active · cellular"
        else -> "SMS bridge active"
    }
    val active = !paused && permission && network != "NONE"
    val foreground = if (active) colors.secondary else colors.onTertiaryContainer
    Surface(color = colors.surface, shape = RoundedCornerShape(18.dp)) {
        Row(Modifier.fillMaxWidth().clickable(role = Role.Button,
            onClickLabel = if (paused) "Resume SMS bridge" else "Pause SMS bridge", onClick = toggle)
            .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            StatusDot(foreground)
            Text(label, style = MaterialTheme.typography.labelLarge)
        }
    }
}

enum class GatewayTab(val label: String) {
    HOME("Chats"), CHAT("Compose"), PEOPLE("People"), SETTINGS("Settings")
}

@Composable
fun IconBottomDock(selected: GatewayTab, select: (GatewayTab) -> Unit) {
    Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 22.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Surface(Modifier.weight(1f), shape = CircleShape, color = MaterialTheme.colorScheme.surface, tonalElevation = 2.dp) {
            Row(Modifier.padding(horizontal = 8.dp, vertical = 3.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
                DockIcon(GatewayTab.HOME, Icons.Default.Email, selected == GatewayTab.HOME || selected == GatewayTab.CHAT, select)
                DockIcon(GatewayTab.PEOPLE, Icons.Default.Person, selected == GatewayTab.PEOPLE, select)
                DockIcon(GatewayTab.SETTINGS, Icons.Default.Settings, selected == GatewayTab.SETTINGS, select)
            }
        }
        FilledIconButton(onClick = { select(GatewayTab.CHAT) }) {
            Icon(Icons.Default.Edit, contentDescription = "Compose message")
        }
    }
}

@Composable
private fun DockIcon(tab: GatewayTab, image: ImageVector, selected: Boolean, select: (GatewayTab) -> Unit) {
    IconButton(onClick = { select(tab) }) {
        Icon(image, contentDescription = tab.label,
            tint = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
