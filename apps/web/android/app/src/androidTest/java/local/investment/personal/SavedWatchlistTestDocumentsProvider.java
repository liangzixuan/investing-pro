package local.investment.personal;

import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.os.CancellationSignal;
import android.os.Bundle;
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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/** Invented instrumentation destinations only. This class/manifest exist only in the test APK. */
public final class SavedWatchlistTestDocumentsProvider extends DocumentsProvider {
    static final String AUTHORITY = "local.investment.personal.test.watchlist-export";
    static final String TITLE = "Investment test exports";
    private static final String ROOT_ID = "invented-exports";
    private static final String REPORT_NAME = "Investment-research-[A-Z0-9][A-Z0-9.-]{0,14}-[A-Z0-9]{4}-[0-9]{8}T[0-9]{9}Z\\.json";
    private static final String HTML_REPORT_NAME = REPORT_NAME.replace("json", "html");
    private static final Object REPORT_OPEN_LOCK = new Object();
    private static HeldReportOpen heldReportOpen;

    static void armReportOpen() {
        synchronized (REPORT_OPEN_LOCK) {
            if (heldReportOpen != null)
                throw new IllegalStateException("Reset the invented report open before arming");
            heldReportOpen = new HeldReportOpen();
        }
    }

    static boolean reportOpenEntered() {
        synchronized (REPORT_OPEN_LOCK) {
            return heldReportOpen != null && heldReportOpen.entered.getCount() == 0;
        }
    }

    static Bundle reportOpenState() {
        synchronized (REPORT_OPEN_LOCK) {
            HeldReportOpen held = heldReportOpen;
            Bundle result = new Bundle();
            result.putBoolean("armed", held != null);
            result.putBoolean("entered", held != null && held.entered.getCount() == 0);
            result.putBoolean("releasedNormally", held != null && held.releasedNormally);
            result.putBoolean("descriptorReturned", held != null && held.descriptorReturned);
            result.putBoolean("timedOut", held != null && held.timedOut);
            result.putBoolean("reset", held != null && held.reset);
            result.putString("generation", held == null ? null : held.generation);
            return result;
        }
    }

    static void releaseReportOpen() {
        synchronized (REPORT_OPEN_LOCK) {
            HeldReportOpen held = heldReportOpen;
            if (held == null) return;
            if (held.entered.getCount() == 0 && !held.timedOut && !held.reset)
                held.releasedNormally = true;
            held.release.countDown();
        }
    }

    private static void resetReportOpen() {
        synchronized (REPORT_OPEN_LOCK) {
            if (heldReportOpen == null) return;
            heldReportOpen.reset = true;
            heldReportOpen.release.countDown();
            heldReportOpen = null;
        }
    }

    private static final class HeldReportOpen {
        final String generation = UUID.randomUUID().toString();
        final CountDownLatch entered = new CountDownLatch(1);
        final CountDownLatch release = new CountDownLatch(1);
        boolean claimed;
        boolean reset;
        boolean releasedNormally;
        boolean descriptorReturned;
        boolean timedOut;
    }
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
        synchronized (REPORT_OPEN_LOCK) {
            resetReportOpen();
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
    }

    @Override public boolean onCreate() { return true; }

    @Override public Cursor queryRoots(String[] projection) {
        MatrixCursor cursor = new MatrixCursor(projection == null ? ROOT_COLUMNS : projection);
        MatrixCursor.RowBuilder row = cursor.newRow();
        row.add(Root.COLUMN_ROOT_ID, ROOT_ID);
        row.add(Root.COLUMN_DOCUMENT_ID, ROOT_ID);
        row.add(Root.COLUMN_TITLE, TITLE);
        row.add(Root.COLUMN_FLAGS, Root.FLAG_SUPPORTS_CREATE | Root.FLAG_LOCAL_ONLY);
        row.add(Root.COLUMN_MIME_TYPES, "text/plain\napplication/json\ntext/html");
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
        boolean watchlist = "text/plain".equals(mimeType) && displayName != null
            && displayName.matches("Investment-watchlist-v[0-9]{1,16}\\.txt");
        boolean report = "application/json".equals(mimeType) && displayName != null
            && displayName.matches(REPORT_NAME);
        boolean htmlReport = "text/html".equals(mimeType) && displayName != null
            && displayName.matches(HTML_REPORT_NAME);
        boolean reviewReport = "text/html".equals(mimeType) && displayName != null
            && displayName.matches("Investment-(?:portfolio|followups)-review-[0-9]{8}T[0-9]{9}Z\\.html");
        boolean screenComparisonReport = "text/html".equals(mimeType) && displayName != null
            && displayName.matches("Investment-(?:screen|portfolio)-comparison-[0-9]{8}T[0-9]{9}Z\\.html");
        boolean draft = "application/json".equals(mimeType) && displayName != null
            && displayName.matches("Investment-(?:watchlist|valuation-inputs|valuation-collection)-draft-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}-[0-9]{3}Z\\.json");
        boolean recipe = "application/json".equals(mimeType) && displayName != null
            && displayName.matches("Investment-financial-screen-recipe-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}-[0-9]{3}Z\\.json");
        boolean researchDraftSet = "application/json".equals(mimeType) && displayName != null
            && displayName.matches("Investment-research-draft-set-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}-[0-9]{3}Z\\.json");
        if (!ROOT_ID.equals(parent) || (!watchlist && !report && !htmlReport && !reviewReport && !screenComparisonReport && !draft && !recipe && !researchDraftSet))
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
        File destination = document(id);
        HeldReportOpen held = "wt".equals(mode) ? holdReportOpen(id) : null;
        if (signal != null) signal.throwIfCanceled();
        if (held != null) {
            synchronized (REPORT_OPEN_LOCK) {
                if (held.reset || heldReportOpen != held || !held.releasedNormally || held.timedOut)
                    throw new FileNotFoundException("Invented report open was not normally released");
                ParcelFileDescriptor descriptor = ParcelFileDescriptor.open(destination, ParcelFileDescriptor.parseMode(mode));
                // Record success only for this armed generation, after a real descriptor exists.
                held.descriptorReturned = true;
                return descriptor;
            }
        }
        return ParcelFileDescriptor.open(destination, ParcelFileDescriptor.parseMode(mode));
    }

    private HeldReportOpen holdReportOpen(String id) throws FileNotFoundException {
        HeldReportOpen held;
        synchronized (REPORT_OPEN_LOCK) {
            held = heldReportOpen;
            if (held == null || held.claimed) return null;
            String name;
            try {
                name = new String(Files.readAllBytes(new File(directory(getContext()), id + ".name").toPath()), StandardCharsets.UTF_8);
            } catch (IOException failure) { throw new FileNotFoundException(); }
            // This metadata can only be created by the fixed application/json branch above.
            if (!name.matches(REPORT_NAME)) return null;
            held.claimed = true;
            held.entered.countDown();
        }
        try {
            if (!held.release.await(20, TimeUnit.SECONDS)) {
                synchronized (REPORT_OPEN_LOCK) { held.timedOut = true; }
                throw new FileNotFoundException("Invented report open was not released");
            }
        } catch (InterruptedException failure) {
            Thread.currentThread().interrupt();
            throw new FileNotFoundException("Invented report open interrupted");
        }
        return held;
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
        String name;
        try {
            name = new String(Files.readAllBytes(new File(directory(getContext()), id + ".name").toPath()), StandardCharsets.UTF_8);
            row.add(Document.COLUMN_DISPLAY_NAME, name);
        } catch (IOException failure) { throw new FileNotFoundException(); }
        row.add(Document.COLUMN_MIME_TYPE, name.endsWith(".html") ? "text/html" : name.endsWith(".json") ? "application/json" : "text/plain");
        row.add(Document.COLUMN_FLAGS, Document.FLAG_SUPPORTS_WRITE);
        row.add(Document.COLUMN_SIZE, file.length());
    }
}
