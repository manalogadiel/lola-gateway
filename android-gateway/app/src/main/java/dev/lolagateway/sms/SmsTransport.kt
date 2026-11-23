package dev.lolagateway.sms

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.telephony.SmsManager

fun interface SmsTransport {
    fun sendParts(destination: String, parts: List<String>, messageId: String, subscriptionId: Int?, attempt: Int)
}

class AndroidSmsTransport(private val context: Context) : SmsTransport {
    @Suppress("DEPRECATION")
    override fun sendParts(destination: String, parts: List<String>, messageId: String, subscriptionId: Int?, attempt: Int) {
        val manager = when {
            subscriptionId == null -> context.getSystemService(SmsManager::class.java)
            Build.VERSION.SDK_INT >= 31 -> context.getSystemService(SmsManager::class.java).createForSubscriptionId(subscriptionId)
            else -> SmsManager.getSmsManagerForSubscriptionId(subscriptionId)
        }
        val sent = ArrayList(parts.indices.map { callback(SmsStatusReceiver.SENT, messageId, attempt, it) })
        val delivered = ArrayList(parts.indices.map { callback(SmsStatusReceiver.DELIVERED, messageId, attempt, it) })
        if (parts.size == 1) {
            manager.sendTextMessage(destination, null, parts.single(), sent.single(), delivered.single())
        } else {
            manager.sendMultipartTextMessage(destination, null, ArrayList(parts), sent, delivered)
        }
    }

    private fun callback(action: String, messageId: String, attempt: Int, part: Int): PendingIntent {
        val intent = Intent(context, SmsStatusReceiver::class.java).setAction(action)
            .setData(Uri.Builder().scheme("lolagateway").authority("sms").appendPath(messageId)
                .appendPath(attempt.toString()).appendPath(part.toString()).build())
        val mutability = if (action == SmsStatusReceiver.DELIVERED) PendingIntent.FLAG_MUTABLE else PendingIntent.FLAG_IMMUTABLE
        return PendingIntent.getBroadcast(context, (messageId.hashCode() * 31 + attempt) * 31 + part, intent, mutability or PendingIntent.FLAG_UPDATE_CURRENT)
    }
}
