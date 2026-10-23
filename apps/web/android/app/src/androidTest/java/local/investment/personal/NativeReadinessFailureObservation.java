package local.investment.personal;

import android.app.UiAutomation;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import androidx.test.platform.app.InstrumentationRegistry;

/** One bounded, content-free observation after native fixture admission has failed. */
final class NativeReadinessFailureObservation {
    private NativeReadinessFailureObservation() {}

    static String capture() {
        Observation observed = new Observation();
        try {
            observed.read(InstrumentationRegistry.getInstrumentation().getUiAutomation());
        } catch (RuntimeException ignored) {
            // Observation must not replace the original fixture timeout assertion.
            observed.runtimeException = true;
        }
        return observed.toString();
    }

    private static final class Observation {
        Boolean rootNull;
        Boolean rootRefreshed;
        Boolean rootFixturePackage;
        Integer rootWindowId;
        Boolean rootVisible;
        Boolean rootFocused;
        Boolean rootAccessibilityFocused;
        Boolean windowNull;
        Integer windowId;
        Integer windowType;
        Integer windowDisplayId;
        Boolean windowActive;
        Boolean windowFocused;
        boolean runtimeException;

        void read(UiAutomation automation) {
            AccessibilityNodeInfo root = automation.getRootInActiveWindow();
            rootNull = root == null;
            if (root == null) return;
            rootRefreshed = root.refresh();
            if (!rootRefreshed) return;
            CharSequence packageName = root.getPackageName();
            rootFixturePackage = packageName != null && "local.investment.personal".contentEquals(packageName);
            rootWindowId = root.getWindowId();
            rootVisible = root.isVisibleToUser();
            rootFocused = root.isFocused();
            rootAccessibilityFocused = root.isAccessibilityFocused();
            AccessibilityWindowInfo window = root.getWindow();
            windowNull = window == null;
            if (window == null) return;
            windowId = window.getId();
            windowType = window.getType();
            windowDisplayId = window.getDisplayId();
            windowActive = window.isActive();
            windowFocused = window.isFocused();
        }

        @Override public String toString() {
            return "{\"rootNull\":" + rootNull +
                ",\"rootRefreshed\":" + rootRefreshed +
                ",\"rootFixturePackage\":" + rootFixturePackage +
                ",\"rootWindowId\":" + rootWindowId +
                ",\"rootVisible\":" + rootVisible +
                ",\"rootFocused\":" + rootFocused +
                ",\"rootAccessibilityFocused\":" + rootAccessibilityFocused +
                ",\"windowNull\":" + windowNull +
                ",\"windowId\":" + windowId +
                ",\"windowType\":" + windowType +
                ",\"windowDisplayId\":" + windowDisplayId +
                ",\"windowActive\":" + windowActive +
                ",\"windowFocused\":" + windowFocused +
                ",\"runtimeException\":" + runtimeException + "}";
        }
    }
}
