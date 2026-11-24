package dev.lolagateway.sms

import dev.lolagateway.data.local.AppDatabase
import dev.lolagateway.data.local.GatewayPrefsStore
import dev.lolagateway.data.local.LocalMessageEntity
import dev.lolagateway.data.model.InboundIdGenerator
import dev.lolagateway.data.model.PhoneNormalizer
import dev.lolagateway.data.model.SmsSegmentCalculator

class SmsInboundHandler(private val database: AppDatabase, private val prefs: GatewayPrefsStore) {
    suspend fun onIncomingPdus(partsBySender: Map<String, Pair<Long, String>>, authenticatedUid: String?): Boolean {
        val profile = prefs.current().profile?.takeIf { it.uid == authenticatedUid } ?: return false
        var saved = false
        for ((raw, message) in partsBySender) {
            val from = PhoneNormalizer.toPhE164(raw)
            if (from == null || from !in profile.allowListE164) {
                prefs.countBlocked()
                continue
            }
            val (timestamp, body) = message
            if (body.isBlank()) continue
            val now = System.currentTimeMillis()
            if (database.messages().hasRecentOutboundEcho(profile.familyId, body, now - 30_000L)) continue
            val details = SmsSegmentCalculator.segment(body)
            val messageId = InboundIdGenerator.generate(from, timestamp, body)
            val createdAt = if (kotlin.math.abs(timestamp - now) > 5 * 60 * 1000L) now else timestamp
            val row = LocalMessageEntity(
                messageId, profile.familyId, "INBOUND", "senior", profile.seniorName, body,
                body, details.encoding.wireName, details.segmentCount, status = "DELIVERED",
                localDispatchState = "FINISHED", syncDirty = true, createInCloud = true,
                createdAtMs = createdAt, deliveredAtMs = now,
            )
            saved = database.messages().insert(row) != -1L || saved
        }
        return saved
    }
}
