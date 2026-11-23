package dev.lolagateway.sync

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import dev.lolagateway.LolaGatewayApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

class GatewayBurstService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val channel = "gateway-sync"
        getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(channel, "SMS bridge activity", NotificationManager.IMPORTANCE_LOW),
        )
        startForeground(1, NotificationCompat.Builder(this, channel)
            .setSmallIcon(android.R.drawable.stat_notify_sync).setContentTitle("Lola Gateway")
            .setContentText("Checking the SMS bridge queue").setOngoing(true).build())
        scope.launch {
            try {
                val app = application as LolaGatewayApp
                val complete = withTimeoutOrNull(25_000) { app.container.sync.runCatchUpAndDrain() } == true
                if (!complete) SyncEngineWorker.enqueue(this@GatewayBurstService)
            } finally {
                if (stopSelfResult(startId)) stopForeground(STOP_FOREGROUND_REMOVE)
            }
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
