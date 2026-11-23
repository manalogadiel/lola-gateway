package dev.lolagateway.sync

import android.app.Application
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import dev.lolagateway.data.local.*
import dev.lolagateway.data.remote.GatewayCloudClient
import dev.lolagateway.sms.SmsSender
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(application = Application::class, sdk = [34])
class SyncEngineTest {
    private lateinit var database: AppDatabase
    private lateinit var prefs: GatewayPrefsStore

    @Before fun open() {
        val context = ApplicationProvider.getApplicationContext<Application>()
        database = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).build()
        prefs = GatewayPrefsStore(context)
    }

    @After fun close() { database.close() }

    @Test fun pausedMessagesDrainOnHandoffWithoutResendingDuplicateCloudRows() = runBlocking {
        val number = "+639171234567"
        prefs.saveProfile(GatewayProfile("family", "Family", "CODE", "Lola", number, setOf(number), "host", "Gadiel"))
        prefs.setPaused(true)
        val inbound = outbound("in_reply").copy(direction = "INBOUND", senderUid = "senior", status = "DELIVERED",
            syncDirty = true, createInCloud = true, localDispatchState = "FINISHED")
        database.messages().insert(inbound)
        val dispatched = mutableListOf<String>()
        val uploads = mutableListOf<String>()
        val cloud = object : GatewayCloudClient {
            override suspend fun fetchQueuedOutbound(familyId: String) = listOf(outbound())
            override suspend fun publishMessage(message: LocalMessageEntity) { uploads += message.messageId }
            override suspend fun publishHeartbeat(familyId: String, heartbeat: Map<String, Any?>) = Unit
        }
        val sender = SmsSender(database) { _, _, id, _, _ -> dispatched += id }
        val engine = SyncEngine(database, prefs, { cloud }, sender, { "host" }, { "CELLULAR" }, { _, _ -> emptyMap() }, { true })
        val handoff = HandoffLogEntity(oldTransport = "WIFI", newTransport = "CELLULAR", transitionedAtMs = 1)
        database.handoffs().insert(handoff)

        assertTrue(engine.runCatchUpAndDrain())
        assertTrue(dispatched.isEmpty())
        assertTrue(uploads.isEmpty())
        assertNull(database.handoffs().all().single().recoveredAtMs)

        prefs.setPaused(false)
        assertTrue(engine.runCatchUpAndDrain())
        assertTrue(engine.runCatchUpAndDrain())
        assertEquals(listOf("outbound"), dispatched)
        assertEquals(listOf("in_reply", "outbound"), uploads)
        assertFalse(requireNotNull(database.messages().find("in_reply")).syncDirty)
        assertNotNull(database.handoffs().all().single().recoveredAtMs)
    }
}
