package local.investment.personal;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.provider.Settings;
import android.view.inputmethod.InputMethodInfo;
import android.view.inputmethod.InputMethodManager;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.SecureRandom;
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

/** One host-leased, emulator-only IME session. Never installs or changes another IME. */
final class ServedEditorSession implements AutoCloseable {
    private static final long TIMEOUT_MS = 10_000;
    private static ServedEditorSession current;
    private final Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
    private final ExecutorService worker = Executors.newSingleThreadExecutor(r -> {
        Thread thread = new Thread(r, "served-editor-client"); thread.setDaemon(true); return thread;
    });
    private final String nonce = randomNonce();
    private final File recovery = new File(context.getCacheDir(), "served-editor-ime-recovery.json");
    private JSONObject lease;
    private String previousDefault, previousEnabled, previousSubtype;
    private boolean initiallyEnabled, armed, prepared, closed;
    private long sequence;

    static ServedEditorSession open() throws Exception {
        if (current != null) throw new IllegalStateException("Only one fixture IME session may exist");
        ServedEditorSession session = new ServedEditorSession();
        try { session.activate(); current = session; return session; }
        catch (Throwable failure) {
            try { session.close(); } catch (Throwable cleanup) { failure.addSuppressed(cleanup); }
            throw asException(failure);
        }
    }
    static ServedEditorSession current() {
        if (current == null || current.closed) throw new IllegalStateException("No host-leased fixture IME session");
        return current;
    }
    private void activate() throws Exception {
        if (BuildConfig.CLERK_AUTH_ENABLED || Build.VERSION.SDK_INT != 36
            || !ServedEditorControlProvider.TARGET.equals(context.getPackageName()))
            throw new SecurityException("Only the disconnected API36 fixture may use the test IME");
        PackageManager pm = context.getPackageManager();
        ApplicationInfo app = pm.getApplicationInfo(context.getPackageName(), 0);
        if ((app.flags & ApplicationInfo.FLAG_DEBUGGABLE) == 0
            || pm.checkSignatures(context.getPackageName(), ServedEditorControlProvider.TEST_PACKAGE) != PackageManager.SIGNATURE_MATCH)
            throw new SecurityException("Exact debuggable target and matching test signature required");
        String hostNonce = InstrumentationRegistry.getArguments().getString("servedEditorImeLease");
        String source = InstrumentationRegistry.getArguments().getString("expectedSourceSha");
        if (hostNonce == null || !hostNonce.matches("[a-f0-9]{64}") || source == null || !source.matches("[a-f0-9]{40}"))
            throw new SecurityException("Exact host lease and source arguments required");
        File leaseFile = new File(context.getCacheDir(), "served-editor-ime-host-lease.json");
        long leaseDeadline = deadline();
        while (!leaseFile.isFile() && SystemClock.uptimeMillis() < leaseDeadline) Thread.sleep(50);
        lease = readJson(leaseFile);
        exactKeys(lease, Set.of("schema", "nonce", "serial", "bootId", "user", "sourceSha", "previousDefault", "previousEnabled", "previousSubtype"));
        if (!(lease.get("schema") instanceof Integer) || !(lease.get("user") instanceof Integer)
            || lease.getInt("schema") != 1 || !hostNonce.equals(lease.getString("nonce")) || !source.equals(lease.getString("sourceSha"))
            || !lease.getString("serial").matches("emulator-[0-9]+")
            || !lease.getString("bootId").matches("[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}") || lease.getInt("user") < 0)
            throw new SecurityException("Host lease does not identify this exact source and emulator");
        if (!"1".equals(shell("getprop ro.kernel.qemu", deadline()).trim())
            || !lease.getString("bootId").equals(shell("cat /proc/sys/kernel/random/boot_id", deadline()).trim())
            || !Integer.toString(lease.getInt("user")).equals(shell("am get-current-user", deadline()).trim()))
            throw new SecurityException("Host lease boot or current user differs from this emulator");
        boolean installed = false;
        for (InputMethodInfo info : context.getSystemService(InputMethodManager.class).getInputMethodList()) {
            if (ServedEditorControlProvider.COMPONENT.equals(info.getId())
                && ServedEditorControlProvider.TEST_PACKAGE.equals(info.getPackageName())
                && "local.investment.personal.ServedEditorIme".equals(info.getServiceName())) installed = true;
        }
        if (!installed) throw new SecurityException("Exact test APK IME is not installed");
        previousDefault = secure(Settings.Secure.DEFAULT_INPUT_METHOD);
        previousEnabled = secure(Settings.Secure.ENABLED_INPUT_METHODS);
        previousSubtype = secure("selected_input_method_subtype");
        requireBaseline(lease, previousDefault, previousEnabled, previousSubtype);
        if (previousDefault == null || !previousDefault.matches("[A-Za-z0-9_.$]+/[A-Za-z0-9_.$]+")
            || ServedEditorControlProvider.COMPONENT.equals(previousDefault)
            || !enabled(previousEnabled, previousDefault)
            || (previousSubtype != null && !previousSubtype.matches("-?[0-9]+")))
            throw new SecurityException("Original keyboard state is not a restorable exact component and subtype");
        initiallyEnabled = enabled(previousEnabled, ServedEditorControlProvider.COMPONENT);
        if (recovery.exists()) {
            JSONObject old = readJson(recovery);
            exactKeys(old, Set.of("schema", "nonce", "serial", "bootId", "user", "component", "previousDefault",
                "previousEnabled", "previousSubtype", "initiallyEnabled", "phase"));
            for (String key : Set.of("schema", "nonce", "serial", "bootId", "user", "previousDefault", "previousEnabled", "previousSubtype"))
                if (!Objects.equals(old.get(key), lease.get(key))) throw new SecurityException("Earlier recovery belongs to another host snapshot");
            if (!ServedEditorControlProvider.COMPONENT.equals(old.getString("component"))
                || !Boolean.valueOf(initiallyEnabled).equals(old.get("initiallyEnabled")) || !"restored".equals(old.getString("phase")))
                throw new SecurityException("An earlier fixture IME session has not been restored");
        }
        // The provider also captures the original subtype object before activation.
        armed = true; // An uncertain arm response still requires retirement with this nonce.
        Bundle snapshot = new Bundle(); snapshot.putString("previousDefault", previousDefault);
        snapshot.putString("previousEnabled", previousEnabled); snapshot.putString("previousSubtype", previousSubtype);
        Bundle baseline = command("arm", snapshot, deadline());
        requireBaseline(baseline, previousDefault, previousEnabled, previousSubtype);
        verifyOriginal();
        writeRecovery("prepared"); prepared = true;
        if (!initiallyEnabled) shell("ime enable --user " + user() + " " + ServedEditorControlProvider.COMPONENT, deadline());
        shell("ime set --user " + user() + " " + ServedEditorControlProvider.COMPONENT, deadline());
        if (!ServedEditorControlProvider.COMPONENT.equals(secure(Settings.Secure.DEFAULT_INPUT_METHOD))
            || !enabled(secure(Settings.Secure.ENABLED_INPUT_METHODS), ServedEditorControlProvider.COMPONENT))
            throw new IllegalStateException("The exact test IME was not selected and enabled");
        writeRecovery("active");
    }
    Bundle command(String method, Bundle fields, long deadline) throws Exception {
        if (closed) throw new IllegalStateException("Fixture IME session is closed");
        Bundle request = new Bundle(fields); request.putString("nonce", nonce);
        request.putLong("sequence", method.equals("arm") ? 0 : ++sequence); request.putLong("deadline", deadline);
        Bundle result = bounded(() -> context.getContentResolver().call(
            Uri.parse("content://" + ServedEditorControlProvider.AUTHORITY), method, null, request), deadline);
        if (result == null) throw new IllegalStateException("Missing fixture IME command receipt");
        return result;
    }
    private <T> T bounded(Callable<T> operation, long deadline) throws Exception {
        long remaining = deadline - SystemClock.uptimeMillis();
        if (remaining <= 0 || remaining > TIMEOUT_MS) throw new IllegalStateException("Original command deadline expired");
        Future<T> future = worker.submit(() -> {
            if (SystemClock.uptimeMillis() >= deadline) throw new IllegalStateException("Cancelled before command dispatch");
            return operation.call();
        });
        try {
            T result = future.get(remaining, TimeUnit.MILLISECONDS);
            if (SystemClock.uptimeMillis() >= deadline) throw new IllegalStateException("Late command response; do not retry mutations");
            return result;
        } catch (ExecutionException failure) {
            if (failure.getCause() instanceof Exception exception) throw exception;
            throw new IllegalStateException("Fixture command failed", failure.getCause());
        } finally { future.cancel(true); }
    }
    private String shell(String command, long deadline) throws Exception {
        if (closed || SystemClock.uptimeMillis() >= deadline || deadline - SystemClock.uptimeMillis() > TIMEOUT_MS)
            throw new IllegalStateException("Retired or expired shell operation before dispatch");
        ParcelFileDescriptor descriptor = InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command);
        try (ParcelFileDescriptor.AutoCloseInputStream input = new ParcelFileDescriptor.AutoCloseInputStream(descriptor)) {
            return bounded(() -> {
                byte[] bytes = input.readNBytes(16_385);
                if (bytes.length > 16_384) throw new IllegalStateException("Oversized fixture shell receipt");
                return new String(bytes, StandardCharsets.UTF_8);
            }, deadline);
        }
    }
    @Override public void close() throws Exception {
        if (closed) return;
        Throwable failure = null;
        try {
            if (armed) {
                try { command("close", new Bundle(), deadline()); }
                catch (Throwable retirement) { failure = retirement; }
            }
            if (prepared) failure = restoreKeyboard(failure);
        } catch (Throwable cleanup) {
            if (failure == null) failure = cleanup; else failure.addSuppressed(cleanup);
        } finally {
            closed = true; if (current == this) current = null;
            try { worker.shutdownNow(); } catch (Throwable cleanup) {
                if (failure == null) failure = cleanup; else failure.addSuppressed(cleanup);
            }
        }
        if (failure != null) throw asException(failure);
    }
    private Throwable restoreKeyboard(Throwable failure) {
        // A receipt-write failure must not prevent a safe restoration attempt.
        try { writeRecovery("restoring"); } catch (Throwable cleanup) { failure = append(failure, cleanup); }
        try {
            String selected = secure(Settings.Secure.DEFAULT_INPUT_METHOD);
            if (!ServedEditorControlProvider.COMPONENT.equals(selected) && !previousDefault.equals(selected))
                throw new SecurityException("Foreign intervening keyboard selection; host recovery must inspect it");
            String enabledNow = secure(Settings.Secure.ENABLED_INPUT_METHODS);
            if (!initiallyEnabled && !Objects.equals(withoutFixture(enabledNow), previousEnabled)
                || initiallyEnabled && !Objects.equals(enabledNow, previousEnabled))
                throw new SecurityException("Foreign intervening enabled keyboard change; do not overwrite it");
            if (!previousDefault.equals(selected)) {
                try { shell("ime set --user " + user() + " " + previousDefault, deadline()); }
                catch (Throwable cleanup) { failure = append(failure, cleanup); }
            }
            // Reconcile an uncertain switch before touching subtype or disabling the fixture.
            if (!previousDefault.equals(secure(Settings.Secure.DEFAULT_INPUT_METHOD)))
                throw new IllegalStateException("Original IME is not selected; leave fixture enabled for host recovery");
            try {
                if (!Objects.equals(previousSubtype, secure("selected_input_method_subtype")))
                    shell(previousSubtype == null ? "settings --user " + user() + " delete secure selected_input_method_subtype"
                        : "settings --user " + user() + " put secure selected_input_method_subtype " + previousSubtype, deadline());
            } catch (Throwable cleanup) { failure = append(failure, cleanup); }
            try {
                if (!initiallyEnabled && enabled(secure(Settings.Secure.ENABLED_INPUT_METHODS), ServedEditorControlProvider.COMPONENT))
                    shell("ime disable --user " + user() + " " + ServedEditorControlProvider.COMPONENT, deadline());
            } catch (Throwable cleanup) { failure = append(failure, cleanup); }
            try { verifyOriginal(); } catch (Throwable cleanup) { failure = append(failure, cleanup); }
            // Failed authority retirement or uncertain restoration never gets a clean receipt.
            if (failure == null) writeRecovery("restored");
        } catch (Throwable cleanup) { failure = append(failure, cleanup); }
        return failure;
    }
    private static String withoutFixture(String raw) {
        if (raw == null) return null;
        java.util.List<String> retained = new java.util.ArrayList<>(); int matches = 0;
        for (String item : raw.split(":", -1)) {
            if (item.split(";", 2)[0].equals(ServedEditorControlProvider.COMPONENT)) matches++;
            else retained.add(item);
        }
        if (matches > 1) throw new SecurityException("Duplicate fixture IME entries");
        return String.join(":", retained);
    }
    private static Throwable append(Throwable first, Throwable next) {
        if (first == null) return next;
        if (first != next) first.addSuppressed(next); return first;
    }
    private static Exception asException(Throwable failure) {
        if (failure instanceof Error error) throw error;
        if (failure instanceof Exception exception) return exception;
        return new IllegalStateException("Fixture cleanup failed", failure);
    }
    private void verifyOriginal() throws Exception {
        if (!Objects.equals(previousDefault, secure(Settings.Secure.DEFAULT_INPUT_METHOD))
            || !Objects.equals(previousEnabled, secure(Settings.Secure.ENABLED_INPUT_METHODS))
            || !Objects.equals(previousSubtype, secure("selected_input_method_subtype")))
            throw new IllegalStateException("Original IME selection, enabled list and subtype are not exact");
    }
    private void writeRecovery(String phase) throws Exception {
        JSONObject data = new JSONObject();
        for (String key : Set.of("schema", "nonce", "serial", "bootId", "user")) data.put(key, lease.get(key));
        data.put("component", ServedEditorControlProvider.COMPONENT);
        data.put("previousDefault", previousDefault); data.put("previousEnabled", nullable(previousEnabled));
        data.put("previousSubtype", nullable(previousSubtype)); data.put("initiallyEnabled", initiallyEnabled); data.put("phase", phase);
        File pending = new File(recovery.getParentFile(), recovery.getName() + ".pending");
        ByteBuffer encoded = StandardCharsets.UTF_8.newEncoder().encode(CharBuffer.wrap(data.toString()));
        byte[] bytes = new byte[encoded.remaining()]; encoded.get(bytes);
        Files.write(pending.toPath(), bytes);
        Files.move(pending.toPath(), recovery.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
    }
    private int user() throws Exception { return lease.getInt("user"); }
    private String secure(String key) throws Exception {
        if (!Set.of(Settings.Secure.DEFAULT_INPUT_METHOD, Settings.Secure.ENABLED_INPUT_METHODS, "selected_input_method_subtype").contains(key))
            throw new SecurityException("Only the three leased IME settings may be read");
        // API34+ forbids app reads of enabled_input_methods. The owned emulator's supported
        // shell preserves exact raw values, including absence, order and subtype suffixes.
        String output = shell("settings --user " + user() + " get secure " + key, deadline());
        if (output.endsWith("\n")) output = output.substring(0, output.length() - 1);
        if (output.endsWith("\r")) output = output.substring(0, output.length() - 1);
        if (output.indexOf('\n') >= 0 || output.indexOf('\r') >= 0 || output.indexOf('\0') >= 0)
            throw new SecurityException("Malformed raw IME setting receipt");
        return output.equals("null") ? null : output;
    }
    private static long deadline() { return SystemClock.uptimeMillis() + TIMEOUT_MS; }
    private static Object nullable(String value) { return value == null ? JSONObject.NULL : value; }
    private static boolean enabled(String raw, String component) {
        if (raw == null) return false;
        for (String item : raw.split(":")) if (item.split(";", 2)[0].equals(component)) return true;
        return false;
    }
    private static JSONObject readJson(File file) throws Exception {
        if (!file.isFile() || file.length() > 16_384) throw new SecurityException("Missing or oversized host fixture receipt");
        return new JSONObject(StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(Files.readAllBytes(file.toPath()))).toString());
    }
    private static void exactKeys(JSONObject data, Set<String> expected) {
        Set<String> actual = new HashSet<>(); data.keys().forEachRemaining(actual::add);
        if (!actual.equals(expected)) throw new SecurityException("Unexpected host lease fields");
    }
    private static void requireBaseline(JSONObject data, String selected, String enabled, String subtype) throws Exception {
        if (!Objects.equals(data.getString("previousDefault"), selected)
            || !Objects.equals(data.isNull("previousEnabled") ? null : data.getString("previousEnabled"), enabled)
            || !Objects.equals(data.isNull("previousSubtype") ? null : data.getString("previousSubtype"), subtype))
            throw new SecurityException("Host snapshot differs from the original keyboard state");
    }
    private static void requireBaseline(Bundle data, String selected, String enabled, String subtype) {
        if (!Objects.equals(data.getString("previousDefault"), selected) || !Objects.equals(data.getString("previousEnabled"), enabled)
            || !Objects.equals(data.getString("previousSubtype"), subtype))
            throw new SecurityException("Provider snapshot differs from the original keyboard state");
    }
    private static String randomNonce() {
        byte[] bytes = new byte[32]; new SecureRandom().nextBytes(bytes); StringBuilder result = new StringBuilder();
        for (byte value : bytes) result.append(String.format(java.util.Locale.ROOT, "%02x", value & 255)); return result.toString();
    }
}
