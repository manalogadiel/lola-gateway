package dev.lolagateway.data.model

import java.security.MessageDigest

object InboundIdGenerator {
    fun generate(senderE164: String, smsTimestampMs: Long, body: String): String {
        val payload = "$senderE164\n$smsTimestampMs\n$body".toByteArray(Charsets.UTF_8)
        val digest = MessageDigest.getInstance("SHA-256").digest(payload)
        return "in_" + digest.joinToString("") { "%02x".format(it) }
    }
}
