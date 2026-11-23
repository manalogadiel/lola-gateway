package dev.lolagateway.data.remote

import dev.lolagateway.data.local.LocalMessageEntity

interface GatewayCloudClient {
    suspend fun fetchQueuedOutbound(familyId: String): List<LocalMessageEntity>
    suspend fun publishMessage(message: LocalMessageEntity)
    suspend fun publishHeartbeat(familyId: String, heartbeat: Map<String, Any?>)
}
