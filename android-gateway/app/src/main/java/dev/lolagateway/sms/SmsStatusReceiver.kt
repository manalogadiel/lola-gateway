package dev.lolagateway.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.SmsMessage
import dev.lolagateway.LolaGatewayApp
import dev.lolagateway.sync.SyncEngineWorker
import kotlinx.coroutines.launch

class SmsStatusReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val (id, rawAttempt, rawPart) = intent.data?.pathSegments?.takeIf { it.size == 3 } ?: return
        val attempt = rawAttempt.toIntOrNull()?.takeIf { it >= 0 } ?: return
        val part = rawPart.toIntOrNull()?.takeIf { it >= 0 } ?: return
        val app = context.applicationContext as LolaGatewayApp
        val outcome = resultCode
        val pending = goAsync()
        app.scope.launch {
            try {
                val handler = app.container.smsStatus
                val updated = when (intent.action) {
                    SENT -> handler.onPartSent(id, attempt, part, outcome)
                    DELIVERED -> readDeliveryStatus(intent)?.let { handler.onPartDelivered(id, attempt, part, it) }
                    else -> null
                } ?: return@launch
                if (updated.status == "SENT") PendingStatusWorker.enqueue(context, id)
                if (updated.localDispatchState == "READY") {
                    SyncEngineWorker.enqueue(context, (updated.nextRetryAtMs - System.currentTimeMillis()).coerceAtLeast(0))
                }
                SyncEngineWorker.enqueue(context)
            } finally {
                pending.finish()
            }
        }
    }

    @Suppress("DEPRECATION")
    private fun readDeliveryStatus(intent: Intent): Int? {
        val pdu = intent.getByteArrayExtra("pdu") ?: return null
        val format = intent.getStringExtra("format")
        val report = if (format != null) SmsMessage.createFromPdu(pdu, format) else SmsMessage.createFromPdu(pdu)
        return report?.takeIf { it.isStatusReportMessage }?.status
    }

    companion object {
        const val SENT = "dev.lolagateway.SMS_SENT"
        const val DELIVERED = "dev.lolagateway.SMS_DELIVERED"
    }
}
