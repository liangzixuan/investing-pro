package local.investment.personal;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.Binder;
import android.os.Bundle;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;

/** Test APK only: fixed invented-cache metadata/reset in its owning process, never document grants. */
public final class SavedWatchlistTestObservationProvider extends ContentProvider {
    static final String AUTHORITY = "local.investment.personal.test.watchlist-export-observer";

    @Override public boolean onCreate() { return true; }

    @Override public Bundle call(String method, String arg, Bundle extras) {
        enforceTarget();
        if (arg != null || extras != null) throw new SecurityException("No test operation arguments");
        try {
            if ("reset-invented-exports".equals(method)) {
                SavedWatchlistTestDocumentsProvider.clear(getContext());
                return Bundle.EMPTY;
            }
            if ("arm-report-open".equals(method)) {
                SavedWatchlistTestDocumentsProvider.armReportOpen();
                return Bundle.EMPTY;
            }
            if ("report-open-state".equals(method)) {
                Bundle result = new Bundle();
                result.putBoolean("entered", SavedWatchlistTestDocumentsProvider.reportOpenEntered());
                return result;
            }
            if ("release-report-open".equals(method)) {
                SavedWatchlistTestDocumentsProvider.releaseReportOpen();
                return Bundle.EMPTY;
            }
            if (!"inspect-invented-exports".equals(method)) throw new UnsupportedOperationException();
            ArrayList<Bundle> documents = new ArrayList<>();
            for (File file : SavedWatchlistTestDocumentsProvider.outputs(getContext())) {
                if (documents.size() >= 8) throw new IllegalStateException("Invented output count exceeded");
                String id = file.getName().substring(0, 36);
                Bundle document = new Bundle();
                document.putString("id", id);
                document.putString("name", new String(Files.readAllBytes(new File(
                    SavedWatchlistTestDocumentsProvider.directory(getContext()), id + ".name").toPath()), StandardCharsets.UTF_8));
                document.putLong("size", file.length());
                documents.add(document);
            }
            Bundle result = new Bundle();
            result.putParcelableArrayList("documents", documents);
            return result;
        } catch (IOException failure) {
            throw new IllegalStateException("Invented export inspection failed");
        }
    }

    private void enforceTarget() {
        try {
            int targetUid = getContext().getPackageManager().getApplicationInfo("local.investment.personal", 0).uid;
            if (Binder.getCallingUid() != targetUid) throw new SecurityException("Wrong test caller");
        } catch (android.content.pm.PackageManager.NameNotFoundException failure) {
            throw new SecurityException("Missing test target");
        }
    }

    @Override public Cursor query(Uri uri, String[] projection, String selection, String[] args, String order) {
        throw new UnsupportedOperationException();
    }
    @Override public String getType(Uri uri) { throw new UnsupportedOperationException(); }
    @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri uri, String selection, String[] args) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] args) {
        throw new UnsupportedOperationException();
    }
}
