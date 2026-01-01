package app.lovable.a50db10995f34b9b99cf1b4d82615234;

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
