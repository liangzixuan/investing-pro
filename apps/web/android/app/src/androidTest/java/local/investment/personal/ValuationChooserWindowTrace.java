package local.investment.personal;

import android.util.Log;
import android.view.MotionEvent;
import android.view.Window;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;

/** Bounded passive observation of the invented chooser gesture at the public window boundary. */
final class ValuationChooserWindowTrace implements InvocationHandler {
    private final Window window;
    private final Window.Callback original;
    private final Window.Callback decorated;
    private final long armId;
    private boolean active = true;
    private int count;

    private ValuationChooserWindowTrace(Window window, long armId) {
        this.window = window;
        this.original = window.getCallback();
        this.armId = armId;
        this.decorated = (Window.Callback) Proxy.newProxyInstance(
            Window.Callback.class.getClassLoader(), new Class<?>[] { Window.Callback.class }, this);
    }

    static ValuationChooserWindowTrace install(Window window, long armId) {
        ValuationChooserWindowTrace trace = null;
        try {
            trace = new ValuationChooserWindowTrace(window, armId);
            if (trace.original == null) return null;
            window.setCallback(trace.decorated);
            Log.i("ValuationChooserWindow", "arm=" + armId + ", installed=true");
            return trace;
        } catch (RuntimeException | AssertionError failure) {
            close(trace);
            unavailable();
            return null;
        }
    }

    @Override public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        if (method.getDeclaringClass() == Object.class) return objectMethod(proxy, method, args);
        Touch touch = sample(method, args);
        try {
            Object handled = forward(method, args);
            record(touch, handled, false);
            return handled;
        } catch (Throwable failure) {
            record(touch, null, true);
            throw failure;
        }
    }

    private static Object objectMethod(Object proxy, Method method, Object[] args) {
        switch (method.getName()) {
            case "equals": return proxy == args[0];
            case "hashCode": return System.identityHashCode(proxy);
            case "toString": return "ValuationChooserWindowTrace";
            default: throw new IllegalArgumentException("Unexpected Object method");
        }
    }

    private Object forward(Method method, Object[] args) throws Throwable {
        try {
            return method.invoke(original, args);
        } catch (InvocationTargetException failure) {
            throw failure.getCause();
        }
    }

    private Touch sample(Method method, Object[] args) {
        if (!active || count >= 8) return null;
        if (!method.getName().equals("dispatchTouchEvent")) return null;
        try {
            MotionEvent event = (MotionEvent) args[0];
            int action = event.getActionMasked();
            if (!observedAction(action)) return null;
            return new Touch(++count, event);
        } catch (RuntimeException | AssertionError failure) {
            unavailable();
            return null;
        }
    }

    private static boolean observedAction(int action) {
        return action == MotionEvent.ACTION_DOWN || action == MotionEvent.ACTION_UP ||
            action == MotionEvent.ACTION_MOVE || action == MotionEvent.ACTION_CANCEL;
    }

    private void record(Touch touch, Object handled, boolean threw) {
        if (touch == null) return;
        try {
            Log.i("ValuationChooserWindow", "arm=" + armId + ", ordinal=" + touch.ordinal +
                ", action=" + touch.action + ", downTime=" + touch.downTime + ", eventTime=" + touch.eventTime +
                ", x=" + touch.x + ", y=" + touch.y + ", source=" + touch.source + ", flags=" + touch.flags +
                ", handled=" + Boolean.TRUE.equals(handled) + ", threw=" + threw);
        } catch (RuntimeException | AssertionError failure) {
            unavailable();
        }
    }

    static boolean ownsCallback(ValuationChooserWindowTrace trace) {
        if (trace == null) return false;
        try {
            return trace.window.getCallback() == trace.decorated;
        } catch (RuntimeException | AssertionError failure) {
            unavailable();
            return false;
        }
    }

    static void close(ValuationChooserWindowTrace trace) {
        if (trace == null) return;
        if (!trace.active) return;
        trace.active = false;
        try {
            boolean owned = trace.window.getCallback() == trace.decorated;
            trace.summary(owned);
            if (owned) trace.window.setCallback(trace.original);
        } catch (RuntimeException | AssertionError failure) {
            unavailable();
        }
    }

    private void summary(boolean owned) {
        try {
            Log.i("ValuationChooserWindow", "arm=" + armId + ", closed=true, receiptCount=" + count +
                ", callbackOwned=" + owned);
        } catch (RuntimeException | AssertionError failure) {
            unavailable();
        }
    }
    private static void unavailable() {
        // Diagnostics must never replace a delegated callback or picker outcome.
        try { Log.w("ValuationChooserWindow", "Passive diagnostic unavailable; original outcome preserved"); }
        catch (RuntimeException | AssertionError ignored) { }
    }

    private static final class Touch {
        final int ordinal, action, source, flags;
        final long downTime, eventTime;
        final float x, y;
        Touch(int ordinal, MotionEvent event) {
            this.ordinal = ordinal;
            action = event.getActionMasked();
            downTime = event.getDownTime();
            eventTime = event.getEventTime();
            x = event.getX();
            y = event.getY();
            if (!Float.isFinite(x) || !Float.isFinite(y)) throw new IllegalArgumentException("Nonfinite touch coordinate");
            source = event.getSource();
            flags = event.getFlags();
        }
    }
}
