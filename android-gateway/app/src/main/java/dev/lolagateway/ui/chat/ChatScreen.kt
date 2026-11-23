package dev.lolagateway.ui.chat

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import dev.lolagateway.data.local.GatewayProfile
import dev.lolagateway.R
import dev.lolagateway.data.local.LocalMessageEntity
import dev.lolagateway.data.model.SmsSegmentCalculator
import java.text.DateFormat
import java.util.Date

@Composable
fun ChatScreen(profile: GatewayProfile, messages: List<LocalMessageEntity>, busy: Boolean, error: String?,
    back: () -> Unit, retry: (LocalMessageEntity) -> Unit, send: (String) -> Unit) {
    var draft by rememberSaveable { mutableStateOf("") }
    val smsName = profile.smsNickname.ifBlank { profile.displayName }
    val metrics = remember(draft, smsName) { SmsSegmentCalculator.formatAndSegment(smsName, draft.trim()) }
    val list = rememberLazyListState()
    LaunchedEffect(messages.lastOrNull()?.messageId) {
        if (messages.isNotEmpty()) list.scrollToItem(messages.lastIndex)
    }
    Column(Modifier.fillMaxSize().imePadding().padding(horizontal = 20.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            IconButton(back) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back to chats") }
            Column(Modifier.weight(1f)) {
                Text(profile.familyName, style = MaterialTheme.typography.titleLarge)
                Text("${profile.seniorName} · via SMS", style = MaterialTheme.typography.labelMedium)
            }
            Image(painterResource(R.drawable.lola_avatar), null, Modifier.size(42.dp).clip(CircleShape), contentScale = ContentScale.Crop)
        }
        LazyColumn(Modifier.weight(1f).fillMaxWidth(), state = list, verticalArrangement = Arrangement.spacedBy(9.dp)) {
            if (messages.isEmpty()) item { Text("No messages yet. Send Lola a hello.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
            items(messages, key = { it.messageId }) { message ->
                val own = message.senderUid == profile.uid
                val canRetry = own && message.status == "FAILED" && message.diagnosticDestination == null && !busy
                MessageBubble(message, own, if (canRetry) ({ retry(message) }) else null)
            }
        }
        if (error != null) Text(error, color = MaterialTheme.colorScheme.error)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(draft, { draft = it }, Modifier.weight(1f), label = { Text("Message") }, maxLines = 4)
            Button(onClick = { send(draft); draft = "" }, enabled = !busy && metrics.segmentCount in 1..10,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFAB384D), contentColor = Color.White)) { Text("Send") }
        }
        if (draft.isNotBlank()) Text("${metrics.encoding.wireName} · ${metrics.segmentCount} SMS", style = MaterialTheme.typography.labelMedium,
            color = if (metrics.segmentCount > 10) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun MessageBubble(message: LocalMessageEntity, own: Boolean, retry: (() -> Unit)?) {
    val colors = MaterialTheme.colorScheme
    val inbound = message.direction == "INBOUND"
    val background = when { inbound -> colors.tertiaryContainer; own -> colors.primaryContainer; else -> colors.surface }
    val foreground = when { inbound -> colors.onTertiaryContainer; own -> colors.onPrimaryContainer; else -> colors.onSurface }
    Box(Modifier.fillMaxWidth(), contentAlignment = if (own) Alignment.CenterEnd else Alignment.CenterStart) {
        Surface(color = background, contentColor = foreground, shape = RoundedCornerShape(19.dp),
            modifier = Modifier.fillMaxWidth(0.84f)) {
            Column(Modifier.padding(13.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(if (inbound) "${message.senderName} · via SMS" else message.senderName, style = MaterialTheme.typography.labelLarge)
                Text(message.text)
                val time = remember(message.createdAtMs) { DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(message.createdAtMs)) }
                val status = message.status.lowercase().replaceFirstChar { it.uppercase() }
                Text(if (inbound) time else "$status · $time", style = MaterialTheme.typography.labelSmall)
                if (!inbound && message.errorReason != null) Text(message.errorReason, style = MaterialTheme.typography.labelSmall)
                if (retry != null) TextButton(retry, contentPadding = PaddingValues(0.dp)) { Text("Retry") }
            }
        }
    }
}
