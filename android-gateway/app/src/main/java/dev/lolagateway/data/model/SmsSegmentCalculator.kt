package dev.lolagateway.data.model

enum class SmsEncoding(val wireName: String) { GSM_7("GSM-7"), UCS_2("UCS-2") }

data class SmsSegmentation(val encoding: SmsEncoding, val parts: List<String>, val formattedText: String) {
    val segmentCount: Int get() = parts.size
}

object SmsSegmentCalculator {
    private const val gsmBasic = "@£\$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
    private const val gsmExtended = "\u000c^{}\\[~]|€"

    fun formatAndSegment(senderName: String, body: String): SmsSegmentation =
        segment(if (body.isEmpty() || senderName.isBlank()) body else "${senderName.trim()}: $body")

    fun segment(text: String): SmsSegmentation {
        if (text.isEmpty()) return SmsSegmentation(SmsEncoding.GSM_7, emptyList(), text)
        val gsm = text.all { it in gsmBasic || it in gsmExtended }
        val encoding = if (gsm) SmsEncoding.GSM_7 else SmsEncoding.UCS_2
        val units = if (gsm) text.sumOf { char -> if (char in gsmExtended) 2L else 1L } else text.length.toLong()
        val singleLimit = if (gsm) 160 else 70
        if (units <= singleLimit) return SmsSegmentation(encoding, listOf(text), text)

        val limit = if (gsm) 153 else 67
        val parts = mutableListOf<String>()
        var start = 0
        var index = 0
        var used = 0
        while (index < text.length) {
            val width = Character.charCount(text.codePointAt(index))
            val cost = if (gsm && text[index] in gsmExtended) 2 else width
            if (used + cost > limit) {
                parts.add(text.substring(start, index))
                start = index
                used = 0
            }
            used += cost
            index += width
        }
        parts.add(text.substring(start))
        return SmsSegmentation(encoding, parts, text)
    }
}
