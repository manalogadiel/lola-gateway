package dev.lolagateway.sms

import android.app.Activity
import android.telephony.SmsManager
import androidx.room.withTransaction
import dev.lolagateway.data.local.AppDatabase
import dev.lolagateway.data.local.LocalMessageEntity
import dev.lolagateway.data.local.LocalSmsPartEntity

class SmsStatusHandler(private val database: AppDatabase, private val now: () -> Long = System::currentTimeMillis) {
    suspend fun onPartSent(id: String, attempt: Int, part: Int, resultCode: Int) = record(id, attempt, part) {
        if (it.sentResultCode == null) it.copy(sentResultCode = resultCode) else it
    }

    suspend fun onPartDelivered(id: String, attempt: Int, part: Int, tpStatus: Int) = record(id, attempt, part) {
        if (it.deliveryStatus == 0) it else it.copy(deliveryStatus = tpStatus)
    }

    private suspend fun record(id: String, attempt: Int, index: Int, change: (LocalSmsPartEntity) -> LocalSmsPartEntity): LocalMessageEntity? =
        database.withTransaction {
            val messages = database.messages()
            val message = messages.find(id) ?: return@withTransaction null
            if (message.retryCount != attempt || message.status in setOf("FAILED", "DELIVERED")) return@withTransaction null
            val parts = database.smsParts()
            val part = parts.find(id, attempt).getOrNull(index) ?: return@withTransaction null
            val updatedPart = change(part)
            if (updatedPart == part) return@withTransaction null
            parts.update(updatedPart)
            val results = parts.find(id, attempt)
            if (results.size != message.segmentCount || results.any { it.sentResultCode == null }) return@withTransaction null

            val timestamp = now()
            val allSent = results.all { it.sentResultCode == Activity.RESULT_OK }
            val updated = if (allSent) {
                val delivered = results.all { it.deliveryStatus == 0 }
                val status = when {
                    delivered -> "DELIVERED"
                    message.status == "PENDING" -> "PENDING"
                    else -> "SENT"
                }
                message.copy(status = status, localDispatchState = "FINISHED", sentAtMs = message.sentAtMs ?: timestamp,
                    deliveredAtMs = timestamp.takeIf { delivered }, errorCode = null, errorReason = null)
            } else {
                sendFailure(message, results, timestamp)
            }
            if (updated == message) return@withTransaction null
            updated.copy(syncDirty = true, version = message.version + 1, statusUpdatedAtMs = timestamp)
                .also { messages.update(it) }
        }

    private fun sendFailure(message: LocalMessageEntity, parts: List<LocalSmsPartEntity>, timestamp: Long): LocalMessageEntity {
        val allTransient = parts.all { it.sentResultCode in setOf(SmsManager.RESULT_ERROR_NO_SERVICE, SmsManager.RESULT_ERROR_RADIO_OFF) }
        val error = when {
            parts.any { it.sentResultCode == SmsManager.RESULT_ERROR_NO_SERVICE } -> "NO_SERVICE"
            parts.any { it.sentResultCode == SmsManager.RESULT_ERROR_RADIO_OFF } -> "RADIO_OFF"
            else -> "GENERIC_FAILURE"
        }
        val failures = message.retryCount + 1
        if (allTransient && failures < 4 && message.status == "QUEUED") {
            return message.copy(localDispatchState = "READY", retryCount = failures,
                nextRetryAtMs = timestamp + backoffMs[failures - 1], dispatchStartedAtMs = null, errorCode = error)
        }
        val wasPartiallySent = parts.any { it.sentResultCode == Activity.RESULT_OK }
        return message.copy(status = "FAILED", localDispatchState = "FINISHED", retryCount = failures,
            errorCode = error, errorReason = if (wasPartiallySent) "Only some SMS parts were accepted" else "Android SMS submission failed")
    }

    suspend fun markPending(id: String): LocalMessageEntity? = database.withTransaction {
        val dao = database.messages()
        val message = dao.find(id)?.takeIf { it.status == "SENT" } ?: return@withTransaction null
        message.copy(status = "PENDING", syncDirty = true, version = message.version + 1, statusUpdatedAtMs = now())
            .also { dao.update(it) }
    }

    private companion object { val backoffMs = longArrayOf(10_000, 20_000, 40_000) }
}
