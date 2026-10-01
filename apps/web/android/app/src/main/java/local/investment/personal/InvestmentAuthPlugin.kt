package local.investment.personal

import com.clerk.api.Clerk
import com.clerk.api.ClerkConfigurationOptions
import com.clerk.api.hostedauth.HostedAuthCancellationException
import com.clerk.api.network.serialization.ClerkResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.util.concurrent.atomic.AtomicLong
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import org.json.JSONObject

/** Keeps Clerk's persistent credential inside its Android SDK. */
@CapacitorPlugin(name = "InvestmentAuth")
class InvestmentAuthPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var destroyed = false
    private var initializationFailed = false
    private var signedOutLocally = false
    private var revocationUnconfirmed = false
    private var mutation: Job? = null
    private var signingOut = false
    private var state = AuthState("loading", null, null, nextGeneration())

    override fun load() {
        scope.launch {
            if (!BuildConfig.CLERK_AUTH_ENABLED) {
                initializationFailed = true
                publishState()
                return@launch
            }
            try {
                Clerk.initialize(
                    activity,
                    BuildConfig.CLERK_PUBLISHABLE_KEY,
                    ClerkConfigurationOptions(enableDebugMode = false, telemetryEnabled = false),
                )
                combine(
                    Clerk.isInitialized,
                    Clerk.initializationError,
                    Clerk.sessionFlow,
                    Clerk.userFlow,
                ) { _, _, _, _ -> Unit }.collect { publishState() }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                initializationFailed = true
                publishState()
            }
        }
    }

    @PluginMethod
    fun getState(call: PluginCall) {
        scope.launch { call.resolve(publishState().toJson()) }
    }

    @PluginMethod
    fun signIn(call: PluginCall) {
        scope.launch {
            if (!ready(call)) return@launch
            if (mutation?.isActive == true) {
                reject(call, "busy")
                return@launch
            }
            if (publishState().status == "signedIn") {
                call.resolve(state.toJson())
                return@launch
            }
            mutation = scope.launch {
                try {
                    when (val result = Clerk.auth.startHostedAuth()) {
                        is ClerkResult.Success -> {
                            signedOutLocally = false
                            revocationUnconfirmed = false
                            val current = publishState()
                            if (current.status == "signedIn") call.resolve(current.toJson())
                            else reject(call, "authentication_incomplete")
                        }
                        is ClerkResult.Failure -> reject(
                            call,
                            if (result.throwable is HostedAuthCancellationException) "cancelled"
                            else "authentication_unavailable",
                        )
                    }
                } catch (cancelled: CancellationException) {
                    reject(call, "cancelled")
                    throw cancelled
                } catch (_: Exception) {
                    reject(call, "authentication_unavailable")
                }
            }
        }
    }

    @PluginMethod
    fun getToken(call: PluginCall) {
        scope.launch {
            if (!ready(call)) return@launch
            val before = publishState()
            if (before.status != "signedIn") {
                reject(call, "signed_out")
                return@launch
            }
            try {
                val result = Clerk.auth.getToken()
                val after = publishState()
                if (before != after || after.status != "signedIn") {
                    reject(call, "retired_session")
                    return@launch
                }
                when (result) {
                    is ClerkResult.Success -> call.resolve(JSObject().apply {
                        put("token", result.value)
                        put("sessionId", after.sessionId)
                        put("generation", after.generation)
                    })
                    is ClerkResult.Failure -> reject(call, "authentication_unavailable")
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                reject(call, "authentication_unavailable")
            }
        }
    }

    @PluginMethod
    fun signOut(call: PluginCall) {
        scope.launch {
            if (!ready(call)) return@launch
            if (signingOut && mutation?.isActive == true) {
                reject(call, "busy")
                return@launch
            }
            mutation?.cancel()
            signedOutLocally = true
            signingOut = true
            publishState()
            mutation = scope.launch {
                try {
                    val confirmed = try {
                        Clerk.auth.signOut() is ClerkResult.Success
                    } catch (cancelled: CancellationException) {
                        throw cancelled
                    } catch (_: Exception) {
                        false
                    }
                    // A failed SDK sign-out discards the original client credential. A later
                    // empty-client request cannot confirm revocation of that original session.
                    revocationUnconfirmed = revocationUnconfirmed || !confirmed
                    if (!destroyed) call.resolve(publishState().toJson().apply {
                        put("serverRevocationConfirmed", confirmed && !revocationUnconfirmed)
                    })
                } finally {
                    signingOut = false
                }
            }
        }
    }

    private fun ready(call: PluginCall): Boolean {
        val current = publishState()
        if (!BuildConfig.CLERK_AUTH_ENABLED || current.status == "error") {
            reject(call, "authentication_unavailable")
            return false
        }
        if (!Clerk.isInitialized.value) {
            reject(call, "not_ready")
            return false
        }
        return true
    }

    private fun publishState(): AuthState {
        val active = if (BuildConfig.CLERK_AUTH_ENABLED) Clerk.activeSession else null
        val userId = active?.user?.id
        val status = when {
            initializationFailed -> "error"
            signedOutLocally -> "signedOut"
            !Clerk.isInitialized.value -> if (Clerk.initializationError.value != null) "error" else "loading"
            active != null && userId != null && Clerk.user?.id == userId -> "signedIn"
            else -> "signedOut"
        }
        val next = AuthState(
            status,
            userId.takeIf { status == "signedIn" },
            active?.id.takeIf { status == "signedIn" },
            state.generation,
        )
        if (next != state) {
            state = next.copy(generation = nextGeneration())
            if (!destroyed) notifyListeners("stateChanged", state.toJson())
        }
        return state
    }

    private fun reject(call: PluginCall, code: String) {
        if (!destroyed) call.reject("Authentication could not complete.", code)
    }

    override fun handleOnDestroy() {
        destroyed = true
        scope.cancel()
        super.handleOnDestroy()
    }

    private data class AuthState(
        val status: String,
        val userId: String?,
        val sessionId: String?,
        val generation: Long,
    ) {
        fun toJson() = JSObject().apply {
            put("status", status)
            put("userId", userId ?: JSONObject.NULL)
            put("sessionId", sessionId ?: JSONObject.NULL)
            put("generation", generation)
        }
    }

    companion object {
        private val generations = AtomicLong(0)
        private fun nextGeneration(): Long = generations.incrementAndGet()
    }
}
