package dev.lolagateway.ui.people

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.lolagateway.data.local.GatewayProfile
import dev.lolagateway.data.remote.FamilyMember
import dev.lolagateway.ui.components.ScreenHeading

@Composable
fun PeopleScreen(profile: GatewayProfile, members: List<FamilyMember>, copyCode: () -> Unit) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { ScreenHeading("People", profile.familyName) }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)) {
                ListItem(headlineContent = { Text(profile.seniorName) }, supportingContent = { Text("Keypad phone · ${profile.seniorPhoneE164}") },
                    colors = ListItemDefaults.colors(containerColor = MaterialTheme.colorScheme.tertiaryContainer,
                        headlineColor = MaterialTheme.colorScheme.onTertiaryContainer, supportingColor = MaterialTheme.colorScheme.onTertiaryContainer))
            }
        }
        items(members) { member ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                ListItem(headlineContent = { Text(member.name) }, supportingContent = {
                    Text(if (member.role == "GATEWAY") "Gateway host" else member.nickname.ifBlank { "Family member" })
                })
            }
        }
        item { OutlinedButton(copyCode) { Text("Copy join code") } }
    }
}
