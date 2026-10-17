package local.investment.personal;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class CompanyReportPolicyInstrumentedTest {
    @Test
    public void acceptsCurrentReportSchemaAndRefusesOldSchemaOrIdentity() {
        String filename = "Investment-research-ZERO-XNAS-20261017T000000000Z.json";
        String current = "{\"purpose\":\"investment.company-research\",\"schemaVersion\":\"5.0.0\","
            + "\"preparedAt\":\"2026-10-17T00:00:00.000Z\",\"listing\":{\"symbol\":\"ZERO\",\"exchangeMic\":\"XNAS\"}}";
        assertTrue(CompanyReportDocumentPolicy.INSTANCE.acceptsText(filename, current));
        assertFalse(CompanyReportDocumentPolicy.INSTANCE.acceptsText(filename, current.replace("5.0.0", "4.0.0")));
        assertFalse(CompanyReportDocumentPolicy.INSTANCE.acceptsText(filename, current.replace("ZERO", "ONE")));
        assertFalse(CompanyReportDocumentPolicy.INSTANCE.acceptsText(filename, current + "{}"));
    }
}
