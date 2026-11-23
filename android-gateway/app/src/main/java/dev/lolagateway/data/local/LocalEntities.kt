package dev.lolagateway.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "messages", indices = [Index("familyId", "localDispatchState", "createdAtMs")])
data class LocalMessageEntity(
    @PrimaryKey val messageId: String,
    val familyId: String,
    val direction: String,
    val senderUid: String,
    val senderName: String,
    val text: String,
    val smsFormattedText: String,
    val encoding: String,
    val segmentCount: Int,
    val status: String = "QUEUED",
    val localDispatchState: String = "READY",
    val syncDirty: Boolean = false,
    val createInCloud: Boolean = false,
    val version: Long = 0,
    val retryCount: Int = 0,
    val nextRetryAtMs: Long = 0,
    val dispatchStartedAtMs: Long? = null,
    val errorCode: String? = null,
    val errorReason: String? = null,
    val createdAtMs: Long,
    val queuedOnGatewayAtMs: Long? = null,
    val sentAtMs: Long? = null,
    val deliveredAtMs: Long? = null,
    val statusUpdatedAtMs: Long = createdAtMs,
    val gatewayNetwork: String? = null,
    val diagnosticDestination: String? = null,
    val retryOfMessageId: String? = null,
)

@Entity(tableName = "sms_parts", primaryKeys = ["messageId", "attempt", "partIndex"])
data class LocalSmsPartEntity(
    val messageId: String,
    val attempt: Int,
    val partIndex: Int,
    val sentResultCode: Int? = null,
    val deliveryStatus: Int? = null,
)

@Entity(tableName = "handoff_logs")
data class HandoffLogEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val oldTransport: String,
    val newTransport: String,
    val transitionedAtMs: Long,
    val recoveredAtMs: Long? = null,
)
