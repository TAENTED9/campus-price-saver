/**
 * Client-side image resizing using canvas — Feature 1B.
 *
 * Draws the source file onto a canvas at exactly (targetWidth × targetHeight)
 * using object-fit:cover / centre-crop logic, then returns the result as a
 * JPEG Blob at the specified quality.
 */
export async function resizeImage(
  file: File,
  targetWidth: number,
  targetHeight: number,
  quality = 0.85,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // object-fit: cover — scale so the image fills the target, then centre-crop
      const srcRatio = img.naturalWidth / img.naturalHeight;
      const dstRatio = targetWidth / targetHeight;

      let sx = 0,
        sy = 0,
        sw = img.naturalWidth,
        sh = img.naturalHeight;

      if (srcRatio > dstRatio) {
        // Source is wider — crop sides
        sw = Math.round(img.naturalHeight * dstRatio);
        sx = Math.round((img.naturalWidth - sw) / 2);
      } else {
        // Source is taller — crop top/bottom
        sh = Math.round(img.naturalWidth / dstRatio);
        sy = Math.round((img.naturalHeight - sh) / 2);
      }

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob returned null"));
        },
        "image/jpeg",
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}
