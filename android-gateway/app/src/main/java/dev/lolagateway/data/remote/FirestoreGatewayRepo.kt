package dev.lolagateway.data.remote

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.Source
import dev.lolagateway.data.local.GatewayProfile
import dev.lolagateway.data.local.LocalMessageEntity
import dev.lolagateway.data.model.PhoneNormalizer
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.security.SecureRandom
import java.util.Date

data class FamilyMember(val name: String, val nickname: String, val role: String)

class FirestoreGatewayRepo(private val db: FirebaseFirestore) : GatewayCloudClient {
    private fun family(id: String) = db.collection("families").document(id)
    private fun messages(id: String) = family(id).collection("messages")

    suspend fun createFamily(
        uid: String, displayName: String, familyName: String, seniorName: String, phone: String, heartbeat: Map<String, Any?>,
    ): GatewayProfile {
        val normalized = requireNotNull(PhoneNormalizer.toPhE164(phone)) { "Enter a valid Philippine mobile number." }
        require(familyName.isNotBlank() && seniorName.isNotBlank()) { "Enter the family name and Lola’s name." }
        val family = db.collection("families").document()
        val alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
        val random = SecureRandom()
        repeat(3) {
            val code = (1..8).map { alphabet[random.nextInt(alphabet.length)] }.joinToString("")
            val codeDoc = db.collection("joinCodes").document(code)
            val created = db.runTransaction { transaction ->
                if (transaction.get(codeDoc).exists()) return@runTransaction false
                val now = FieldValue.serverTimestamp()
                transaction.set(family, mapOf(
                    "name" to familyName.trim(), "joinCode" to code, "seniorName" to seniorName.trim(),
                    "seniorPhoneE164" to normalized, "allowListE164" to listOf(normalized), "gateway" to heartbeat,
                ))
                transaction.set(codeDoc, mapOf("familyId" to family.id))
                transaction.set(family.collection("members").document(uid), mapOf(
                    "displayName" to displayName, "smsNickname" to "", "role" to "GATEWAY",
                    "joinedAt" to now, "lastActiveAt" to now,
                ))
                true
            }.await()
            if (created) return GatewayProfile(family.id, familyName.trim(), code, seniorName.trim(),
                normalized, setOf(normalized), uid, displayName)
        }
        error("Could not allocate a family join code.")
    }

    override suspend fun fetchQueuedOutbound(familyId: String): List<LocalMessageEntity> = messages(familyId)
        .whereEqualTo("direction", "OUTBOUND").whereEqualTo("status", "QUEUED")
        .orderBy("createdAt").get(Source.SERVER).await().documents.mapNotNull { it.toLocal(familyId) }

    override suspend fun publishMessage(message: LocalMessageEntity) {
        val ref = messages(message.familyId).document(message.messageId)
        db.runTransaction { transaction ->
            val existing = transaction.get(ref)
            val metadata = message.metadata()
            if (!existing.exists()) {
                check(message.createInCloud) { "The queued cloud message no longer exists." }
                transaction.set(ref, metadata + mapOf(
                    "direction" to message.direction, "senderUid" to message.senderUid, "senderName" to message.senderName,
                    "text" to message.text, "smsFormattedText" to message.smsFormattedText, "encoding" to message.encoding,
                    "segmentCount" to message.segmentCount, "createdAt" to Timestamp(Date(message.createdAtMs)),
                    "retryOfMessageId" to message.retryOfMessageId,
                ))
            } else if (message.direction == "OUTBOUND" && canPublish(existing.getString("status"), message.status)) {
                transaction.update(ref, metadata)
            }
            Unit
        }.await()
    }

    suspend fun updateProfile(profile: GatewayProfile) {
        val family = family(profile.familyId)
        db.runTransaction { transaction ->
            transaction.update(family, "seniorPhoneE164", profile.seniorPhoneE164, "allowListE164", profile.allowListE164.sorted())
            transaction.update(family.collection("members").document(profile.uid),
                "smsNickname", profile.smsNickname, "lastActiveAt", FieldValue.serverTimestamp())
            Unit
        }.await()
    }

    private fun canPublish(old: String?, new: String): Boolean = old == new || when (old) {
        "QUEUED" -> new != "QUEUED"
        "SENT" -> new in setOf("PENDING", "DELIVERED", "FAILED")
        "PENDING" -> new in setOf("DELIVERED", "FAILED")
        else -> false
    }

    override suspend fun publishHeartbeat(familyId: String, heartbeat: Map<String, Any?>) {
        family(familyId).update("gateway", heartbeat).await()
    }

    fun observeMessages(familyId: String) = callbackFlow {
        val subscription = messages(familyId).orderBy("createdAt", Query.Direction.DESCENDING).limit(100)
            .addSnapshotListener { snapshot, _ ->
                if (snapshot != null) trySend(snapshot.documents.mapNotNull { it.toLocal(familyId) }.reversed())
            }
        awaitClose { subscription.remove() }
    }

    fun observeMembers(familyId: String) = callbackFlow {
        val subscription = family(familyId).collection("members").addSnapshotListener { snapshot, _ ->
            if (snapshot != null) trySend(snapshot.documents.mapNotNull { doc ->
                val name = doc.getString("displayName") ?: return@mapNotNull null
                FamilyMember(name, doc.getString("smsNickname").orEmpty(), doc.getString("role").orEmpty())
            }.sortedBy { it.name.lowercase() })
        }
        awaitClose { subscription.remove() }
    }

    private fun LocalMessageEntity.metadata(): Map<String, Any?> = mapOf(
        "status" to status, "retryCount" to retryCount, "errorCode" to errorCode, "errorReason" to errorReason,
        "queuedOnGatewayAt" to queuedOnGatewayAtMs?.let { Timestamp(Date(it)) },
        "sentAt" to sentAtMs?.let { Timestamp(Date(it)) }, "deliveredAt" to deliveredAtMs?.let { Timestamp(Date(it)) },
        "statusUpdatedAt" to Timestamp(Date(statusUpdatedAtMs)), "gatewayNetworkAtSend" to gatewayNetwork,
    )

    private fun DocumentSnapshot.toLocal(familyId: String): LocalMessageEntity? {
        val text = getString("text") ?: return null
        val createdAt = getTimestamp("createdAt")?.toDate()?.time ?: return null
        return LocalMessageEntity(
            id, familyId, getString("direction") ?: return null, getString("senderUid") ?: return null,
            getString("senderName") ?: return null, text, getString("smsFormattedText") ?: text,
            getString("encoding") ?: return null, getLong("segmentCount")?.toInt() ?: return null,
            status = getString("status") ?: return null, retryCount = getLong("retryCount")?.toInt() ?: 0,
            createdAtMs = createdAt, sentAtMs = getTimestamp("sentAt")?.toDate()?.time,
            deliveredAtMs = getTimestamp("deliveredAt")?.toDate()?.time,
            statusUpdatedAtMs = getTimestamp("statusUpdatedAt")?.toDate()?.time ?: createdAt,
            gatewayNetwork = getString("gatewayNetworkAtSend"), errorCode = getString("errorCode"),
            errorReason = getString("errorReason"), retryOfMessageId = getString("retryOfMessageId"),
        )
    }
}
