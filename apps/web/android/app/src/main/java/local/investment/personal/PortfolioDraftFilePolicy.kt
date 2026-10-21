package local.investment.personal

import android.util.JsonReader
import android.util.JsonToken
import java.io.StringReader
import org.json.JSONObject

/** Bounded file framing only. The shared document guard admits the whole raw ledger. */
internal object PortfolioDraftFilePolicy : ChosenDocumentPolicy {
    const val MAX_BYTES = 266240
    private const val MAX_SAFE_INTEGER = 9007199254740991L
    private const val FORMAT = "investment-portfolio-draft"
    private val FIELDS = setOf("format", "version", "accountScope", "capturedAt", "baseVersion", "draft")
    private val TIMESTAMP = Regex("([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})\\.([0-9]{3})Z")
    private val HASH = Regex("sha256:[0-9a-f]{64}")
    override val mimeType = "application/json"
    override val maxBytes = MAX_BYTES
    override val failureMessage = "Portfolio draft file unavailable"

    override fun filename(options: JSONObject): String? {
        if (!exactDocumentKeys(options, setOf("operationId", "capturedAt", "baseVersion"))) return null
        val value = options.opt("baseVersion") as? Number ?: return null
        val version = value.toDouble()
        if (!version.isFinite()) return null
        if (version !in 0.0..MAX_SAFE_INTEGER.toDouble()) return null
        if (version != version.toLong().toDouble()) return null
        return draftFilename(options.opt("capturedAt") as? String)
    }

    override fun acceptsText(filename: String, text: String): Boolean = try {
        require(text.isNotEmpty() && text.length <= MAX_BYTES)
        JsonReader(StringReader(text)).use { reader ->
            reader.isLenient = false
            require(reader.peek() == JsonToken.BEGIN_OBJECT)
            reader.beginObject()
            val keys = mutableSetOf<String>()
            var capturedAt: String? = null
            while (reader.hasNext()) {
                val key = reader.nextName()
                require(keys.add(key))
                capturedAt = readField(reader, key) ?: capturedAt
            }
            reader.endObject()
            require(keys == FIELDS && reader.peek() == JsonToken.END_DOCUMENT)
            draftFilename(capturedAt) == filename
        }
    } catch (_: Exception) { false }

    private fun readField(reader: JsonReader, key: String): String? {
        when (key) {
            "format" -> require(readString(reader) == FORMAT)
            "version" -> require(readInteger(reader) == 1L)
            "accountScope" -> require(HASH.matches(readString(reader)))
            "capturedAt" -> return readString(reader)
            "baseVersion" -> readInteger(reader)
            "draft" -> {
                require(reader.peek() == JsonToken.BEGIN_OBJECT)
                reader.skipValue()
            }
            else -> throw IllegalArgumentException()
        }
        return null
    }

    private fun readString(reader: JsonReader): String {
        require(reader.peek() == JsonToken.STRING)
        return reader.nextString()
    }

    private fun readInteger(reader: JsonReader): Long {
        require(reader.peek() == JsonToken.NUMBER)
        val text = reader.nextString()
        require(text.matches(Regex("0|[1-9][0-9]{0,15}")))
        val number = text.toLong()
        require(number <= MAX_SAFE_INTEGER)
        return number
    }

    private fun draftFilename(capturedAt: String?): String? {
        val match = capturedAt?.let { TIMESTAMP.matchEntire(it) } ?: return null
        val year = match.groupValues[1].toInt()
        val month = match.groupValues[2].toInt()
        val day = match.groupValues[3].toInt()
        if (month !in 1..12) return null
        val clock = match.groupValues.slice(4..6).map { it.toInt() }
        if (!clock.zip(listOf(23, 59, 59)).all { (value, maximum) -> value in 0..maximum }) return null
        if (day !in 1..daysInMonth(year, month)) return null
        return "Investment-portfolio-draft-${capturedAt.replace(Regex("[:.]"), "-")}.json"
    }

    private fun daysInMonth(year: Int, month: Int): Int {
        val leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)
        return when (month) { 2 -> if (leap) 29 else 28; 4, 6, 9, 11 -> 30; else -> 31 }
    }
}
