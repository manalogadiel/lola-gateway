package dev.lolagateway.diagnostics

import dev.lolagateway.data.local.HandoffLogEntity
import dev.lolagateway.data.local.LocalMessageEntity

object CsvLogExporter {
    fun formatMessagesCsv(rows: List<LocalMessageEntity>): String = buildString {
        appendLine("messageId,direction,encoding,segments,network,createdAtMs,sentAtMs,deliveredAtMs,status,retryCount,errorCode")
        rows.forEach { row -> appendLine(listOf(row.messageId, row.direction, row.encoding, row.segmentCount, row.gatewayNetwork,
            row.createdAtMs, row.sentAtMs, row.deliveredAtMs, row.status, row.retryCount, row.errorCode).joinToString(",", transform = ::cell)) }
    }

    fun formatHandoffsCsv(rows: List<HandoffLogEntity>): String = buildString {
        appendLine("oldTransport,newTransport,transitionedAtMs,recoveredAtMs")
        rows.forEach { row -> appendLine(listOf(row.oldTransport, row.newTransport, row.transitionedAtMs, row.recoveredAtMs)
            .joinToString(",", transform = ::cell)) }
    }

    private fun cell(value: Any?): String {
        val raw = value?.toString().orEmpty()
        val text = if (value is String && raw.trimStart().firstOrNull() in listOf('=', '+', '-', '@')) "'$raw" else raw
        return if (text.any { it == ',' || it == '"' || it == '\r' || it == '\n' }) {
            "\"${text.replace("\"", "\"\"")}\""
        } else text
    }
}
