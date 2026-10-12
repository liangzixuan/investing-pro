package local.investment.personal

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import java.nio.CharBuffer
import java.nio.charset.CodingErrorAction
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

/** Writes bounded caller-provided text only to the destination chosen for that operation. */
@CapacitorPlugin(name = "InvestmentWatchlistExport")
class InvestmentWatchlistExportPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var pending: PendingChoice? = null
    private var selected: SelectedDocument? = null
    private var writeJob: Job? = null
    private var writingOperation: String? = null
    @Volatile private var destroyed = false

    @PluginMethod
    fun choose(call: PluginCall) {
        if (destroyed) return reject(call, "unavailable")
        scope.launch { chooseDocument(call) }
    }

    private fun chooseDocument(call: PluginCall) {
        val operationId = operationId(call)
        val version = version(call)
        if (!exactKeys(call, setOf("operationId", "version")) || operationId == null || version == null) {
            reject(call, "invalid_input")
            return
        }
        if (pending != null || selected != null || writeJob != null) {
            reject(call, "busy")
            return
        }
        pending = PendingChoice(operationId, call)
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "text/plain"
            putExtra(Intent.EXTRA_TITLE, "Investment-watchlist-v$version.txt")
        }
        try {
            startActivityForResult(call, intent, "documentChosen")
        } catch (_: Exception) {
            pending = null
            reject(call, "unavailable")
        }
    }

    @ActivityCallback
    private fun documentChosen(call: PluginCall?, result: ActivityResult) {
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
        selected = SelectedDocument(choice.operationId, handle, uri)
        choice.call.resolve(JSObject().put("status", "chosen").put("handle", handle))
    }

    @PluginMethod
    fun write(call: PluginCall) {
        if (destroyed) return reject(call, "unavailable")
        scope.launch { writeDocument(call) }
    }

    private fun writeDocument(call: PluginCall) {
        val document = selected
        val operationId = operationId(call)
        val handle = call.getString("handle")
        if (document == null || document.operationId != operationId || document.handle != handle) {
            reject(call, "invalid_handle")
            return
        }
        selected = null
        val text = call.getString("text")
        val validKeys = exactKeys(call, setOf("operationId", "handle", "text"))
        call.data.remove("text")
        if (!validKeys || text.isNullOrEmpty() || text.length > MAX_EXPORT_BYTES) {
            reject(call, "invalid_input")
            return
        }
        writingOperation = document.operationId
        val job = scope.launch(start = CoroutineStart.LAZY) {
            try {
                writeText(document.uri, text)
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

    private suspend fun writeText(uri: Uri, text: String) = withContext(Dispatchers.IO) {
        val buffer = Charsets.UTF_8.newEncoder()
            .onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT)
            .encode(CharBuffer.wrap(text))
        require(buffer.remaining() <= MAX_EXPORT_BYTES)
        val bytes = ByteArray(buffer.remaining())
        buffer.get(bytes)
        try {
            ensureActive()
            val stream = context.contentResolver.openOutputStream(uri, "wt")
                ?: throw IllegalStateException()
            stream.use {
                it.write(bytes)
                it.flush()
            }
        } finally {
            bytes.fill(0)
        }
    }

    @PluginMethod
    fun cancel(call: PluginCall) {
        if (destroyed) return call.resolve()
        scope.launch {
            val operationId = operationId(call)
            if (!exactKeys(call, setOf("operationId")) || operationId == null) {
                reject(call, "invalid_input")
                return@launch
            }
            cancelOperation(operationId)
            call.resolve()
        }
    }

    private fun cancelOperation(operationId: String) {
        pending?.takeIf { it.operationId == operationId && !it.cancelled }?.let {
            // Keep the chooser reserved until its actual callback returns.
            it.cancelled = true
            it.call.resolve(JSObject().put("status", "cancelled"))
        }
        if (selected?.operationId == operationId) selected = null
        if (writingOperation == operationId) writeJob?.cancel()
    }

    // Neither metadata nor text is restored as a pending export after recreation.
    override fun saveInstanceState(): Bundle? = null

    override fun handleOnDestroy() {
        destroyed = true
        pending = null
        selected = null
        writingOperation = null
        scope.cancel()
        writeJob = null
        super.handleOnDestroy()
    }

    private fun operationId(call: PluginCall): String? =
        call.getString("operationId")?.takeIf { OPERATION_ID.matches(it) }

    private fun version(call: PluginCall): Long? {
        val value = call.data.opt("version") as? Number ?: return null
        val number = value.toDouble()
        if (!number.isFinite() || number < 0 || number > MAX_SAFE_INTEGER || number != number.toLong().toDouble()) return null
        return number.toLong()
    }

    private fun exactKeys(call: PluginCall, keys: Set<String>): Boolean =
        call.data.keys().asSequence().toSet() == keys

    private fun reject(call: PluginCall, code: String) {
        call.reject("Watchlist export unavailable", code)
    }

    private data class PendingChoice(val operationId: String, val call: PluginCall, var cancelled: Boolean = false)
    private data class SelectedDocument(val operationId: String, val handle: String, val uri: Uri)

    companion object {
        // Same structural output bound as MANAGED_WATCHLIST_EXPORT_MAX_BYTES.
        const val MAX_EXPORT_BYTES = 524800
        private const val MAX_SAFE_INTEGER = 9007199254740991.0
        private val OPERATION_ID = Regex("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
    }
}
