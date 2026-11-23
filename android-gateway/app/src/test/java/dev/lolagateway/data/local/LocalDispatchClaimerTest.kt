package dev.lolagateway.data.local

import android.app.Application
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
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
class LocalDispatchClaimerTest {
    private lateinit var database: AppDatabase

    @Before fun open() {
        database = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), AppDatabase::class.java).build()
    }

    @After fun close() { database.close() }

    @Test fun deduplicatesAndClaimsExactlyOnce() = runBlocking {
        val messages = database.messages()
        val message = outbound()
        assertNotEquals(-1L, messages.insert(message))
        assertEquals(-1L, messages.insert(message))
        val first = LocalDispatchClaimer(database)
        val second = LocalDispatchClaimer(database)
        val claims = listOf(async { first.claimNextReady("family", 10, false) }, async { second.claimNextReady("family", 10, false) }).awaitAll()
        assertEquals(1, claims.filterNotNull().size)
        assertEquals("DISPATCHING", messages.find(message.messageId)?.localDispatchState)
    }

    @Test fun leavesPausedAndDeferredMessagesQueued() = runBlocking {
        database.messages().insert(outbound().copy(nextRetryAtMs = 100))
        val claimer = LocalDispatchClaimer(database)
        assertNull(claimer.claimNextReady("family", 100, true))
        assertNull(claimer.claimNextReady("family", 99, false))
        assertEquals("QUEUED", database.messages().find("outbound")?.status)
        assertNotNull(claimer.claimNextReady("family", 100, false))
    }
}

internal fun outbound(id: String = "outbound", parts: Int = 1) = LocalMessageEntity(
    id, "family", "OUTBOUND", "host", "Gadiel", "Kumusta", "Gadiel: Kumusta", "GSM-7", parts, createdAtMs = 1,
)
