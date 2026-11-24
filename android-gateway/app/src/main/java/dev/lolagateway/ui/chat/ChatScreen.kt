package dev.lolagateway.ui.chat

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import dev.lolagateway.R
import dev.lolagateway.data.local.GatewayProfile
import dev.lolagateway.data.local.LocalMessageEntity
import dev.lolagateway.data.model.SmsEncoding
import dev.lolagateway.data.model.SmsSegmentCalculator
import dev.lolagateway.ui.components.StatusDot
import dev.lolagateway.ui.components.StatusInline
import dev.lolagateway.ui.theme.LocalLolaColors
import java.text.DateFormat
import java.util.Date

@Composable
fun ChatScreen(
    profile: GatewayProfile,
    messages: List<LocalMessageEntity>,
    busy: Boolean,
    error: String?,
    back: () -> Unit,
    retry: (LocalMessageEntity) -> Unit,
    send: (String) -> Unit,
) {
    val lola = LocalLolaColors.current
    var draft by rememberSaveable { mutableStateOf("") }
    val smsName = profile.smsNickname.ifBlank { profile.displayName }
    val metrics = remember(draft, smsName) { SmsSegmentCalculator.formatAndSegment(smsName, draft.trim()) }
    val list = rememberLazyListState()
    LaunchedEffect(messages.lastOrNull()?.messageId, messages.lastOrNull()?.status) {
        if (messages.isNotEmpty()) list.scrollToItem(messages.lastIndex)
    }

    Box(
        Modifier.fillMaxSize().background(lola.chatBase)
            .background(Brush.radialGradient(listOf(lola.chatWashA, Color.Transparent), center = Offset(80f, 160f), radius = 650f))
            .background(Brush.radialGradient(listOf(lola.chatWashB, Color.Transparent), center = Offset(920f, 1500f), radius = 700f)),
    ) {
        Column(Modifier.fillMaxSize().imePadding()) {
            // Unified Top Chrome
            Surface(color = lola.surface.copy(alpha = 0.88f), modifier = Modifier.fillMaxWidth()) {
                Column {
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        IconButton(back, modifier = Modifier.size(36.dp)) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back to chats", tint = lola.ink)
                        }
                        Column(Modifier.weight(1f)) {
                            Text(profile.familyName, style = MaterialTheme.typography.titleLarge, color = lola.ink)
                            StatusInline(lola.mint, "${profile.seniorName} reachable via SMS")
                        }
                        Image(
                            painterResource(R.drawable.lola_avatar),
                            contentDescription = profile.seniorName,
                            modifier = Modifier.size(38.dp).clip(CircleShape),
                            contentScale = ContentScale.Crop,
                        )
                    }
                    HorizontalDivider(color = lola.divider)
                }
            }

            LazyColumn(
                Modifier.weight(1f).fillMaxWidth(),
                state = list,
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 14.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (messages.isEmpty()) {
                    item {
                        Box(Modifier.fillParentMaxWidth().padding(top = 48.dp), contentAlignment = Alignment.Center) {
                            Text("No messages yet. Send ${profile.seniorName} a hello.", style = MaterialTheme.typography.bodyMedium, color = lola.inkSecondary)
                        }
                    }
                }
                items(messages, key = { it.messageId }) { message ->
                    val own = message.senderUid == profile.uid
                    val canRetry = own && message.status == "FAILED" && message.diagnosticDestination == null && !busy
                    MessageBubble(message, own, if (canRetry) ({ retry(message) }) else null)
                }
            }

            if (error != null) {
                Text(error, color = lola.coralInk, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(horizontal = 18.dp, vertical = 4.dp))
            }

            // Clean Composer: SMS meter stays hidden until typing
            Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp)) {
                if (draft.isNotBlank()) {
                    val warn = metrics.encoding == SmsEncoding.UCS_2 || metrics.segmentCount > 1
                    val meterColor = if (metrics.segmentCount > 10) lola.coralInk else if (warn) lola.marigoldInk else lola.inkSecondary
                    val single = if (metrics.encoding == SmsEncoding.GSM_7) 160 else 70
                    val multi = if (metrics.encoding == SmsEncoding.GSM_7) 153 else 67
                    val limit = if (metrics.segmentCount <= 1) single else metrics.segmentCount * multi
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(
                            if (metrics.encoding == SmsEncoding.GSM_7) "GSM-7" else "UCS-2 (shorter per SMS)",
                            style = MaterialTheme.typography.labelSmall,
                            color = meterColor,
                        )
                        Text(
                            "${metrics.formattedText.length}/$limit · ${metrics.segmentCount} SMS",
                            style = MaterialTheme.typography.labelSmall,
                            color = meterColor,
                        )
                    }
                }

                Surface(
                    shape = RoundedCornerShape(26.dp),
                    color = lola.surface,
                    modifier = Modifier.fillMaxWidth()
                        .shadow(elevation = if (lola.dark) 0.dp else 2.dp, shape = RoundedCornerShape(26.dp), ambientColor = Color.Black.copy(alpha = 0.08f)),
                ) {
                    Row(
                        Modifier.fillMaxWidth().padding(start = 16.dp, end = 6.dp, top = 5.dp, bottom = 5.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Box(Modifier.weight(1f).padding(vertical = 8.dp)) {
                            if (draft.isEmpty()) {
                                Text("Message family...", style = MaterialTheme.typography.bodyLarge, color = lola.inkMuted)
                            }
                            BasicTextField(
                                value = draft,
                                onValueChange = { draft = it },
                                maxLines = 4,
                                textStyle = MaterialTheme.typography.bodyLarge.copy(color = lola.ink),
                                cursorBrush = SolidColor(lola.periwinkle),
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                        val canSendNow = !busy && draft.isNotBlank() && metrics.segmentCount in 1..10
                        Surface(
                            onClick = { if (canSendNow) { send(draft); draft = "" } },
                            enabled = canSendNow,
                            shape = CircleShape,
                            color = if (canSendNow) lola.coral else lola.coral.copy(alpha = 0.45f),
                            contentColor = Color.White,
                            modifier = Modifier.size(40.dp),
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = "Send message", modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MessageBubble(message: LocalMessageEntity, own: Boolean, retry: (() -> Unit)?) {
    val lola = LocalLolaColors.current
    val inbound = message.direction == "INBOUND"
    val bg = when {
        inbound -> lola.marigoldBubble
        own -> lola.periwinkle
        else -> lola.surface
    }
    val fg = if (own && !inbound) Color.White else lola.ink
    val shape = if (own && !inbound) {
        RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp, bottomStart = 20.dp, bottomEnd = 6.dp)
    } else {
        RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp, bottomStart = 6.dp, bottomEnd = 20.dp)
    }

    Column(
        Modifier.fillMaxWidth(),
        horizontalAlignment = if (own && !inbound) Alignment.End else Alignment.Start,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        if (!own || inbound) {
            Text(
                if (inbound) "${message.senderName} · via SMS" else message.senderName,
                style = MaterialTheme.typography.labelSmall,
                color = lola.inkSecondary,
                modifier = Modifier.padding(horizontal = 6.dp),
            )
        }
        Surface(
            color = bg,
            contentColor = fg,
            shape = shape,
            shadowElevation = if (!own && !inbound && !lola.dark) 1.dp else 0.dp,
            modifier = Modifier.widthIn(max = 286.dp),
        ) {
            Text(
                message.text,
                style = MaterialTheme.typography.bodyLarge,
                color = fg,
                modifier = Modifier.padding(horizontal = 14.dp, vertical = 11.dp),
            )
        }

        val time = remember(message.createdAtMs) { DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(message.createdAtMs)) }
        Row(
            Modifier.padding(horizontal = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(5.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (!inbound) {
                val (dot, label) = when (message.status) {
                    "DELIVERED" -> lola.mint to "Delivered · $time"
                    "SENT" -> lola.periwinkle to "Sent · $time"
                    "PENDING" -> lola.marigold to "Pending · keypad may be off"
                    "FAILED" -> lola.coral to (message.errorReason ?: "Failed")
                    else -> lola.marigold to "Queued · $time"
                }
                StatusDot(dot, size = 6.dp)
                Text(label, style = MaterialTheme.typography.labelSmall, color = lola.inkSecondary)
                if (retry != null) {
                    Text(
                        "Retry",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, textDecoration = TextDecoration.Underline),
                        color = lola.coralInk,
                        modifier = Modifier.clickable(onClick = retry).padding(start = 4.dp),
                    )
                }
            } else {
                Text(time, style = MaterialTheme.typography.labelSmall, color = lola.inkSecondary)
            }
        }
    }
}
