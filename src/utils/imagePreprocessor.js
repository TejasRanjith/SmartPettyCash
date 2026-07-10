/**
 * Preprocess an image before sending to OCR to improve accuracy.
 * Converts to grayscale, increases contrast, and resizes if needed.
 * @param {File|Blob} imageFile - The image file to preprocess
 * @returns {Promise<Blob>} - The preprocessed image as a Blob
 */
export async function preprocessImage(imageFile) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageFile);

    img.onload = () => {
      try {
        // Create a canvas with max dimensions to avoid huge images
        const MAX_WIDTH = 2000;
        const MAX_HEIGHT = 2000;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Get image data for pixel manipulation
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Convert to grayscale and increase contrast
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Standard luminance grayscale
          let gray = 0.299 * r + 0.587 * g + 0.114 * b;

          // Increase contrast (apply sigmoid-like contrast stretching)
          const contrast = 1.4; // contrast factor
          gray = 128 + (gray - 128) * contrast;

          // Clamp values
          gray = Math.max(0, Math.min(255, gray));

          data[i] = gray;     // R
          data[i + 1] = gray; // G
          data[i + 2] = gray; // B
          // data[i + 3] = alpha (unchanged)
        }

        ctx.putImageData(imageData, 0, 0);

        // Convert canvas to blob
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            resolve(blob);
          },
          'image/jpeg',
          0.95
        );
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for preprocessing'));
    };

    img.src = url;
  });
}