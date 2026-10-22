package local.investment.personal;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(InvestmentWatchlistExportPlugin.class);
        registerPlugin(InvestmentWatchlistDraftFilePlugin.class);
        registerPlugin(InvestmentPortfolioDraftFilePlugin.class);
        registerPlugin(InvestmentFollowupsDraftFilePlugin.class);
        registerPlugin(InvestmentCompanyReportPlugin.class);
        if (BuildConfig.CLERK_AUTH_ENABLED) {
            registerPlugin(InvestmentAuthPlugin.class);
        }
        super.onCreate(savedInstanceState);
    }
}
