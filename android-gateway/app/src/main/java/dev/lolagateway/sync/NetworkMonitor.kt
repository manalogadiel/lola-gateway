package dev.lolagateway.sync

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import dev.lolagateway.data.local.HandoffDao
import dev.lolagateway.data.local.HandoffLogEntity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class NetworkMonitor(private val context: Context, private val logs: HandoffDao, private val scope: CoroutineScope) {
    private val manager = context.getSystemService(ConnectivityManager::class.java)
    private val transportState = MutableStateFlow("NONE")
    val state = transportState.asStateFlow()

    private val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) = changed(transport(capabilities))
        override fun onLost(network: Network) = changed(currentTransport())
    }

    fun start() {
        transportState.value = currentTransport()
        manager.registerDefaultNetworkCallback(callback)
    }

    fun currentTransport(): String = transport(manager.getNetworkCapabilities(manager.activeNetwork))

    private fun transport(capabilities: NetworkCapabilities?): String = when {
        capabilities == null -> "NONE"
        capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "WIFI"
        capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "CELLULAR"
        capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) -> "OTHER"
        else -> "NONE"
    }

    private fun changed(next: String) {
        val previous = transportState.value
        if (previous == next) return
        transportState.value = next
        val timestamp = System.currentTimeMillis()
        scope.launch {
            logs.insert(HandoffLogEntity(oldTransport = previous, newTransport = next, transitionedAtMs = timestamp))
            if (next != "NONE") SyncEngineWorker.enqueue(context)
        }
    }
}
