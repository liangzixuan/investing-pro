package local.investment.personal;

import static org.junit.Assert.*;

import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.view.inspector.WindowInspector;
import android.webkit.WebView;
import java.util.List;

/** Refuse ambiguous own-process windows before the valuation chooser's one original touch. */
final class ValuationChooserTouchAdmission {
    private static final int MAX_ROOTS = 8;

    private ValuationChooserTouchAdmission() {}

    static void require(Window window, WebView page) {
        assertSame("Valuation chooser window admission runs on the UI thread", Looper.getMainLooper(), Looper.myLooper());
        List<View> roots = WindowInspector.getGlobalWindowViews();
        assertNotNull("Valuation chooser own-process roots must be observable", roots);
        assertTrue("Valuation chooser window admission stays bounded", roots.size() <= MAX_ROOTS);
        View main = window.peekDecorView();
        assertNotNull("Valuation chooser activity decor must exist", main);
        assertTrue("Valuation chooser roots include the activity decor", roots.contains(main));
        requireMain(main, page);
        for (View root : roots) requireOther(root, main);
    }

    private static void requireMain(View main, WebView page) {
        assertTrue("Valuation chooser main decor must remain attached", main.isAttachedToWindow());
        assertTrue("Valuation chooser main decor must remain shown", main.isShown());
        assertEquals("Valuation chooser main window remains visible", View.VISIBLE, main.getWindowVisibility());
        assertTrue("Valuation chooser activity window must retain focus", main.hasWindowFocus());
        assertTrue("Valuation chooser WebView window must retain focus", page.hasWindowFocus());
        WindowManager.LayoutParams parameters = parameters(main);
        assertEquals("Valuation chooser main window must accept touch", 0,
            parameters.flags & WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE);
    }

    private static void requireOther(View root, View main) {
        assertNotNull("Observed valuation chooser window root must exist", root);
        if (root == main) return;
        if (!root.isAttachedToWindow()) return;
        if (!root.isShown()) return;
        if (root.getWindowVisibility() != View.VISIBLE) return;
        ViewGroup.LayoutParams raw = root.getLayoutParams();
        boolean known = raw instanceof WindowManager.LayoutParams;
        Log.i("ValuationChooserAdmission", "otherVisible=true, windowParameters=" + known);
        WindowManager.LayoutParams parameters = parameters(root);
        boolean touchCapable = (parameters.flags & WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE) == 0;
        Log.i("ValuationChooserAdmission", "otherVisible=true, type=" + parameters.type +
            ", flags=" + parameters.flags + ", touchCapable=" + touchCapable);
        // This is a conservative admission rule, not a claim about modality or window layering.
        // NOT_FOCUSABLE/NOT_TOUCH_MODAL do not establish whether this point was intercepted.
        assertFalse("Valuation chooser refuses a visible touch-capable other app window", touchCapable);
    }

    private static WindowManager.LayoutParams parameters(View root) {
        ViewGroup.LayoutParams raw = root.getLayoutParams();
        assertTrue("Visible valuation chooser window must have known window parameters",
            raw instanceof WindowManager.LayoutParams);
        return (WindowManager.LayoutParams) raw;
    }

}
