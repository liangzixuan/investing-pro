package local.investment.personal;

import android.inputmethodservice.InputMethodService;
import android.graphics.Color;
import android.text.InputType;
import android.util.Log;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputBinding;
import android.view.inputmethod.InputConnection;
import android.widget.TextView;

/** Exists only in the test APK. Android supplies every connection used by this service. */
public final class ServedEditorIme extends InputMethodService {
    static ServedEditorIme current;

    @Override public void onCreate() {
        super.onCreate(); current = this; changed("create", false);
    }
    @Override public void onBindInput() { super.onBindInput(); changed("bind", false); }
    @Override public void onStartInput(EditorInfo info, boolean restarting) {
        super.onStartInput(info, restarting); changed(restarting ? "restart" : "start", servesTarget());
    }
    @Override public void onFinishInput() { changed("finish", false); super.onFinishInput(); }
    @Override public void onUnbindInput() { changed("unbind", false); super.onUnbindInput(); }
    @Override public void onDestroy() {
        changed("destroy", false); if (current == this) current = null; super.onDestroy();
    }
    private void changed(String event, boolean available) {
        ServedEditorControlProvider.GUARD.lifecycle(available);
        EditorInfo info = getCurrentInputEditorInfo(); InputBinding binding = getCurrentInputBinding();
        Log.i("ServedEditorIme", "event=" + event + ",generation=" + ServedEditorControlProvider.GUARD.generation()
            + ",target=" + available + ",bindingUid=" + (binding == null ? -1 : binding.getUid())
            + ",package=" + (info == null ? null : info.packageName) + ",inputType=" + (info == null ? 0 : info.inputType)
            + ",initialSelection=" + (info == null ? "none" : info.initialSelStart + ":" + info.initialSelEnd));
    }
    boolean servesTarget() {
        try {
            InputBinding binding = getCurrentInputBinding(); EditorInfo info = getCurrentInputEditorInfo();
            return binding != null && info != null && (info.inputType & InputType.TYPE_MASK_CLASS) != InputType.TYPE_NULL
                && ServedEditorControlProvider.TARGET.equals(info.packageName)
                && binding.getUid() == getPackageManager().getApplicationInfo(ServedEditorControlProvider.TARGET, 0).uid;
        } catch (android.content.pm.PackageManager.NameNotFoundException missing) { return false; }
    }
    InputConnection servedConnection() {
        if (!servesTarget()) throw new IllegalStateException("IME does not serve the exact target UID/package");
        InputConnection connection = getCurrentInputConnection();
        if (connection == null) throw new IllegalStateException("Framework has no current input connection");
        return connection;
    }
    @Override public boolean onEvaluateFullscreenMode() { return false; }
    @Override public boolean onEvaluateInputViewShown() {
        return ServedEditorControlProvider.GUARD.hasSession() && servesTarget();
    }
    @Override public View onCreateInputView() {
        TextView panel = new TextView(this);
        panel.setText("Invented research text input"); panel.setTextColor(Color.WHITE);
        panel.setBackgroundColor(Color.rgb(23, 27, 38)); panel.setTextSize(18);
        int padding = Math.round(20 * getResources().getDisplayMetrics().density);
        panel.setPadding(padding, padding, padding, padding);
        panel.setMinimumHeight(Math.round(160 * getResources().getDisplayMetrics().density));
        panel.setFocusable(false); return panel;
    }
}
