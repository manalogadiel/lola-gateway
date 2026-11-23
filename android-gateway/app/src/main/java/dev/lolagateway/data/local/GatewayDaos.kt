package dev.lolagateway.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface MessageDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(message: LocalMessageEntity): Long

    @Update
    suspend fun update(message: LocalMessageEntity)

    @Query("SELECT * FROM messages WHERE messageId = :id")
    suspend fun find(id: String): LocalMessageEntity?

    @Query("SELECT * FROM messages WHERE familyId = :familyId AND direction = 'OUTBOUND' AND status = 'QUEUED' AND localDispatchState = 'READY' AND nextRetryAtMs <= :now ORDER BY createdAtMs, messageId LIMIT 1")
    suspend fun nextReady(familyId: String, now: Long): LocalMessageEntity?

    @Query("UPDATE messages SET localDispatchState = 'DISPATCHING', dispatchStartedAtMs = :now WHERE messageId = :id AND localDispatchState = 'READY'")
    suspend fun claim(id: String, now: Long): Int

    @Query("SELECT * FROM messages WHERE familyId = :familyId AND localDispatchState = 'DISPATCHING' AND dispatchStartedAtMs <= :before")
    suspend fun uncertain(familyId: String, before: Long): List<LocalMessageEntity>

    @Query("SELECT * FROM messages WHERE familyId = :familyId AND syncDirty = 1 ORDER BY createdAtMs, messageId")
    suspend fun dirty(familyId: String): List<LocalMessageEntity>

    @Query("UPDATE messages SET syncDirty = 0 WHERE messageId = :id AND version = :version")
    suspend fun markSynced(id: String, version: Long)

    @Query("SELECT * FROM messages WHERE familyId = :familyId ORDER BY createdAtMs, messageId")
    fun observe(familyId: String): Flow<List<LocalMessageEntity>>

    @Query("SELECT * FROM messages WHERE familyId = :familyId ORDER BY createdAtMs, messageId")
    suspend fun all(familyId: String): List<LocalMessageEntity>
}

@Dao
interface SmsPartDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(parts: List<LocalSmsPartEntity>)

    @Update
    suspend fun update(part: LocalSmsPartEntity)

    @Query("SELECT * FROM sms_parts WHERE messageId = :id AND attempt = :attempt ORDER BY partIndex")
    suspend fun find(id: String, attempt: Int): List<LocalSmsPartEntity>
}

@Dao
interface HandoffDao {
    @Insert
    suspend fun insert(log: HandoffLogEntity)

    @Query("UPDATE handoff_logs SET recoveredAtMs = :now WHERE recoveredAtMs IS NULL AND transitionedAtMs <= :startedAt")
    suspend fun markRecovered(startedAt: Long, now: Long)

    @Query("SELECT * FROM handoff_logs ORDER BY transitionedAtMs, id")
    suspend fun all(): List<HandoffLogEntity>
}
