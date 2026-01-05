package com.xunda.im;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import app.lovable.zxing.ZXingBarcodeScanner;
import app.lovable.gallery.GallerySaverPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ZXingBarcodeScanner.class);
        registerPlugin(GallerySaverPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
