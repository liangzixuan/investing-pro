package local.investment.personal;

import static org.junit.Assert.*;

import android.content.res.AssetManager;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;

/** Owns only the bounded copied instrumentation subtree and its fixed scenario marker. */
final class ReportRevisitFixtureAssets implements AutoCloseable {
    enum Scenario {
        REPORT_REVISIT("report-revisit"), PORTFOLIO_REVIEW_REPORT("portfolio-review-report"),
        COMPANY_SNAPSHOT_LOADING("company-snapshot-loading"),
        REVIEWED_COMPANY_SOURCE_PASS("reviewed-company-source-pass"),
        FOLLOWUPS_REVIEW_REPORT("followups-review-report"),
        HOLDING_FOLLOWUP("holding-followup"),
        PORTFOLIO_COMPOSITION_REVIEW("portfolio-composition-review"),
        MARKETS_SOURCE_REVIEW("markets-source-review"),
        MARKETS_CALENDAR_FOLLOWUP("markets-calendar-followup"),
        FOLLOWUP_ASSESSMENT_NOTE("followup-assessment-note"),
        ANNUAL_REVENUE_MODEL_BASIS("annual-revenue-model-basis"),
        VALUATION_SCENARIO_FOLLOWUP("valuation-scenario-followup"),
        INTERIM_STATEMENTS("interim-statements");
        final String marker;
        Scenario(String marker) { this.marker = marker; }
    }
    private final Scenario scenario;
    ReportRevisitFixtureAssets() { this(Scenario.REPORT_REVISIT); }
    ReportRevisitFixtureAssets(Scenario scenario) { this.scenario = java.util.Objects.requireNonNull(scenario); }
    private static final long MAX_BYTES = 4 * 1024 * 1024;
    private final AssetManager assets = InstrumentationRegistry.getInstrumentation().getContext().getAssets();
    private final List<File> created = new ArrayList<>();
    private int fileCount;
    private long byteCount;
    private File directory;
    private static final class Directory {
        final String source;
        final File destination;
        final int depth;
        Directory(Directory parent, File destination) {
            this.destination = destination;
            source = parent == null ? "managed-workspace" : parent.source + "/" + destination.getName();
            depth = parent == null ? 0 : parent.depth + 1;
        }
        Directory child(File destination) { return new Directory(this, destination); }
    }
    void prepare() throws IOException {
        directory = File.createTempFile("report-revisit-instrumentation-", "", InstrumentationRegistry.getInstrumentation().getTargetContext().getCacheDir());
        created.add(directory);
        assertTrue(directory.delete());
        assertTrue(directory.mkdir());
        copyDirectory(new Directory(null, directory));
        selectScenario();
        assertTrue(fileCount > 0);
        assertTrue(fileCount <= 64);
        assertTrue(byteCount <= MAX_BYTES);
    }
    File directory() { return directory; }
    private void requireDepth(Directory current) throws IOException {
        if (current.depth > 3) throw new IOException("Fixture nesting limit exceeded");
    }
    private String[] entries(Directory current) throws IOException {
        requireDepth(current);
        String[] entries = assets.list(current.source);
        if (entries == null) throw new IOException("Invalid fixture directory");
        if (entries.length == 0) throw new IOException("Invalid fixture directory");
        if (entries.length > 64) throw new IOException("Invalid fixture directory");
        return entries;
    }
    private void copyDirectory(Directory current) throws IOException {
        for (String name : entries(current)) {
            if (!name.matches("[A-Za-z0-9_][A-Za-z0-9_.-]*")) throw new IOException("Invalid fixture asset name");
            copyEntry(current.child(new File(current.destination, name)));
        }
    }
    private void copyEntry(Directory child) throws IOException {
        String[] children = assets.list(child.source);
        if (children == null) { copyFile(child); return; }
        if (children.length == 0) { copyFile(child); return; }
        if (!child.destination.mkdir()) throw new IOException("Cannot create fixture subdirectory");
        created.add(child.destination);
        copyDirectory(child);
    }
    private void copyFile(Directory current) throws IOException {
        if (++fileCount > 64) throw new IOException("Fixture file limit or collision");
        if (!current.destination.createNewFile()) throw new IOException("Fixture file limit or collision");
        created.add(current.destination);
        try (InputStream input = assets.open(current.source); FileOutputStream output = new FileOutputStream(current.destination)) {
            copyBytes(input, output);
        }
    }
    private void copyBytes(InputStream input, FileOutputStream output) throws IOException {
        byte[] buffer = new byte[8192];
        int count;
        while ((count = input.read(buffer)) != -1) {
            byteCount += count;
            if (byteCount > MAX_BYTES) throw new IOException("Fixture byte limit exceeded");
            output.write(buffer, 0, count);
        }
    }
    private void selectScenario() throws IOException {
        File index = new File(directory, "index.html");
        byte[] original = Files.readAllBytes(index.toPath());
        assertTrue(original.length > 0);
        assertTrue(original.length <= 65_536);
        String html = new String(original, StandardCharsets.UTF_8);
        String sha = InstrumentationRegistry.getArguments().getString("expectedSourceSha");
        assertNotNull("Pass the actual bundled source SHA", sha);
        assertTrue(sha.matches("[0-9a-f]{40}"));
        assertTrue(html.contains(sha));
        assertEquals(html.indexOf("</head>"), html.lastIndexOf("</head>"));
        assertTrue(html.contains("</head>"));
        assertFalse(html.contains("investment-android-test-scenario"));
        byte[] selected = html.replace("</head>", "<meta name=\"investment-android-test-scenario\" content=\"" + scenario.marker + "\"></head>").getBytes(StandardCharsets.UTF_8);
        byteCount += selected.length - original.length;
        assertTrue(byteCount <= MAX_BYTES);
        Files.write(index.toPath(), selected);
    }
    @Override public void close() {
        for (int index = created.size() - 1; index >= 0; index--)
            assertTrue("Only test-created fixture paths are removed", created.get(index).delete());
    }
}
