import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary'; // ✅ إزالة DestroyOptions و UploadApiResponse لأنها غير ضرورية هنا

// 1. تعريف واجهات (Interfaces) لـ Request Bodies
// ✅ استخدم النوع الصريح بدلاً من DestroyOptions['resource_type']
interface DeleteFileRequestBody {
  public_id: string;
  resource_type?: 'image' | 'video' | 'raw';
}

interface BulkDeleteRequestBody {
  public_ids: string[];
  resource_type?: 'image' | 'video' | 'raw';
}

// ✅ إعداد Cloudinary مرة واحدة فقط
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.NEXT_PUBLIC_CLOUDINARY_API_SECRET,
  secure: true,
});

// 🚀 حذف ملف واحد
export async function POST(request: NextRequest) {
  try {
    const { public_id, resource_type = 'image' } = (await request.json()) as DeleteFileRequestBody;

    if (!public_id || typeof public_id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'معرف الملف (public_id) مطلوب ويجب أن يكون نصًا.' },
        { status: 400 }
      );
    }

    // 🗑️ حذف الملف
    const result = await cloudinary.uploader.destroy(public_id, {
      resource_type,
      invalidate: true,
    });

    if (result.result === 'ok') {
      return NextResponse.json({
        success: true,
        message: `تم حذف الملف "${public_id}" بنجاح.`,
        data: result,
      });
    }

    if (result.result === 'not found') {
      return NextResponse.json({
        success: true,
        message: `الملف "${public_id}" غير موجود في Cloudinary.`,
        data: result,
      });
    }

    return NextResponse.json(
      { success: false, error: `فشل في حذف الملف. نتيجة Cloudinary: ${result.result}` },
      { status: 500 }
    );

  } catch (error: unknown) {
    console.error('Delete (POST) Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير معروف أثناء معالجة طلب الحذف.';

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// 🚀 حذف عدة ملفات
export async function DELETE(request: NextRequest) {
  try {
    const { public_ids, resource_type = 'image' } = (await request.json()) as BulkDeleteRequestBody;

    if (!public_ids || !Array.isArray(public_ids) || public_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'قائمة معرفات الملفات (public_ids) مطلوبة ويجب أن تكون مصفوفة غير فارغة.' },
        { status: 400 }
      );
    }

    // 🗑️ حذف عدة ملفات دفعة واحدة
    const result = await cloudinary.api.delete_resources(public_ids, {
      resource_type,
      type: 'upload',
      invalidate: true,
    });

    const deletedCount = Object.keys(result.deleted || {}).length;
    const notFoundCount = Object.keys(result.not_found || {}).length;
    const totalProcessed = public_ids.length;

    return NextResponse.json({
      success: true,
      deleted_count: deletedCount,
      not_found_count: notFoundCount,
      total_count: totalProcessed,
      message: `تمت معالجة ${totalProcessed} ملف. تم حذف ${deletedCount} ملف بنجاح.`,
      data: result,
    });

  } catch (error: unknown) {
    console.error('Bulk Delete (DELETE) Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير معروف أثناء معالجة طلب الحذف بالجملة.';

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
