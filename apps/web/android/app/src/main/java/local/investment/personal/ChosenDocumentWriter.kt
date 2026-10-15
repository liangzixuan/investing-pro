package local.investment.personal

import android.app.Activity
import android.content.Intent
import android.net.Uri
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import java.util.UUID
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** One transient operation owns one chosen destination and at most one write. */
internal class ChosenDocumentWriter(
    private val plugin: Plugin,
    private val policy: ChosenDocumentPolicy,
    private val launchChooser: (PluginCall, Intent) -> Unit,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var pending: PendingChoice? = null
    private var selected: SelectedDocument? = null
    private var writeJob: Job? = null
    private var writingOperation: String? = null
    @Volatile private var destroyed = false

    fun choose(call: PluginCall) {
        if (destroyed) return reject(call, "unavailable")
        scope.launch {
            val operationId = operationId(call)
            val filename = policy.filename(call.data)
            if (operationId == null || filename == null) {
                reject(call, "invalid_input")
                return@launch
            }
            if (pending != null || selected != null || writeJob != null) {
                reject(call, "busy")
                return@launch
            }
            pending = PendingChoice(operationId, filename, call)
            val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = policy.mimeType
                putExtra(Intent.EXTRA_TITLE, filename)
            }
            try {
                launchChooser(call, intent)
            } catch (_: Exception) {
                pending = null
                reject(call, "unavailable")
            }
        }
    }

    fun documentChosen(call: PluginCall?, result: ActivityResult) {
        val choice = pending ?: return
        pending = null
        if (destroyed || choice.cancelled) return
        if (call?.callbackId != choice.call.callbackId) {
            reject(choice.call, "unavailable")
            return
        }
        if (result.resultCode != Activity.RESULT_OK) {
            choice.call.resolve(JSObject().put("status", "cancelled"))
            return
        }
        val uri = result.data?.data
        if (uri?.scheme != "content" || result.data?.clipData != null) {
            reject(choice.call, "unavailable")
            return
        }
        val handle = UUID.randomUUID().toString()
        selected = SelectedDocument(choice.operationId, handle, uri, choice.filename)
        choice.call.resolve(JSObject().put("status", "chosen").put("handle", handle))
    }

    fun write(call: PluginCall) {
        if (destroyed) return reject(call, "unavailable")
        scope.launch {
            val document = selected
            val operationId = operationId(call)
            val handle = call.getString("handle")
            if (document == null || document.operationId != operationId || document.handle != handle) {
                reject(call, "invalid_handle")
                return@launch
            }
            selected = null
            val text = call.getString("text")
            val validKeys = exactDocumentKeys(call.data, setOf("operationId", "handle", "text"))
            call.data.remove("text")
            if (!validKeys || text.isNullOrEmpty() || text.length > policy.maxBytes) {
                reject(call, "invalid_input")
                return@launch
            }
            writingOperation = document.operationId
            val job = scope.launch(start = CoroutineStart.LAZY) {
                try {
                    writeText(document, text)
                    if (!destroyed) call.resolve(JSObject().put("status", "written"))
                } catch (_: CancellationException) {
                    if (!destroyed) reject(call, "cancelled")
                } catch (_: Exception) {
                    if (!destroyed) reject(call, "write_failed")
                } finally {
                    writingOperation = null
                    writeJob = null
                }
            }
            writeJob = job
            job.start()
        }
    }

    private suspend fun writeText(document: SelectedDocument, text: String) = withContext(Dispatchers.IO) {
        val bytes = strictDocumentBytes(text, policy.maxBytes)
        try {
            require(policy.acceptsText(document.filename, text))
            ensureActive()
            val stream = plugin.context.contentResolver.openOutputStream(document.uri, "wt")
                ?: throw IllegalStateException()
            stream.use {
                // A provider can finish opening after this operation was cancelled.
                ensureActive()
                it.write(bytes)
                ensureActive()
                it.flush()
            }
        } finally {
            bytes.fill(0)
        }
    }

    fun cancel(call: PluginCall) {
        if (destroyed) return call.resolve()
        scope.launch {
            val operationId = operationId(call)
            if (!exactDocumentKeys(call.data, setOf("operationId")) || operationId == null) {
                reject(call, "invalid_input")
                return@launch
            }
            pending?.takeIf { it.operationId == operationId && !it.cancelled }?.let {
                // Keep the chooser reserved until its actual callback returns.
                it.cancelled = true
                it.call.resolve(JSObject().put("status", "cancelled"))
            }
            if (selected?.operationId == operationId) selected = null
            if (writingOperation == operationId) writeJob?.cancel()
            call.resolve()
        }
    }

    fun destroy() {
        destroyed = true
        pending = null
        selected = null
        writingOperation = null
        scope.cancel()
        writeJob = null
    }

    private fun operationId(call: PluginCall): String? =
        call.getString("operationId")?.takeIf { OPERATION_ID.matches(it) }

    private fun reject(call: PluginCall, code: String) {
        call.reject(policy.failureMessage, code)
    }

    private data class PendingChoice(val operationId: String, val filename: String, val call: PluginCall, var cancelled: Boolean = false)
    private data class SelectedDocument(val operationId: String, val handle: String, val uri: Uri, val filename: String)

    companion object {
        private val OPERATION_ID = Regex("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
    }
}
