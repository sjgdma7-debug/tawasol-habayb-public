export const uploadToCloudinary = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; url?: string; error?: string; public_id?: string; resource_type?: string; format?: string; bytes?: number; duration?: number }> => {
  try {
    // التحقق من وجود إعدادات Cloudinary
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;
    const apiSecret = process.env.NEXT_PUBLIC_CLOUDINARY_API_SECRET;
    
    if (!cloudName || !apiKey || !apiSecret) {
      return { success: false, error: "إعدادات Cloudinary غير مكتملة" };
    }

    // التحقق من حجم الملف (10MB كحد أقصى)
    const maxSizeInBytes = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSizeInBytes) {
      return { success: false, error: "حجم الملف كبير جداً. الحد الأقصى 10 ميجابايت" };
    }

    // تحديد نوع المورد بدقة أكبر
    let resourceType = "auto";
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (file.type.startsWith("image/")) {
      resourceType = "image";
    } else if (file.type.startsWith("video/")) {
      resourceType = "video";
    } else if (
      file.type.startsWith("audio/") || 
      ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(fileExtension || '')
    ) {
      resourceType = "video"; // Cloudinary يعامل الصوت كـ video
    } else {
      resourceType = "raw"; // للملفات الأخرى مثل PDF, DOC, etc
    }

    // إنشاء توقيع للأمان
    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = "chat_files";
    const publicId = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    // إنشاء FormData
    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", apiKey);
    formData.append("timestamp", timestamp.toString());
    formData.append("folder", folder);
    formData.append("public_id", publicId);
    
    // إنشاء التوقيع
    const crypto = await import('crypto-js');
    const paramsToSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.default.SHA1(paramsToSign).toString();
    formData.append("signature", signature);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();

      // تتبع تقدم الرفع
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && onProgress) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          onProgress(percentComplete);
        }
      });

      // عند اكتمال الرفع
      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve({ 
              success: true, 
              url: response.secure_url,
              public_id: response.public_id,
              resource_type: response.resource_type,
              format: response.format,
              bytes: response.bytes,
              duration: response.duration
            });
          } catch (e) {
            console.error("Parse error:", e);
            resolve({ success: false, error: "فشل معالجة الاستجابة" });
          }
        } else {
          let errorMessage = "فشل رفع الملف";
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            errorMessage = errorResponse.error?.message || errorMessage;
          } catch (e) {
            console.error("Error parsing error response:", e);
          }
          console.error("Upload failed with status:", xhr.status, xhr.responseText);
          resolve({ success: false, error: `${errorMessage} (${xhr.status})` });
        }
      });

      // في حالة حدوث خطأ في الشبكة
      xhr.addEventListener("error", (e) => {
        console.error("XHR error:", e);
        resolve({ success: false, error: "خطأ في الاتصال بالخادم" });
      });

      // في حالة انتهاء المهلة الزمنية
      xhr.addEventListener("timeout", () => {
        resolve({ success: false, error: "انتهت مهلة الرفع. يرجى المحاولة مرة أخرى" });
      });

      // تعيين مهلة زمنية أطول للملفات الكبيرة
      xhr.timeout = 300000; // 5 minutes
      xhr.open("POST", uploadUrl);
      xhr.send(formData);
    });
  } catch (error) {
    console.error("Upload error:", error);
    return { success: false, error: "حدث خطأ أثناء رفع الملف" };
  }
};

// دالة مساعدة للتحقق من دعم أنواع الملفات
export const isFileTypeSupported = (file: File): { supported: boolean; error?: string } => {
  const supportedTypes = {
    image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'],
    video: ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm'],
    audio: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'],
    document: ['pdf', 'doc', 'docx', 'txt', 'rtf'],
    archive: ['zip', 'rar', '7z', 'tar', 'gz']
  };

  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  if (!fileExtension) {
    return { supported: false, error: "نوع الملف غير محدد" };
  }

  const isSupported = Object.values(supportedTypes).some(types => 
    types.includes(fileExtension)
  );

  if (!isSupported) {
    return { supported: false, error: "نوع الملف غير مدعوم" };
  }

  return { supported: true };
};

// دالة للحصول على نوع الملف المناسب لعرضه
export const getFileDisplayType = (file: { type: string; name: string }) => {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(extension || '')) return 'audio';
  if (['pdf', 'doc', 'docx', 'txt'].includes(extension || '')) return 'document';
  
  return 'file';
};
