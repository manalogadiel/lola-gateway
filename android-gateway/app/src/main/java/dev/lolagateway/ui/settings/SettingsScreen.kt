package dev.lolagateway.ui.settings

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.lolagateway.data.local.GatewayPrefs
import dev.lolagateway.data.local.GatewayProfile
import dev.lolagateway.ui.components.ScreenHeading

data class SimChoice(val id: Int, val label: String)

@Composable
fun SettingsScreen(
    profile: GatewayProfile, prefs: GatewayPrefs, sims: List<SimChoice>, maySend: Boolean, setPaused: (Boolean) -> Unit,
    setTheme: (String) -> Unit, selectSim: (Int?) -> Unit, grant: () -> Unit,
    battery: () -> Unit, diagnostics: () -> Unit, signOut: () -> Unit, copyCode: () -> Unit,
    saving: Boolean, error: String?, save: (String, String, String) -> Unit,
) {
    var versionTaps by rememberSaveable { mutableIntStateOf(0) }
    var nickname by rememberSaveable(profile.smsNickname) { mutableStateOf(profile.smsNickname) }
    var seniorPhone by rememberSaveable(profile.seniorPhoneE164) { mutableStateOf(profile.seniorPhoneE164) }
    val savedAllowList = profile.allowListE164.filterNot { it == profile.seniorPhoneE164 }.sorted().joinToString(", ")
    var allowList by rememberSaveable(savedAllowList) { mutableStateOf(savedAllowList) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(15.dp)) {
        ScreenHeading("Settings")
        Text(profile.displayName, style = MaterialTheme.typography.titleMedium)
        OutlinedTextField(nickname, { nickname = it }, Modifier.fillMaxWidth(), label = { Text("SMS nickname") }, singleLine = true)
        OutlinedTextField(seniorPhone, { seniorPhone = it }, Modifier.fillMaxWidth(), label = { Text("Lola’s mobile number") }, singleLine = true)
        OutlinedTextField(allowList, { allowList = it }, Modifier.fillMaxWidth(), label = { Text("Additional allowed numbers") },
            supportingText = { Text("Separate numbers with commas. Lola’s number is always allowed.") })
        if (error != null) Text(error, color = MaterialTheme.colorScheme.error)
        Button({ save(seniorPhone, allowList, nickname) }, enabled = !saving &&
            (seniorPhone != profile.seniorPhoneE164 || allowList != savedAllowList || nickname != profile.smsNickname)) {
            Text(if (saving) "Saving…" else "Save family settings")
        }
        TextButton(copyCode) { Text("Copy family join code") }
        ListItem(headlineContent = { Text("SMS bridge") }, supportingContent = {
            Text(if (prefs.paused) "Paused. Messages will queue." else "On. This phone relays family SMS.")
        }, trailingContent = { Switch(!prefs.paused, { setPaused(!it) }) })
        if (sims.size > 1 || prefs.selectedSubId != null) {
            Text("Send SMS using", style = MaterialTheme.typography.titleMedium)
            Choice("System default", prefs.selectedSubId == null) { selectSim(null) }
            sims.forEach { Choice(it.label, prefs.selectedSubId == it.id) { selectSim(it.id) } }
        }
        Text("Appearance", style = MaterialTheme.typography.titleMedium)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("SYSTEM" to "System", "LIGHT" to "Light", "DARK" to "Dark").forEach { (mode, label) ->
                FilterChip(prefs.themeMode == mode, { setTheme(mode) }, { Text(label) })
            }
        }
        OutlinedButton(grant) { Text(if (maySend) "Gateway permissions" else "Grant gateway permissions") }
        OutlinedButton(battery) { Text("Battery optimization") }
        TextButton(signOut) { Text("Sign out") }
        HorizontalDivider()
        TextButton({
            versionTaps++
            if (versionTaps == 5) {
                versionTaps = 0
                diagnostics()
            }
        }) { Text("Lola Gateway 1.0", color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}

@Composable
private fun Choice(label: String, selected: Boolean, choose: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        RadioButton(selected, choose)
        TextButton(choose) { Text(label) }
    }
}
