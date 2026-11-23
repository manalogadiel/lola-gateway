package dev.lolagateway.sms

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import dev.lolagateway.LolaGatewayApp
import dev.lolagateway.sync.SyncEngineWorker
import java.util.concurrent.TimeUnit

class PendingStatusWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val messageId = inputData.getString("messageId") ?: return Result.failure()
        val app = applicationContext as LolaGatewayApp
        if (app.container.smsStatus.markPending(messageId) != null) SyncEngineWorker.enqueue(applicationContext)
        return Result.success()
    }

    companion object {
        fun enqueue(context: Context, messageId: String) {
            val request = OneTimeWorkRequestBuilder<PendingStatusWorker>()
                .setInputData(workDataOf("messageId" to messageId))
                .setInitialDelay(10, TimeUnit.SECONDS).build()
            WorkManager.getInstance(context).enqueueUniqueWork("sms-pending-$messageId", ExistingWorkPolicy.KEEP, request)
        }
    }
}
