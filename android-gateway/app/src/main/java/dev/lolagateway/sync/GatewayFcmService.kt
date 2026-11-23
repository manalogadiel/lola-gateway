package dev.lolagateway.sync

import android.content.Intent
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dev.lolagateway.LolaGatewayApp

class GatewayFcmService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        (application as LolaGatewayApp).container.rememberFcmToken(token)
        SyncEngineWorker.enqueue(this)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        if (message.data["familyId"].isNullOrBlank() || message.data["messageId"].isNullOrBlank()) return
        if (message.priority == RemoteMessage.PRIORITY_HIGH) {
            try {
                ContextCompat.startForegroundService(this, Intent(this, GatewayBurstService::class.java))
                return
            } catch (_: IllegalStateException) {
                // Android may downgrade high-priority delivery or reject a foreground start.
            } catch (_: SecurityException) {
                // WorkManager remains available if Android denies the foreground service.
            }
        }
        SyncEngineWorker.enqueue(this)
    }
}
