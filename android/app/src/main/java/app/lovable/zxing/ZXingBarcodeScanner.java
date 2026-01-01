package app.lovable.zxing;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.util.Log;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "ZXingBarcodeScanner",
    permissions = {
        @Permission(
            alias = "camera",
            strings = { Manifest.permission.CAMERA }
        )
    }
)
public class ZXingBarcodeScanner extends Plugin {
    private static final String TAG = "ZXingBarcodeScanner";
    public static final String EXTRA_RESULT_TEXT = "SCAN_RESULT_TEXT";
    public static final String EXTRA_RESULT_FORMAT = "SCAN_RESULT_FORMAT";
    public static final String EXTRA_RESULT_ERROR = "SCAN_RESULT_ERROR";
    public static final int RESULT_ERROR = 2;

    @PluginMethod
    public void scan(PluginCall call) {
        Log.d(TAG, "scan() called");
        
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            Log.d(TAG, "Requesting camera permission");
            requestPermissionForAlias("camera", call, "handleCameraPermissionResult");
            return;
        }
        
        startScan(call);
    }

    @PermissionCallback
    private void handleCameraPermissionResult(PluginCall call) {
        if (getPermissionState("camera") == PermissionState.GRANTED) {
            startScan(call);
        } else {
            JSObject result = new JSObject();
            result.put("cancelled", false);
            result.put("text", "");
            result.put("format", "");
            result.put("error", "Camera permission denied");
            call.resolve(result);
        }
    }

    private void startScan(PluginCall call) {
        Log.d(TAG, "Starting ZXing scan activity");
        
        Intent intent = new Intent(getContext(), ZXingScannerActivity.class);
        startActivityForResult(call, intent, "handleScanResult");
    }

    @ActivityCallback
    private void handleScanResult(PluginCall call, ActivityResult result) {
        Log.d(TAG, "handleScanResult called, resultCode: " + result.getResultCode());
        
        JSObject response = new JSObject();
        
        if (result.getResultCode() == Activity.RESULT_OK) {
            Intent data = result.getData();
            if (data != null) {
                String text = data.getStringExtra(EXTRA_RESULT_TEXT);
                String format = data.getStringExtra(EXTRA_RESULT_FORMAT);
                
                Log.d(TAG, "Scan successful: " + text);
                
                response.put("cancelled", false);
                response.put("text", text != null ? text : "");
                response.put("format", format != null ? format : "QR_CODE");
                response.put("error", JSObject.NULL);
            } else {
                Log.d(TAG, "Scan result data is null");
                response.put("cancelled", true);
                response.put("text", "");
                response.put("format", "");
                response.put("error", JSObject.NULL);
            }
        } else if (result.getResultCode() == Activity.RESULT_CANCELED) {
            Log.d(TAG, "Scan cancelled by user");
            response.put("cancelled", true);
            response.put("text", "");
            response.put("format", "");
            response.put("error", JSObject.NULL);
        } else if (result.getResultCode() == RESULT_ERROR) {
            Intent data = result.getData();
            String error = data != null ? data.getStringExtra(EXTRA_RESULT_ERROR) : "Unknown error";
            Log.d(TAG, "Scan failed: " + error);
            response.put("cancelled", false);
            response.put("text", "");
            response.put("format", "");
            response.put("error", error);
        } else {
            Log.d(TAG, "Scan failed with unknown result code");
            response.put("cancelled", false);
            response.put("text", "");
            response.put("format", "");
            response.put("error", "Scan failed");
        }
        
        call.resolve(response);
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState("camera") == PermissionState.GRANTED);
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (getPermissionState("camera") == PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
        } else {
            requestPermissionForAlias("camera", call, "handlePermissionRequestResult");
        }
    }

    @PermissionCallback
    private void handlePermissionRequestResult(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState("camera") == PermissionState.GRANTED);
        call.resolve(result);
    }
}
