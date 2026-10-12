package local.investment.personal;

import static org.junit.Assert.*;

import android.content.Context;
import android.net.Uri;
import android.os.Bundle;
import android.provider.DocumentsContract;
import java.io.InputStream;
import java.util.ArrayList;

/** Cross-process test observations; no direct test-APK filesystem access or shell identity. */
final class WatchlistTestDocuments {
    private static final String AUTHORITY = SavedWatchlistTestDocumentsProvider.AUTHORITY;

    static void clear(Context context) {
        assertNotNull(context.getContentResolver().call(SavedWatchlistTestObservationProvider.AUTHORITY, "reset-invented-exports", null, null));
    }

    static Output[] outputs(Context context) {
        Bundle result = context.getContentResolver().call(SavedWatchlistTestObservationProvider.AUTHORITY, "inspect-invented-exports", null, null);
        assertNotNull(result);
        ArrayList<Bundle> documents = result.getParcelableArrayList("documents", Bundle.class);
        assertNotNull(documents);
        assertTrue("Bound the invented test destination", documents.size() <= 8);
        return documents.stream().map(document -> {
            String id = document.getString("id");
            assertNotNull(id);
            assertTrue(id.matches("[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}"));
            return new Output(DocumentsContract.buildDocumentUri(AUTHORITY, id),
                document.getString("name"), document.getLong("size"));
        }).toArray(Output[]::new);
    }

    static byte[] read(Context context, Output output) throws Exception {
        assertEquals(AUTHORITY, output.uri.getAuthority());
        // Uses the real picker grant in the target UID; inspection grants no URI permission.
        try (InputStream input = context.getContentResolver().openInputStream(output.uri)) {
            assertNotNull(input);
            byte[] bytes = input.readNBytes(InvestmentWatchlistExportPlugin.MAX_EXPORT_BYTES + 1);
            assertTrue(bytes.length <= InvestmentWatchlistExportPlugin.MAX_EXPORT_BYTES);
            assertEquals(output.size, bytes.length);
            return bytes;
        }
    }

    static final class Output {
        final Uri uri;
        final String name;
        final long size;
        Output(Uri uri, String name, long size) { this.uri = uri; this.name = name; this.size = size; }
    }
}
