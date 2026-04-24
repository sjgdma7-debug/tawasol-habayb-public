import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary, UploadApiOptions, UploadApiResponse } from 'cloudinary';

// إعداد Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.NEXT_PUBLIC_CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    // تم الافتراض هنا أن الخطأ في السطر 24 هو تحويل `formData.get('file')` إلى `File`
    const file = formData.get('file') as File; 
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'لم يتم تحديد ملف' },
        { status: 400 }
      );
    }

    // التحقق من حجم الملف (10MB كحد أقصى)
    const maxSizeInBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      return NextResponse.json(
        { success: false, error: 'حجم الملف كبير جداً. الحد الأقصى 10 ميجابايت' },
        { status: 400 }
      );
    }

    // تحديد نوع المورد
    let resourceType: string = 'auto';
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (file.type.startsWith('image/')) {
      resourceType = 'image';
    } else if (file.type.startsWith('video/')) {
      resourceType = 'video';
    } else if (
      file.type.startsWith('audio/') || 
      ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(fileExtension || '')
    ) {
      resourceType = 'video'; // Cloudinary يعامل الصوت كـ video
    } else {
      resourceType = 'raw';
    }

    // تحويل الملف إلى buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // رفع الملف
    const uploadResponse = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          // ✅ تصحيح الخطأ: استخدام النوع الصحيح لـ resource_type
          resource_type: resourceType as UploadApiOptions['resource_type'], 
          folder: 'chat_files',
          public_id: `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`,
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      ).end(buffer);
    });

    // ✅ تصحيح الخطأ: استخدام النوع الصحيح لنتائج الرفع
    const result = uploadResponse as UploadApiResponse; 

    return NextResponse.json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      resource_type: result.resource_type,
      format: result.format,
      bytes: result.bytes,
      duration: result.duration,
    });

  } catch (uploadError) {
    console.error('Upload error:', uploadError);
    return NextResponse.json(
      { success: false, error: 'حدث خطأ أثناء رفع الملف' },
      { status: 500 }
    );
  }
}

// التحقق من حالة الخدمة (كما هو)
export async function GET() {
  try {
    const result = await cloudinary.api.ping();
    
    return NextResponse.json({
      success: true,
      status: 'OK',
      cloudinary_status: result.status,
      message: 'خدمة رفع الملفات تعمل بشكل صحيح'
    });
  } catch (getError) {
    console.error('Cloudinary GET error:', getError);
    return NextResponse.json(
      { success: false, error: 'خطأ في الاتصال بخدمة التخزين السحابي' },
      { status: 500 }
    );
  }
}
