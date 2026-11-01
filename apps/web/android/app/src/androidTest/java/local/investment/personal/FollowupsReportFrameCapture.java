package local.investment.personal;

import static org.junit.Assert.*;

import android.graphics.Bitmap;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.PixelCopy;
import android.view.View;
import android.view.ViewTreeObserver;
import android.view.Window;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/** One absolute deadline covers visual readiness, a committed frame and PixelCopy ownership. */
final class FollowupsReportFrameCapture {
    enum Frame { CAPTURED, MARKETS_CALENDAR_PREVIEW, VALUATION_SCENARIO_PREVIEW, CPI_HEADLINE_PREVIEW, SCREEN_COMPARISON_PREVIEW, SCREEN_COMPARISON_FOLLOWUP_PREVIEW, FILING_ASSESSMENT_PREVIEW, REVIEW_CHECK_COMPLETION_FOCUS, VALUATION_COLLECTION_REVIEW, RESEARCH_DRAFT_SET_PORTFOLIO_COMPARISON, COMPANY_RESEARCH_CHECK_ATTACHED, REPORT_COMPARISON_CHECK_PREVIEW, PORTFOLIO_SCREEN_SELECTION, PORTFOLIO_REPORT_COMPARISON, PORTFOLIO_COMPARISON_REPORT, PORTFOLIO_HELD_DUE_CHECKS, REVIEW_FILINGS_EVIDENCE, MARKETS_BRIEFING, PORTFOLIO_DATED_REVIEW_ENTRY, PORTFOLIO_DATED_REVIEW_RESEARCH, PORTFOLIO_DATED_REVIEW_FINISH, WATCHLIST_DAILY_REVIEW_PLAN, WATCHLIST_DAILY_REVIEW_RESEARCH, WATCHLIST_DAILY_REVIEW_FINISH }
    record Request(ActivityScenario<MainActivity> scenario, Frame frame) {}
    private record WindowFrame(WebView webView, Window window) {}
    private record PixelResult(Bitmap bitmap, int result) {}
    private static final class Pending {
        final long deadline = SystemClock.uptimeMillis() + 10_000;
        final Handler main = new Handler(Looper.getMainLooper());
        final CompletableFuture<Bitmap> captured = new CompletableFuture<>();
        final AtomicReference<String> phase = new AtomicReference<>("visual-state");
        final AtomicReference<ViewTreeObserver> observer = new AtomicReference<>();
        final AtomicReference<Runnable> frameCallback = new AtomicReference<>();
        boolean expired() {
            if (captured.isDone()) return true;
            return SystemClock.uptimeMillis() >= deadline;
        }
    }
    private final Request request;
    FollowupsReportFrameCapture(Request request) { this.request = request; }

    void retain() throws Exception {
        String configured = InstrumentationRegistry.getArguments().getString("additionalTestOutputDir");
        File output = configured == null
            ? new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalCacheDir(), "instrumentation-screenshots")
            : new File(configured);
        assertTrue(output.isDirectory() || output.mkdirs());
        Bitmap screenshot = capture();
        try (FileOutputStream stream = new FileOutputStream(new File(output, filename() + ".png"))) {
            assertTrue(screenshot.compress(Bitmap.CompressFormat.PNG, 100, stream));
        } finally { screenshot.recycle(); }
    }
    private String filename() { return switch(request.frame) {
        case CAPTURED -> "followupsReviewReportCaptured";
        case MARKETS_CALENDAR_PREVIEW -> "newMarketsCalendarQuestionCompletePreview";
        case VALUATION_SCENARIO_PREVIEW -> "newValuationScenarioCompleteCheckPreview";
        case CPI_HEADLINE_PREVIEW -> "newCpiHeadlineCompleteCheckPreview";
        case SCREEN_COMPARISON_PREVIEW -> "newScreenComparisonReportPreview";
        case SCREEN_COMPARISON_FOLLOWUP_PREVIEW -> "newScreenComparisonCompleteCheckPreview";
        case FILING_ASSESSMENT_PREVIEW -> "newFilingCheckAssessmentPreview";
        case REVIEW_CHECK_COMPLETION_FOCUS -> "newReviewCheckCompletionFocus";
        case VALUATION_COLLECTION_REVIEW -> "newValuationCollectionFileCompleteReview";
        case RESEARCH_DRAFT_SET_PORTFOLIO_COMPARISON -> "newResearchDraftSetPortfolioComparison";
        case COMPANY_RESEARCH_CHECK_ATTACHED -> "newCompanyResearchCheckAttached";
        case REPORT_COMPARISON_CHECK_PREVIEW -> "newReportComparisonCheckPreview";
        case PORTFOLIO_SCREEN_SELECTION -> "newPortfolioScreenSelectionPreview";
        case PORTFOLIO_REPORT_COMPARISON -> "newPortfolioReportComparisonReview";
        case PORTFOLIO_COMPARISON_REPORT -> "newPortfolioComparisonReportReview";
        case PORTFOLIO_HELD_DUE_CHECKS -> "newPortfolioHeldDueChecksReview";
        case REVIEW_FILINGS_EVIDENCE -> "newReviewFilingsEvidence";
        case MARKETS_BRIEFING -> "newMarketsBriefing";
        case PORTFOLIO_DATED_REVIEW_ENTRY -> "newPortfolioDatedReviewEntry";
        case PORTFOLIO_DATED_REVIEW_RESEARCH -> "newPortfolioDatedReviewResearch";
        case PORTFOLIO_DATED_REVIEW_FINISH -> "newPortfolioDatedReviewFinish";
        case WATCHLIST_DAILY_REVIEW_PLAN -> "newWatchlistDailyReviewPlan";
        case WATCHLIST_DAILY_REVIEW_RESEARCH -> "newWatchlistDailyReviewResearch";
        case WATCHLIST_DAILY_REVIEW_FINISH -> "newWatchlistDailyReviewFinish";
    }; }

    private Bitmap capture() throws Exception {
        Pending pending = new Pending();
        try {
            request.scenario.onActivity(activity -> prepareVisual(pending, new WindowFrame(activity.getBridge().getWebView(), activity.getWindow())));
            long remaining = pending.deadline - SystemClock.uptimeMillis();
            if (remaining <= 0) throw new IOException("Screenshot deadline expired before waiting");
            return pending.captured.get(remaining, TimeUnit.MILLISECONDS);
        } catch (Exception error) {
            cancelResult(pending);
            throw new IOException("Screenshot did not complete: " + filename() + ", phase=" + pending.phase.get(), error);
        } finally { unregisterFrameCallback(pending); }
    }
    private void prepareVisual(Pending pending, WindowFrame frame) {
        assertTrue("Screenshot needs an attached visible hardware WebView",
            frame.webView.isAttachedToWindow() && frame.webView.isShown() && frame.webView.isHardwareAccelerated());
        frame.webView.postVisualStateCallback(0, new WebView.VisualStateCallback() {
            @Override public void onComplete(long requestId) { prepareFrame(pending, frame); }
        });
    }
    private void prepareFrame(Pending pending, WindowFrame frame) {
        if (pending.expired()) return;
        pending.phase.set("frame-commit");
        Runnable committed = () -> pending.main.post(() -> copyCommittedPixels(pending, frame));
        ViewTreeObserver current = frame.webView.getViewTreeObserver();
        pending.observer.set(current);
        pending.frameCallback.set(committed);
        current.registerFrameCommitCallback(committed);
        frame.webView.invalidate();
    }
    private boolean invalidDimensions(View decor) {
        if (decor == null) return true;
        if (decor.getWidth() <= 0) return true;
        if (decor.getHeight() <= 0) return true;
        return (long) decor.getWidth() * decor.getHeight() > 16_777_216;
    }
    private void copyCommittedPixels(Pending pending, WindowFrame frame) {
        if (pending.expired()) return;
        pending.phase.set("pixel-copy");
        View decor = frame.window.peekDecorView();
        if (invalidDimensions(decor)) {
            pending.captured.completeExceptionally(new IOException("Invalid screenshot window dimensions"));
            return;
        }
        Bitmap bitmap = Bitmap.createBitmap(decor.getWidth(), decor.getHeight(), Bitmap.Config.ARGB_8888);
        try {
            PixelCopy.request(frame.window, bitmap, result -> acceptPixels(pending, new PixelResult(bitmap, result)), pending.main);
        } catch (RuntimeException error) {
            bitmap.recycle();
            pending.captured.completeExceptionally(error);
        }
    }
    private void acceptPixels(Pending pending, PixelResult pixels) {
        if (pixels.result != PixelCopy.SUCCESS) {
            pixels.bitmap.recycle();
            pending.captured.completeExceptionally(new IOException("PixelCopy result=" + pixels.result));
            return;
        }
        // A timed-out caller never owns a still-running copy's bitmap.
        if (pending.captured.complete(pixels.bitmap))
            Log.i("ManagedScreenshot", "name=" + filename() + ", visualReady=true, frameCommitted=true, pixelCopy=SUCCESS, width=" + pixels.bitmap.getWidth() + ", height=" + pixels.bitmap.getHeight());
        else pixels.bitmap.recycle();
    }
    private void cancelResult(Pending pending) {
        if (pending.captured.cancel(false)) return;
        if (pending.captured.isCompletedExceptionally()) return;
        Bitmap completed = pending.captured.getNow(null);
        if (completed != null) completed.recycle();
    }
    private void unregisterFrameCallback(Pending pending) {
        pending.main.post(() -> {
            ViewTreeObserver current = pending.observer.get();
            if (current == null) return;
            if (!current.isAlive()) return;
            Runnable callback = pending.frameCallback.get();
            if (callback != null) current.unregisterFrameCommitCallback(callback);
        });
    }
}
