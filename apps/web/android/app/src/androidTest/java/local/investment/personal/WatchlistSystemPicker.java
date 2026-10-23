package local.investment.personal;

import static org.junit.Assert.*;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.UiAutomation;
import android.graphics.Rect;
import android.os.SystemClock;
import android.util.Log;
import android.view.Display;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.AccessibilityNodeInfoExt;
import androidx.test.uiautomator.StableResult;
import androidx.test.uiautomator.UiDevice;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Predicate;

/** Uses the actual external DocumentsUI accessibility surface, not an Activity-result mock. */
final class WatchlistSystemPicker {
    private static final long TIMEOUT_MS = 10_000;
    private final UiDevice device;
    private final UiAutomation automation;

    WatchlistSystemPicker() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        automation = InstrumentationRegistry.getInstrumentation().getUiAutomation();
        AccessibilityServiceInfo info = automation.getServiceInfo();
        info.flags |= AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
            | AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
        automation.setServiceInfo(info);
    }

    void awaitOpen() throws Exception {
        await(node -> node.getViewIdResourceName() != null
            && node.getViewIdResourceName().endsWith(":id/container_save"));
    }

    void cancel() throws Exception {
        long deadline = SystemClock.uptimeMillis() + TIMEOUT_MS;
        CancelSurface initial = awaitCancelSurface(deadline, -1);
        if (initial.imeId >= 0) {
            dispatchCancelBack(initial, deadline, "ime-dismiss");
            awaitImeDismissed(initial, deadline);
        }
        CancelSurface current = awaitCancelSurface(deadline, initial.pickerId);
        assertEquals("A late keyboard must not consume picker cancellation", -1, current.imeId);
        dispatchCancelBack(current, deadline, "picker-cancel");
        awaitReturnToApp(deadline);
    }

    private static final class CancelSurface {
        final int pickerId;
        final int imeId;

        CancelSurface(int pickerId, int imeId) {
            this.pickerId = pickerId;
            this.imeId = imeId;
        }
    }

    private CancelSurface awaitCancelSurface(long deadline, int expectedPickerId) throws InterruptedException {
        while (SystemClock.uptimeMillis() < deadline) {
            CancelSurface surface = stableCancelSurface(deadline, expectedPickerId);
            if (surface != null) return surface;
            pauseUntil(deadline);
        }
        throw new AssertionError("The exact system Save picker did not become unambiguous before Cancel");
    }

    private CancelSurface stableCancelSurface(long deadline, int expectedPickerId) {
        AccessibilityNodeInfo root = automation.getRootInActiveWindow();
        CancelSurface before = readCancelSurface(root, expectedPickerId);
        if (before == null) return null;
        long remaining = deadline - SystemClock.uptimeMillis();
        if (remaining <= 0) return null;
        StableResult stable = AccessibilityNodeInfoExt.waitForStable(root, remaining, 500, 50, false);
        if (stable.isTimeout()) return null;
        AccessibilityNodeInfo current = automation.getRootInActiveWindow();
        CancelSurface after = readCancelSurface(current, before.pickerId);
        if (!root.equals(current)) return null;
        return after;
    }

    private CancelSurface readCancelSurface(int expectedPickerId) {
        return readCancelSurface(automation.getRootInActiveWindow(), expectedPickerId);
    }

    private CancelSurface readCancelSurface(AccessibilityNodeInfo root, int expectedPickerId) {
        if (!readyCancelRoot(root, expectedPickerId)) return null;
        AccessibilityWindowInfo window = root.getWindow();
        if (!isCancelPickerWindow(window)) return null;
        if (expectedPickerId >= 0)
            assertEquals("Cancel must not move to a different picker window", expectedPickerId, window.getId());
        if (!isCancelSurfaceReady(root, window)) return null;
        int imeId = observeCancelIme(window);
        if (imeId == -2) return null;
        return new CancelSurface(window.getId(), imeId);
    }

    private static boolean readyCancelRoot(AccessibilityNodeInfo root, int expectedPickerId) {
        if (root == null) return false;
        if (!root.refresh()) return false;
        if (!root.isVisibleToUser()) return false;
        if (string(root.getPackageName()).endsWith(".documentsui")) return true;
        if (expectedPickerId < 0) return false;
        throw new AssertionError("Cancel must remain in the observed DocumentsUI window");
    }

    private static boolean isCancelPickerWindow(AccessibilityWindowInfo window) {
        if (window == null) return false;
        if (window.getType() != AccessibilityWindowInfo.TYPE_APPLICATION) return false;
        if (window.getDisplayId() != Display.DEFAULT_DISPLAY) return false;
        if (!window.isActive()) return false;
        return window.isFocused();
    }

    private static boolean isCancelSurfaceReady(AccessibilityNodeInfo root, AccessibilityWindowInfo window) {
        if (root.getWindowId() != window.getId()) return false;
        AccessibilityNodeInfo save = find(root, node -> node.isVisibleToUser()
            && string(node.getViewIdResourceName()).endsWith(":id/container_save"), 0);
        if (save == null) return false;
        if (find(root, WatchlistSystemPicker::isRootsList, 0) != null) return false;
        return find(root, WatchlistSystemPicker::isCancelModal, 0) == null;
    }

    private static boolean isCancelModal(AccessibilityNodeInfo node) {
        if (!node.isVisibleToUser()) return false;
        return java.util.Set.of("android:id/parentPanel", "android:id/alertTitle")
            .contains(string(node.getViewIdResourceName()));
    }

    /** -1 means observed absent; -2 means incomplete or conflicting window evidence. */
    private int observeCancelIme(AccessibilityWindowInfo picker) {
        List<AccessibilityWindowInfo> windows = automation.getWindows();
        if (windows == null) return -2;
        if (!isCancelWindowRoster(windows, picker)) return -2;
        return visibleCancelImeId(windows);
    }

    private static boolean isCancelWindowRoster(List<AccessibilityWindowInfo> windows, AccessibilityWindowInfo picker) {
        int pickerCount = 0;
        for (AccessibilityWindowInfo window : windows) {
            if (window == null) return false;
            if (window.getDisplayId() != Display.DEFAULT_DISPLAY) continue;
            if (window.getId() == picker.getId()) {
                if (!isCancelPickerWindow(window)) return false;
                pickerCount++;
            } else if (window.getType() != AccessibilityWindowInfo.TYPE_INPUT_METHOD) {
                if (conflictsWithCancelPicker(window, picker)) return false;
            }
        }
        return pickerCount == 1;
    }

    private static int visibleCancelImeId(List<AccessibilityWindowInfo> windows) {
        int imeId = -1;
        for (AccessibilityWindowInfo window : windows) {
            if (window.getDisplayId() != Display.DEFAULT_DISPLAY) continue;
            if (window.getType() != AccessibilityWindowInfo.TYPE_INPUT_METHOD) continue;
            int visibleId = visibleCancelIme(window);
            if (visibleId == -2) return -2;
            if (visibleId == -1) continue;
            if (imeId >= 0) return -2;
            imeId = visibleId;
        }
        return imeId;
    }

    private static int visibleCancelIme(AccessibilityWindowInfo window) {
        AccessibilityNodeInfo root = window.getRoot();
        if (root == null) return -2;
        if (!root.refresh() || root.getWindowId() != window.getId()) return -2;
        if (!root.isVisibleToUser()) return -1;
        Rect bounds = new Rect();
        window.getBoundsInScreen(bounds);
        if (bounds.isEmpty()) return -2;
        return window.getId();
    }

    private static boolean conflictsWithCancelPicker(AccessibilityWindowInfo window, AccessibilityWindowInfo picker) {
        if (window.isActive()) return true;
        if (window.isFocused()) return true;
        if (window.getType() != AccessibilityWindowInfo.TYPE_APPLICATION) return false;
        if (window.getLayer() <= picker.getLayer()) return false;
        AccessibilityNodeInfo root = window.getRoot();
        if (root == null || !root.refresh()) return true;
        return root.isVisibleToUser();
    }

    private void awaitImeDismissed(CancelSurface initial, long deadline) throws InterruptedException {
        while (SystemClock.uptimeMillis() < deadline) {
            CancelSurface current = readCancelSurface(initial.pickerId);
            if (current != null) {
                if (current.imeId == -1) return;
                assertEquals("IME dismissal must not select another keyboard window", initial.imeId, current.imeId);
            }
            pauseUntil(deadline);
        }
        throw new AssertionError("The observed keyboard did not dismiss within the shared picker Cancel deadline");
    }

    private void dispatchCancelBack(CancelSurface surface, long deadline, String phase) {
        assertTrue("Picker Cancel must stay within its original deadline", SystemClock.uptimeMillis() < deadline);
        Log.i("WatchlistSystemPicker", "Cancel phase=" + phase + " picker=" + surface.pickerId
            + " ime=" + surface.imeId + " uptime=" + SystemClock.uptimeMillis());
        assertTrue("System picker " + phase + " Back must dispatch", automation.performGlobalAction(
            android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK));
    }

    private static void pauseUntil(long deadline) throws InterruptedException {
        long remaining = deadline - SystemClock.uptimeMillis();
        if (remaining > 0) Thread.sleep(Math.min(50, remaining));
    }

    void saveToInventedRoot() throws Exception {
        awaitOpen();
        // Do not navigate while DocumentsUI is still restoring its initial stack.
        // New folder is enabled only after a writable current directory exists.
        // An open roots drawer alone does not establish that initial readiness.
        await(WatchlistSystemPicker::readyCurrentSaveDirectory);
        // The emulator uses the platform English locale. Resolve every node afresh.
        AccessibilityNodeInfo navigation = await(node -> isRootsList(node)
            || "Show roots".contentEquals(string(node.getContentDescription())));
        if (!isRootsList(navigation)) click(navigation);
        clickInventedRoot();
        AccessibilityNodeInfo save = await(WatchlistSystemPicker::saveInInventedDirectory);
        assertTrue("Unexpected native Save control", "Save".equalsIgnoreCase(string(save.getText())));
        click(save);
        awaitReturnToApp();
    }

    /** The CREATE picker exposes this action only after a writable current directory exists. */
    private static boolean readySaveDirectory(AccessibilityNodeInfo toolbar) {
        if (!readyCurrentSaveDirectory(toolbar)) return false;
        return find(toolbar, node -> node.isVisibleToUser()
            && SavedWatchlistTestDocumentsProvider.TITLE.contentEquals(string(node.getText())), 0) != null;
    }

    private static boolean readyCurrentSaveDirectory(AccessibilityNodeInfo toolbar) {
        if (!toolbar.isVisibleToUser()) return false;
        if (!string(toolbar.getViewIdResourceName()).endsWith(":id/toolbar")) return false;
        AccessibilityWindowInfo window = toolbar.getWindow();
        if (window == null) return false;
        if (window.getType() != AccessibilityWindowInfo.TYPE_APPLICATION) return false;
        if (!window.isActive() || !window.isFocused()) return false;
        if (window.getDisplayId() != Display.DEFAULT_DISPLAY) return false;
        AccessibilityNodeInfo title = find(toolbar, node -> node.isVisibleToUser()
            && !string(node.getText()).isEmpty(), 0);
        return title != null && find(toolbar, WatchlistSystemPicker::isDirectoryCreateAction, 0) != null;
    }

    /** The destination and Save must belong to the same fresh hierarchy, not separate observations. */
    private static boolean saveInInventedDirectory(AccessibilityNodeInfo save) {
        if (!"android:id/button1".equals(save.getViewIdResourceName())
            || !save.refresh() || !save.isVisibleToUser() || !save.isEnabled()
            || !hasAncestor(save, ":id/container_save")) return false;
        AccessibilityNodeInfo root = save;
        for (int depth = 0; depth < 48; depth++) {
            AccessibilityNodeInfo parent = root.getParent();
            if (parent == null) {
                if (!root.refresh() || !root.isVisibleToUser()
                    || !string(root.getPackageName()).endsWith(".documentsui")) return false;
                AccessibilityNodeInfo toolbar = find(root, WatchlistSystemPicker::readySaveDirectory, 0);
                return toolbar != null && toolbar.getWindowId() == save.getWindowId()
                    && root.getWindowId() == save.getWindowId();
            }
            root = parent;
        }
        throw new AssertionError("Unexpected system picker hierarchy depth before Save");
    }

    private static boolean isDirectoryCreateAction(AccessibilityNodeInfo node) {
        if (!node.isVisibleToUser() || !node.isEnabled()) return false;
        return string(node.getViewIdResourceName()).endsWith(":id/option_menu_create_dir");
    }

    /** OPEN uses the same real provider root, with one exact observed document label. */
    void openInventedDocument(String displayName) throws Exception {
        openInventedDocument(displayName, "watchlist-draft");
    }

    void openInventedDocument(String displayName, String family) throws Exception {
        assertTrue("Only existing invented draft file families can be selected",
            family.equals("watchlist-draft") || family.equals("valuation-inputs-draft") || family.equals("financial-screen-recipe"));
        assertTrue("Only an exact invented draft document can be selected",
            displayName.matches("Investment-" + family + "-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}-[0-9]{3}Z\\.json"));
        AccessibilityNodeInfo navigation = await(node -> isRootsList(node)
            || "Show roots".contentEquals(string(node.getContentDescription())));
        if (!isRootsList(navigation)) click(navigation);
        clickInventedRoot();
        await(node -> string(node.getViewIdResourceName()).endsWith(":id/toolbar")
            && find(node, child -> SavedWatchlistTestDocumentsProvider.TITLE.contentEquals(string(child.getText())), 0) != null);
        AccessibilityNodeInfo document = await(node -> displayName.equals(string(node.getText()))
            && !hasAncestor(node, ":id/roots_list"));
        click(document);
        awaitReturnToApp();
    }

    /** Reacquire after drawer events settle; a rejected action is never retried. */
    private void clickInventedRoot() throws Exception {
        long deadline = SystemClock.uptimeMillis() + TIMEOUT_MS;
        while (SystemClock.uptimeMillis() < deadline) {
            long remaining = deadline - SystemClock.uptimeMillis();
            if (remaining <= 0) break;
            automation.waitForIdle(50, remaining);
            Rect target = stableInventedRoot(deadline);
            if (target != null && SystemClock.uptimeMillis() < deadline) {
                boolean dispatched = device.click(target.centerX(), target.centerY());
                Log.i("WatchlistSystemPicker", "Invented-root touch dispatched=" + dispatched
                    + " uptime=" + SystemClock.uptimeMillis());
                assertTrue("System root touch must dispatch after invented-root readiness", dispatched);
                return;
            }
            remaining = deadline - SystemClock.uptimeMillis();
            if (remaining > 0) Thread.sleep(Math.min(50, remaining));
        }
        throw new AssertionError("Invented root did not become stable and actionable in the active system picker");
    }

    private Rect stableInventedRoot(long deadline) {
        AccessibilityNodeInfo root = automation.getRootInActiveWindow();
        Rect before = readyInventedRoot(root);
        long remaining = deadline - SystemClock.uptimeMillis();
        if (before == null || remaining <= 0) return null;
        // Accessibility idle can precede a roots refresh or drawer layout.
        // Observe the whole hierarchy; do not capture an image or dispatch yet.
        StableResult stable = AccessibilityNodeInfoExt.waitForStable(root, remaining, 500, 50, false);
        if (stable.isTimeout()) return null;
        AccessibilityNodeInfo current = automation.getRootInActiveWindow();
        Rect target = readyInventedRoot(current);
        if (target == null || !root.equals(current) || root.getWindowId() != current.getWindowId()
            || !before.equals(target) || SystemClock.uptimeMillis() >= deadline) return null;
        Log.i("WatchlistSystemPicker", "Invented-root hierarchy stable; touch window="
            + current.getWindowId() + " bounds=" + target.toShortString()
            + " uptime=" + SystemClock.uptimeMillis());
        return target;
    }

    private Rect readyInventedRoot(AccessibilityNodeInfo root) {
        Rect displayBounds = new Rect(0, 0, device.getDisplayWidth(), device.getDisplayHeight());
        if (root == null || !root.refresh() || !root.isVisibleToUser()
            || !string(root.getPackageName()).endsWith(".documentsui")) return null;
        AccessibilityWindowInfo window = root.getWindow();
        if (window == null || window.getType() != AccessibilityWindowInfo.TYPE_APPLICATION
            || !window.isActive() || !window.isFocused()
            || window.getDisplayId() != Display.DEFAULT_DISPLAY) return null;
        List<AccessibilityNodeInfo> labels = new ArrayList<>();
        collectRootLabels(root, labels, 0);
        if (labels.size() > 1) throw new AssertionError("Invented root label is ambiguous");
        if (labels.isEmpty()) return null;
        AccessibilityNodeInfo label = labels.get(0);
        if (!label.refresh() || !isInventedRootLabel(label)) return null;
        AccessibilityNodeInfo target = label;
        while (target != null && !isRootsList(target) && !target.isClickable()) target = target.getParent();
        if (target == null || isRootsList(target) || !target.refresh() || !target.isVisibleToUser()
            || !target.isEnabled() || !target.isClickable()
            || target.getWindowId() != root.getWindowId()
            || !string(root.getPackageName()).equals(string(target.getPackageName()))
            || !hasAncestor(target, ":id/roots_list")
            || !target.getActionList().contains(AccessibilityNodeInfo.AccessibilityAction.ACTION_CLICK)) return null;
        Rect bounds = clippedLabelBounds(label, window, displayBounds);
        if (bounds != null) Log.i("WatchlistSystemPicker", "Invented-root touch ready window="
            + root.getWindowId() + " bounds=" + bounds.toShortString()
            + " selected=" + target.isSelected()
            + " uptime=" + SystemClock.uptimeMillis());
        return bounds;
    }

    private static boolean isInventedRootLabel(AccessibilityNodeInfo node) {
        return node.isVisibleToUser()
            && SavedWatchlistTestDocumentsProvider.TITLE.contentEquals(string(node.getText()))
            && hasAncestor(node, ":id/roots_list");
    }

    private static void collectRootLabels(AccessibilityNodeInfo node,
        List<AccessibilityNodeInfo> labels, int depth) {
        if (depth > 48) throw new AssertionError("Unexpected system picker hierarchy depth");
        if (isInventedRootLabel(node)) labels.add(node);
        for (int index = 0; index < node.getChildCount() && labels.size() < 2; index++) {
            AccessibilityNodeInfo child = node.getChild(index);
            if (child != null) collectRootLabels(child, labels, depth + 1);
        }
    }

    /** Clip the exact label through its current ancestors, window and default display. */
    private static Rect clippedLabelBounds(AccessibilityNodeInfo label,
        AccessibilityWindowInfo window, Rect displayBounds) {
        Rect bounds = new Rect(displayBounds);
        Rect clip = new Rect();
        window.getBoundsInScreen(clip);
        if (!bounds.intersect(clip)) return null;
        AccessibilityNodeInfo node = label;
        for (int depth = 0; node != null && depth < 48; depth++, node = node.getParent()) {
            if (!node.refresh() || !node.isVisibleToUser()) return null;
            node.getBoundsInScreen(clip);
            if (!bounds.intersect(clip)) return null;
        }
        return node == null && !bounds.isEmpty() ? bounds : null;
    }

    /** A dispatched picker action does not mean its destination or Activity result is ready. */
    private void awaitReturnToApp() throws InterruptedException {
        awaitReturnToApp(SystemClock.uptimeMillis() + TIMEOUT_MS);
    }

    private void awaitReturnToApp(long deadline) throws InterruptedException {
        while (SystemClock.uptimeMillis() < deadline) {
            AccessibilityNodeInfo root = automation.getRootInActiveWindow();
            if (root != null && "local.investment.personal".contentEquals(string(root.getPackageName()))
                && root.isVisibleToUser()) {
                AccessibilityWindowInfo window = root.getWindow();
                if (window != null && window.getType() == AccessibilityWindowInfo.TYPE_APPLICATION
                    && window.isActive() && window.isFocused()) return;
            }
            pauseUntil(deadline);
        }
        throw new AssertionError("The target app did not regain the active focused window after the system picker");
    }

    private AccessibilityNodeInfo await(Predicate<AccessibilityNodeInfo> predicate) throws Exception {
        long deadline = SystemClock.uptimeMillis() + TIMEOUT_MS;
        do {
            AccessibilityNodeInfo root = automation.getRootInActiveWindow();
            if (root != null && string(root.getPackageName()).endsWith(".documentsui")) {
                AccessibilityNodeInfo result = find(root, predicate, 0);
                if (result != null && result.isVisibleToUser()) return result;
            }
            Thread.sleep(50);
        } while (SystemClock.uptimeMillis() < deadline);
        throw new AssertionError("Expected control not found in the actual DocumentsUI window");
    }

    private static AccessibilityNodeInfo find(AccessibilityNodeInfo node,
        Predicate<AccessibilityNodeInfo> predicate, int depth) {
        if (depth > 48) throw new AssertionError("Unexpected system picker hierarchy depth");
        if (predicate.test(node)) return node;
        for (int index = 0; index < node.getChildCount(); index++) {
            AccessibilityNodeInfo child = node.getChild(index);
            if (child == null) continue;
            AccessibilityNodeInfo match = find(child, predicate, depth + 1);
            if (match != null) return match;
        }
        return null;
    }

    private static void click(AccessibilityNodeInfo node) {
        while (node != null && !node.isClickable()) node = node.getParent();
        assertNotNull("System control has no clickable parent", node);
        assertTrue("System control must be enabled", node.isEnabled());
        assertTrue("System control action must dispatch", node.performAction(AccessibilityNodeInfo.ACTION_CLICK));
    }

    private static String string(CharSequence value) { return value == null ? "" : value.toString(); }

    private static boolean isRootsList(AccessibilityNodeInfo node) {
        return node.isVisibleToUser() && string(node.getViewIdResourceName()).endsWith(":id/roots_list");
    }

    private static boolean hasAncestor(AccessibilityNodeInfo node, String idSuffix) {
        for (int depth = 0; node != null && depth < 48; depth++, node = node.getParent())
            if (string(node.getViewIdResourceName()).endsWith(idSuffix)) return true;
        return false;
    }
}
