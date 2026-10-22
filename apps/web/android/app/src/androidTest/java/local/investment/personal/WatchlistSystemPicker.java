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
        awaitOpen();
        assertTrue("System picker Back must dispatch", automation.performGlobalAction(
            android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK));
        awaitReturnToApp();
    }

    void saveToInventedRoot() throws Exception {
        awaitOpen();
        // The emulator uses the platform English locale. Resolve every node afresh.
        AccessibilityNodeInfo navigation = await(node -> isRootsList(node)
            || "Show roots".contentEquals(string(node.getContentDescription())));
        if (!isRootsList(navigation)) click(navigation);
        clickInventedRoot();
        await(node -> string(node.getViewIdResourceName()).endsWith(":id/toolbar")
            && find(node, child -> SavedWatchlistTestDocumentsProvider.TITLE.contentEquals(string(child.getText())), 0) != null);
        AccessibilityNodeInfo save = await(node -> "android:id/button1".equals(node.getViewIdResourceName())
            && node.isEnabled() && hasAncestor(node, ":id/container_save"));
        assertTrue("Unexpected native Save control", "Save".equalsIgnoreCase(string(save.getText())));
        click(save);
        awaitReturnToApp();
    }

    /** OPEN uses the same real provider root, with one exact observed document label. */
    void openInventedDocument(String displayName) throws Exception {
        openInventedDocument(displayName, "watchlist-draft");
    }

    void openInventedDocument(String displayName, String family) throws Exception {
        assertTrue("Only existing invented draft file families can be selected",
            family.equals("watchlist-draft") || family.equals("valuation-inputs-draft"));
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
        long deadline = SystemClock.uptimeMillis() + TIMEOUT_MS;
        do {
            AccessibilityNodeInfo root = automation.getRootInActiveWindow();
            if (root != null && "local.investment.personal".contentEquals(string(root.getPackageName()))
                && root.isVisibleToUser()) {
                AccessibilityWindowInfo window = root.getWindow();
                if (window != null && window.getType() == AccessibilityWindowInfo.TYPE_APPLICATION
                    && window.isActive() && window.isFocused()) return;
            }
            Thread.sleep(50);
        } while (SystemClock.uptimeMillis() < deadline);
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
