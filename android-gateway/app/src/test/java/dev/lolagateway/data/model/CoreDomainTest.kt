package dev.lolagateway.data.model

import org.junit.Assert.*
import org.junit.Test

class CoreDomainTest {
    @Test fun normalizesPhilippineMobileFormats() {
        listOf("0917-123-4567", "9171234567", "639171234567", "+63 917 123 4567").forEach {
            assertEquals("+639171234567", PhoneNormalizer.toPhE164(it))
        }
        listOf("12345", "abc", "+1 917 123 4567").forEach { assertNull(PhoneNormalizer.toPhE164(it)) }
    }

    @Test fun countsPrefixExtendedGsmAndUnicodeWithoutSplittingEmoji() {
        assertEquals(1, SmsSegmentCalculator.formatAndSegment("Gadiel", "a".repeat(152)).segmentCount)
        assertEquals(2, SmsSegmentCalculator.formatAndSegment("Gadiel", "a".repeat(153)).segmentCount)
        assertEquals(2, SmsSegmentCalculator.segment("^".repeat(81)).segmentCount)
        val unicode = "a".repeat(66) + "😀more"
        val result = SmsSegmentCalculator.segment(unicode)
        assertEquals(SmsEncoding.UCS_2, result.encoding)
        assertEquals("😀more", result.parts[1])
        assertEquals(unicode, result.parts.joinToString(""))
    }

    @Test fun inboundIdIsStableAndDistinguishesMessages() {
        val first = InboundIdGenerator.generate("+639171234567", 1700000000000L, "Kumain na ako")
        assertTrue(first.matches(Regex("in_[0-9a-f]{64}")))
        assertEquals(first, InboundIdGenerator.generate("+639171234567", 1700000000000L, "Kumain na ako"))
        assertNotEquals(first, InboundIdGenerator.generate("+639171234567", 1700000000001L, "Kumain na ako"))
    }

    @Test fun neverReturnsSentMessagesToTheQueue() {
        assertFalse(MessageStatus.SENT.canTransitionTo(MessageStatus.QUEUED))
        assertTrue(MessageStatus.SENT.canTransitionTo(MessageStatus.PENDING))
        assertTrue(MessageStatus.PENDING.canTransitionTo(MessageStatus.DELIVERED))
        assertTrue(MessageStatus.QUEUED.canTransitionTo(MessageStatus.FAILED))
    }
}
