package dev.lolagateway.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import dev.lolagateway.data.local.GatewayPrefs
import dev.lolagateway.data.local.GatewayProfile
import dev.lolagateway.ui.components.PastelInitialAvatar
import dev.lolagateway.ui.components.SoftTextField
import dev.lolagateway.ui.components.StatusInline
import dev.lolagateway.ui.theme.LocalLolaColors

data class SimChoice(val id: Int, val label: String)

@Composable
fun SettingsScreen(
    profile: GatewayProfile,
    prefs: GatewayPrefs,
    sims: List<SimChoice>,
    maySend: Boolean,
    setPaused: (Boolean) -> Unit,
    setTheme: (String) -> Unit,
    selectSim: (Int?) -> Unit,
    grant: () -> Unit,
    battery: () -> Unit,
    diagnostics: () -> Unit,
    signOut: () -> Unit,
    copyCode: () -> Unit,
    saving: Boolean,
    error: String?,
    save: (String, String, String) -> Unit,
) {
    val lola = LocalLolaColors.current
    var versionTaps by rememberSaveable { mutableIntStateOf(0) }
    var editingFamily by rememberSaveable { mutableStateOf(false) }
    var nickname by rememberSaveable(profile.smsNickname) { mutableStateOf(profile.smsNickname) }
    var seniorPhone by rememberSaveable(profile.seniorPhoneE164) { mutableStateOf(profile.seniorPhoneE164) }
    val savedAllowList = profile.allowListE164.filterNot { it == profile.seniorPhoneE164 }.sorted().joinToString(", ")
    var allowList by rememberSaveable(savedAllowList) { mutableStateOf(savedAllowList) }

    Column(
        Modifier.fillMaxSize().background(lola.canvas).verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text("Settings", style = MaterialTheme.typography.headlineLarge, color = lola.ink)

        // Profile Banner
        Surface(
            shape = RoundedCornerShape(22.dp),
            color = lola.surface,
            shadowElevation = if (lola.dark) 0.dp else 1.dp,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Row(
                Modifier.fillMaxWidth().padding(14.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PastelInitialAvatar(profile.displayName, 0, size = 46.dp, ringColor = lola.surface)
                Column(Modifier.weight(1f)) {
                    Text(profile.displayName, style = MaterialTheme.typography.titleMedium, color = lola.ink)
                    val shown = profile.smsNickname.ifBlank { profile.displayName.substringBefore(' ') }
                    Text("Shown to Lola as \"$shown\"", style = MaterialTheme.typography.labelMedium, color = lola.inkSecondary)
                }
                Text(
                    if (editingFamily) "Done" else "Edit",
                    style = MaterialTheme.typography.labelLarge,
                    color = lola.periwinkle,
                    modifier = Modifier.clickable { editingFamily = !editingFamily }.padding(4.dp),
                )
            }
        }

        if (editingFamily) {
            Surface(
                shape = RoundedCornerShape(22.dp),
                color = lola.surface,
                shadowElevation = if (lola.dark) 0.dp else 1.dp,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Edit Family & Lola", style = MaterialTheme.typography.titleMedium, color = lola.ink)
                    SoftTextField(nickname, { nickname = it }, "SMS nickname", containerColor = lola.surfaceSoft)
                    SoftTextField(seniorPhone, { seniorPhone = it }, "Lola's mobile number", containerColor = lola.surfaceSoft)
                    SoftTextField(allowList, { allowList = it }, "Additional allowed numbers (comma-separated)", containerColor = lola.surfaceSoft, singleLine = false)
                    if (error != null) Text(error, color = lola.coralInk, style = MaterialTheme.typography.labelMedium)
                    val changed = seniorPhone != profile.seniorPhoneE164 || allowList != savedAllowList || nickname != profile.smsNickname
                    Button(
                        onClick = { save(seniorPhone, allowList, nickname) },
                        enabled = !saving && changed,
                        shape = CircleShape,
                        colors = ButtonDefaults.buttonColors(containerColor = lola.periwinkle, contentColor = Color.White),
                        modifier = Modifier.fillMaxWidth().height(46.dp),
                    ) {
                        Text(if (saving) "Saving..." else "Save Changes", style = MaterialTheme.typography.labelLarge)
                    }
                }
            }
        }

        Text("Family & Lola", style = MaterialTheme.typography.labelLarge, color = lola.inkSecondary)
        Surface(
            shape = RoundedCornerShape(22.dp),
            color = lola.surface,
            shadowElevation = if (lola.dark) 0.dp else 1.dp,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
                SettingRow(
                    title = profile.seniorName,
                    subtitle = "${profile.seniorPhoneE164} · Allowed sender",
                    trailing = {
                        Text(
                            "Edit",
                            style = MaterialTheme.typography.labelLarge,
                            color = lola.periwinkle,
                            modifier = Modifier.clickable { editingFamily = true }.padding(4.dp),
                        )
                    },
                )
                HorizontalDivider(color = lola.divider)
                SettingRow(
                    title = "Family Join Code",
                    subtitle = profile.joinCode,
                    trailing = {
                        Text(
                            "Copy",
                            style = MaterialTheme.typography.labelLarge,
                            color = lola.periwinkle,
                            modifier = Modifier.clickable(onClick = copyCode).padding(4.dp),
                        )
                    },
                )
            }
        }

        Text("Gateway Phone", style = MaterialTheme.typography.labelLarge, color = lola.inkSecondary)
        Surface(
            shape = RoundedCornerShape(22.dp),
            color = lola.surface,
            shadowElevation = if (lola.dark) 0.dp else 1.dp,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
                SettingRow(
                    title = "SMS Bridge",
                    subtitle = if (prefs.paused) "Paused · messages will queue" else "Active · relaying family SMS",
                    trailing = {
                        Switch(
                            checked = !prefs.paused,
                            onCheckedChange = { setPaused(!it) },
                            colors = SwitchDefaults.colors(checkedTrackColor = lola.mint, checkedThumbColor = Color.White),
                        )
                    },
                )
                HorizontalDivider(color = lola.divider)
                SettingRow(
                    title = "SMS Permissions",
                    subtitle = if (maySend) "SMS & phone access granted" else "Tap to grant SMS permissions",
                    onClick = grant,
                    trailing = { StatusInline(if (maySend) lola.mint else lola.coral, if (maySend) "Ready" else "Grant") },
                )
                HorizontalDivider(color = lola.divider)
                SettingRow(
                    title = "Background Reliability",
                    subtitle = "Exempt gateway from battery limits",
                    onClick = battery,
                    trailing = { Text("Configure", style = MaterialTheme.typography.labelLarge, color = lola.periwinkle) },
                )
                if (sims.size > 1 || prefs.selectedSubId != null) {
                    HorizontalDivider(color = lola.divider)
                    Column(Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Send SMS using", style = MaterialTheme.typography.labelLarge, color = lola.ink)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            SimChip("Default", prefs.selectedSubId == null) { selectSim(null) }
                            sims.forEach { sim -> SimChip(sim.label, prefs.selectedSubId == sim.id) { selectSim(sim.id) } }
                        }
                    }
                }
            }
        }

        Text("Preferences", style = MaterialTheme.typography.labelLarge, color = lola.inkSecondary)
        Surface(
            shape = RoundedCornerShape(22.dp),
            color = lola.surface,
            shadowElevation = if (lola.dark) 0.dp else 1.dp,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Row(
                Modifier.fillMaxWidth().padding(14.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text("Appearance", style = MaterialTheme.typography.titleMedium, color = lola.ink)
                    Text("Theme mode", style = MaterialTheme.typography.labelMedium, color = lola.inkSecondary)
                }
                Row(
                    Modifier.clip(RoundedCornerShape(12.dp)).background(lola.surfaceSoft).padding(3.dp),
                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    listOf("SYSTEM" to "Auto", "LIGHT" to "Light", "DARK" to "Dark").forEach { (mode, label) ->
                        val active = prefs.themeMode == mode
                        Box(
                            Modifier.clip(RoundedCornerShape(9.dp))
                                .background(if (active) lola.surface else Color.Transparent)
                                .clickable { setTheme(mode) }
                                .padding(horizontal = 10.dp, vertical = 6.dp),
                        ) {
                            Text(
                                label,
                                style = MaterialTheme.typography.labelMedium.copy(fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold),
                                color = if (active) lola.ink else lola.inkSecondary,
                            )
                        }
                    }
                }
            }
        }

        Surface(
            onClick = signOut,
            shape = RoundedCornerShape(18.dp),
            color = lola.coralSoft,
            modifier = Modifier.fillMaxWidth().height(48.dp),
        ) {
            Box(contentAlignment = Alignment.Center) {
                Text("Sign Out", style = MaterialTheme.typography.titleMedium, color = lola.coralInk)
            }
        }

        Box(
            Modifier.fillMaxWidth().clickable {
                versionTaps++
                if (versionTaps == 5) {
                    versionTaps = 0
                    diagnostics()
                }
            }.padding(vertical = 8.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text("Lola Gateway 1.0", style = MaterialTheme.typography.labelSmall, color = lola.inkMuted)
        }
    }
}

@Composable
private fun SettingRow(
    title: String,
    subtitle: String,
    onClick: (() -> Unit)? = null,
    trailing: @Composable () -> Unit,
) {
    val lola = LocalLolaColors.current
    Row(
        Modifier.fillMaxWidth().let { if (onClick != null) it.clickable(onClick = onClick) else it }.padding(vertical = 13.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f).padding(end = 10.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, color = lola.ink)
            Text(subtitle, style = MaterialTheme.typography.labelMedium, color = lola.inkSecondary)
        }
        trailing()
    }
}

@Composable
private fun SimChip(label: String, selected: Boolean, onClick: () -> Unit) {
    val lola = LocalLolaColors.current
    Box(
        Modifier.clip(RoundedCornerShape(10.dp))
            .background(if (selected) lola.periwinkleSoft else lola.surfaceSoft)
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 6.dp),
    ) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = if (selected) lola.periwinkle else lola.inkSecondary)
    }
}
