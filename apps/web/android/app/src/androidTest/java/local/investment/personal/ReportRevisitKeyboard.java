package local.investment.personal;

import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.pressKey;
import static androidx.test.espresso.matcher.ViewMatchers.isAssignableFrom;
import static androidx.test.espresso.matcher.ViewMatchers.isDisplayed;
import static androidx.test.espresso.matcher.ViewMatchers.supportsInputMethods;
import static org.junit.Assert.*;

import android.os.SystemClock;
import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsAnimation;
import android.webkit.WebView;
import androidx.lifecycle.Lifecycle;
import androidx.test.espresso.PerformException;
import androidx.test.espresso.UiController;
import androidx.test.espresso.ViewAction;
import androidx.test.espresso.action.EspressoKey;
import java.util.List;
import org.hamcrest.Matcher;
import org.json.JSONObject;

/** The single comparison textarea keeps native focus, complete selection and IME lifecycle guards. */
final class ReportRevisitKeyboard {
    enum Assessment {
        EMPTY(""), SUPERSEDED("Draft assessment superseded"), FINAL("Archived liquidity needs a new review");
        final String text;
        Assessment(String text) { this.text = text; }
    }
    record Edit(Assessment next, Assessment previous) {}
    private static final long PAGE_TIMEOUT_MS = 10_000;
    private final ReportRevisitPage page;
    private final ReportRevisitTouch touch;
    private View observedImeDecor;
    private Lifecycle observedImeLifecycle;
    private final java.util.Set<WindowInsetsAnimation> imeAnimations = new java.util.HashSet<>();
    ReportRevisitKeyboard(ReportRevisitPage page, ReportRevisitTouch touch) { this.page = page; this.touch = touch; }
    void observe(MainActivity activity) { observeImeAnimations(activity); }
    void enter(Edit edit) throws Exception {
        String selector = ".managed-report-revisit textarea:not([readonly])";
        String focused = "document.activeElement===document.querySelector('" + selector + "') && document.activeElement.value===" + JSONObject.quote(edit.previous.text);
        touch.assessment();
        page.await(new ReportRevisitPage.Check("exact assessment editor and raw previous value focused", new ReportRevisitPage.Script(focused)));
        awaitNativeEditor();
        if (edit.previous != Assessment.EMPTY) selectCompletePrevious(edit, focused);
        commitNativeText(edit.next);
        page.await(new ReportRevisitPage.Check("native assessment edit reaches the controlled product field", new ReportRevisitPage.Script("document.activeElement===document.querySelector('" + selector + "') && document.activeElement.value===" + JSONObject.quote(edit.next.text))));
        closeSoftKeyboard();
    }
    private void selectCompletePrevious(Edit edit, String focused) throws Exception {
        onView(isAssignableFrom(WebView.class)).perform(pressKey(new EspressoKey.Builder().withKeyCode(KeyEvent.KEYCODE_A).withCtrlPressed(true).build()));
        page.await(new ReportRevisitPage.Check("native select all covers the complete old assessment", new ReportRevisitPage.Script(focused + " && document.activeElement.selectionStart===0 && document.activeElement.selectionEnd===" + edit.previous.text.length())));
        awaitNativeEditor();
    }
    private void observeImeAnimations(MainActivity activity) {
        View decor = activity.getWindow().getDecorView();
        observedImeLifecycle = activity.getLifecycle();
        observedImeDecor = decor;
        imeAnimations.clear();
        decor.setWindowInsetsAnimationCallback(new WindowInsetsAnimation.Callback(
                WindowInsetsAnimation.Callback.DISPATCH_MODE_CONTINUE_ON_SUBTREE) {
            @Override public void onPrepare(WindowInsetsAnimation animation) {
                if (observedImeDecor == decor && (animation.getTypeMask() & WindowInsets.Type.ime()) != 0)
                    imeAnimations.add(animation);
            }
            @Override public WindowInsets onProgress(WindowInsets insets, List<WindowInsetsAnimation> running) {
                return insets;
            }
            @Override public void onEnd(WindowInsetsAnimation animation) {
                if (observedImeDecor == decor) imeAnimations.remove(animation);
            }
        });
    }
    private void closeSoftKeyboard() {
        androidx.test.espresso.Espresso.closeSoftKeyboard();
        awaitHiddenIme();
    }
    private boolean hasHiddenIme(View view) {
        WindowInsets insets = view.getRootWindowInsets();
        return insets != null && !insets.isVisible(WindowInsets.Type.ime());
    }
    private void awaitHiddenIme() {
        onView(isAssignableFrom(WebView.class)).perform(new ViewAction() {
            @Override public Matcher<View> getConstraints() { return isDisplayed(); }
            @Override public String getDescription() { return "wait for hidden, settled native IME"; }
            @Override public void perform(UiController uiController, View view) {
                assertSame("IME observer belongs to this Activity window", observedImeDecor, view.getRootView());
                long deadline = SystemClock.uptimeMillis() + PAGE_TIMEOUT_MS;
                String diagnostic;
                do {
                    boolean hidden = hasHiddenIme(view);
                    boolean focused = view.hasWindowFocus();
                    boolean resumed = observedImeLifecycle.getCurrentState() == Lifecycle.State.RESUMED;
                    diagnostic = "hidden=" + hidden + ", animations=" + imeAnimations.size() +
                        ", windowFocus=" + focused + ", resumed=" + resumed;
                    boolean imeSettled = hidden && imeAnimations.isEmpty();
                    boolean activityReady = focused && resumed;
                    if (imeSettled && activityReady) {
                        Log.i("ManagedIme", diagnostic);
                        return;
                    }
                    long remaining = deadline - SystemClock.uptimeMillis();
                    if (remaining <= 0) break;
                    uiController.loopMainThreadForAtLeast(Math.min(50, remaining));
                } while (SystemClock.uptimeMillis() < deadline);
                throw new PerformException.Builder().withActionDescription(getDescription())
                    .withViewDescription("Managed fixture IME: " + diagnostic)
                    .withCause(new IllegalStateException("Native IME did not settle")).build();
            }
        });
    }
    private void awaitNativeEditor() {
        onView(isAssignableFrom(WebView.class)).perform(new ViewAction() {
            @Override public Matcher<View> getConstraints() { return isDisplayed(); }
            @Override public String getDescription() { return "wait for native input connection: " + "report comparison assessment"; }
            @Override public void perform(UiController uiController, View view) {
                long deadline = SystemClock.uptimeMillis() + PAGE_TIMEOUT_MS;
                String diagnostic;
                do {
                    boolean inputConnection = supportsInputMethods().matches(view);
                    boolean ready = view.hasFocus() && view.hasWindowFocus() && inputConnection;
                    diagnostic = "id=" + "report comparison assessment" + ", focus=" + view.hasFocus() + ", windowFocus=" +
                        view.hasWindowFocus() + ", inputConnection=" + inputConnection;
                    if (ready) {
                        Log.i("ManagedInput", diagnostic);
                        return;
                    }
                    long remaining = deadline - SystemClock.uptimeMillis();
                    if (remaining <= 0) break;
                    uiController.loopMainThreadForAtLeast(Math.min(50, remaining));
                } while (SystemClock.uptimeMillis() < deadline);
                throw new PerformException.Builder().withActionDescription(getDescription())
                    .withViewDescription("Managed fixture WebView: " + diagnostic)
                    .withCause(new IllegalStateException("Native editor was not ready"))
                    .build();
            }
        });
    }
    private void commitNativeText(Assessment assessment) {
        onView(isAssignableFrom(WebView.class)).perform(new ViewAction() {
            @Override public Matcher<View> getConstraints() { return isDisplayed(); }
            @Override public String getDescription() { return "commit invented text through native IME"; }
            @Override public void perform(UiController controller, View view) {
                assertTrue(view.hasFocus() && view.hasWindowFocus());
                android.view.inputmethod.InputConnection input = ((WebView) view).onCreateInputConnection(
                    new android.view.inputmethod.EditorInfo());
                assertNotNull("The actual WebView editor must supply a native connection", input);
                assertTrue("Native IME commit must dispatch", input.commitText(assessment.text, 1));
                controller.loopMainThreadUntilIdle();
            }
        });
    }
}
