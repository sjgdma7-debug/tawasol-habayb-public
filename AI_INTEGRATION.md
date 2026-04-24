# دمج الذكاء الصناعي الطبي مع Socket.io Server

## الخطوات المطلوبة لدمج AI في server/index.js

### 1. إضافة الاستيراد في أعلى الملف:

```javascript
import { handleAIMessage, isAIRoom } from './aiHandler.js';
import OpenAI from 'openai';
```

### 2. تحديث schema المستخدم لإضافة حقل role:

في UserSchema، أضف:
```javascript
role: { type: String, enum: ["user", "doctor", "admin"], default: "user" },
isPaid: { type: Boolean, default: false },
```

### 3. إضافة معالج AI في event handler للرسائل:

ابحث عن `socket.on('newMessage', async (data, callback) => {`

وأضف هذا الكود **بعد** إنشاء الرسالة وقبل callback:

```javascript
// بعد السطر: await Room.findOneAndUpdate...

// معالجة AI التلقائية
const isRoomWithAI = await isAIRoom(Room, User, roomID);
if (isRoomWithAI) {
  // انتظار ثانية واحدة ثم الرد
  setTimeout(async () => {
    await handleAIMessage({
      Message,
      Room,
      User,
      io,
      roomID,
      userMessage: message,
      senderID: sender
    });
  }, 1000);
}
```

### 4. إنشاء حساب AI عند بدء السيرفر:

أضف هذا الكود بعد الاتصال بـ MongoDB:

```javascript
// بعد: await mongoose.connect(MONGODB_URI);

// إنشاء حساب AI إذا لم يكن موجوداً
const aiUsername = "medical_ai_assistant";
let aiUser = await User.findOne({ username: aiUsername });

if (!aiUser) {
  const bcrypt = await import('bcrypt');
  const hashedPassword = await bcrypt.hash("AI_MEDICAL_2025_SECURE", 10);
  
  aiUser = await User.create({
    name: "المساعد الطبي",
    lastName: "الذكي",
    username: aiUsername,
    password: hashedPassword,
    phone: "+966500000001",
    avatar: "/ai-doctor-avatar.png",
    biography: "أنا مساعد طبي ذكي هنا لمساعدتك",
    role: "user",
    isPaid: true,
    status: "online",
    type: "private",
  });
  
  console.log('✅ تم إنشاء حساب AI:', aiUser._id);
}
```

## ملاحظات مهمة:

1. **تأكد من إضافة OPENAI_API_KEY في .env**
2. **الـ AI يرد تلقائياً بعد ثانية واحدة من استلام الرسالة**
3. **AI لا يرد على رسائله الخاصة (لتجنب التكرار)**
4. **يستخدم آخر 10 رسائل كسياق للمحادثة**

## اختبار التكامل:

1. شغّل السيرفر
2. سجّل دخول كمستخدم
3. افتح الصفحة الطبية: `/?medical=true`
4. اضغط على "المساعد الطبي الذكي"
5. أرسل رسالة وانتظر الرد التلقائي

---

تم إنشاء هذا الدليل لتسهيل دمج الذكاء الصناعي في المشروع 🚀
