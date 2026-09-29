package local.investment.personal;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        if (BuildConfig.CLERK_TRIAL_ENABLED) {
            registerPlugin(InvestmentAuthPlugin.class);
        }
        super.onCreate(savedInstanceState);
    }
}
