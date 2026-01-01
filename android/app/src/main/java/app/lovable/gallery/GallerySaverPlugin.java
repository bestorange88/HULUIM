package app.lovable.gallery;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

@CapacitorPlugin(name = "GallerySaver")
public class GallerySaverPlugin extends Plugin {
    private static final String TAG = "GallerySaver";

    @PluginMethod
    public void saveImageFromUrl(PluginCall call) {
        String imageUrl = call.getString("url");
        String filename = call.getString("filename");

        if (imageUrl == null || imageUrl.isEmpty()) {
            call.reject("Image URL is required");
            return;
        }

        if (filename == null || filename.isEmpty()) {
            SimpleDateFormat sdf = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault());
            filename = "IMG_" + sdf.format(new Date()) + ".jpg";
        }

        final String finalFilename = filename;

        new Thread(() -> {
            try {
                URL url = new URL(imageUrl);
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.setDoInput(true);
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(10000);
                connection.connect();

                InputStream inputStream = connection.getInputStream();
                Bitmap bitmap = BitmapFactory.decodeStream(inputStream);
                inputStream.close();

                if (bitmap == null) {
                    getActivity().runOnUiThread(() -> call.reject("Failed to decode image"));
                    return;
                }

                boolean saved = saveToGallery(bitmap, finalFilename);
                bitmap.recycle();

                getActivity().runOnUiThread(() -> {
                    if (saved) {
                        JSObject result = new JSObject();
                        result.put("success", true);
                        result.put("filename", finalFilename);
                        call.resolve(result);
                    } else {
                        call.reject("Failed to save image to gallery");
                    }
                });
            } catch (Exception e) {
                Log.e(TAG, "Error saving image from URL", e);
                getActivity().runOnUiThread(() -> call.reject("Error: " + e.getMessage()));
            }
        }).start();
    }

    @PluginMethod
    public void saveImageFromBase64(PluginCall call) {
        String base64Data = call.getString("data");
        String filename = call.getString("filename");

        if (base64Data == null || base64Data.isEmpty()) {
            call.reject("Base64 data is required");
            return;
        }

        if (filename == null || filename.isEmpty()) {
            SimpleDateFormat sdf = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault());
            filename = "IMG_" + sdf.format(new Date()) + ".jpg";
        }

        try {
            String pureBase64 = base64Data;
            if (base64Data.contains(",")) {
                pureBase64 = base64Data.split(",")[1];
            }

            byte[] decodedBytes = Base64.decode(pureBase64, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.length);

            if (bitmap == null) {
                call.reject("Failed to decode base64 image");
                return;
            }

            boolean saved = saveToGallery(bitmap, filename);
            bitmap.recycle();

            if (saved) {
                JSObject result = new JSObject();
                result.put("success", true);
                result.put("filename", filename);
                call.resolve(result);
            } else {
                call.reject("Failed to save image to gallery");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error saving image from base64", e);
            call.reject("Error: " + e.getMessage());
        }
    }

    private boolean saveToGallery(Bitmap bitmap, String filename) {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues contentValues = new ContentValues();
        contentValues.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
        contentValues.put(MediaStore.MediaColumns.MIME_TYPE, "image/jpeg");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            contentValues.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Alo");
            contentValues.put(MediaStore.MediaColumns.IS_PENDING, 1);
        }

        Uri imageUri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, contentValues);

        if (imageUri == null) {
            Log.e(TAG, "Failed to create MediaStore entry");
            return false;
        }

        try {
            OutputStream outputStream = resolver.openOutputStream(imageUri);
            if (outputStream == null) {
                Log.e(TAG, "Failed to open output stream");
                return false;
            }

            bitmap.compress(Bitmap.CompressFormat.JPEG, 95, outputStream);
            outputStream.close();

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                contentValues.clear();
                contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(imageUri, contentValues, null, null);
            }

            Log.d(TAG, "Image saved successfully: " + imageUri);
            return true;
        } catch (IOException e) {
            Log.e(TAG, "Error writing image to gallery", e);
            resolver.delete(imageUri, null, null);
            return false;
        }
    }
}
