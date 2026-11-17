// Kompres foto di browser: max lebar 800px, kualitas 0.8 -> base64 (tanpa prefix data:)
export function compressImage(file, maxWidth = 800, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const base = file.name.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-').slice(0, 40) || 'foto';
      resolve({ base64: dataUrl.split(',')[1], preview: dataUrl, name: `${base}-${Date.now()}.jpg` });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Foto tidak bisa dibaca')); };
    img.src = url;
  });
}
