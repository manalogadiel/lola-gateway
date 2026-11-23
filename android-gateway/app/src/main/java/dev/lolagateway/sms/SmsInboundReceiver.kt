package dev.lolagateway.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import dev.lolagateway.LolaGatewayApp
import dev.lolagateway.sync.SyncEngineWorker
import kotlinx.coroutines.launch

class SmsInboundReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val app = context.applicationContext as LolaGatewayApp
        val pending = goAsync()
        app.scope.launch {
            try {
                val parts = Telephony.Sms.Intents.getMessagesFromIntent(intent).filterNotNull()
                    .groupBy { it.originatingAddress.orEmpty() }
                    .mapValues { (_, group) -> group.minOf { it.timestampMillis } to group.joinToString("") { it.messageBody.orEmpty() } }
                if (app.container.smsInbound.onIncomingPdus(parts, app.container.currentUid())) SyncEngineWorker.enqueue(context)
            } finally {
                pending.finish()
            }
        }
    }
}
