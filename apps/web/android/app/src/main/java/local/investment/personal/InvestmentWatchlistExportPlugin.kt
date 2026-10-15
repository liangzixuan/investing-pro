package local.investment.personal

import android.os.Bundle
import androidx.activity.result.ActivityResult
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin

/** Writes the existing bounded saved-watchlist export to its explicit destination. */
@CapacitorPlugin(name = "InvestmentWatchlistExport")
class InvestmentWatchlistExportPlugin : Plugin() {
    private val writer = ChosenDocumentWriter(this, WatchlistDocumentPolicy) { call, intent ->
        startActivityForResult(call, intent, "documentChosen")
    }

    @PluginMethod
    fun choose(call: PluginCall) = writer.choose(call)

    @ActivityCallback
    private fun documentChosen(call: PluginCall?, result: ActivityResult) = writer.documentChosen(call, result)

    @PluginMethod
    fun write(call: PluginCall) = writer.write(call)

    @PluginMethod
    fun cancel(call: PluginCall) = writer.cancel(call)

    // Neither metadata nor text is restored as a pending export after recreation.
    override fun saveInstanceState(): Bundle? = null

    override fun handleOnDestroy() {
        writer.destroy()
        super.handleOnDestroy()
    }

    companion object {
        const val MAX_EXPORT_BYTES = WatchlistDocumentPolicy.MAX_BYTES
    }
}
