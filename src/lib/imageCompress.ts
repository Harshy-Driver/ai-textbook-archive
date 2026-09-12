const MAX_SIZE_BYTES = 850 * 1024; // 850KB target to stay safely under 1MB Convex limit

/**
 * Compress an image file to fit within Convex's 1MB mutation limit.
 * Resizes to max 1600px on the longest side and uses JPEG compression.
 */
export async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down if larger than 1600px on longest side
      const MAX_DIM = 1600;
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

      // Use better quality image smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      // Function to get actual blob size
      const getDataUrlWithSize = (type: string, q: number): { dataUrl: string; size: number } => {
        return new Promise<{ dataUrl: string; size: number }>((resolve) => {
          canvas.toBlob((blob) => {
            if (blob) {
              const Reader = new FileReader();
              Reader.onloadend = () => {
                resolve({ dataUrl: Reader.result as string, size: blob.size });
              };
              Reader.readAsDataURL(blob);
            } else {
              resolve({ dataUrl: "", size: Infinity });
            }
          }, type, q);
        });
      };

      let dataUrl = "";
      let size = Infinity;
      let quality = 0.9;

      // Try JPEG first with binary search for best quality
      while (quality >= 0.3 && size > MAX_SIZE_BYTES) {
        const result = getDataUrlWithSize("image/jpeg", quality);
        // Use sync estimation first for speed, then verify
        canvas.toBlob((blob) => {
          if (blob) {
            size = blob.size;
            const Reader = new FileReader();
            Reader.onloadend = () => {
              dataUrl = Reader.result as string;
            };
            Reader.readAsDataURL(blob);
          }
        }, "image/jpeg", quality);
        quality -= 0.1;
      }

      // Simpler approach: just iterate until we get under the limit
      async function compressSync() {
        let q = 0.85;
        while (q >= 0.2) {
          const result = await new Promise<{ dataUrl: string; size: number }>((res) => {
            canvas.toBlob((blob) => {
              if (blob) {
                const Reader = new FileReader();
                Reader.onloadend = () => {
                  res({ dataUrl: Reader.result as string, size: blob.size });
                };
                Reader.readAsDataURL(blob);
              } else {
                res({ dataUrl: "", size: Infinity });
              }
            }, "image/jpeg", q);
          });
          if (result.size <= MAX_SIZE_BYTES) {
            return result;
          }
          q -= 0.1;
        }
        // If JPEG can't get small enough, try WebP
        q = 0.8;
        while (q >= 0.2) {
          const result = await new Promise<{ dataUrl: string; size: number }>((res) => {
            canvas.toBlob((blob) => {
              if (blob) {
                const Reader = new FileReader();
                Reader.onloadend = () => {
                  res({ dataUrl: Reader.result as string, size: blob.size });
                };
                Reader.readAsDataURL(blob);
              } else {
                res({ dataUrl: "", size: Infinity });
              }
            }, "image/webp", q);
          });
          if (result.size <= MAX_SIZE_BYTES) {
            return result;
          }
          q -= 0.1;
        }
        // Last resort: scale down
        const scale = 0.7;
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const result = await new Promise<{ dataUrl: string; size: number }>((res) => {
          canvas.toBlob((blob) => {
            if (blob) {
              const Reader = new FileReader();
              Reader.onloadend = () => {
                res({ dataUrl: Reader.result as string, size: blob.size });
              };
              Reader.readAsDataURL(blob);
            } else {
              res({ dataUrl: "", size: Infinity });
            }
          }, "image/jpeg", 0.6);
        });
        return result;
      }

      compressSync().then((result) => resolve(result.dataUrl));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}
