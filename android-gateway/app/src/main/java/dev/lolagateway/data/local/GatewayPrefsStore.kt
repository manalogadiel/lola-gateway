package dev.lolagateway.data.local

import android.content.Context
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.gatewayDataStore by preferencesDataStore("gateway")

data class GatewayProfile(
    val familyId: String,
    val familyName: String,
    val joinCode: String,
    val seniorName: String,
    val seniorPhoneE164: String,
    val allowListE164: Set<String>,
    val uid: String,
    val displayName: String,
    val smsNickname: String = "",
)

data class GatewayPrefs(
    val profile: GatewayProfile? = null,
    val paused: Boolean = false,
    val selectedSubId: Int? = null,
    val blockedUnknownCount: Int = 0,
    val themeMode: String = "SYSTEM",
)

class GatewayPrefsStore(context: Context) {
    private val store = context.gatewayDataStore
    private val family = stringPreferencesKey("familyId")
    private val familyName = stringPreferencesKey("familyName")
    private val code = stringPreferencesKey("joinCode")
    private val senior = stringPreferencesKey("seniorName")
    private val phone = stringPreferencesKey("seniorPhoneE164")
    private val allowList = stringSetPreferencesKey("allowListE164")
    private val uid = stringPreferencesKey("uid")
    private val name = stringPreferencesKey("displayName")
    private val nickname = stringPreferencesKey("smsNickname")
    private val paused = booleanPreferencesKey("paused")
    private val sim = intPreferencesKey("selectedSubId")
    private val blocked = intPreferencesKey("blockedUnknownCount")
    private val theme = stringPreferencesKey("themeMode")

    val state = store.data.map { data ->
        val profile = data[family]?.let { id -> GatewayProfile(
            id, data[familyName].orEmpty(), data[code].orEmpty(), data[senior].orEmpty(),
            data[phone].orEmpty(), data[allowList].orEmpty(), data[uid].orEmpty(), data[name].orEmpty(), data[nickname].orEmpty(),
        ) }
        GatewayPrefs(profile, data[paused] ?: false, data[sim], data[blocked] ?: 0, data[theme] ?: "SYSTEM")
    }

    suspend fun current() = state.first()

    suspend fun saveProfile(profile: GatewayProfile) { store.edit {
        if (it[family] != profile.familyId) {
            it.remove(paused)
            it.remove(blocked)
        }
        it[family] = profile.familyId
        it[familyName] = profile.familyName
        it[code] = profile.joinCode
        it[senior] = profile.seniorName
        it[phone] = profile.seniorPhoneE164
        it[allowList] = profile.allowListE164
        it[uid] = profile.uid
        it[name] = profile.displayName
        it[nickname] = profile.smsNickname
    } }

    suspend fun setPaused(value: Boolean) { store.edit { it[paused] = value } }
    suspend fun selectSim(value: Int?) { store.edit { if (value == null) it.remove(sim) else it[sim] = value } }
    suspend fun countBlocked() { store.edit { it[blocked] = (it[blocked] ?: 0) + 1 } }
    suspend fun setTheme(value: String) { store.edit { it[theme] = value } }
}
