package local.investment.personal;

import android.os.SystemClock;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;

/** Correlates one chooser arm with its geometry budget and later independent diagnostic read. */
final class ValuationChooserProbe {
    private static final AtomicLong NEXT_ARM = new AtomicLong();
    private final long armId;
    private final Duration timeout;
    private final long geometryDeadline;

    ValuationChooserProbe(Duration timeout) {
        geometryDeadline = SystemClock.uptimeMillis() + timeout.toMillis();
        this.timeout = timeout;
        armId = NEXT_ARM.incrementAndGet();
    }

    String armToken() { return Long.toString(armId); }

    long remainingGeometryMillis() { return geometryDeadline - SystemClock.uptimeMillis(); }

    boolean geometryExpired() { return SystemClock.uptimeMillis() >= geometryDeadline; }

    // The picker can outlive geometry preparation; draining receives the original full budget.
    long diagnosticTimeoutMillis() { return timeout.toMillis(); }
}
