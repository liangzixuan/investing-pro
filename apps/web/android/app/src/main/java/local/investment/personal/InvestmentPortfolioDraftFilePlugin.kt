package local.investment.personal

import android.os.Bundle
import androidx.activity.result.ActivityResult
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin

/** Explicitly writes one unconfirmed draft file; it does not restore or save a Portfolio. */
@CapacitorPlugin(name = "InvestmentPortfolioDraftFile")
class InvestmentPortfolioDraftFilePlugin : Plugin() {
    private val writer = ChosenDocumentWriter(this, PortfolioDraftFilePolicy) { call, intent ->
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
