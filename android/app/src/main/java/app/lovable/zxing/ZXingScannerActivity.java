package app.lovable.zxing;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import androidx.appcompat.app.AppCompatActivity;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;
import com.journeyapps.barcodescanner.CaptureActivity;

import java.util.Collections;

public class ZXingScannerActivity extends AppCompatActivity {
    private static final String TAG = "ZXingScannerActivity";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        Log.d(TAG, "Starting ZXing scanner via IntentIntegrator");
        
        IntentIntegrator integrator = new IntentIntegrator(this);
        integrator.setDesiredBarcodeFormats(Collections.singletonList(BarcodeFormat.QR_CODE.name()));
        integrator.setPrompt("将二维码放入框内扫描");
        integrator.setCameraId(0);
        integrator.setBeepEnabled(true);
        integrator.setBarcodeImageEnabled(false);
        integrator.setOrientationLocked(false);
        integrator.setCaptureActivity(CustomCaptureActivity.class);
        integrator.initiateScan();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        Log.d(TAG, "onActivityResult: requestCode=" + requestCode + ", resultCode=" + resultCode);
        
        IntentResult result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data);
        
        if (result != null) {
            if (result.getContents() == null) {
                Log.d(TAG, "Scan cancelled");
                setResult(RESULT_CANCELED);
            } else {
                String text = result.getContents();
                String format = result.getFormatName();
                Log.d(TAG, "Scan successful: " + text + " (format: " + format + ")");
                
                Intent resultIntent = new Intent();
                resultIntent.putExtra(ZXingBarcodeScanner.EXTRA_RESULT_TEXT, text);
                resultIntent.putExtra(ZXingBarcodeScanner.EXTRA_RESULT_FORMAT, format != null ? format : "QR_CODE");
                setResult(RESULT_OK, resultIntent);
            }
        } else {
            Log.d(TAG, "IntentResult is null, passing to super");
            super.onActivityResult(requestCode, resultCode, data);
            return;
        }
        
        finish();
    }

    @Override
    public void onBackPressed() {
        setResult(RESULT_CANCELED);
        super.onBackPressed();
    }
}
