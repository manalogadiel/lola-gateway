package dev.lolagateway.ui.home

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.lolagateway.R
import dev.lolagateway.data.local.GatewayProfile
import dev.lolagateway.data.remote.FamilyMember
import dev.lolagateway.ui.components.*
import dev.lolagateway.ui.theme.LocalLolaColors

@Composable
fun HomeScreen(
    profile: GatewayProfile,
    members: List<FamilyMember>,
    paused: Boolean,
    network: String,
    maySend: Boolean,
    copy: () -> Unit,
    openChat: () -> Unit,
    openPeople: () -> Unit,
    grantPermissions: () -> Unit,
    toggle: () -> Unit,
) {
    val lola = LocalLolaColors.current
    var search by rememberSaveable { mutableStateOf("") }
    val (statusDot, statusText) = when {
        paused -> lola.coral to "Paused"
        !maySend -> lola.coral to "Needs SMS"
        network == "NONE" -> lola.marigold to "Offline"
        network == "CELLULAR" -> lola.marigold to "4G Backup"
        else -> lola.mint to "Online"
    }

    Column(
        Modifier.fillMaxSize().background(lola.canvas).verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Messages", style = MaterialTheme.typography.headlineLarge, color = lola.ink)
            StatusInline(statusDot, statusText)
        }

        SoftTextField(
            value = search,
            onValueChange = { search = it },
            placeholder = "Search people or chats",
            containerColor = lola.surfaceSoft,
            leading = { Icon(Icons.Default.Search, contentDescription = null, tint = lola.inkMuted, modifier = Modifier.size(18.dp)) },
        )

        BridgeStatusStrip(paused, network, maySend, if (!maySend) grantPermissions else toggle)

        // People strip
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 2.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("People", style = MaterialTheme.typography.labelLarge, color = lola.inkSecondary)
            Text(
                "${members.size + 1} in family",
                style = MaterialTheme.typography.labelMedium,
                color = lola.inkMuted,
                modifier = Modifier.clickable(onClick = openPeople),
            )
        }

        LazyRow(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            item {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.width(58.dp).clickable(onClick = openChat),
                ) {
                    Box(Modifier.size(54.dp)) {
                        Image(
                            painterResource(R.drawable.lola_avatar),
                            contentDescription = profile.seniorName,
                            modifier = Modifier.fillMaxSize().clip(CircleShape),
                            contentScale = ContentScale.Crop,
                        )
                        Box(
                            Modifier.align(Alignment.BottomEnd).size(14.dp)
                                .background(lola.canvas, CircleShape)
                                .padding(2.5.dp)
                                .background(lola.marigold, CircleShape),
                        )
                    }
                    Text(
                        profile.seniorName.substringBefore(' '),
                        style = MaterialTheme.typography.labelMedium,
                        color = lola.ink,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            itemsIndexed(members) { index, member ->
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.width(58.dp).clickable(onClick = openPeople),
                ) {
                    PastelInitialAvatar(member.name, index, size = 54.dp, online = member.role == "GATEWAY")
                    Text(
                        member.nickname.ifBlank { member.name.substringBefore(' ') },
                        style = MaterialTheme.typography.labelMedium,
                        color = lola.ink,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }

        Text("Chats", style = MaterialTheme.typography.labelLarge, color = lola.inkSecondary, modifier = Modifier.padding(horizontal = 2.dp))

        val matchesSearch = search.isBlank() ||
            "${profile.familyName} ${profile.seniorName} family group chat sms".contains(search.trim(), ignoreCase = true)

        if (matchesSearch) {
            Surface(
                onClick = openChat,
                shape = RoundedCornerShape(22.dp),
                color = lola.periwinkleSoft,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(
                    Modifier.fillMaxWidth().padding(14.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.size(50.dp)) {
                        Image(
                            painterResource(R.drawable.lola_avatar),
                            contentDescription = null,
                            modifier = Modifier.size(40.dp).clip(CircleShape).align(Alignment.TopStart),
                            contentScale = ContentScale.Crop,
                        )
                        Box(
                            Modifier.size(24.dp).align(Alignment.BottomEnd)
                                .background(lola.periwinkleSoft, CircleShape)
                                .padding(2.dp)
                                .background(lola.periwinkle, CircleShape),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("+${members.size}", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        }
                    }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(profile.familyName, style = MaterialTheme.typography.titleMedium, color = lola.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text("${profile.seniorName} · via SMS bridge", style = MaterialTheme.typography.bodyMedium, color = lola.inkSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    Text("SMS", style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold), color = lola.marigoldInk)
                }
            }
        } else {
            Text("No matching chats.", style = MaterialTheme.typography.bodyMedium, color = lola.inkSecondary)
        }

        // Compact Invite Code Card
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = lola.surface,
            shadowElevation = if (lola.dark) 0.dp else 1.dp,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text("Family Join Code", style = MaterialTheme.typography.labelSmall, color = lola.inkSecondary)
                    Text(profile.joinCode, style = MaterialTheme.typography.titleLarge.copy(letterSpacing = 1.sp), color = lola.periwinkle)
                }
                Button(
                    onClick = copy,
                    shape = CircleShape,
                    colors = ButtonDefaults.buttonColors(containerColor = lola.periwinkle, contentColor = Color.White),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                ) {
                    Text("Copy Code", style = MaterialTheme.typography.labelMedium)
                }
            }
        }

        Spacer(Modifier.height(8.dp))
    }
}
