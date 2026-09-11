const MAX_SIZE_BYTES = 900 * 1024; // 900KB target to stay under 1MB with padding

/**
 * Compress an image file to fit within Convex's 1MB mutation limit.
 * Resizes to max 2000px on the longest side and uses JPEG compression.
 */
export async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down if larger than 2000px on longest side
      const MAX_DIM = 2000;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height / width) * MAX_DIM);
          width = MAX_DIM;
        } else {
          width = Math.round((width / height) * MAX_DIM);
          height = MAX_DIM;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Try JPEG at decreasing quality levels
      let quality = 0.85;
      let dataUrl = canvas.toDataURL("image/jpeg", quality);

      while (dataUrl.length * 0.75 > MAX_SIZE_BYTES && quality > 0.1) {
        quality -= 0.1;
        dataUrl = canvas.toDataURL("image/jpeg", quality);
      }

      // If still too large, try WebP
      if (dataUrl.length * 0.75 > MAX_SIZE_BYTES) {
        quality = 0.8;
        dataUrl = canvas.toDataURL("image/webp", quality);
        while (dataUrl.length * 0.75 > MAX_SIZE_BYTES && quality > 0.1) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL("image/webp", quality);
        }
      }

      // Final size reduction: scale down further if still too large
      if (dataUrl.length * 0.75 > MAX_SIZE_BYTES) {
        const scale = 0.6;
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        dataUrl = canvas.toDataURL("image/jpeg", 0.6);
      }

      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}
