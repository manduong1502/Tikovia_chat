export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Hàm nén ảnh ở phía Client bằng HTML5 Canvas trước khi upload
export const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        // Kích thước tối đa FullHD 1920x1080
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1080;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Chuyển đổi sang Blob dạng JPEG với chất lượng nén 75%
        canvas.toBlob(
          (blob) => {
            if (blob) {
              // Tạo một File object mới giữ nguyên tên file gốc nhưng đổi đuôi sang .jpg
              const cleanName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
              const compressedFile = new File([blob], `${cleanName}.jpg`, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              console.log(`[Image Compression] Dung lượng gốc: ${(file.size / 1024 / 1024).toFixed(2)}MB -> Dung lượng nén: ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.75
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

// Định dạng thời gian giây sang mm:ss
export const formatTime = (secs) => {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};
