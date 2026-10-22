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
    private final ValuationChooserProbe probe;
    private boolean active = true;
    private int count;

    private ValuationChooserWindowTrace(Window window, ValuationChooserProbe probe) {
        this.window = window;
        this.original = window.getCallback();
        this.probe = probe;
        this.decorated = (Window.Callback) Proxy.newProxyInstance(
            Window.Callback.class.getClassLoader(), new Class<?>[] { Window.Callback.class }, this);
    }

    static ValuationChooserWindowTrace install(Window window, ValuationChooserProbe probe) {
        ValuationChooserWindowTrace trace = null;
        try {
            trace = new ValuationChooserWindowTrace(window, probe);
            if (trace.original == null) return null;
            window.setCallback(trace.decorated);
            Log.i("ValuationChooserWindow", "arm=" + probe.armToken() + ", installed=true");
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
            record(touch, DispatchOutcome.returned(handled));
            return handled;
        } catch (Throwable failure) {
            record(touch, DispatchOutcome.THREW);
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

    private void record(Touch touch, DispatchOutcome outcome) {
        if (touch == null) return;
        try {
            Log.i("ValuationChooserWindow", "arm=" + probe.armToken() + ", ordinal=" + touch.ordinal +
                ", action=" + touch.action + ", downTime=" + touch.downTime + ", eventTime=" + touch.eventTime +
                ", x=" + touch.x + ", y=" + touch.y + ", source=" + touch.source + ", flags=" + touch.flags +
                ", handled=" + (outcome == DispatchOutcome.HANDLED) + ", threw=" + (outcome == DispatchOutcome.THREW));
        } catch (RuntimeException | AssertionError failure) {
            unavailable();
        }
    }

    static CallbackOwnership ownership(ValuationChooserWindowTrace trace) {
        if (trace == null) return CallbackOwnership.UNAVAILABLE;
        try {
            return trace.window.getCallback() == trace.decorated ? CallbackOwnership.OWNED : CallbackOwnership.REPLACED;
        } catch (RuntimeException | AssertionError failure) {
            unavailable();
            return CallbackOwnership.UNAVAILABLE;
        }
    }

    static void snapshot(ValuationChooserWindowTrace trace, ValuationChooserWindowSnapshot.Phase phase) {
        if (trace == null) return;
        ValuationChooserWindowSnapshot.capture(trace.window, trace.probe, phase);
    }

    static void close(ValuationChooserWindowTrace trace) {
        if (trace == null) return;
        if (!trace.active) return;
        trace.active = false;
        snapshot(trace, ValuationChooserWindowSnapshot.Phase.CLOSE);
        try {
            CallbackOwnership owner = trace.window.getCallback() == trace.decorated
                ? CallbackOwnership.OWNED : CallbackOwnership.REPLACED;
            trace.summary(owner);
            if (owner == CallbackOwnership.OWNED) trace.window.setCallback(trace.original);
        } catch (RuntimeException | AssertionError failure) {
            unavailable();
        }
    }

    private void summary(CallbackOwnership owner) {
        try {
            Log.i("ValuationChooserWindow", "arm=" + probe.armToken() + ", closed=true, receiptCount=" + count +
                ", callbackOwned=" + (owner == CallbackOwnership.OWNED));
        } catch (RuntimeException | AssertionError failure) {
            unavailable();
        }
    }
    private static void unavailable() {
        // Diagnostics must never replace a delegated callback or picker outcome.
        try { Log.w("ValuationChooserWindow", "Passive diagnostic unavailable; original outcome preserved"); }
        catch (RuntimeException | AssertionError ignored) { }
    }

    enum CallbackOwnership { OWNED, REPLACED, UNAVAILABLE }

    private enum DispatchOutcome {
        HANDLED, UNHANDLED, THREW;
        static DispatchOutcome returned(Object result) {
            return Boolean.TRUE.equals(result) ? HANDLED : UNHANDLED;
        }
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
