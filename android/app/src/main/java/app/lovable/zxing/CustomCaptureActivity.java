package app.lovable.zxing;

import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.widget.ImageButton;

import com.journeyapps.barcodescanner.CaptureActivity;
import com.journeyapps.barcodescanner.DecoratedBarcodeView;

import com.xunda.im.R;

public class CustomCaptureActivity extends CaptureActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Set up back button
        ImageButton backButton = findViewById(R.id.back_button);
        if (backButton != null) {
            backButton.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    onBackPressed();
                }
            });
        }
    }

    @Override
    protected DecoratedBarcodeView initializeContent() {
        setContentView(R.layout.activity_custom_capture);
        return findViewById(R.id.barcode_scanner);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            setResult(RESULT_CANCELED);
            finish();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
}
