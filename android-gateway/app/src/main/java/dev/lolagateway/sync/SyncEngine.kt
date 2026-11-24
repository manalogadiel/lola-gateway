package dev.lolagateway.sync

import androidx.room.withTransaction
import dev.lolagateway.data.local.AppDatabase
import dev.lolagateway.data.local.GatewayPrefsStore
import dev.lolagateway.data.local.GatewayProfile
import dev.lolagateway.data.local.LocalDispatchClaimer
import dev.lolagateway.data.local.LocalMessageEntity
import dev.lolagateway.data.remote.GatewayCloudClient
import dev.lolagateway.sms.SmsSender
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeout

class SyncEngine(
    private val database: AppDatabase,
    private val prefs: GatewayPrefsStore,
    private val cloud: () -> GatewayCloudClient?,
    private val sender: SmsSender,
    private val currentUid: () -> String?,
    private val network: () -> String,
    private val heartbeat: suspend (GatewayProfile, Boolean) -> Map<String, Any?>,
    private val canSend: () -> Boolean,
    private val clock: () -> Long = System::currentTimeMillis,
    private val heartbeatIntervalMs: Long = 15 * 60 * 1000L,
) {
    private val lock = Mutex()
    private val claimer = LocalDispatchClaimer(database)
    private var lastHeartbeatAtMs: Long? = null
    private var lastHeartbeatKey: Triple<String, Boolean, String>? = null

    suspend fun runCatchUpAndDrain(): Boolean = lock.withLock {
        val startedAt = System.currentTimeMillis()
        val initial = prefs.current()
        val profile = initial.profile?.takeIf { it.uid == currentUid() } ?: return@withLock true
        val transport = network()
        val remote = cloud()?.takeIf { transport != "NONE" }
        val messages = database.messages()
        var cloudOk = true
        if (remote != null && !initial.paused) {
            cloudOk = cloudCall {
                for (message in remote.fetchQueuedOutbound(profile.familyId)) {
                    val now = System.currentTimeMillis()
                    messages.insert(message.copy(queuedOnGatewayAtMs = now, statusUpdatedAtMs = now, syncDirty = true))
                }
            }
        }

        if (remote != null) {
            for (message in messages.dirty(profile.familyId)) {
                if (currentUid() != profile.uid) return@withLock true
                if (message.createInCloud && message.direction == "OUTBOUND" && message.status == "QUEUED" && message.retryCount == 0) {
                    val synced = publish(remote, message)
                    cloudOk = cloudOk && synced
                }
            }
        }

        recoverUncertainDispatches(profile.familyId, startedAt)
        if (canSend()) {
            while (true) {
                val current = prefs.current()
                if (current.profile != profile || currentUid() != profile.uid || current.paused || !canSend()) break
                val row = claimer.claimNextReady(profile.familyId, System.currentTimeMillis(), current.paused) ?: break
                val destination = row.diagnosticDestination ?: profile.seniorPhoneE164
                sender.dispatch(row, destination, current.selectedSubId, network().takeIf { it == "WIFI" || it == "CELLULAR" }) {
                    val latest = prefs.current()
                    latest.profile == profile && !latest.paused && currentUid() == profile.uid && canSend()
                }
            }
        }

        if (remote != null && currentUid() == profile.uid) {
            val state = prefs.current()
            if (state.profile != profile) return@withLock true
            for (message in messages.dirty(profile.familyId)) {
                if (currentUid() != profile.uid) return@withLock true
                if (state.paused && message.direction == "INBOUND") continue
                val synced = publish(remote, message)
                cloudOk = cloudOk && synced
            }
            val now = clock()
            val heartbeatKey = Triple(profile.familyId, state.paused, network())
            val heartbeatDue = lastHeartbeatAtMs == null ||
                lastHeartbeatKey != heartbeatKey ||
                (now - (lastHeartbeatAtMs ?: 0L)) >= heartbeatIntervalMs
            if (heartbeatDue) {
                val heartbeatPublished = cloudCall {
                    remote.publishHeartbeat(profile.familyId, heartbeat(profile, state.paused))
                }
                if (heartbeatPublished) {
                    lastHeartbeatAtMs = now
                    lastHeartbeatKey = heartbeatKey
                }
                cloudOk = cloudOk && heartbeatPublished
            }
            if (cloudOk && !state.paused) database.handoffs().markRecovered(startedAt, System.currentTimeMillis())
        }
        cloudOk
    }

    private suspend fun publish(remote: GatewayCloudClient, message: LocalMessageEntity) = cloudCall {
        remote.publishMessage(message)
        database.messages().markSynced(message.messageId, message.version)
    }

    private suspend fun recoverUncertainDispatches(familyId: String, now: Long) = database.withTransaction {
        val messages = database.messages()
        for (message in messages.uncertain(familyId, now - 60_000)) {
            val armed = database.smsParts().find(message.messageId, message.retryCount).isNotEmpty()
            if (!armed) {
                messages.update(message.copy(localDispatchState = "READY", dispatchStartedAtMs = null))
                continue
            }
            messages.update(message.copy(status = "PENDING", localDispatchState = "FINISHED", syncDirty = true,
                version = message.version + 1, statusUpdatedAtMs = now,
                errorReason = "Android did not confirm submission. The gateway will not send it again automatically."))
        }
    }

    private suspend fun cloudCall(action: suspend () -> Unit): Boolean = try {
        withTimeout(12_000) { action() }
        true
    } catch (_: TimeoutCancellationException) {
        false
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (_: Exception) {
        false
    }
}
