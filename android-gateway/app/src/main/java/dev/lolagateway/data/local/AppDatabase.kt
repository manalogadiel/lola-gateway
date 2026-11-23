package dev.lolagateway.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(entities = [LocalMessageEntity::class, LocalSmsPartEntity::class, HandoffLogEntity::class], version = 1)
abstract class AppDatabase : RoomDatabase() {
    abstract fun messages(): MessageDao
    abstract fun smsParts(): SmsPartDao
    abstract fun handoffs(): HandoffDao
}
