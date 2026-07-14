import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, X, ScanLine, Loader2, Settings, Key } from 'lucide-react';
import { getApiKey, setApiKey, scanReceipt } from '../utils/ocrService';

/**
 * ReceiptScanner component — captures receipt images via camera or file upload,
 * runs OCR via OCR.space API, and returns parsed data.
 */
export default function ReceiptScanner({ onScanComplete, onClose }) {
  const [mode, setMode] = useState(null); // 'camera' | 'upload' | null
  const [image, setImage] = useState(null); // Selected/captured image preview URL
  const [imageFile, setImageFile] = useState(null); // Raw file for OCR
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState(null); // Preview URL for display
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);

  // Load key on mount
  useEffect(() => {
    setApiKeyInput(getApiKey());
  }, []);

  // Save key
  const handleSaveSettings = () => {
    setApiKey(apiKeyInput);
    setShowSettings(false);
  };

  // Start camera
  const startCamera = useCallback(async () => {
    setMode('camera');
    setImage(null);
    setImageFile(null);
    setPreview(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access denied:', err);
      alert('Camera access denied. Please allow camera permissions or use file upload instead.');
      setMode(null);
    }
  }, []);

  // Capture photo from camera
  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      const file = new File([blob], 'receipt-capture.jpg', { type: 'image/jpeg' });
      setImageFile(file);
      setPreview(URL.createObjectURL(blob));
      setImage('captured');
      // Stop camera
      stopCamera();
    }, 'image/jpeg', 0.95);
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Handle file upload
  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMode('upload');
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
    setImage('uploaded');
  }, []);

  // Run OCR scan
  const handleScan = useCallback(async () => {
    if (!imageFile) return;

    setScanning(true);
    setProgress(0);

    try {
      const parsedData = await scanReceipt(imageFile, {
        onProgress: (pct) => {
          setProgress(pct);
        }
      });

      // Convert imageFile to Base64 and pass it along with parsed data
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result;
        onScanComplete({
          ...parsedData,
          receiptImage: base64Data
        });
        cleanup();
      };
      reader.onerror = (error) => {
        console.error('FileReader error:', error);
        alert('Failed to read image for PDF embedding. Please try again.');
        cleanup();
      };
      reader.readAsDataURL(imageFile);
    } catch (err) {
      console.error('Scan failed:', err);
      alert(err.message || 'Failed to scan receipt. Please try again.');
      setScanning(false);
    }
  }, [imageFile, onScanComplete]);

  const cleanup = useCallback(() => {
    stopCamera();
    if (preview) URL.revokeObjectURL(preview);
    onClose();
  }, [stopCamera, preview, onClose]);

  const handleClose = useCallback(() => {
    cleanup();
  }, [cleanup]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <ScanLine size={20} className="text-blue-600" />
            Scan Receipt
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSettings(!showSettings)}
              disabled={scanning}
              title="OCR Settings"
              className="p-2 hover:bg-gray-100 text-gray-600 rounded-full transition-colors disabled:opacity-50"
            >
              <Settings size={20} />
            </button>
            <button
              onClick={handleClose}
              disabled={scanning}
              className="p-2 hover:bg-gray-100 text-gray-600 rounded-full transition-colors disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Settings Panel Overlay */}
        {showSettings && (
          <div className="p-4 border-b border-gray-200 bg-blue-50/50 animate-fade-in">
            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-2">
              <Key size={16} className="text-blue-600" />
              OCR.space Configuration
            </h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">OCR.space API Key</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Enter your API Key"
                    className="flex-1 p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {apiKeyInput !== 'helloworld' && (
                    <button
                      onClick={() => setApiKeyInput('helloworld')}
                      className="px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Use Demo Key
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Default is 'helloworld' (shared rate-limited demo). Get a free personal key instantly at <a href="https://ocr.space/ocrapi" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">ocr.space/ocrapi</a>.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setApiKeyInput(getApiKey());
                    setShowSettings(false);
                  }}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-md font-semibold"
                >
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="p-4">
          {/* Mode Selection (if no image selected yet) */}
          {!mode && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 text-center mb-4">
                Take a photo or upload a receipt image to automatically extract expense details.
              </p>

              <button
                onClick={startCamera}
                className="w-full flex items-center justify-center gap-3 p-6 border-2 border-dashed border-blue-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
              >
                <Camera size={32} className="text-blue-500 group-hover:text-blue-700" />
                <div className="text-left">
                  <p className="font-semibold text-gray-800 group-hover:text-blue-700">Take a Photo</p>
                  <p className="text-sm text-gray-500">Use your device camera</p>
                </div>
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-sm text-gray-400 font-medium">OR</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-3 p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-gray-500 hover:bg-gray-50 transition-all group"
              >
                <Upload size={32} className="text-gray-500 group-hover:text-gray-700" />
                <div className="text-left">
                  <p className="font-semibold text-gray-800 group-hover:text-gray-700">Upload Image</p>
                  <p className="text-sm text-gray-500">Choose a receipt photo from your device</p>
                </div>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* Camera View */}
          {mode === 'camera' && !image && (
            <div>
              <div className="relative rounded-xl overflow-hidden bg-black mb-4">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-72 object-cover"
                />
                <div className="absolute inset-0 border-2 border-blue-400 rounded-xl pointer-events-none" />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={capturePhoto}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Camera size={18} />
                  Capture Photo
                </button>
                <button
                  onClick={() => { stopCamera(); setMode(null); }}
                  className="px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Image Preview */}
          {image && preview && (
            <div>
              <div className="relative rounded-xl overflow-hidden bg-gray-100 mb-4">
                <img
                  src={preview}
                  alt="Receipt preview"
                  className="w-full h-72 object-contain"
                />
                {image === 'captured' && (
                  <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-lg font-semibold">
                    Captured
                  </div>
                )}
                {image === 'uploaded' && (
                  <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-lg font-semibold">
                    Uploaded
                  </div>
                )}
              </div>

              {/* Scanning Progress */}
              {scanning && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Scanning receipt...
                    </span>
                    <span className="text-sm font-bold text-blue-600">{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Extracting text from receipt image</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                {!scanning && (
                  <button
                    onClick={handleScan}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <ScanLine size={18} />
                    Scan Receipt
                  </button>
                )}
                {!scanning && (
                  <button
                    onClick={() => {
                      setImage(null);
                      setImageFile(null);
                      setPreview(null);
                      if (mode === 'camera') startCamera();
                      else setMode(null);
                    }}
                    className="px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                  >
                    Retake
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <p className="text-xs text-gray-400 text-center">
            OCR processing is powered by **OCR.space Engine 2** (specialized receipt layout analyzer) directly in your browser.
          </p>
        </div>
      </div>
    </div>
  );
}