package dev.lolagateway

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.telephony.SubscriptionManager
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import dev.lolagateway.data.local.GatewayPrefs
import dev.lolagateway.data.local.GatewayProfile
import dev.lolagateway.diagnostics.CsvLogExporter
import dev.lolagateway.sync.SyncEngineWorker
import dev.lolagateway.ui.chat.ChatScreen
import dev.lolagateway.ui.components.GatewayTab
import dev.lolagateway.ui.components.IconBottomDock
import dev.lolagateway.ui.home.HomeScreen
import dev.lolagateway.ui.loading.LoadingScreen
import dev.lolagateway.ui.onboarding.OnboardingScreen
import dev.lolagateway.ui.people.PeopleScreen
import dev.lolagateway.ui.settings.SettingsScreen
import dev.lolagateway.ui.settings.SimChoice
import dev.lolagateway.ui.theme.LocalLolaColors
import dev.lolagateway.ui.theme.LolaTheme
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    private val container by lazy { (application as LolaGatewayApp).container }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { GatewayContent() }
    }

    @Composable
    private fun GatewayContent() {
        val stored by container.prefs.state.collectAsStateWithLifecycle(initialValue = null)
        var uid by remember { mutableStateOf(container.currentUid()) }
        DisposableEffect(container.auth) {
            val listener = FirebaseAuth.AuthStateListener { uid = it.currentUser?.uid }
            container.auth?.addAuthStateListener(listener)
            onDispose { container.auth?.removeAuthStateListener(listener) }
        }
        var busy by remember { mutableStateOf(false) }
        var error by remember { mutableStateOf<String?>(null) }
        val scope = rememberCoroutineScope()
        val profile = stored?.profile?.takeIf { it.uid == uid }
        LaunchedEffect(uid) { if (uid != null) SyncEngineWorker.enqueue(this@MainActivity) }
        val oauth = resources.getIdentifier("default_web_client_id", "string", packageName)
        LolaTheme(stored?.themeMode ?: "SYSTEM") {
            val lola = LocalLolaColors.current
            val view = LocalView.current
            val onOnboarding = stored != null && profile == null
            SideEffect {
                WindowCompat.getInsetsController(window, view).apply {
                    isAppearanceLightStatusBars = !lola.dark && !onOnboarding
                    isAppearanceLightNavigationBars = !lola.dark
                }
            }
            Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                val prefs = stored
                when {
                    prefs == null -> LoadingScreen()
                    profile == null -> Box(Modifier.navigationBarsPadding()) {
                        OnboardingScreen(uid != null, oauth != 0 && container.auth != null, busy, error,
                            signIn = {
                                busy = true
                                error = null
                                scope.launch {
                                    try {
                                        signIn(oauth)
                                    } catch (_: GetCredentialCancellationException) {
                                        // Returning from the account picker leaves the welcome screen active.
                                    } catch (cancelled: CancellationException) {
                                        throw cancelled
                                    } catch (_: Exception) {
                                        error = "Google Sign-In could not finish. Check your connection and try again."
                                    } finally { busy = false }
                                }
                            }, createFamily = { family, name, phone ->
                                busy = true
                                error = null
                                scope.launch {
                                    try {
                                        container.createFamily(family, name, phone)
                                    } catch (cancelled: CancellationException) {
                                        throw cancelled
                                    } catch (invalid: IllegalArgumentException) {
                                        error = invalid.message
                                    } catch (_: Exception) {
                                        error = "The family could not be created. Check the connection and try again."
                                    } finally { busy = false }
                                }
                            })
                    }
                    else -> key(profile.familyId) { FamilyContent(profile, prefs) }
                }
            }
        }
    }

    @Composable
    private fun FamilyContent(profile: GatewayProfile, prefs: GatewayPrefs) {
        var tab by rememberSaveable { mutableStateOf(GatewayTab.HOME) }
        var showDiagnostics by rememberSaveable { mutableStateOf(false) }
        var permissionEpoch by remember { mutableIntStateOf(0) }
        val maySend = remember(permissionEpoch, tab) { container.maySendSms() }
        val sims = remember(permissionEpoch, tab) { availableSims() }
        val scope = rememberCoroutineScope()
        var busy by remember { mutableStateOf(false) }
        var error by remember { mutableStateOf<String?>(null) }
        val status by container.network.state.collectAsStateWithLifecycle()
        val permissions = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
            permissionEpoch++
            SyncEngineWorker.enqueue(this)
        }
        val grant = {
            val needed = gatewayPermissions().filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }
            if (needed.isEmpty()) {
                startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
            } else permissions.launch(needed.toTypedArray())
        }
        val saveMessages = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
            if (uri != null) scope.launch { writeCsv(uri, CsvLogExporter.formatMessagesCsv(container.database.messages().all(profile.familyId))) }
        }
        val saveHandoffs = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
            if (uri != null) scope.launch { writeCsv(uri, CsvLogExporter.formatHandoffsCsv(container.database.handoffs().all())) }
        }
        val copyCode = { getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText("Family join code", profile.joinCode)) }
        val toggle = { paused: Boolean ->
            scope.launch { container.prefs.setPaused(paused); SyncEngineWorker.enqueue(this@MainActivity) }
            Unit
        }
        val enqueue = { text: String, invalidNumberTest: Boolean, retryOf: String? ->
            busy = true
            error = null
            scope.launch {
                try {
                    container.queueHostMessage(profile, text, invalidNumberTest, retryOf)
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (_: Exception) {
                    error = "Message could not be queued. Try again."
                } finally { busy = false }
            }
            Unit
        }
        val membersFlow = remember(profile.familyId) { requireNotNull(container.cloud).observeMembers(profile.familyId) }
        val members by membersFlow.collectAsStateWithLifecycle(initialValue = emptyList())
        BackHandler(enabled = tab != GatewayTab.HOME) { tab = GatewayTab.HOME }
        Scaffold(
            modifier = Modifier.statusBarsPadding(),
            containerColor = MaterialTheme.colorScheme.background,
            bottomBar = { if (tab != GatewayTab.CHAT) IconBottomDock(tab) { tab = it } },
        ) { padding ->
            Box(Modifier.fillMaxSize().padding(padding)) {
                when (tab) {
                    GatewayTab.HOME -> HomeScreen(profile, members, prefs.paused, status, maySend, copyCode,
                        { tab = GatewayTab.CHAT }, { tab = GatewayTab.PEOPLE }, grant, { toggle(!prefs.paused) })
                    GatewayTab.CHAT -> {
                        val messagesFlow = remember(profile.familyId) {
                            combine(
                                container.database.messages().observe(profile.familyId),
                                requireNotNull(container.cloud).observeMessages(profile.familyId),
                            ) { local, remote ->
                                (local + remote).groupBy { it.messageId }.values
                                    .map { copies -> copies.maxBy { it.statusUpdatedAtMs } }
                                    .sortedBy { it.createdAtMs }
                            }.distinctUntilChanged().flowOn(Dispatchers.Default)
                        }
                        val messages by messagesFlow.collectAsStateWithLifecycle(initialValue = emptyList())
                        ChatScreen(profile, messages, busy, error, { tab = GatewayTab.HOME },
                            { message -> enqueue(message.text, false, message.messageId) }) { enqueue(it, false, null) }
                    }
                    GatewayTab.PEOPLE -> PeopleScreen(profile, members, copyCode)
                    GatewayTab.SETTINGS -> SettingsScreen(profile, prefs, sims, maySend,
                        setPaused = toggle,
                        setTheme = { scope.launch { container.prefs.setTheme(it) } },
                        selectSim = { scope.launch { container.prefs.selectSim(it) } }, grant = grant,
                        battery = {
                            try {
                                startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
                            } catch (_: Exception) {
                                try {
                                    startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
                                } catch (_: Exception) {
                                    Toast.makeText(this@MainActivity, "Battery optimization settings unavailable", Toast.LENGTH_SHORT).show()
                                }
                            }
                        },
                        diagnostics = { showDiagnostics = true }, signOut = {
                            scope.launch {
                                container.auth?.signOut()
                                try { CredentialManager.create(this@MainActivity).clearCredentialState(ClearCredentialStateRequest()) }
                                catch (_: androidx.credentials.exceptions.ClearCredentialException) { }
                            }
                        }, copyCode = copyCode, saving = busy, error = error, save = { phone, numbers, nickname ->
                            busy = true
                            error = null
                            scope.launch {
                                try {
                                    container.updateProfile(profile, phone, numbers, nickname)
                                } catch (cancelled: CancellationException) {
                                    throw cancelled
                                } catch (invalid: IllegalArgumentException) {
                                    error = invalid.message
                                } catch (_: Exception) {
                                    error = "Settings could not be saved. Check your connection and try again."
                                } finally { busy = false }
                            }
                        })
                }
            }
        }
        if (showDiagnostics) {
            AlertDialog(onDismissRequest = { showDiagnostics = false }, title = { Text("QA diagnostics") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Blocked unknown senders: ${prefs.blockedUnknownCount}")
                        if (error != null) Text(error.orEmpty(), color = MaterialTheme.colorScheme.error)
                        OutlinedButton({ enqueue("QA test message", false, null); tab = GatewayTab.CHAT; showDiagnostics = false }, enabled = !busy) { Text("Queue test SMS to Lola") }
                        OutlinedButton({ enqueue("QA invalid-number test", true, null); tab = GatewayTab.CHAT; showDiagnostics = false }, enabled = !busy) { Text("Run invalid-number test") }
                        OutlinedButton({ saveMessages.launch("lola-messages.csv") }) { Text("Export message CSV") }
                        OutlinedButton({ saveHandoffs.launch("lola-handoffs.csv") }) { Text("Export handoff CSV") }
                    }
                }, confirmButton = { TextButton({ showDiagnostics = false }) { Text("Done") } })
        }
    }

    private suspend fun signIn(oauthResource: Int) {
        val option = GetSignInWithGoogleOption.Builder(getString(oauthResource)).build()
        val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
        val credential = CredentialManager.create(this).getCredential(this, request).credential
        check(credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL)
        val token = GoogleIdTokenCredential.createFrom(credential.data).idToken
        requireNotNull(container.auth).signInWithCredential(GoogleAuthProvider.getCredential(token, null)).await()
    }

    private fun gatewayPermissions(): List<String> = buildList {
        addAll(listOf(Manifest.permission.SEND_SMS, Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_PHONE_STATE))
        if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
    }

    private fun availableSims(): List<SimChoice> {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) return emptyList()
        return getSystemService(SubscriptionManager::class.java)?.activeSubscriptionInfoList.orEmpty()
            .sortedBy { it.simSlotIndex }.map { SimChoice(it.subscriptionId, "SIM ${it.simSlotIndex + 1} · ${it.carrierName}") }
    }

    private suspend fun writeCsv(uri: Uri, csv: String) {
        val written = withContext(Dispatchers.IO) {
            try {
                val output = contentResolver.openOutputStream(uri) ?: return@withContext false
                output.bufferedWriter(Charsets.UTF_8).use { it.write(csv) }
                true
            } catch (_: java.io.IOException) { false }
        }
        Toast.makeText(this, if (written) "CSV saved" else "CSV could not be saved", Toast.LENGTH_SHORT).show()
    }
}
