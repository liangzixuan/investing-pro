package local.investment.personal

import android.util.Base64
import java.security.MessageDigest
import org.json.JSONObject

/** Admits the fixed application export envelope; the branded formatter owns passive content. */
internal object FollowupsReviewReportDocumentPolicy : ChosenDocumentPolicy {
    const val PURPOSE = "investment.followups-review-html"
    const val MAX_BYTES = 8388608
    private const val STYLE_HASH = "0prZMY8NvuxrM52UL/gsirqQ7bU+/xP67p90kVL2EMQ="
    private const val CSP = "default-src 'none'; script-src 'none'; connect-src 'none'; img-src 'none'; font-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; style-src 'sha256-$STYLE_HASH'"
    private const val BODY_OPEN = "</style></head><body><main>"
    private const val SUFFIX = "</main></body></html>\n"
    private val FILENAME = Regex("Investment-followups-review-([0-9]{8}T[0-9]{9}Z)\\.html")

    override val mimeType = "text/html"
    override val maxBytes = MAX_BYTES
    override val failureMessage = "Follow-ups report save unavailable"

    override fun filename(options: JSONObject): String? {
        if (!exactDocumentKeys(options, setOf("operationId", "purpose", "filename"))) return null
        if (options.opt("purpose") != PURPOSE) return null
        val name = options.opt("filename") as? String ?: return null
        return name.takeIf { validFilename(it) }
    }

    private fun validFilename(name: String): Boolean {
        val match = FILENAME.matchEntire(name) ?: return false
        // Reuse the existing complete UTC calendar check without admitting company metadata.
        val calendarOptions = JSONObject()
            .put("operationId", "00000000-0000-0000-0000-000000000000")
            .put("purpose", CompanyReportDocumentPolicy.PURPOSE)
            .put("filename", "Investment-research-ZERO-XNAS-${match.groupValues[1]}.json")
        return CompanyReportDocumentPolicy.filename(calendarOptions) != null
    }

    override fun acceptsText(filename: String, text: String): Boolean = try {
        require(text.isNotEmpty() && text.length <= MAX_BYTES && validFilename(filename))
        val prefix = "<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\">" +
            "<meta http-equiv=\"Content-Security-Policy\" content=\"$CSP\">" +
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
            "<meta name=\"investment-report-format\" content=\"1\">" +
            "<meta name=\"investment-report-purpose\" content=\"$PURPOSE\">" +
            "<meta name=\"investment-report-filename\" content=\"$filename\">" +
            "<title>Follow-ups review report</title><style>"
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
