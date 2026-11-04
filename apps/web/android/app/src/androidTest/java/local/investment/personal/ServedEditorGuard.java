package local.investment.personal;

import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

/** Android-free authority and one-use dispatch state for the invented IME session. */
final class ServedEditorGuard {
    static final long MAX_COMMAND_MS = 10_000;
    record Caller(int uid, int targetUid, boolean debuggable, boolean signaturesMatch, boolean exactPackages) {}
    static final class Ticket {
        final String nonce;
        final long sequence, deadline;
        final AtomicBoolean pending = new AtomicBoolean(true);
        Ticket(String nonce, long sequence, long deadline) {
            this.nonce = nonce; this.sequence = sequence; this.deadline = deadline;
        }
        void cancel() { pending.set(false); }
    }
    private enum Stage { PREPARED, SELECTED, COMMITTED }
    private final Set<String> usedNonces = new HashSet<>();
    private String nonce, original;
    private int ownerUid;
    private long lastSequence, generation, editCounter, edit;
    private boolean inputAvailable;
    private Stage stage;

    static void requireCaller(Caller caller) {
        if (caller.uid != caller.targetUid || !caller.debuggable || !caller.signaturesMatch || !caller.exactPackages)
            throw new SecurityException("Only the exact signed debug test target may control the fixture IME");
    }
    static void requireCompleteOriginal(String original, String nativeText, int offset, int partialStart,
        int nativeStart, int nativeEnd, int domStart, int domEnd) {
        if (original == null || original.length() > 16_384 || domStart < 0 || domEnd < domStart || domEnd > original.length()
            || !original.equals(nativeText) || offset != 0 || partialStart != -1
            || Math.min(nativeStart, nativeEnd) != domStart || Math.max(nativeStart, nativeEnd) != domEnd)
            throw new IllegalStateException("Complete native original and DOM selection must correspond");
    }
    private static void deadline(long deadline, long now) {
        if (deadline <= now || deadline - now > MAX_COMMAND_MS)
            throw new IllegalStateException("Original command deadline is absent, expired or extended");
    }
    synchronized void arm(Caller caller, String nextNonce, long deadline, long now) {
        requireCaller(caller); deadline(deadline, now);
        if (nonce != null || nextNonce == null || !nextNonce.matches("[a-f0-9]{64}") || usedNonces.contains(nextNonce))
            throw new SecurityException("Missing, replayed or overlapping fixture session");
        if (usedNonces.size() >= 16) throw new IllegalStateException("Fixture session limit exceeded");
        usedNonces.add(nextNonce); nonce = nextNonce; ownerUid = caller.uid; lastSequence = 0; clearEdit();
    }
    synchronized Ticket admit(Caller caller, String suppliedNonce, long sequence, long deadline, long now) {
        requireCaller(caller); deadline(deadline, now);
        if (nonce == null || !nonce.equals(suppliedNonce) || ownerUid != caller.uid || sequence <= lastSequence)
            throw new SecurityException("Foreign, retired or replayed fixture command");
        lastSequence = sequence;
        return new Ticket(nonce, sequence, deadline);
    }
    synchronized void checkSession(Ticket ticket, long now) {
        if (!ticket.pending.get() || nonce == null || !nonce.equals(ticket.nonce) || ticket.sequence != lastSequence)
            throw new IllegalStateException("Cancelled, superseded or retired fixture command");
        deadline(ticket.deadline, now);
    }
    synchronized void lifecycle(boolean available) {
        generation++; inputAvailable = available; clearEdit();
    }
    synchronized long generation() { return generation; }
    synchronized boolean hasSession() { return nonce != null; }
    synchronized boolean hasInput() { return inputAvailable; }
    synchronized void checkInput(Ticket ticket, long expectedGeneration, long now) {
        checkSession(ticket, now);
        if (!inputAvailable || expectedGeneration != generation)
            throw new IllegalStateException("Input generation is absent or stale");
    }
    synchronized long bind(Ticket ticket, long expectedGeneration, String value, long now) {
        checkInput(ticket, expectedGeneration, now);
        if (stage != null || value == null || value.length() > 16_384)
            throw new IllegalStateException("An edit is already bound or its original is invalid");
        edit = ++editCounter; original = value; stage = Stage.PREPARED; return edit;
    }
    synchronized String requireEdit(Ticket ticket, long expectedGeneration, long expectedEdit, long now) {
        checkInput(ticket, expectedGeneration, now);
        if (stage == null || edit != expectedEdit) throw new IllegalStateException("Edit token is stale");
        return original;
    }
    synchronized void claimSelect(Ticket ticket, long expectedGeneration, long expectedEdit, long now) {
        requireEdit(ticket, expectedGeneration, expectedEdit, now);
        if (stage != Stage.PREPARED) throw new IllegalStateException("Select all was already dispatched");
        stage = Stage.SELECTED;
    }
    synchronized void claimCommit(Ticket ticket, long expectedGeneration, long expectedEdit, long now) {
        requireEdit(ticket, expectedGeneration, expectedEdit, now);
        if (stage != Stage.SELECTED) throw new IllegalStateException("Commit requires one Select all and cannot replay");
        stage = Stage.COMMITTED;
    }
    synchronized void release(Ticket ticket, long expectedEdit, long now) {
        checkSession(ticket, now);
        if (expectedEdit <= 0 || expectedEdit > editCounter) throw new IllegalStateException("Unknown edit token");
        if (edit == expectedEdit) clearEdit();
    }
    synchronized void close(Ticket ticket, long now) {
        checkSession(ticket, now); nonce = null; clearEdit();
    }
    private void clearEdit() { original = null; edit = 0; stage = null; }
}
