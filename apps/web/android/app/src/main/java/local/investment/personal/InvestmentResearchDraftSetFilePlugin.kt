package local.investment.personal

import android.os.Bundle
import androidx.activity.result.ActivityResult
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin

/** Writes one complete selected research draft set without restoring or saving valuation inputs online. */
@CapacitorPlugin(name = "InvestmentResearchDraftSetFile")
class InvestmentResearchDraftSetFilePlugin : Plugin() {
    private val writer = ChosenDocumentWriter(this, ResearchDraftSetFilePolicy) { call, intent ->
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

    override fun saveInstanceState(): Bundle? = null

    override fun handleOnDestroy() {
        writer.destroy()
        super.handleOnDestroy()
    }
}
