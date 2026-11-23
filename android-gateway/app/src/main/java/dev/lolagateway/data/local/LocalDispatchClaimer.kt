package dev.lolagateway.data.local

import androidx.room.withTransaction

class LocalDispatchClaimer(private val database: AppDatabase) {
    suspend fun claimNextReady(familyId: String, nowMs: Long, isPaused: Boolean): LocalMessageEntity? {
        if (isPaused) return null
        return database.withTransaction {
            val dao = database.messages()
            val candidate = dao.nextReady(familyId, nowMs) ?: return@withTransaction null
            if (dao.claim(candidate.messageId, nowMs) != 1) return@withTransaction null
            candidate.copy(localDispatchState = "DISPATCHING", dispatchStartedAtMs = nowMs)
        }
    }
}
