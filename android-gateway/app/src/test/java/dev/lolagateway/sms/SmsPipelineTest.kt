package dev.lolagateway.sms

import android.app.Activity
import android.app.Application
import android.telephony.SmsManager
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import dev.lolagateway.data.local.*
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
class SmsPipelineTest {
    private lateinit var database: AppDatabase
    private lateinit var prefs: GatewayPrefsStore
    private val now = 100_000L

    @Before fun open() {
        val context = ApplicationProvider.getApplicationContext<Application>()
        database = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).build()
        prefs = GatewayPrefsStore(context)
    }

    @After fun close() { database.close() }

    @Test fun multipartWaitsForBothSendResultsAndDeliveryReports() = runBlocking {
        arm(parts = 2)
        val handler = SmsStatusHandler(database) { now }
        assertNull(handler.onPartSent("outbound", 0, 0, Activity.RESULT_OK))
        assertEquals("QUEUED", database.messages().find("outbound")?.status)
        assertEquals("SENT", handler.onPartSent("outbound", 0, 1, Activity.RESULT_OK)?.status)
        assertEquals("PENDING", handler.markPending("outbound")?.status)
        assertNull(handler.onPartDelivered("outbound", 0, 0, 0))
        assertEquals("DELIVERED", handler.onPartDelivered("outbound", 0, 1, 0)?.status)
        assertNull(handler.markPending("outbound"))
    }

    @Test fun transientFailuresBackOffAndStopAfterFourthAttempt() = runBlocking {
        arm()
        val handler = SmsStatusHandler(database) { now }
        listOf(10_000L, 20_000L, 40_000L).forEachIndexed { attempt, backoff ->
            val retry = handler.onPartSent("outbound", attempt, 0, SmsManager.RESULT_ERROR_NO_SERVICE)
            assertEquals("READY", retry?.localDispatchState)
            assertEquals(now + backoff, retry?.nextRetryAtMs)
            database.smsParts().insert(listOf(LocalSmsPartEntity("outbound", attempt + 1, 0)))
        }
        val failure = handler.onPartSent("outbound", 3, 0, SmsManager.RESULT_ERROR_NO_SERVICE)
        assertEquals("FAILED", failure?.status)
        assertEquals(4, failure?.retryCount)
    }

    @Test fun partialSendIsNotAutomaticallyRetried() = runBlocking {
        arm(parts = 2)
        val handler = SmsStatusHandler(database) { now }
        handler.onPartSent("outbound", 0, 0, Activity.RESULT_OK)
        val failure = handler.onPartSent("outbound", 0, 1, SmsManager.RESULT_ERROR_RADIO_OFF)
        assertEquals("FAILED", failure?.status)
        assertEquals("FINISHED", failure?.localDispatchState)
    }

    @Test fun invalidDestinationNeverReachesTheSmsTransport() = runBlocking {
        val message = outbound()
        database.messages().insert(message)
        SmsSender(database) { _, _, _, _, _ -> fail("Transport was called for an invalid number") }
            .dispatch(message, "12345", null, null)
        assertEquals("INVALID_NUMBER", database.messages().find(message.messageId)?.errorCode)
    }

    @Test fun deduplicatesInboundAndDiscardsUnlistedContent() = runBlocking {
        val allowed = "+639171234567"
        prefs.saveProfile(GatewayProfile("family", "Family", "CODE", "Lola", allowed, setOf(allowed), "host", "Gadiel"))
        val before = prefs.current().blockedUnknownCount
        val handler = SmsInboundHandler(database, prefs)
        val incoming = mapOf(allowed to (now to "Kumain na ako"), "+639189999999" to (now to "Discard me"))
        assertTrue(handler.onIncomingPdus(incoming, "host"))
        assertFalse(handler.onIncomingPdus(incoming.filterKeys { it == allowed }, "host"))
        val messages = database.messages().all("family")
        assertEquals(1, messages.size)
        assertEquals("Kumain na ako", messages.single().text)
        assertEquals(before + 1, prefs.current().blockedUnknownCount)
    }

    private suspend fun arm(parts: Int = 1) {
        database.messages().insert(outbound(parts = parts).copy(localDispatchState = "DISPATCHING"))
        database.smsParts().insert((0 until parts).map { LocalSmsPartEntity("outbound", 0, it) })
    }
}
