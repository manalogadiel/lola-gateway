package dev.lolagateway.diagnostics

import dev.lolagateway.data.local.outbound
import org.junit.Assert.*
import org.junit.Test

class CsvLogExporterTest {
    @Test fun emitsQaColumnsAndEscapesText() {
        val csv = CsvLogExporter.formatMessagesCsv(listOf(outbound("msg,\"1\"").copy(errorCode = "NO_SERVICE")))
        assertEquals("messageId,direction,encoding,segments,network,createdAtMs,sentAtMs,deliveredAtMs,status,retryCount,errorCode", csv.lineSequence().first())
        assertTrue(csv.contains("\"msg,\"\"1\"\"\",OUTBOUND,GSM-7,1,,1,,,QUEUED,0,NO_SERVICE"))
        assertFalse(csv.contains("Kumusta"))
    }
}
