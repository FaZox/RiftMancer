package com.riftmancer.app;

import android.view.WindowManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Keeps the screen on while the score counter is open (RiftboundScreen.keepAwake({ on })),
 * and the text size of Réglages → Affichage (RiftboundScreen.setTextZoom({ percent })).
 */
@CapacitorPlugin(name = "RiftboundScreen")
public class ScreenPlugin extends Plugin {
    @PluginMethod
    public void keepAwake(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", true));
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            call.resolve();
        });
    }

    @PluginMethod
    public void setTextZoom(PluginCall call) {
        int percent = Math.max(80, Math.min(160, call.getInt("percent", 100)));
        getActivity().runOnUiThread(() -> {
            getBridge().getWebView().getSettings().setTextZoom(percent);
            call.resolve();
        });
    }
}
