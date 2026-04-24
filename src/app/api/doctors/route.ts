import { NextRequest, NextResponse } from "next/server";
import connectToDB from "@/db";
import UserSchema from "@/schemas/userSchema";

// GET - جلب جميع البنات
export async function GET(request: NextRequest) {
  try {
    await connectToDB();

    // جلب جميع المستخدمين الذين role=doctor
    const doctors = await UserSchema.find({ role: "doctor" })
      .select("name lastName username phone avatar biography status _id")
      .lean();

    return NextResponse.json({
      success: true,
      doctors,
    });
  } catch (error) {
    console.error("Error fetching doctors:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch doctors" },
      { status: 500 }
    );
  }
}
