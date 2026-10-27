package local.investment.personal

import android.util.JsonReader
import android.util.JsonToken
import java.io.StringReader
import java.nio.CharBuffer
import java.nio.charset.CodingErrorAction
import org.json.JSONObject

/** Fixed native policy; neither byte bounds nor destination URIs come from callers. */
internal interface ChosenDocumentPolicy {
    val mimeType: String
    val maxBytes: Int
    val failureMessage: String
    fun filename(options: JSONObject): String?
    fun acceptsText(filename: String, text: String): Boolean
}

internal fun exactDocumentKeys(options: JSONObject, keys: Set<String>): Boolean =
    options.keys().asSequence().toSet() == keys

internal object WatchlistDocumentPolicy : ChosenDocumentPolicy {
    const val MAX_BYTES = 524800
    private const val MAX_SAFE_INTEGER = 9007199254740991.0
    override val mimeType = "text/plain"
    override val maxBytes = MAX_BYTES
    override val failureMessage = "Watchlist export unavailable"

    override fun filename(options: JSONObject): String? {
        if (!exactDocumentKeys(options, setOf("operationId", "version"))) return null
        val value = options.opt("version") as? Number ?: return null
        val number = value.toDouble()
        if (!number.isFinite() || number < 0 || number > MAX_SAFE_INTEGER || number != number.toLong().toDouble()) return null
        return "Investment-watchlist-v${number.toLong()}.txt"
    }

    // Preserve the existing watchlist writer contract; its caller admits its own document.
    override fun acceptsText(filename: String, text: String) = true
}

internal object CompanyReportDocumentPolicy : ChosenDocumentPolicy {
    const val PURPOSE = "investment.company-research"
    const val MAX_BYTES = 5996544
    override val mimeType = "application/json"
    override val maxBytes = MAX_BYTES
    override val failureMessage = "Report save unavailable"
    private val SYMBOL = Regex("[A-Z0-9][A-Z0-9.-]{0,14}")
    private val MIC = Regex("[A-Z0-9]{4}")
    private val TIMESTAMP = Regex("([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})\\.([0-9]{3})Z")
    private val FILENAME = Regex("Investment-research-([A-Z0-9][A-Z0-9.-]{0,14})-([A-Z0-9]{4})-([0-9]{4})([0-9]{2})([0-9]{2})T([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{3})Z\\.json")

    override fun filename(options: JSONObject): String? {
        if (!exactDocumentKeys(options, setOf("operationId", "purpose", "filename")) ||
            options.opt("purpose") != PURPOSE) return null
        val name = options.opt("filename") as? String ?: return null
        val match = FILENAME.matchEntire(name) ?: return null
        val (_, _, year, month, day, hour, minute, second, millis) = match.destructured
        val preparedAt = "$year-$month-${day}T$hour:$minute:$second.${millis}Z"
        return name.takeIf { reportFilename(match.groupValues[1], match.groupValues[2], preparedAt) == name }
    }

    override fun acceptsText(filename: String, text: String): Boolean = try {
        // Stream the JSON so neither ignored source packets nor hostile nesting recurse through JSONObject.
        JsonReader(StringReader(text)).use { reader ->
            reader.isLenient = false
            require(reader.peek() == JsonToken.BEGIN_OBJECT)
            var purpose: String? = null
            var schema: String? = null
            var preparedAt: String? = null
            var listing: Pair<String?, String?>? = null
            reader.beginObject()
            while (reader.hasNext()) {
                when (reader.nextName()) {
                    "purpose" -> purpose = readString(reader)
                    "schemaVersion" -> schema = readString(reader)
                    "preparedAt" -> preparedAt = readString(reader)
                    "listing" -> listing = readListing(reader)
                    else -> reader.skipValue()
                }
            }
            reader.endObject()
            require(reader.peek() == JsonToken.END_DOCUMENT)
            purpose == PURPOSE && schema == "6.0.0" && listing != null &&
                reportFilename(listing.first, listing.second, preparedAt) == filename
        }
    } catch (_: Exception) {
        false
    }

    private fun readString(reader: JsonReader): String? {
        if (reader.peek() == JsonToken.STRING) return reader.nextString()
        reader.skipValue()
        return null
    }

    private fun readListing(reader: JsonReader): Pair<String?, String?>? {
        if (reader.peek() != JsonToken.BEGIN_OBJECT) {
            reader.skipValue()
            return null
        }
        var symbol: String? = null
        var mic: String? = null
        reader.beginObject()
        while (reader.hasNext()) {
            when (reader.nextName()) {
                "symbol" -> symbol = readString(reader)
                "exchangeMic" -> mic = readString(reader)
                else -> reader.skipValue()
            }
        }
        reader.endObject()
        return symbol to mic
    }

    private fun reportFilename(symbol: String?, mic: String?, preparedAt: String?): String? {
        if (symbol == null || !SYMBOL.matches(symbol) || mic == null || !MIC.matches(mic) || preparedAt == null) return null
        val match = TIMESTAMP.matchEntire(preparedAt) ?: return null
        val year = match.groupValues[1].toInt()
        val month = match.groupValues[2].toInt()
        val day = match.groupValues[3].toInt()
        val hour = match.groupValues[4].toInt()
        val minute = match.groupValues[5].toInt()
        val second = match.groupValues[6].toInt()
        if (month !in 1..12 || hour !in 0..23 || minute !in 0..59 || second !in 0..59) return null
        val leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)
        val days = when (month) { 2 -> if (leap) 29 else 28; 4, 6, 9, 11 -> 30; else -> 31 }
        if (day !in 1..days) return null
        return "Investment-research-$symbol-$mic-${preparedAt.replace(Regex("[-:.]"), "")}.json"
    }
}

/** Refuse malformed UTF-16 instead of replacing it, and clear the encoder's backing buffer. */
internal fun strictDocumentBytes(text: String, maxBytes: Int): ByteArray {
    require(text.isNotEmpty() && text.length <= maxBytes)
    val buffer = Charsets.UTF_8.newEncoder()
        .onMalformedInput(CodingErrorAction.REPORT)
        .onUnmappableCharacter(CodingErrorAction.REPORT)
        .encode(CharBuffer.wrap(text))
    try {
        require(buffer.remaining() <= maxBytes)
        return ByteArray(buffer.remaining()).also { buffer.get(it) }
    } finally {
        if (buffer.hasArray()) buffer.array().fill(0)
    }
}
