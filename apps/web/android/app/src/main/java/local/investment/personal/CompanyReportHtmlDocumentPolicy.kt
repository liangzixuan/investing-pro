package local.investment.personal

import android.util.Base64
import java.security.MessageDigest
import org.json.JSONObject

/** Admits the fixed application export envelope; the shared branded formatter owns passive content. */
internal object CompanyReportHtmlDocumentPolicy : ChosenDocumentPolicy {
    const val PURPOSE = "investment.company-research-html"
    const val MAX_BYTES = 8388608
    private const val STYLE_HASH = "0prZMY8NvuxrM52UL/gsirqQ7bU+/xP67p90kVL2EMQ="
    private const val CSP = "default-src 'none'; script-src 'none'; connect-src 'none'; img-src 'none'; font-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; style-src 'sha256-$STYLE_HASH'"
    private const val BODY_OPEN = "</style></head><body><main>"
    private const val SUFFIX = "</main></body></html>\n"
    private val FILENAME = Regex("Investment-research-([A-Z0-9][A-Z0-9.-]{0,14})-([A-Z0-9]{4})-([0-9]{4})([0-9]{2})([0-9]{2})T([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{3})Z\\.html")

    override val mimeType = "text/html"
    override val maxBytes = MAX_BYTES
    override val failureMessage = "Report save unavailable"

    override fun filename(options: JSONObject): String? {
        if (!exactDocumentKeys(options, setOf("operationId", "purpose", "filename"))) return null
        if (options.opt("purpose") != PURPOSE) return null
        val name = options.opt("filename") as? String ?: return null
        if (!name.endsWith(".html")) return null
        val jsonOptions = JSONObject()
            .put("operationId", options.opt("operationId"))
            .put("purpose", CompanyReportDocumentPolicy.PURPOSE)
            .put("filename", name.removeSuffix(".html") + ".json")
        return name.takeIf { CompanyReportDocumentPolicy.filename(jsonOptions) != null }
    }

    override fun acceptsText(filename: String, text: String): Boolean = try {
        require(text.isNotEmpty() && text.length <= MAX_BYTES)
        val match = requireNotNull(FILENAME.matchEntire(filename))
        val (symbol, mic, year, month, day, hour, minute, second, millis) = match.destructured
        // Reuse JSON's complete calendar/filename admission without a second date parser.
        val identity = JSONObject()
            .put("purpose", CompanyReportDocumentPolicy.PURPOSE)
            .put("schemaVersion", "6.0.0")
            .put("preparedAt", "$year-$month-" + day + "T$hour:$minute:$second." + millis + "Z")
            .put("listing", JSONObject().put("symbol", symbol).put("exchangeMic", mic))
        require(CompanyReportDocumentPolicy.acceptsText(filename.removeSuffix(".html") + ".json", identity.toString()))
        val prefix = "<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\">" +
            "<meta http-equiv=\"Content-Security-Policy\" content=\"$CSP\">" +
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
            "<meta name=\"investment-report-format\" content=\"1\">" +
            "<meta name=\"investment-report-purpose\" content=\"$PURPOSE\">" +
            "<meta name=\"investment-report-filename\" content=\"$filename\">" +
            "<title>Company research · $symbol</title><style>"
        require(text.startsWith(prefix) && text.endsWith(SUFFIX))
        val styleEnd = text.indexOf(BODY_OPEN, prefix.length)
        require(styleEnd >= prefix.length && styleEnd <= text.length - SUFFIX.length)
        val style = text.substring(prefix.length, styleEnd).toByteArray(Charsets.UTF_8)
        val digest = MessageDigest.getInstance("SHA-256").digest(style)
        Base64.encodeToString(digest, Base64.NO_WRAP) == STYLE_HASH
    } catch (_: Exception) {
        false
    }
}
