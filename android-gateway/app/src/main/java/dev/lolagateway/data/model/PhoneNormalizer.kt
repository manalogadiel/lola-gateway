package dev.lolagateway.data.model

object PhoneNormalizer {
    private val separators = Regex("[\\s().-]")
    private val mobile = Regex("(?:\\+?63|0)?(9[0-9]{9})")

    fun toPhE164(raw: String): String? = mobile.matchEntire(raw.replace(separators, ""))
        ?.groupValues?.get(1)?.let { "+63$it" }

    fun isAllowListed(raw: String, allowListE164: Set<String>): Boolean =
        toPhE164(raw)?.let(allowListE164::contains) ?: false
}
