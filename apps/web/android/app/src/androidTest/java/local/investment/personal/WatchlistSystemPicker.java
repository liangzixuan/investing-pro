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
    private final PickerCancelObservation observation = new PickerCancelObservation();

    WatchlistSystemPicker() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        automation = InstrumentationRegistry.getInstrumentation().getUiAutomation();
        AccessibilityServiceInfo info = automation.getServiceInfo();
        info.flags |= AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
            | AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
        automation.setServiceInfo(info);
    }

    void awaitOpen() throws Exception {
        awaitOpen(TIMEOUT_MS);
    }

    void awaitOpen(long startupTimeoutMs) throws Exception {
        await(node -> node.getViewIdResourceName() != null
            && node.getViewIdResourceName().endsWith(":id/container_save"), startupTimeoutMs);
    }

    void cancel() throws Exception {
        long startedAt = SystemClock.uptimeMillis();
        long deadline = startedAt + TIMEOUT_MS;
        observation.begin(startedAt, deadline);
        try {
            Log.i("WatchlistSystemPicker", "Cancel start uptime=" + startedAt + " deadline=" + deadline);
            CancelSurface initial = awaitCancelSurface(deadline, -1);
            if (initial.imeId >= 0) {
                dispatchCancelBack(initial, deadline, "ime-dismiss");
                awaitImeDismissed(initial, deadline);
                awaitCancelSurface(deadline, initial.pickerId);
            }
            CancelRoot root = observation.measure(PickerCancelObservation.Stage.CANCEL_FINAL_ROOT, () -> currentCancelRoot(deadline));
            CancelSurface current = observation.measure(PickerCancelObservation.Stage.CANCEL_FINAL_SURFACE, () -> readCurrentCancelSurface(root, initial.pickerId));
            assertNotNull("Fresh exact system Save picker must remain unambiguous before Cancel", current);
            assertEquals("A late keyboard must not consume picker cancellation", -1, current.imeId);
            dispatchCancelBack(current, deadline, "picker-cancel");
            awaitReturnToApp(deadline);
        } catch (Exception | AssertionError failure) {
            observation.failure();
            throw failure;
        }
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
        CancelRoot root = observation.measure(PickerCancelObservation.Stage.CANCEL_INITIAL_ROOT, () -> currentCancelRoot(deadline));
        CancelSurface before = observation.measure(PickerCancelObservation.Stage.CANCEL_INITIAL_SURFACE, () -> readCurrentCancelSurface(root, expectedPickerId));
        if (before == null) return null;
        long remaining = deadline - SystemClock.uptimeMillis();
        if (remaining <= 0) return null;
        StableResult stable = observation.measure(PickerCancelObservation.Stage.CANCEL_STABILITY,
            () -> AccessibilityNodeInfoExt.waitForStable(root.node, remaining, 500, 50, false));
        if (stable.isTimeout()) return null;
        CancelRoot current = observation.measure(PickerCancelObservation.Stage.CANCEL_FRESH_ROOT, () -> currentCancelRoot(deadline));
        CancelSurface after = observation.measure(PickerCancelObservation.Stage.CANCEL_FRESH_SURFACE, () -> readCurrentCancelSurface(current, before.pickerId));
        if (current == null || !root.node.equals(current.node)) return null;
        return after;
    }

    private CancelSurface readCancelSurface(int expectedPickerId, long deadline) {
        CancelRoot root = observation.measure(PickerCancelObservation.Stage.CANCEL_IME_ROOT, () -> currentCancelRoot(deadline));
        return observation.measure(PickerCancelObservation.Stage.CANCEL_IME_SURFACE, () -> readCurrentCancelSurface(root, expectedPickerId));
    }

    private static final class CancelRoot {
        final AccessibilityNodeInfo node;
        final int windowId;
        final long deadline;

        CancelRoot(AccessibilityNodeInfo node, int windowId, long deadline) {
            this.node = node;
            this.windowId = windowId;
            this.deadline = deadline;
        }
    }

    /** Root-only acquisition; original full surface and hierarchy checks still apply. */
    private CancelRoot currentCancelRoot(long deadline) {
        if (SystemClock.uptimeMillis() >= deadline) return null;
        AccessibilityWindowInfo selected = freshCurrentApplicationWindow(PickerCancelObservation.Selection.BEFORE);
        if (SystemClock.uptimeMillis() >= deadline || selected == null) return null;
        AccessibilityNodeInfo root = observation.measure(PickerCancelObservation.Stage.CANCEL_ROOT_ZERO, () -> selected.getRoot(0));
        if (SystemClock.uptimeMillis() >= deadline) return null;
        return new CancelRoot(root, selected.getId(), deadline);
    }

    /** Join the original admitted picker surface to fresh explicit-window evidence. */
    private CancelSurface readCurrentCancelSurface(CancelRoot root, int expectedPickerId) {
        if (root == null || SystemClock.uptimeMillis() >= root.deadline) return null;
        CancelSurface surface = readCancelSurface(root.node, expectedPickerId);
        if (SystemClock.uptimeMillis() >= root.deadline || surface == null) return null;
        if (surface.pickerId != root.windowId) return null;
        AccessibilityWindowInfo after = freshCurrentApplicationWindow(PickerCancelObservation.Selection.AFTER);
        if (SystemClock.uptimeMillis() >= root.deadline || after == null) return null;
        if (after.getId() != root.windowId) return null;
        return surface;
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
            int contribution = cancelRosterContribution(window, picker);
            if (contribution < 0) return false;
            pickerCount += contribution;
        }
        return pickerCount == 1;
    }

    /** Refused windows contribute -1; admitted other windows 0; the exact picker 1. */
    private static int cancelRosterContribution(AccessibilityWindowInfo window, AccessibilityWindowInfo picker) {
        if (window == null) return -1;
        if (window.getDisplayId() != Display.DEFAULT_DISPLAY) return 0;
        if (window.getId() == picker.getId()) return isCancelPickerWindow(window) ? 1 : -1;
        if (window.getType() == AccessibilityWindowInfo.TYPE_INPUT_METHOD) return 0;
        return conflictsWithCancelPicker(window, picker) ? -1 : 0;
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
            CancelSurface current = readCancelSurface(initial.pickerId, deadline);
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
        selectInventedDocument(displayName);
    }

    /** Exact invented format5 report filename; selection and return guards are shared unchanged. */
    void openInventedReportDocument(String displayName) throws Exception {
        assertEquals("Only the fixed invented current-format company report can be selected",
            "Investment-research-ZERO-XNAS-20261015T000000000Z.json", displayName);
        selectInventedDocument(displayName);
    }

    private void selectInventedDocument(String displayName) throws Exception {
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
        long deadline = SystemClock.uptimeMillis() + TIMEOUT_MS;
        observation.begin(deadline - TIMEOUT_MS, deadline);
        try {
            awaitReturnToApp(deadline);
        } catch (InterruptedException | RuntimeException | AssertionError failure) {
            observation.failure();
            throw failure;
        }
    }

    private void awaitReturnToApp(long deadline) throws InterruptedException {
        AppReturnObservation last = new AppReturnObservation();
        while (SystemClock.uptimeMillis() < deadline) {
            last = observation.measure(PickerCancelObservation.Stage.RETURN_SAMPLE, this::readFreshAppReturn);
            if (SystemClock.uptimeMillis() >= deadline) break;
            if (last.isReady()) return;
            pauseUntil(deadline);
        }
        throw new AssertionError("The target app did not regain the active focused window after the system picker; "
            + last.details(deadline));
    }

    /** Select current default-display application evidence without cached active-root fallback. */
    private AccessibilityWindowInfo freshCurrentApplicationWindow(PickerCancelObservation.Selection selection) {
        observation.reason(selection, PickerCancelObservation.Refusal.STARTED);
        if (!observation.measure(selection.cache, automation::clearCache)) {
            observation.reason(selection, PickerCancelObservation.Refusal.CACHE_CLEAR_FALSE);
            return null;
        }
        List<AccessibilityWindowInfo> windows = observation.measure(selection.windows, automation::getWindows);
        if (windows == null) {
            observation.reason(selection, PickerCancelObservation.Refusal.NULL_WINDOWS);
            return null;
        }
        observation.windowCount(selection, windows);
        long metadataStart = observation.start(selection.metadata);
        AccessibilityWindowInfo selected = null;
        for (AccessibilityWindowInfo window : windows) {
            if (window == null)
                return observation.finishSelection(selection, PickerCancelObservation.Refusal.NULL_ENTRY, metadataStart, null);
            if (window.getDisplayId() != Display.DEFAULT_DISPLAY) continue;
            boolean active = window.isActive();
            boolean focused = window.isFocused();
            if (active != focused)
                return observation.finishSelection(selection, PickerCancelObservation.Refusal.ACTIVE_FOCUS_SPLIT, metadataStart, null);
            if (!active) continue;
            if (window.getType() != AccessibilityWindowInfo.TYPE_APPLICATION)
                return observation.finishSelection(selection, PickerCancelObservation.Refusal.NON_APPLICATION, metadataStart, null);
            if (selected != null)
                return observation.finishSelection(selection, PickerCancelObservation.Refusal.AMBIGUOUS, metadataStart, null);
            selected = window;
        }
        return observation.finishSelected(selection, metadataStart, selected);
    }

    private AppReturnObservation readFreshAppReturn() {
        observation.sample();
        AccessibilityWindowInfo before = freshCurrentApplicationWindow(PickerCancelObservation.Selection.BEFORE);
        if (before == null) return new AppReturnObservation();
        int selectedId = before.getId();
        AppReturnObservation observed = readAppReturn(
            observation.measure(PickerCancelObservation.Stage.ROOT_ZERO, () -> before.getRoot(0)), observation);
        AccessibilityWindowInfo after = freshCurrentApplicationWindow(PickerCancelObservation.Selection.AFTER);
        observed.selectedWindowMatches = after != null && after.getId() == selectedId
            && observed.rootWindowId == selectedId && observed.windowId == selectedId;
        return observed;
    }

    private static AppReturnObservation readAppReturn(AccessibilityNodeInfo root, PickerCancelObservation observation) {
        AppReturnObservation observed = new AppReturnObservation();
        observed.rootPresent = root != null;
        if (root == null) {
            observation.root(PickerCancelObservation.RootResult.NULL_ROOT);
            return observed;
        }
        observed.refreshed = observation.measure(PickerCancelObservation.Stage.ROOT_REFRESH, root::refresh);
        if (!observed.refreshed) {
            observation.root(PickerCancelObservation.RootResult.REFRESH_FALSE);
            return observed;
        }
        observation.run(PickerCancelObservation.Stage.ROOT_METADATA, () -> {
            observed.exactPackage = "local.investment.personal".contentEquals(string(root.getPackageName()));
            observed.visible = root.isVisibleToUser();
            observed.rootWindowId = root.getWindowId();
        });
        AccessibilityWindowInfo window = observation.measure(PickerCancelObservation.Stage.ROOT_WINDOW, root::getWindow);
        if (window == null) {
            observation.root(PickerCancelObservation.RootResult.NO_WINDOW);
            return observed;
        }
        observation.run(PickerCancelObservation.Stage.WINDOW_METADATA, () -> {
            observed.windowId = window.getId();
            observed.type = window.getType();
            observed.display = window.getDisplayId();
            observed.active = window.isActive();
            observed.focused = window.isFocused();
        });
        observation.root(PickerCancelObservation.RootResult.OBSERVED);
        return observed;
    }

    /** Only finite window metadata is retained; no node text or other package names. */
    private static final class AppReturnObservation {
        boolean rootPresent;
        boolean refreshed;
        boolean exactPackage;
        boolean visible;
        int rootWindowId = -1;
        int windowId = -1;
        int type = -1;
        int display = -1;
        boolean active;
        boolean focused;
        boolean selectedWindowMatches;

        boolean isReady() {
            if (!rootPresent) return false;
            if (!refreshed) return false;
            if (!exactPackage) return false;
            if (!visible) return false;
            if (!selectedWindowMatches) return false;
            return isExactAppWindow();
        }

        private boolean isExactAppWindow() {
            if (windowId < 0) return false;
            if (rootWindowId != windowId) return false;
            if (type != AccessibilityWindowInfo.TYPE_APPLICATION) return false;
            if (display != Display.DEFAULT_DISPLAY) return false;
            if (!active) return false;
            return focused;
        }

        String details(long deadline) {
            long now = SystemClock.uptimeMillis();
            return "elapsedMs=" + (now - (deadline - TIMEOUT_MS))
                + " remainingMs=" + Math.max(0, deadline - now)
                + " rootPresent=" + rootPresent + " refreshed=" + refreshed
                + " exactPackage=" + exactPackage + " visible=" + visible
                + " rootWindowId=" + rootWindowId + " windowId=" + windowId
                + " type=" + type + " display=" + display
                + " active=" + active + " focused=" + focused
                + " selectedWindowMatches=" + selectedWindowMatches;
        }
    }

    private AccessibilityNodeInfo await(Predicate<AccessibilityNodeInfo> predicate) throws Exception {
        return await(predicate, TIMEOUT_MS);
    }

    private AccessibilityNodeInfo await(Predicate<AccessibilityNodeInfo> predicate, long timeoutMs) throws Exception {
        long deadline = SystemClock.uptimeMillis() + timeoutMs;
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
