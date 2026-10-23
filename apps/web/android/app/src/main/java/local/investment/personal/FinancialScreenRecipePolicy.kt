package local.investment.personal

import android.util.JsonReader
import android.util.JsonToken
import java.io.StringReader
import org.json.JSONObject

/** File framing only. The shared recipe codec validates the criteria and listings. */
internal object FinancialScreenRecipePolicy : ChosenDocumentPolicy {
    const val MAX_BYTES = 65536
    private const val PURPOSE = "financial-screen-recipe"
    private const val FORMAT = "investment-$PURPOSE"
    private val FIELDS = setOf("format", "version", "name", "capturedAt", "catalogSnapshotSha256", "criteria", "listings")
    private val TIMESTAMP = Regex("([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})\\.([0-9]{3})Z")
    private val HASH = Regex("sha256:[0-9a-f]{64}")
    override val mimeType = "application/json"
    override val maxBytes = MAX_BYTES
    override val failureMessage = "Screen recipe file unavailable"

    override fun filename(options: JSONObject): String? {
        if (!exactDocumentKeys(options, setOf("operationId", "capturedAt"))) return null
        return recipeFilename(options.opt("capturedAt") as? String)
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
            recipeFilename(capturedAt) == filename
        }
    } catch (_: Exception) { false }

    private fun readField(reader: JsonReader, key: String): String? {
        when (key) {
            "format" -> require(readString(reader) == FORMAT)
            "version" -> {
                require(reader.peek() == JsonToken.NUMBER)
                require(reader.nextString() == "1")
            }
            "name" -> readString(reader)
            "capturedAt" -> return readString(reader)
            "catalogSnapshotSha256" -> require(HASH.matches(readString(reader)))
            "criteria" -> {
                require(reader.peek() == JsonToken.BEGIN_OBJECT)
                reader.skipValue()
            }
            "listings" -> {
                require(reader.peek() == JsonToken.BEGIN_ARRAY)
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

    private fun recipeFilename(capturedAt: String?): String? {
        val match = capturedAt?.let { TIMESTAMP.matchEntire(it) } ?: return null
        val year = match.groupValues[1].toInt()
        val month = match.groupValues[2].toInt()
        val day = match.groupValues[3].toInt()
        if (month !in 1..12) return null
        val clock = match.groupValues.slice(4..6).map { it.toInt() }
        if (!clock.zip(listOf(23, 59, 59)).all { (value, maximum) -> value in 0..maximum }) return null
        if (day !in 1..daysInMonth(year, month)) return null
        return "Investment-$PURPOSE-${capturedAt.replace(Regex("[:.]"), "-")}.json"
    }

    private fun daysInMonth(year: Int, month: Int): Int {
        val leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)
        return when (month) { 2 -> if (leap) 29 else 28; 4, 6, 9, 11 -> 30; else -> 31 }
    }
}
