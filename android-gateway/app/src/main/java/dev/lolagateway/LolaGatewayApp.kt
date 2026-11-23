package dev.lolagateway

import android.Manifest
import android.app.Application
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.provider.Settings
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import androidx.room.Room
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.messaging.FirebaseMessaging
import dev.lolagateway.data.local.AppDatabase
import dev.lolagateway.data.local.GatewayPrefsStore
import dev.lolagateway.data.local.GatewayProfile
import dev.lolagateway.data.local.LocalMessageEntity
import dev.lolagateway.data.model.SmsSegmentCalculator
import dev.lolagateway.data.model.PhoneNormalizer
import dev.lolagateway.data.remote.FirestoreGatewayRepo
import dev.lolagateway.sms.AndroidSmsTransport
import dev.lolagateway.sms.SmsInboundHandler
import dev.lolagateway.sms.SmsSender
import dev.lolagateway.sms.SmsStatusHandler
import dev.lolagateway.sync.NetworkMonitor
import dev.lolagateway.sync.SyncEngine
import dev.lolagateway.sync.SyncEngineWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull
import java.util.UUID

class LolaGatewayApp : Application() {
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    val container by lazy { AppContainer(this) }

    override fun onCreate() {
        super.onCreate()
        container.network.start()
        SyncEngineWorker.startPeriodic(this)
        if (container.currentUid() != null) SyncEngineWorker.enqueue(this)
    }
}

class AppContainer(private val app: LolaGatewayApp) {
    val database = Room.databaseBuilder(app, AppDatabase::class.java, "lola-gateway.db").build()
    val prefs = GatewayPrefsStore(app)
    val smsStatus = SmsStatusHandler(database)
    val smsInbound = SmsInboundHandler(database, prefs)
    val network = NetworkMonitor(app, database.handoffs(), app.scope)
    val auth: FirebaseAuth? by lazy { FirebaseApp.getApps(app).firstOrNull()?.let(FirebaseAuth::getInstance) }
    val cloud: FirestoreGatewayRepo? by lazy {
        FirebaseApp.getApps(app).firstOrNull()?.let { FirestoreGatewayRepo(FirebaseFirestore.getInstance(it)) }
    }
    private val sender = SmsSender(database, AndroidSmsTransport(app))
    @Volatile private var lastFcmToken = ""
    val sync = SyncEngine(database, prefs, { cloud }, sender, ::currentUid, network::currentTransport,
        { profile, paused -> heartbeat(profile.uid, paused) }, ::maySendSms)

    fun currentUid(): String? = auth?.currentUser?.uid

    fun maySendSms(): Boolean = ContextCompat.checkSelfPermission(app, Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED

    fun rememberFcmToken(token: String) { lastFcmToken = token }

    suspend fun createFamily(familyName: String, seniorName: String, phone: String) {
        val user = requireNotNull(auth?.currentUser) { "Sign in with Google first." }
        val displayName = user.displayName?.takeIf { it.isNotBlank() } ?: "Gateway Host"
        val profile = requireNotNull(cloud).createFamily(user.uid, displayName, familyName, seniorName, phone, heartbeat(user.uid, false))
        prefs.saveProfile(profile)
        SyncEngineWorker.enqueue(app)
    }

    suspend fun updateProfile(profile: GatewayProfile, phone: String, allowList: String, nickname: String) {
        check(profile.uid == currentUid() && prefs.current().profile == profile)
        val seniorPhone = requireNotNull(PhoneNormalizer.toPhE164(phone)) { "Enter a valid mobile number for Lola." }
        val allowed = allowList.split(',', '\n').filter { it.isNotBlank() }.map { number ->
            requireNotNull(PhoneNormalizer.toPhE164(number)) { "Enter valid Philippine mobile numbers in the allow-list." }
        }.toSet() + seniorPhone
        require(nickname.trim().length <= 24) { "Use 24 characters or fewer for your SMS nickname." }
        val updated = profile.copy(seniorPhoneE164 = seniorPhone, allowListE164 = allowed, smsNickname = nickname.trim())
        requireNotNull(cloud).updateProfile(updated)
        prefs.saveProfile(updated)
        SyncEngineWorker.enqueue(app)
    }

    suspend fun queueHostMessage(profile: GatewayProfile, raw: String, invalidNumberTest: Boolean = false, retryOf: String? = null) {
        check(profile.uid == currentUid() && prefs.current().profile == profile) { "Sign in to the active family." }
        val text = raw.trim()
        require(text.isNotEmpty()) { "Enter a message." }
        val senderName = profile.smsNickname.ifBlank { profile.displayName }
        val sms = SmsSegmentCalculator.formatAndSegment(senderName, text)
        require(sms.segmentCount <= 10) { "Use 10 SMS segments or fewer." }
        val now = System.currentTimeMillis()
        val row = LocalMessageEntity(UUID.randomUUID().toString(), profile.familyId, "OUTBOUND", profile.uid,
            senderName, text, sms.formattedText, sms.encoding.wireName, sms.segmentCount,
            syncDirty = true, createInCloud = true, queuedOnGatewayAtMs = now, createdAtMs = now,
            diagnosticDestination = "12345".takeIf { invalidNumberTest }, retryOfMessageId = retryOf)
        database.messages().insert(row)
        SyncEngineWorker.enqueue(app)
    }

    private suspend fun heartbeat(uid: String, paused: Boolean): Map<String, Any?> {
        val currentNetwork = network.currentTransport()
        val battery = app.getSystemService(BatteryManager::class.java)
        val plugged = app.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            ?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0
        val phone = app.getSystemService(TelephonyManager::class.java)
        try {
            withTimeoutOrNull(4_000) { FirebaseMessaging.getInstance().token.await() }?.let(::rememberFcmToken)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            // A token refresh failure should not hold up family setup or heartbeat writes.
        }
        return mapOf(
            "uid" to uid, "deviceId" to Settings.Secure.getString(app.contentResolver, Settings.Secure.ANDROID_ID).orEmpty(),
            "fcmToken" to lastFcmToken, "status" to if (paused) "PAUSED" else "ONLINE",
            "networkType" to currentNetwork.takeIf { it in setOf("WIFI", "CELLULAR") }.orEmpty().ifEmpty { "NONE" },
            "carrierName" to phone?.networkOperatorName.orEmpty(),
            "batteryPercent" to battery.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY).coerceIn(0, 100),
            "isCharging" to (plugged != 0), "lastHeartbeatAt" to FieldValue.serverTimestamp(),
        )
    }
}
