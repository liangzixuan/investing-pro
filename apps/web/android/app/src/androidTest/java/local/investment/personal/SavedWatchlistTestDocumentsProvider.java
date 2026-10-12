package local.investment.personal;

import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.provider.DocumentsContract.Document;
import android.provider.DocumentsContract.Root;
import android.provider.DocumentsProvider;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.UUID;

/** Invented instrumentation destinations only. This class/manifest exist only in the test APK. */
public final class SavedWatchlistTestDocumentsProvider extends DocumentsProvider {
    static final String AUTHORITY = "local.investment.personal.test.watchlist-export";
    static final String TITLE = "Investment test exports";
    private static final String ROOT_ID = "invented-exports";
    private static final String[] ROOT_COLUMNS = {
        Root.COLUMN_ROOT_ID, Root.COLUMN_DOCUMENT_ID, Root.COLUMN_TITLE,
        Root.COLUMN_FLAGS, Root.COLUMN_MIME_TYPES, Root.COLUMN_AVAILABLE_BYTES
    };
    private static final String[] DOCUMENT_COLUMNS = {
        Document.COLUMN_DOCUMENT_ID, Document.COLUMN_DISPLAY_NAME,
        Document.COLUMN_MIME_TYPE, Document.COLUMN_FLAGS, Document.COLUMN_SIZE
    };

    static File directory(Context context) {
        File directory = new File(context.getCacheDir(), "invented-watchlist-exports");
        if (!directory.isDirectory() && !directory.mkdir())
            throw new IllegalStateException("Cannot create invented export directory");
        return directory;
    }

    static File[] outputs(Context context) {
        File[] files = directory(context).listFiles((directory, name) -> name.endsWith(".txt"));
        if (files == null) throw new IllegalStateException("Cannot list invented outputs");
        return files;
    }

    static void clear(Context context) throws IOException {
        File owned = directory(context);
        File[] files = owned.listFiles();
        if (files == null) throw new IOException("Cannot inspect invented outputs");
        for (File file : files) {
            if (!file.getCanonicalFile().getParentFile().equals(owned.getCanonicalFile())
                || !file.getName().matches("[0-9a-f-]{36}\\.(txt|name)"))
                throw new IOException("Unexpected invented output path");
            if (!file.delete()) throw new IOException("Cannot clear invented output");
        }
    }

    @Override public boolean onCreate() { return true; }

    @Override public Cursor queryRoots(String[] projection) {
        MatrixCursor cursor = new MatrixCursor(projection == null ? ROOT_COLUMNS : projection);
        MatrixCursor.RowBuilder row = cursor.newRow();
        row.add(Root.COLUMN_ROOT_ID, ROOT_ID);
        row.add(Root.COLUMN_DOCUMENT_ID, ROOT_ID);
        row.add(Root.COLUMN_TITLE, TITLE);
        row.add(Root.COLUMN_FLAGS, Root.FLAG_SUPPORTS_CREATE | Root.FLAG_LOCAL_ONLY);
        row.add(Root.COLUMN_MIME_TYPES, "text/plain");
        row.add(Root.COLUMN_AVAILABLE_BYTES, 16 * 1024 * 1024L);
        return cursor;
    }

    @Override public Cursor queryDocument(String id, String[] projection) throws FileNotFoundException {
        MatrixCursor cursor = new MatrixCursor(projection == null ? DOCUMENT_COLUMNS : projection);
        addDocument(cursor, id);
        return cursor;
    }

    @Override public Cursor queryChildDocuments(String parent, String[] projection, String sortOrder)
        throws FileNotFoundException {
        if (!ROOT_ID.equals(parent)) throw new FileNotFoundException();
        MatrixCursor cursor = new MatrixCursor(projection == null ? DOCUMENT_COLUMNS : projection);
        for (File file : outputs(getContext()))
            addDocument(cursor, file.getName().substring(0, 36));
        return cursor;
    }

    @Override public String createDocument(String parent, String mimeType, String displayName)
        throws FileNotFoundException {
        if (!ROOT_ID.equals(parent) || !"text/plain".equals(mimeType)
            || displayName == null || !displayName.matches("Investment-watchlist-v[0-9]{1,16}\\.txt"))
            throw new FileNotFoundException();
        String id = UUID.randomUUID().toString();
        try {
            if (!document(id).createNewFile()) throw new IOException();
            Files.write(new File(directory(getContext()), id + ".name").toPath(),
                displayName.getBytes(StandardCharsets.UTF_8));
        } catch (IOException failure) { throw new FileNotFoundException(); }
        return id;
    }

    @Override public ParcelFileDescriptor openDocument(String id, String mode, CancellationSignal signal)
        throws FileNotFoundException {
        if (signal != null) signal.throwIfCanceled();
        if (!"r".equals(mode) && !"wt".equals(mode)) throw new FileNotFoundException();
        return ParcelFileDescriptor.open(document(id), ParcelFileDescriptor.parseMode(mode));
    }

    private File document(String id) throws FileNotFoundException {
        if (id == null || !id.matches("[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}"))
            throw new FileNotFoundException();
        return new File(directory(getContext()), id + ".txt");
    }

    private void addDocument(MatrixCursor cursor, String id) throws FileNotFoundException {
        MatrixCursor.RowBuilder row = cursor.newRow();
        row.add(Document.COLUMN_DOCUMENT_ID, id);
        if (ROOT_ID.equals(id)) {
            row.add(Document.COLUMN_DISPLAY_NAME, TITLE);
            row.add(Document.COLUMN_MIME_TYPE, Document.MIME_TYPE_DIR);
            row.add(Document.COLUMN_FLAGS, Document.FLAG_DIR_SUPPORTS_CREATE);
            row.add(Document.COLUMN_SIZE, 0);
            return;
        }
        File file = document(id);
        try {
            row.add(Document.COLUMN_DISPLAY_NAME, new String(Files.readAllBytes(
                new File(directory(getContext()), id + ".name").toPath()), StandardCharsets.UTF_8));
        } catch (IOException failure) { throw new FileNotFoundException(); }
        row.add(Document.COLUMN_MIME_TYPE, "text/plain");
        row.add(Document.COLUMN_FLAGS, Document.FLAG_SUPPORTS_WRITE);
        row.add(Document.COLUMN_SIZE, file.length());
    }
}
