package local.investment.personal;

import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.view.inspector.WindowInspector;
import java.util.List;

/** Fixed scalar observations of this process's window roots; list order does not establish layers. */
final class ValuationChooserWindowSnapshot {
    private static final int MAX_ROOTS = 8;

    private ValuationChooserWindowSnapshot() {}

    static void capture(Window window, ValuationChooserProbe probe, Phase phase) {
        try {
            List<View> roots = WindowInspector.getGlobalWindowViews();
            Log.i("ValuationChooserRoots", "arm=" + probe.armToken() + ", phase=" + phase +
                ", count=" + roots.size() + ", truncated=" + (roots.size() > MAX_ROOTS));
            View main = window.peekDecorView();
            for (int index = 0; index < Math.min(roots.size(), MAX_ROOTS); index++) {
                record(roots.get(index), main, probe, phase);
            }
        } catch (RuntimeException | AssertionError failure) {
            unavailable();
        }
    }

    private static void record(View root, View main, ValuationChooserProbe probe, Phase phase) {
        try {
            int[] location = new int[2];
            root.getLocationOnScreen(location);
            StringBuilder fields = new StringBuilder("arm=").append(probe.armToken())
                .append(", phase=").append(phase)
                .append(", identity=").append(System.identityHashCode(root))
                .append(", mainDecor=").append(root == main)
                .append(", category=").append(category(root, main))
                .append(", attached=").append(root.isAttachedToWindow())
                .append(", shown=").append(root.isShown())
                .append(", windowVisibility=").append(root.getWindowVisibility())
                .append(", windowFocus=").append(root.hasWindowFocus())
                .append(", viewFocus=").append(root.hasFocus())
                .append(", left=").append(location[0])
                .append(", top=").append(location[1])
                .append(", right=").append(location[0] + root.getWidth())
                .append(", bottom=").append(location[1] + root.getHeight());
            ViewGroup.LayoutParams parameters = root.getLayoutParams();
            fields.append(", windowParameters=").append(parameters instanceof WindowManager.LayoutParams);
            if (parameters instanceof WindowManager.LayoutParams) {
                WindowManager.LayoutParams windowParameters = (WindowManager.LayoutParams) parameters;
                fields.append(", type=").append(windowParameters.type)
                    .append(", flags=").append(windowParameters.flags);
            }
            Log.i("ValuationChooserRoots", fields.toString());
        } catch (RuntimeException | AssertionError failure) {
            unavailable();
        }
    }

    private static RootCategory category(View root, View main) {
        if (root == main) return RootCategory.MAIN;
        if (root.getClass().getName().equals("android.widget.PopupWindow$PopupDecorView")) return RootCategory.POPUP;
        return RootCategory.OTHER;
    }

    private static void unavailable() {
        try { Log.w("ValuationChooserRoots", "Window snapshot unavailable; original outcome preserved"); }
        catch (RuntimeException | AssertionError ignored) { }
    }

    enum Phase { FRESH_GEOMETRY, CLOSE }
    private enum RootCategory { MAIN, POPUP, OTHER }
}
