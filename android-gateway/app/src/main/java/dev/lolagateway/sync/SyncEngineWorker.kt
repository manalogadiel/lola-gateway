package dev.lolagateway.sync

import android.content.Context
import android.os.Build
import androidx.work.*
import dev.lolagateway.LolaGatewayApp
import java.util.concurrent.TimeUnit

class SyncEngineWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val app = applicationContext as LolaGatewayApp
        return if (app.container.sync.runCatchUpAndDrain()) Result.success() else Result.retry()
    }

    companion object {
        fun enqueue(context: Context, delayMs: Long = 0) {
            val request = OneTimeWorkRequestBuilder<SyncEngineWorker>()
                .setExpeditedIfImmediate(delayMs).build()
            val manager = WorkManager.getInstance(context)
            if (delayMs == 0L) manager.enqueueUniqueWork("gateway-sync", ExistingWorkPolicy.APPEND_OR_REPLACE, request)
            else manager.enqueue(request)
        }

        fun startPeriodic(context: Context) {
            val request = PeriodicWorkRequestBuilder<SyncEngineWorker>(15, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork("gateway-heartbeat", ExistingPeriodicWorkPolicy.KEEP, request)
        }

        private fun OneTimeWorkRequest.Builder.setExpeditedIfImmediate(delayMs: Long) = if (delayMs > 0) {
            setInitialDelay(delayMs, TimeUnit.MILLISECONDS)
        } else if (Build.VERSION.SDK_INT >= 31) {
            setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
        } else this
    }
}
