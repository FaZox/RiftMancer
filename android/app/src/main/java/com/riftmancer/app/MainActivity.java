package com.riftmancer.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugin: finds the PC on the network (mDNS), see DiscoveryPlugin.
        registerPlugin(DiscoveryPlugin.class);
        // Keeps the screen on during a game (score counter), see ScreenPlugin.
        registerPlugin(ScreenPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
