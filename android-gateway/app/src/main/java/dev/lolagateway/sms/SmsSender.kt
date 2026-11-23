package dev.lolagateway.sms

import android.os.SystemClock
import androidx.room.withTransaction
import dev.lolagateway.data.local.AppDatabase
import dev.lolagateway.data.local.LocalMessageEntity
import dev.lolagateway.data.local.LocalSmsPartEntity
import dev.lolagateway.data.model.PhoneNormalizer
import dev.lolagateway.data.model.SmsSegmentCalculator
import kotlinx.coroutines.delay
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class SmsSender(private val database: AppDatabase, private val transport: SmsTransport) {
    private val lock = Mutex()
    private var lastDispatchAt: Long? = null

    suspend fun dispatch(
        message: LocalMessageEntity, destination: String, subscriptionId: Int?, network: String?,
        shouldSend: suspend () -> Boolean = { true },
    ) {
        lock.withLock {
            val number = PhoneNormalizer.toPhE164(destination)
            if (number == null) {
                failBeforeSend(message, "INVALID_NUMBER", "Invalid Philippine mobile number")
                return@withLock
            }
            val parts = SmsSegmentCalculator.segment(message.smsFormattedText).parts
            if (parts.isEmpty() || parts.size != message.segmentCount) {
                failBeforeSend(message, "GENERIC_FAILURE", "SMS segment count does not match the message")
                return@withLock
            }
            lastDispatchAt?.let { delay((2_000 - (SystemClock.elapsedRealtime() - it)).coerceAtLeast(0)) }
            if (!shouldSend()) {
                database.messages().update(message.copy(localDispatchState = "READY", dispatchStartedAtMs = null))
                return@withLock
            }
            database.withTransaction {
                val armed = message.copy(gatewayNetwork = network)
                database.messages().update(armed)
                database.smsParts().insert(parts.indices.map { LocalSmsPartEntity(message.messageId, message.retryCount, it) })
            }
            lastDispatchAt = SystemClock.elapsedRealtime()
            try {
                transport.sendParts(number, parts, message.messageId, subscriptionId, message.retryCount)
            } catch (_: SecurityException) {
                failBeforeSend(message, "GENERIC_FAILURE", "SMS permission is unavailable")
            } catch (_: IllegalArgumentException) {
                failBeforeSend(message, "GENERIC_FAILURE", "SMS arguments were rejected by Android")
            }
        }
    }

    private suspend fun failBeforeSend(message: LocalMessageEntity, code: String, reason: String) {
        database.messages().update(message.copy(
            status = "FAILED", localDispatchState = "FINISHED", syncDirty = true,
            version = message.version + 1, errorCode = code, errorReason = reason,
            statusUpdatedAtMs = System.currentTimeMillis(),
        ))
    }
}
