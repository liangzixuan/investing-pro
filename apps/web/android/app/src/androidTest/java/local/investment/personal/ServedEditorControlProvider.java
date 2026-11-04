package local.investment.personal;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Binder;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.inputmethod.ExtractedText;
import android.view.inputmethod.ExtractedTextRequest;
import android.view.inputmethod.InputConnection;
import android.view.inputmethod.InputMethodInfo;
import android.view.inputmethod.InputMethodManager;
import android.view.inputmethod.InputMethodSubtype;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.atomic.AtomicLong;

/** Authenticated test-process IPC. No production component or general command endpoint. */
public final class ServedEditorControlProvider extends ContentProvider {
    static final String TARGET = "local.investment.personal";
    static final String TEST_PACKAGE = TARGET + ".test";
    static final String AUTHORITY = TEST_PACKAGE + ".served-editor-control";
    static final String COMPONENT = TEST_PACKAGE + "/local.investment.personal.ServedEditorIme";
    static final ServedEditorGuard GUARD = new ServedEditorGuard();
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private String previousDefault, previousEnabled, previousSubtype;
    private InputMethodSubtype previousSubtypeObject;
    private ServedEditorIme editService;
    private InputConnection editConnection;
    private long editIdentity;

    @Override public boolean onCreate() { return true; }

    private ServedEditorGuard.Caller caller() {
        try {
            PackageManager pm = getContext().getPackageManager();
            ApplicationInfo target = pm.getApplicationInfo(TARGET, 0);
            int uid = Binder.getCallingUid(); String[] packages = pm.getPackagesForUid(uid);
            ServedEditorGuard.Caller caller = new ServedEditorGuard.Caller(uid, target.uid,
                (target.flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0,
                pm.checkSignatures(TARGET, TEST_PACKAGE) == PackageManager.SIGNATURE_MATCH,
                TEST_PACKAGE.equals(getContext().getPackageName()) && packages != null && packages.length == 1 && TARGET.equals(packages[0]));
            ServedEditorGuard.requireCaller(caller);
            if (Build.VERSION.SDK_INT != 36 || !("ranchu".equals(Build.HARDWARE) || "goldfish".equals(Build.HARDWARE)))
                throw new SecurityException("Fixture IME is restricted to the owned API36 emulator");
            return caller;
        } catch (PackageManager.NameNotFoundException missing) { throw new SecurityException("Missing exact test packages"); }
    }
    @Override public Bundle call(String method, String arg, Bundle supplied) {
        ServedEditorGuard.Caller caller = caller(); // Authenticate the original Binder caller before posting.
        if (Looper.myLooper() == Looper.getMainLooper()) throw new IllegalStateException("Provider waits only on its Binder worker");
        if (arg != null || supplied == null) throw new SecurityException("Exact command bundle required");
        Bundle data = new Bundle(supplied);
        Set<String> keys = new HashSet<>(Set.of("nonce", "sequence", "deadline"));
        switch (method) {
            case "arm" -> keys.addAll(Set.of("previousDefault", "previousEnabled", "previousSubtype"));
            case "observe", "close" -> {}
            case "bind" -> keys.addAll(Set.of("generation", "original", "start", "end"));
            case "select", "commit", "observe-edit" -> {
                keys.addAll(Set.of("generation", "edit", "original", "start", "end"));
                if (method.equals("commit")) keys.add("value");
            }
            case "release" -> keys.add("edit");
            default -> throw new SecurityException("Unknown fixture IME command");
        }
        if (!data.keySet().equals(keys)) throw new SecurityException("Unexpected command fields");
        String nonce = string(data, "nonce"); long sequence = number(data, "sequence"), deadline = number(data, "deadline");
        boolean arm = method.equals("arm");
        if (arm && sequence != 0) throw new SecurityException("Arm sequence must be zero");
        ServedEditorGuard.Ticket ticket = arm ? null : GUARD.admit(caller, nonce, sequence, deadline, SystemClock.uptimeMillis());
        CompletableFuture<Bundle> result = new CompletableFuture<>(); AtomicBoolean pending = new AtomicBoolean(true);
        AtomicReference<Runnable> barrier = new AtomicReference<>();
        AtomicLong requestEdit = new AtomicLong(Set.of("select","commit","observe-edit").contains(method)?number(data,"edit"):0); boolean responseAccepted=false;
        Runnable work = () -> {
            try {
                requirePending(pending, deadline);
                if (arm) {
                    if (GUARD.hasSession()) throw new SecurityException("An IME session is already armed");
                    String selected = selectedIme();
                    String suppliedDefault = string(data, "previousDefault");
                    String suppliedEnabled = nullableString(data, "previousEnabled");
                    String suppliedSubtype = nullableString(data, "previousSubtype");
                    if (selected == null || COMPONENT.equals(selected) || !selected.equals(suppliedDefault))
                        throw new SecurityException("Original IME must match the authenticated shell snapshot");
                    requireEnabledSnapshot(suppliedEnabled, selected);
                    if (suppliedSubtype != null && !suppliedSubtype.matches("-?[0-9]+"))
                        throw new SecurityException("Invalid original subtype snapshot");
                    previousDefault = selected; previousEnabled = suppliedEnabled; previousSubtype = suppliedSubtype;
                    previousSubtypeObject = getContext().getSystemService(InputMethodManager.class).getCurrentInputMethodSubtype();
                    GUARD.arm(caller, nonce, deadline, SystemClock.uptimeMillis());
                    result.complete(baseline()); return;
                }
                GUARD.checkSession(ticket, SystemClock.uptimeMillis());
                if (method.equals("close")) {
                    String selected = selectedIme();
                    GUARD.close(ticket, SystemClock.uptimeMillis()); // Retire editing authority before restoring the keyboard.
                    clearPreparedConnection();
                    if (!COMPONENT.equals(selected) && !previousDefault.equals(selected))
                        throw new SecurityException("Another IME was selected during the fixture session");
                    ServedEditorIme service = ServedEditorIme.current;
                    if (COMPONENT.equals(selected) && service != null) {
                        if (previousSubtypeObject == null) service.switchInputMethod(previousDefault);
                        else service.switchInputMethod(previousDefault, previousSubtypeObject);
                    }
                    result.complete(baseline()); return;
                }
                if (method.equals("release")) {
                    long released=number(data,"edit");GUARD.release(ticket,released,SystemClock.uptimeMillis());
                    if(released==editIdentity)clearPreparedConnection();result.complete(new Bundle());return;
                }
                long generation = method.equals("observe") ? GUARD.generation() : number(data, "generation");
                ServedEditorIme service = ServedEditorIme.current;
                if (method.equals("observe") && (service == null || !GUARD.hasInput() || !service.servesTarget())) {
                    Bundle unavailable = new Bundle(); unavailable.putBoolean("ready", false); unavailable.putLong("generation", generation);
                    result.complete(unavailable); return;
                }
                GUARD.checkInput(ticket, generation, SystemClock.uptimeMillis());
                if (service == null) throw new IllegalStateException("Framework IME service is absent");
                InputConnection connection = service.servedConnection();
                Bundle snapshot = snapshot(connection, generation);
                requirePending(pending, deadline); GUARD.checkInput(ticket, generation, SystemClock.uptimeMillis());
                if (ServedEditorIme.current != service || service.servedConnection() != connection)
                    throw new IllegalStateException("Framework replaced the served connection");
                if (!method.equals("observe")) {
                    applyEditCommand(method,data,ticket,generation,service,connection,snapshot,pending,deadline);
                    if(method.equals("bind"))requestEdit.set(snapshot.getLong("edit"));
                }
                // Let already queued lifecycle callbacks run before accepting this observation/result.
                Runnable accept = () -> {
                    try {
                        requirePending(pending, deadline); GUARD.checkInput(ticket, generation, SystemClock.uptimeMillis());
                        if (ServedEditorIme.current != service || service.servedConnection() != connection)
                            throw new IllegalStateException("Served generation changed before result acceptance");
                        result.complete(snapshot);
                    } catch (RuntimeException failure) { retirePreparedConnection(requestEdit.get());result.completeExceptionally(failure); }
                };
                barrier.set(accept);
                if (!MAIN.post(accept)) throw new IllegalStateException("IME main handler refused the lifecycle barrier");
            } catch (RuntimeException failure) { retirePreparedConnection(requestEdit.get());result.completeExceptionally(failure); }
        };
        try {
            requirePending(pending, deadline);
            if (!MAIN.post(work)) throw new IllegalStateException("IME main handler refused the bounded command");
            Bundle response=result.get(Math.max(1,deadline-SystemClock.uptimeMillis()),TimeUnit.MILLISECONDS);
            requirePending(pending,deadline);responseAccepted=true;return response;
        } catch (ExecutionException failure) {
            if (failure.getCause() instanceof RuntimeException runtime) throw runtime;
            throw new IllegalStateException("Fixture IME command failed", failure);
        } catch (Exception failure) {
            throw new IllegalStateException("Fixture IME command expired or was interrupted; no automatic mutation retry", failure);
        } finally {
            pending.set(false); if (ticket != null) ticket.cancel(); MAIN.removeCallbacks(work); result.cancel(false);
            if (barrier.get() != null) MAIN.removeCallbacks(barrier.get());
            long failedEdit=requestEdit.get();
            if(!responseAccepted&&failedEdit>0)MAIN.post(()->retirePreparedConnection(failedEdit));
        }
    }
    private void applyEditCommand(String method,Bundle data,ServedEditorGuard.Ticket ticket,long generation,
        ServedEditorIme service,InputConnection connection,Bundle snapshot,AtomicBoolean pending,long deadline) {
        long owned=method.equals("bind")?0:number(data,"edit");
        try{applyPreparedEditCommand(method,data,ticket,generation,service,connection,snapshot,pending,deadline);}
        catch(RuntimeException|Error failure){retirePreparedConnection(owned);throw failure;}
    }
    private void applyPreparedEditCommand(String method,Bundle data,ServedEditorGuard.Ticket ticket,long generation,
        ServedEditorIme service,InputConnection connection,Bundle snapshot,AtomicBoolean pending,long deadline) {
        String original=string(data,"original");int start=integer(data,"start"),end=integer(data,"end");
        if(original.length()>16_384||start<0||end<start||end>original.length())
            throw new IllegalStateException("Invalid complete original DOM range");
        if(method.equals("bind")) {
            long edit=GUARD.bind(ticket,generation,original,SystemClock.uptimeMillis());
            editService=service;editConnection=connection;editIdentity=edit;snapshot.putLong("edit",edit);return;
        }
        long edit=number(data,"edit");
        if(!original.equals(GUARD.requireEdit(ticket,generation,edit,SystemClock.uptimeMillis())))
            throw new IllegalStateException("Original DOM text changed since ownership preparation");
        if(edit!=editIdentity||service!=editService||connection!=editConnection)
            throw new IllegalStateException("Prepared framework service or connection changed");
        if(method.equals("observe-edit"))return;
        boolean dispatched;
        if(method.equals("select")) {
            requirePending(pending,deadline);GUARD.claimSelect(ticket,generation,edit,SystemClock.uptimeMillis());
            dispatched=connection.performContextMenuAction(android.R.id.selectAll);
        }else if(method.equals("commit")) {
            requireCompleteOriginal(snapshot,original,start,end);
            if(start!=0||end!=original.length())throw new IllegalStateException("Full native and DOM selection required");
            String value=string(data,"value");
            if(value.length()>16_384)throw new IllegalStateException("Fixture replacement exceeds the bounded input");
            requirePending(pending,deadline);GUARD.claimCommit(ticket,generation,edit,SystemClock.uptimeMillis());
            dispatched=connection.commitText(value,1);
        }else throw new SecurityException("Unknown prepared edit command");
        Log.i("ServedEditorIme","command="+method+",generation="+generation+",edit="+edit+",dispatched="+dispatched);
        if(!dispatched)throw new IllegalStateException("Framework refused the one native dispatch; do not retry");
    }
    private void retirePreparedConnection(long edit) {if(edit>0&&edit==editIdentity)clearPreparedConnection();}
    private void clearPreparedConnection() {editService=null;editConnection=null;editIdentity=0;}
    private Bundle snapshot(InputConnection connection, long generation) {
        ExtractedTextRequest request = new ExtractedTextRequest(); request.hintMaxChars = 16_384;
        ExtractedText text = connection.getExtractedText(request, 0); Bundle result = new Bundle();
        if (text != null && text.text != null && text.text.length() > 16_384)
            throw new IllegalStateException("Framework returned an oversized complete editor; no truncation permitted");
        result.putBoolean("ready", true); result.putLong("generation", generation);
        result.putString("text", text == null || text.text == null ? null : text.text.toString());
        result.putInt("offset", text == null ? -1 : text.startOffset); result.putInt("partialStart", text == null ? -1 : text.partialStartOffset);
        result.putInt("start", text == null ? -1 : text.selectionStart); result.putInt("end", text == null ? -1 : text.selectionEnd);
        Log.i("ServedEditorIme", "observation,generation=" + generation + ",connectionIdentity=" + System.identityHashCode(connection)
            + ",length=" + (result.getString("text") == null ? -1 : result.getString("text").length())
            + ",offset=" + result.getInt("offset") + ",partialStart=" + result.getInt("partialStart")
            + ",selection=" + result.getInt("start") + ":" + result.getInt("end"));
        return result;
    }
    private static void requireCompleteOriginal(Bundle snapshot, String original, int start, int end) {
        ServedEditorGuard.requireCompleteOriginal(original, snapshot.getString("text"), snapshot.getInt("offset"),
            snapshot.getInt("partialStart"), snapshot.getInt("start"), snapshot.getInt("end"), start, end);
    }
    private Bundle baseline() {
        Bundle result = new Bundle(); result.putString("previousDefault", previousDefault);
        result.putString("previousEnabled", previousEnabled); result.putString("previousSubtype", previousSubtype); return result;
    }
    private String selectedIme() {
        InputMethodInfo info = getContext().getSystemService(InputMethodManager.class).getCurrentInputMethodInfo();
        return info == null ? null : info.getId();
    }
    private void requireEnabledSnapshot(String raw, String selected) {
        if (raw == null || raw.length() > 16_384) throw new SecurityException("Missing original enabled IME snapshot");
        Set<String> expected = new HashSet<>();
        for (String row : raw.split(":", -1)) {
            String[] values = row.split(";", -1);
            if (!values[0].matches("[A-Za-z0-9_.$]+/[A-Za-z0-9_.$]+") || !expected.add(values[0]))
                throw new SecurityException("Invalid or duplicated enabled IME snapshot");
            for (int index = 1; index < values.length; index++)
                if (!values[index].matches("-?[0-9]+")) throw new SecurityException("Invalid enabled subtype snapshot");
        }
        Set<String> actual = new HashSet<>();
        for (InputMethodInfo info : getContext().getSystemService(InputMethodManager.class).getEnabledInputMethodList())
            if (!actual.add(info.getId())) throw new SecurityException("Duplicated framework IME identity");
        if (!expected.contains(selected) || !expected.equals(actual))
            throw new SecurityException("Public framework IME identities differ from the exact shell snapshot");
    }
    private static void requirePending(AtomicBoolean pending, long deadline) {
        long now = SystemClock.uptimeMillis();
        if (!pending.get() || now >= deadline || deadline - now > ServedEditorGuard.MAX_COMMAND_MS)
            throw new IllegalStateException("Cancelled or expired IME command");
    }
    private static String nullableString(Bundle data, String key) {
        Object value = data.get(key);
        if (value != null && !(value instanceof String)) throw new SecurityException("Invalid nullable string field " + key);
        return (String) value;
    }
    private static String string(Bundle data, String key) {
        Object value = data.get(key); if (!(value instanceof String text)) throw new SecurityException("Invalid string field " + key); return text;
    }
    private static long number(Bundle data, String key) {
        Object value = data.get(key); if (!(value instanceof Long number)) throw new SecurityException("Invalid long field " + key); return number;
    }
    private static int integer(Bundle data, String key) {
        Object value = data.get(key); if (!(value instanceof Integer number)) throw new SecurityException("Invalid integer field " + key); return number;
    }
    @Override public Cursor query(Uri u, String[] p, String s, String[] a, String o) { throw new UnsupportedOperationException(); }
    @Override public String getType(Uri u) { throw new UnsupportedOperationException(); }
    @Override public Uri insert(Uri u, ContentValues v) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri u, String s, String[] a) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri u, ContentValues v, String s, String[] a) { throw new UnsupportedOperationException(); }
}
