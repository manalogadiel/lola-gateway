package dev.lolagateway.ui.home

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import dev.lolagateway.R
import dev.lolagateway.data.local.GatewayProfile
import dev.lolagateway.data.remote.FamilyMember
import dev.lolagateway.ui.components.BridgeStatusStrip
import dev.lolagateway.ui.components.ScreenHeading

@Composable
fun HomeScreen(profile: GatewayProfile, members: List<FamilyMember>, paused: Boolean, network: String, maySend: Boolean,
    copy: () -> Unit, openChat: () -> Unit, openPeople: () -> Unit, grantPermissions: () -> Unit, toggle: () -> Unit) {
    var search by rememberSaveable { mutableStateOf("") }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        ScreenHeading("Messages", profile.familyName)
        TextField(search, { search = it }, Modifier.fillMaxWidth(), placeholder = { Text("Search chats") }, singleLine = true)
        BridgeStatusStrip(paused, network, maySend, toggle)
        if (!maySend) OutlinedButton(grantPermissions) { Text("Grant gateway permissions") }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            Text("People", style = MaterialTheme.typography.titleMedium)
            TextButton(openPeople) { Text("View all") }
        }
        LazyRow(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            item { PersonAvatar(profile.seniorName, true) }
            items(members) { PersonAvatar(it.name, false) }
        }
        Text("Chats", style = MaterialTheme.typography.titleMedium)
        if (search.isBlank() || "${profile.familyName} ${profile.seniorName} family group chat".contains(search.trim(), ignoreCase = true)) {
          Card(onClick = openChat, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
            Row(Modifier.fillMaxWidth().padding(18.dp), horizontalArrangement = Arrangement.spacedBy(14.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Image(painterResource(R.drawable.lola_avatar), null, Modifier.size(58.dp).clip(CircleShape), contentScale = ContentScale.Crop)
                Column {
                    Text(profile.familyName, style = MaterialTheme.typography.titleMedium)
                    Text("${profile.seniorName} · via SMS", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
          }
        } else {
            Text("No matching chats.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
            Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Family join code", style = MaterialTheme.typography.labelLarge)
                Text(profile.joinCode, style = MaterialTheme.typography.headlineMedium)
                TextButton(copy) { Text("Copy join code") }
            }
        }
    }
}

@Composable
private fun PersonAvatar(name: String, senior: Boolean) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (senior) {
            Image(painterResource(R.drawable.lola_avatar), null, Modifier.size(49.dp).clip(CircleShape), contentScale = ContentScale.Crop)
        } else {
            Box(Modifier.size(49.dp).background(MaterialTheme.colorScheme.primaryContainer, CircleShape), contentAlignment = Alignment.Center) {
                Text(name.firstOrNull()?.uppercase().orEmpty(), color = MaterialTheme.colorScheme.onPrimaryContainer)
            }
        }
        Text(name.substringBefore(' '), style = MaterialTheme.typography.labelMedium)
    }
}
