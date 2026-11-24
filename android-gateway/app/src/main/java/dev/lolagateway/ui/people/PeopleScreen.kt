package dev.lolagateway.ui.people

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.lolagateway.R
import dev.lolagateway.data.local.GatewayProfile
import dev.lolagateway.data.remote.FamilyMember
import dev.lolagateway.ui.components.PastelInitialAvatar
import dev.lolagateway.ui.components.StatusInline
import dev.lolagateway.ui.theme.LocalLolaColors

@Composable
fun PeopleScreen(profile: GatewayProfile, members: List<FamilyMember>, copyCode: () -> Unit) {
    val lola = LocalLolaColors.current
    LazyColumn(
        Modifier.fillMaxSize().background(lola.canvas),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("People", style = MaterialTheme.typography.headlineLarge, color = lola.ink)
                Text(
                    "+ Invite",
                    style = MaterialTheme.typography.titleMedium,
                    color = lola.periwinkle,
                    modifier = Modifier.clickable(onClick = copyCode).padding(4.dp),
                )
            }
        }

        item {
            Text("Linked Keypad Senior", style = MaterialTheme.typography.labelLarge, color = lola.inkSecondary)
            Spacer(Modifier.height(8.dp))
            Surface(
                shape = RoundedCornerShape(22.dp),
                color = lola.marigoldBubble,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(
                    Modifier.fillMaxWidth().padding(15.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Image(
                        painterResource(R.drawable.lola_avatar),
                        contentDescription = profile.seniorName,
                        modifier = Modifier.size(54.dp).clip(CircleShape),
                        contentScale = ContentScale.Crop,
                    )
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(profile.seniorName, style = MaterialTheme.typography.titleMedium, color = lola.ink)
                        Text(profile.seniorPhoneE164, style = MaterialTheme.typography.labelMedium, color = lola.inkSecondary)
                        Spacer(Modifier.height(2.dp))
                        StatusInline(lola.mint, "Reachable via SMS")
                    }
                }
            }
        }

        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Family Members", style = MaterialTheme.typography.labelLarge, color = lola.inkSecondary)
                Text("${members.size} joined", style = MaterialTheme.typography.labelMedium, color = lola.inkMuted)
            }
            Spacer(Modifier.height(8.dp))
            Surface(
                shape = RoundedCornerShape(22.dp),
                color = lola.surface,
                shadowElevation = if (lola.dark) 0.dp else 1.dp,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
                    if (members.isEmpty()) {
                        Text(
                            "Share the join code below so relatives can join.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = lola.inkSecondary,
                            modifier = Modifier.padding(vertical = 12.dp),
                        )
                    } else {
                        members.forEachIndexed { index, member ->
                            if (index > 0) HorizontalDivider(color = lola.divider)
                            Row(
                                Modifier.fillMaxWidth().padding(vertical = 11.dp),
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                PastelInitialAvatar(member.name, index, size = 42.dp, online = member.role == "GATEWAY", ringColor = lola.surface)
                                Column(Modifier.weight(1f)) {
                                    Text(member.name, style = MaterialTheme.typography.titleMedium, color = lola.ink)
                                    val roleLabel = if (member.role == "GATEWAY") "Gateway Host" else "Family Member"
                                    val nick = member.nickname.ifBlank { member.name.substringBefore(' ') }
                                    Text("$roleLabel · SMS: \"$nick\"", style = MaterialTheme.typography.labelSmall, color = lola.inkSecondary)
                                }
                            }
                        }
                    }
                }
            }
        }

        item {
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = lola.periwinkleSoft,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column {
                        Text("Family Join Code", style = MaterialTheme.typography.labelSmall, color = lola.inkSecondary)
                        Text(profile.joinCode, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp, color = lola.periwinkle)
                    }
                    Button(
                        onClick = copyCode,
                        shape = CircleShape,
                        colors = ButtonDefaults.buttonColors(containerColor = lola.periwinkle, contentColor = Color.White),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    ) {
                        Text("Copy Code", style = MaterialTheme.typography.labelMedium)
                    }
                }
            }
        }
    }
}
