package local.investment.personal;

import android.os.SystemClock;
import android.util.Log;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.function.Supplier;

/** Finite failure-only timings; never supplies readiness or dispatch decisions. */
final class PickerCancelObservation {
    enum Stage {
        CANCEL_INITIAL_ROOT, CANCEL_INITIAL_SURFACE, CANCEL_STABILITY, CANCEL_ROOT_ZERO,
        CANCEL_FRESH_ROOT, CANCEL_FRESH_SURFACE, CANCEL_FINAL_ROOT,
        CANCEL_FINAL_SURFACE, CANCEL_IME_ROOT, CANCEL_IME_SURFACE,
        RETURN_SAMPLE, BEFORE_CACHE, BEFORE_WINDOWS, BEFORE_METADATA,
        AFTER_CACHE, AFTER_WINDOWS, AFTER_METADATA, ROOT_ZERO,
        ROOT_REFRESH, ROOT_METADATA, ROOT_WINDOW, WINDOW_METADATA
    }
    enum Selection {
        BEFORE(Stage.BEFORE_CACHE, Stage.BEFORE_WINDOWS, Stage.BEFORE_METADATA),
        AFTER(Stage.AFTER_CACHE, Stage.AFTER_WINDOWS, Stage.AFTER_METADATA);
        final Stage cache;
        final Stage windows;
        final Stage metadata;
        Selection(Stage cache, Stage windows, Stage metadata) {
            this.cache = cache;
            this.windows = windows;
            this.metadata = metadata;
        }
    }
    enum Refusal {
        NOT_QUERIED, STARTED, CACHE_CLEAR_FALSE, NULL_WINDOWS, NULL_ENTRY,
        ACTIVE_FOCUS_SPLIT, NON_APPLICATION, AMBIGUOUS, NO_ACTIVE, SELECTED
    }
    enum RootResult { NOT_QUERIED, NULL_ROOT, REFRESH_FALSE, NO_WINDOW, OBSERVED }
    private static final int MAX_BYTES = 8 * 1024;
    private static final long MAX_NUMBER = 1_000_000;
    private static final Stage[] STAGES = Stage.values();
    private final long[] calls = new long[STAGES.length];
    private final long[] totalMillis = new long[STAGES.length];
    private final long[] lastMillis = new long[STAGES.length];
    private long startedAt;
    private long deadline;
    private Stage lastStarted;
    private long lastStartedAt = -1;
    private Refusal before = Refusal.NOT_QUERIED;
    private Refusal after = Refusal.NOT_QUERIED;
    private RootResult root = RootResult.NOT_QUERIED;
    private int beforeWindows = -1;
    private int afterWindows = -1;
    private boolean logged;

    void begin(long startedAt, long deadline) {
        try {
            this.startedAt = startedAt;
            this.deadline = deadline;
            Arrays.fill(calls, 0);
            Arrays.fill(totalMillis, 0);
            Arrays.fill(lastMillis, -1);
            lastStarted = null;
            lastStartedAt = -1;
            logged = false;
            sample();
        } catch (Throwable ignored) { /* Diagnostic state cannot change the operation. */ }
    }
    <T> T measure(Stage stage, Supplier<T> operation) {
        long start = start(stage);
        try {
            return operation.get();
        } finally {
            completed(stage, start);
        }
    }
    void run(Stage stage, Runnable operation) {
        measure(stage, () -> { operation.run(); return null; });
    }
    void sample() {
        before = Refusal.NOT_QUERIED;
        after = Refusal.NOT_QUERIED;
        root = RootResult.NOT_QUERIED;
        beforeWindows = -1;
        afterWindows = -1;
    }
    void reason(Selection selection, Refusal reason) {
        if (selection == Selection.BEFORE) before = reason;
        else after = reason;
    }
    void windowCount(Selection selection, List<?> windows) {
        try {
            int bounded = (int)Math.min(MAX_NUMBER, Math.max(0, windows.size()));
            if (selection == Selection.BEFORE) beforeWindows = bounded;
            else afterWindows = bounded;
        } catch (Throwable ignored) { /* A diagnostic count cannot reject a valid window. */ }
    }
    void root(RootResult result) { root = result; }
    long start(Stage stage) {
        long start = clock();
        try {
            lastStarted = stage;
            lastStartedAt = start;
            int index = stage.ordinal();
            calls[index] = bounded(calls[index] + 1);
        } catch (Throwable ignored) { /* Observation only. */ }
        return start;
    }
    <T> T finishSelection(Selection selection, Refusal reason, long start, T value) {
        completed(selection.metadata, start);
        reason(selection, reason);
        return value;
    }
    <T> T finishSelected(Selection selection, long start, T value) {
        Refusal reason = value == null ? Refusal.NO_ACTIVE : Refusal.SELECTED;
        return finishSelection(selection, reason, start, value);
    }
    private void completed(Stage stage, long start) {
        try {
            int index = stage.ordinal();
            long end = clock();
            if (start < 0) return;
            if (end < start) return;
            long duration = bounded(end - start);
            lastMillis[index] = duration;
            totalMillis[index] = bounded(totalMillis[index] + duration);
        } catch (Throwable ignored) { /* Preserve the operation's original result or exception. */ }
    }
    void failure() {
        try {
            if (logged) return;
            logged = true;
            String text = summary();
            if (text.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES)
                text = "failure observation exceeded bound";
            Log.e("WatchlistSystemPicker", text);
        } catch (Throwable ignored) { /* Preserve the primary failure. */ }
    }
    private String summary() {
        long now = clock();
        StringBuilder text = new StringBuilder("Failure observation start=").append(startedAt)
            .append(" deadline=").append(deadline).append(" elapsedMs=").append(bounded(now - startedAt))
            .append(" remainingMs=").append(bounded(deadline - now)).append(" lastStage=").append(lastStarted)
            .append(" lastStageAgeMs=").append(bounded(now - lastStartedAt))
            .append(" beforeReason=").append(before).append(" beforeWindows=").append(beforeWindows)
            .append(" afterReason=").append(after).append(" afterWindows=").append(afterWindows)
            .append(" rootResult=").append(root);
        for (Stage stage : STAGES) {
            int index = stage.ordinal();
            text.append(' ').append(stage).append("[calls=").append(calls[index])
                .append(",totalMs=").append(totalMillis[index]).append(",lastMs=").append(lastMillis[index]).append(']');
        }
        return text.toString();
    }
    private static long bounded(long value) { return Math.min(MAX_NUMBER, Math.max(0, value)); }
    private static long clock() {
        try { return SystemClock.uptimeMillis(); }
        catch (Throwable ignored) { return -1; }
    }
}
