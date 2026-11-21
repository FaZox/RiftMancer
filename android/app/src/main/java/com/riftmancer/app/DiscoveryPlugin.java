package com.riftmancer.app;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Finds the PC app on the local network with mDNS / DNS-SD (Android NsdManager),
 * so the phone never has to scan addresses. The PC announces `_riftbound._tcp`
 * with only its fingerprint in the TXT record (electron/mdns.cjs).
 *
 * JS: RiftboundDiscovery.discover({ type, timeout }) → { services: [{ host, port, name, txt }] }
 */
@CapacitorPlugin(name = "RiftboundDiscovery")
public class DiscoveryPlugin extends Plugin {

    private static final int MAX_RESOLVE = 8;

    @PluginMethod
    public void discover(PluginCall call) {
        String type = call.getString("type", "_riftbound._tcp.");
        int timeout = Math.max(500, Math.min(call.getInt("timeout", 3000), 10000));
        NsdManager nsd = (NsdManager) getContext().getSystemService(Context.NSD_SERVICE);
        if (nsd == null) {
            call.resolve(result(new JSArray()));
            return;
        }
        List<NsdServiceInfo> found = Collections.synchronizedList(new ArrayList<>());
        AtomicBoolean finished = new AtomicBoolean(false);

        NsdManager.DiscoveryListener listener = new NsdManager.DiscoveryListener() {
            @Override public void onStartDiscoveryFailed(String serviceType, int errorCode) {
                if (finished.compareAndSet(false, true)) call.resolve(result(new JSArray()));
            }
            @Override public void onStopDiscoveryFailed(String serviceType, int errorCode) { }
            @Override public void onDiscoveryStarted(String serviceType) { }
            @Override public void onDiscoveryStopped(String serviceType) { }
            @Override public void onServiceFound(NsdServiceInfo info) { found.add(info); }
            @Override public void onServiceLost(NsdServiceInfo info) { }
        };

        try {
            nsd.discoverServices(type, NsdManager.PROTOCOL_DNS_SD, listener);
        } catch (Exception e) {
            if (finished.compareAndSet(false, true)) call.resolve(result(new JSArray()));
            return;
        }

        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            try { nsd.stopServiceDiscovery(listener); } catch (Exception ignored) { }
            if (!finished.compareAndSet(false, true)) return;
            List<NsdServiceInfo> list;
            synchronized (found) { list = new ArrayList<>(found); }
            resolveNext(nsd, list, 0, new JSArray(), call);
        }, timeout);
    }

    private static JSObject result(JSArray services) {
        JSObject r = new JSObject();
        r.put("services", services);
        return r;
    }

    /** NsdManager resolves one service at a time: chain them. */
    private void resolveNext(NsdManager nsd, List<NsdServiceInfo> list, int i, JSArray out, PluginCall call) {
        if (i >= list.size() || i >= MAX_RESOLVE) {
            call.resolve(result(out));
            return;
        }
        try {
            nsd.resolveService(list.get(i), new NsdManager.ResolveListener() {
                @Override public void onResolveFailed(NsdServiceInfo info, int errorCode) {
                    resolveNext(nsd, list, i + 1, out, call);
                }
                @Override public void onServiceResolved(NsdServiceInfo info) {
                    InetAddress host = info.getHost();
                    if (host instanceof Inet4Address) {
                        JSObject o = new JSObject();
                        o.put("host", host.getHostAddress());
                        o.put("port", info.getPort());
                        o.put("name", info.getServiceName());
                        JSObject txt = new JSObject();
                        Map<String, byte[]> attrs = info.getAttributes();
                        if (attrs != null) {
                            for (Map.Entry<String, byte[]> e : attrs.entrySet()) {
                                byte[] v = e.getValue();
                                txt.put(e.getKey(), v == null ? "" : new String(v, StandardCharsets.UTF_8));
                            }
                        }
                        o.put("txt", txt);
                        out.put(o);
                    }
                    resolveNext(nsd, list, i + 1, out, call);
                }
            });
        } catch (Exception e) {
            resolveNext(nsd, list, i + 1, out, call);
        }
    }
}
