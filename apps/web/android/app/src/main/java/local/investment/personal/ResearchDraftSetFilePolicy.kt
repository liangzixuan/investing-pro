package local.investment.personal

import android.util.JsonReader
import android.util.JsonToken
import java.io.StringReader
import org.json.JSONObject

/** Closed file framing and coherent scope; shared resource codecs admit all nested payload fields. */
internal object ResearchDraftSetFilePolicy : ChosenDocumentPolicy {
    const val MAX_BYTES = 1061324
    private const val MAX_SAFE_INTEGER = 9007199254740991L
    private val RESOURCES = listOf("watchlist", "portfolio", "followups", "valuation")
    private val FIELDS = setOf("format", "version", "accountScope", "capturedAt", "members", "omitted")
    private val HASH = Regex("sha256:[0-9a-f]{64}")
    private val TIMESTAMP = Regex("([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})\\.([0-9]{3})Z")
    override val mimeType = "application/json"
    override val maxBytes = MAX_BYTES
    override val failureMessage = "Research draft-set file unavailable"

    override fun filename(options: JSONObject): String? {
        if (!exactDocumentKeys(options, setOf("operationId", "capturedAt"))) return null
        val capturedAt = options.opt("capturedAt") as? String ?: return null
        if (!validTime(capturedAt)) return null
        return draftFilename(capturedAt)
    }

    override fun acceptsText(filename: String, text: String): Boolean = try {
        require(text.isNotEmpty() && text.length <= MAX_BYTES)
        JsonReader(StringReader(text)).use { reader ->
            reader.isLenient = false
            require(reader.peek() == JsonToken.BEGIN_OBJECT)
            reader.beginObject()
            val keys = mutableSetOf<String>()
            var scope: String? = null
            var capturedAt: String? = null
            var members: Map<String, String?>? = null
            var omitted: List<String>? = null
            while (reader.hasNext()) {
                val key = reader.nextName()
                require(keys.add(key))
                when (key) {
                    "format" -> require(readString(reader) == "investment-research-draft-set")
                    "version" -> require(readInteger(reader) == 1L)
                    "accountScope" -> scope = readScope(reader)
                    "capturedAt" -> capturedAt = readTime(reader)
                    "members" -> members = readMembers(reader)
                    "omitted" -> omitted = readOmitted(reader)
                    else -> throw IllegalArgumentException()
                }
            }
            reader.endObject()
            require(keys == FIELDS && reader.peek() == JsonToken.END_DOCUMENT)
            val inventory = requireNotNull(members)
            require(inventory.values.any { it != null })
            require(inventory.values.all { it == null || it == scope })
            require(omitted == RESOURCES.filter { inventory[it] == null })
            draftFilename(requireNotNull(capturedAt)) == filename
        }
    } catch (_: Exception) { false }

    private fun readMembers(reader: JsonReader): Map<String, String?> {
        require(reader.peek() == JsonToken.BEGIN_OBJECT)
        reader.beginObject()
        val result = linkedMapOf<String, String?>()
        while (reader.hasNext()) {
            val resource = reader.nextName()
            require(resource in RESOURCES && !result.containsKey(resource))
            result[resource] = if (reader.peek() == JsonToken.NULL) {
                reader.nextNull()
                null
            } else readMember(reader, resource)
        }
        reader.endObject()
        require(result.keys == RESOURCES.toSet())
        return result
    }

    private fun readMember(reader: JsonReader, resource: String): String {
        require(reader.peek() == JsonToken.BEGIN_OBJECT)
        reader.beginObject()
        val keys = mutableSetOf<String>()
        var scope: String? = null
        val valuation = resource == "valuation"
        while (reader.hasNext()) {
            val key = reader.nextName()
            require(keys.add(key))
            when (key) {
                "format" -> require(readString(reader) == if (valuation) "investment-valuation-collection-draft" else "investment-$resource-draft")
                "version" -> require(readInteger(reader) == 1L)
                "accountScope" -> scope = readScope(reader)
                "capturedAt" -> readTime(reader)
                "baseVersion" -> { require(!valuation); readInteger(reader) }
                "draft" -> { require(!valuation); readPayloadObject(reader) }
                "payload" -> { require(valuation); readPayloadObject(reader) }
                else -> throw IllegalArgumentException()
            }
        }
        reader.endObject()
        val expected = if (valuation) setOf("format", "version", "accountScope", "capturedAt", "payload")
            else setOf("format", "version", "accountScope", "capturedAt", "baseVersion", "draft")
        require(keys == expected)
        return requireNotNull(scope)
    }

    private fun readPayloadObject(reader: JsonReader) {
        require(reader.peek() == JsonToken.BEGIN_OBJECT)
        reader.skipValue()
    }
    private fun readOmitted(reader: JsonReader): List<String> {
        require(reader.peek() == JsonToken.BEGIN_ARRAY)
        reader.beginArray()
        val resources = mutableListOf<String>()
        while (reader.hasNext()) {
            val resource = readString(reader)
            require(resource in RESOURCES && resource !in resources)
            resources.add(resource)
        }
        reader.endArray()
        return resources
    }
    private fun readString(reader: JsonReader): String {
        require(reader.peek() == JsonToken.STRING)
        return reader.nextString()
    }
    private fun readScope(reader: JsonReader): String = readString(reader).also { require(HASH.matches(it)) }
    private fun readTime(reader: JsonReader): String = readString(reader).also { require(validTime(it)) }
    private fun readInteger(reader: JsonReader): Long {
        require(reader.peek() == JsonToken.NUMBER)
        val value = reader.nextString()
        require(value.matches(Regex("0|[1-9][0-9]{0,15}")))
        return value.toLong().also { require(it <= MAX_SAFE_INTEGER) }
    }
    private fun draftFilename(capturedAt: String) = "Investment-research-draft-set-${capturedAt.replace(Regex("[:.]"), "-")}.json"
    private fun validTime(value: String): Boolean {
        val match = TIMESTAMP.matchEntire(value) ?: return false
        val year = match.groupValues[1].toInt()
        val month = match.groupValues[2].toInt()
        val day = match.groupValues[3].toInt()
        if (month !in 1..12) return false
        val clock = match.groupValues.slice(4..6).map { it.toInt() }
        if (!clock.zip(listOf(23, 59, 59)).all { (part, maximum) -> part in 0..maximum }) return false
        val leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)
        val days = when (month) { 2 -> if (leap) 29 else 28; 4, 6, 9, 11 -> 30; else -> 31 }
        return day in 1..days
    }
}
