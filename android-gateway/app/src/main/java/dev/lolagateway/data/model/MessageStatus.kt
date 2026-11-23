package dev.lolagateway.data.model

enum class MessageStatus { QUEUED, SENT, PENDING, DELIVERED, FAILED }

fun MessageStatus.canTransitionTo(next: MessageStatus): Boolean = this == next || when (this) {
    MessageStatus.QUEUED -> next in setOf(MessageStatus.SENT, MessageStatus.FAILED)
    MessageStatus.SENT -> next in setOf(MessageStatus.PENDING, MessageStatus.DELIVERED)
    MessageStatus.PENDING -> next == MessageStatus.DELIVERED
    MessageStatus.DELIVERED, MessageStatus.FAILED -> false
}
