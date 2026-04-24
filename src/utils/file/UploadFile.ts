// لا نحتاج إلى S3، نحتاج فقط إلى ضغط الصورة
import compressImage from "./CompressImage";

// لا نحتاج إلى هذه المتغيرات بعد الآن إذا كنا نستخدم الرفع غير الموقّع
// const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
// const API_KEY = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;

const checkNetworkConnectivity = async (): Promise<boolean> => {
  // ... (نفس الدالة الأصلية للتحقق من الاتصال)
  if (!navigator.onLine) {
    return false;
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    await fetch("https://www.google.com/favicon.ico", {
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return true;
  } catch (error) {
    console.error("Network check failed:", error);
    return false;
  }
};

// 🌟 المفاتيح المستخدمة في هذا التعديل 🌟
const CLOUD_NAME = "dta1febjy"; // من متغير NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

// اسم مجموعة الإعدادات المُخصصة للرفع (Upload Preset)
// يجب عليك إنشاء هذه المجموعة في إعدادات Cloudinary وتحديد أنها "غير موقعة"
const UPLOAD_PRESET = "Your_Unsigned_Upload_Preset"; // **يجب عليك تغيير هذا**

const uploadFile = async (
  file: File,
  onProgress?: (progress: number) => void
) => {
  let uploadFile: File = file;

  if (file.type.match("image.*")) {
    // لا يزال بإمكاننا ضغط الصورة قبل الرفع لتقليل وقت النقل
    uploadFile = await compressImage(file);
  }

  try {
    // 1. إنشاء رابط Cloudinary للرفع
    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;
    
    // 2. تجهيز بيانات الرفع (FormData)
    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("upload_preset", UPLOAD_PRESET);
    // يمكنك إضافة مجلد معين للصور هنا:
    // formData.append("folder", file.type.match("image.*") ? "images" : "files");


    // 3. إرسال طلب الرفع
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);

    // متابعة التقدم (Progress Tracking)
    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    // إرجاع وعد (Promise) لانتظار نتيجة الرفع
    const result = await new Promise((resolve, reject) => {
      xhr.onload = () => {
        if (xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText);
            // Cloudinary ترجع رابط الملف في خاصية secure_url
            resolve(data.secure_url);
          } catch {
            reject(new Error("Failed to parse Cloudinary response."));
          }
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText);
            reject(new Error(errorData.error.message || `Cloudinary upload failed with status: ${xhr.status}`));
          } catch {
            reject(new Error(`Cloudinary upload failed with status: ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error("Network error during Cloudinary upload."));
      };

      xhr.send(formData);
    });

    return result as string; // رابط الملف المرفوع
  } catch (error) {
    console.error("Upload failed:", error);
    throw error; // أعد رمي الخطأ ليتم معالجته بواسطة دالة uploadFileWithRetry
  }
};

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

const uploadFileWithRetry = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; error?: string; downloadUrl?: string }> => {
  // ... (نفس منطق إعادة المحاولة)
  const isConnected = await checkNetworkConnectivity();
  if (!isConnected) {
    return {
      success: false,
      error:
        "Network connection unavailable. Please check your internet connection.",
    };
  }

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const result = await uploadFile(file, onProgress);
      return { success: true, downloadUrl: result };
    } catch (error: unknown) {
      if (i < MAX_RETRIES - 1) {
        console.warn(
          `Upload failed, retrying in ${
            RETRY_DELAY_MS / 1000
          } seconds... (Attempt ${i + 1}/${MAX_RETRIES})`,
          error
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      } else {
        console.error("Max retries reached. Upload failed permanently.", error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Upload failed permanently.",
        };
      }
    }
  }
  return { success: false, error: "Unknown error during upload." };
};

export default uploadFileWithRetry;
