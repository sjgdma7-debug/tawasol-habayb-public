// AI Message Handler for Chat Assistant with Typing Status
// معالج رسائل الذكاء الصناعي مع حالة الكتابة
// ✅ مُحوَّل للعمل مع Groq API بدلاً من OpenAI

import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import https from 'https';
import http from 'http';

dotenv.config();

// ✅ إنشاء عميل Groq
const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const AI_USERNAME = "hub_ai";
const AI_TYPING_DELAY = 2000; // مدة إظهار حالة الكتابة بالميلي ثانية

// ✅ النماذج المستخدمة
const MODELS = {
  TEXT: "llama-3.3-70b-versatile",       // للردود النصية القوية
  VISION: "meta-llama/llama-4-scout-17b-16e-instruct", // لتحليل الصور
  FAST: "llama-3.1-8b-instant",           // للمهام السريعة
};

// System message للذكاء الاصطناعي
const SYSTEM_MESSAGE = {
  role: "system",
  content: `أنت مساعد ذكي وودود. مهمتك هي الدردشة مع المستخدمين وتقديم المساعدة بطريقة ممتعة وودية.

تذكر دائماً:
1. كن لطيفاً ومرحاً في محادثاتك
2. استخدم لغة بسيطة وواضحة
3. شجع على التواصل الإيجابي
4. كن متعاوناً ومساعداً
5. استخدم الإيموجي المناسبة لإضفاء جو مرح
6. الرد يجب أن يكون بالعربية`,
};

/**
 * ✅ دالة تحويل الصورة من URL إلى Base64
 * مهم: Groq يفضل Base64 لتجنب أخطاء 403 Forbidden
 */
async function imageUrlToBase64(url) {
  return new Promise((resolve, reject) => {
    try {
      const protocol = url.startsWith('https') ? https : http;
      
      protocol.get(url, (response) => {
        // في حالة إعادة التوجيه
        if (response.statusCode === 301 || response.statusCode === 302) {
          imageUrlToBase64(response.headers.location).then(resolve).catch(reject);
          return;
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        
        const contentType = response.headers['content-type'] || 'image/jpeg';
        const chunks = [];
        
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const base64 = buffer.toString('base64');
          resolve({ base64, contentType });
        });
        response.on('error', reject);
      }).on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * دالة إظهار حالة الكتابة للذكاء الاصطناعي
 */
async function showAITypingStatus(io, roomID, aiUser, isTyping = true) {
  try {
    const typingData = {
      userId: aiUser._id,
      userName: aiUser.name,
      userAvatar: aiUser.avatar,
      isTyping: isTyping,
      isAI: true,
      timestamp: new Date()
    };

    // إرسال حالة الكتابة لجميع المستخدمين في الغرفة
    io.to(roomID).emit('userTyping', typingData);
    
    console.log(`🤖 AI typing status: ${isTyping ? 'يكتب...' : 'توقف عن الكتابة'}`);
  } catch (error) {
    console.error('❌ Error showing AI typing status:', error);
  }
}

/**
 * دالة محاكاة كتابة تدريجية (كتابة الرد كلمة بكلمة)
 */
async function simulateTypingEffect(io, roomID, aiUser, message) {
  try {
    const words = message.split(' ');
    let currentMessage = '';
    
    for (let i = 0; i < words.length; i++) {
      currentMessage += (i > 0 ? ' ' : '') + words[i];
      
      // إرسال الجزء المكتوب حتى الآن
      io.to(roomID).emit('aiTypingProgress', {
        aiId: aiUser._id,
        partialMessage: currentMessage,
        isComplete: i === words.length - 1
      });
      
      // تأخير قصير بين الكلمات لمحاكاة الكتابة الطبيعية
      await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 100));
    }
  } catch (error) {
    console.error('❌ Error in typing simulation:', error);
  }
}

/**
 * ✅ معالج رسائل AI مع دعم الصور والملفات وحالة الكتابة - يعمل مع Groq
 */
export async function handleAIMessage({ Message, Room, User, io, roomID, userMessage, senderID, fileData = null }) {
  try {
    // 1. الحصول على حساب AI
    const aiUser = await User.findOne({ username: AI_USERNAME });
    if (!aiUser) {
      console.error('❌ AI user not found');
      return;
    }

    // 2. التحقق من أن المرسل ليس AI نفسه (لتجنب التكرار)
    if (senderID === aiUser._id.toString()) {
      return;
    }

    // 3. إظهار أن AI بدأ في الكتابة فوراً
    await showAITypingStatus(io, roomID, aiUser, true);

    // 4. جلب آخر 10 رسائل من المحادثة للسياق
    const room = await Room.findById(roomID).populate({
      path: 'messages',
      options: { sort: { createdAt: -1 }, limit: 10 },
      populate: { path: 'sender', select: 'name _id' }
    });

    if (!room) {
      console.error('❌ Room not found');
      await showAITypingStatus(io, roomID, aiUser, false);
      return;
    }

    // 5. بناء تاريخ المحادثة
    const conversationHistory = room.messages
      .reverse()
      .map(msg => ({
        role: msg.sender._id.toString() === aiUser._id.toString() ? 'assistant' : 'user',
        content: msg.message || 'رسالة صوتية أو ملف',
      }))
      .slice(-10);

    // 6. ✅ استدعاء Groq API مع دعم الصور
    let aiResponse;
    try {
      const messages = [SYSTEM_MESSAGE, ...conversationHistory];
      
      // التحقق من وجود صورة أو ملف
      if (fileData && fileData.url) {
        const fileType = fileData.type?.toLowerCase() || '';
        
        if (fileType.includes('image') || fileData.url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          console.log('📸 Analyzing image with Groq Vision...');
          
          try {
            // ✅ تحويل الصورة إلى Base64 لتجنب أخطاء 403
            console.log('🔄 Converting image to Base64...');
            const { base64, contentType } = await imageUrlToBase64(fileData.url);
            const imageDataUrl = `data:${contentType};base64,${base64}`;
            
            messages.push({
              role: "user",
              content: [
                {
                  type: "text",
                  text: userMessage || "يرجى تحليل هذه الصورة وإعطاء تفاصيل عما تراه"
                },
                {
                  type: "image_url",
                  image_url: {
                    url: imageDataUrl  // ✅ Base64 بدلاً من URL مباشر
                  }
                }
              ]
            });
            
            // ✅ استخدام نموذج Vision من Groq
            const processingDelay = 1000 + Math.random() * 2000;
            await new Promise(resolve => setTimeout(resolve, processingDelay));
            
            const response = await client.chat.completions.create({
              model: MODELS.VISION,
              messages: messages,
              temperature: 0.7,
              max_tokens: 1024,
            });
            
            aiResponse = response.choices[0]?.message?.content || "عذراً، لم أتمكن من تحليل الصورة.";
            console.log('✅ Image analyzed successfully with Groq Vision');
            
          } catch (imageError) {
            console.error('❌ Error processing image:', imageError);
            // في حالة فشل تحليل الصورة، نرسل رسالة نصية
            messages.push({
              role: "user",
              content: `${userMessage || 'تم إرسال صورة'}. (ملاحظة: لم يتم تحميل الصورة بشكل صحيح، يرجى وصف المحتوى)`
            });
            
            const response = await client.chat.completions.create({
              model: MODELS.TEXT,
              messages: messages,
              temperature: 0.7,
              max_tokens: 800,
            });
            
            aiResponse = response.choices[0]?.message?.content || "عذراً، لم أتمكن من تحليل الصورة. يرجى وصف ما تراه في الصورة.";
          }
          
        } else {
          // ملف غير صورة
          messages.push({
            role: "user",
            content: `تم إرسال ملف: ${fileData.name || 'ملف'} (${fileType}). ${userMessage || ''}`
          });
          
          const processingDelay = 1000 + Math.random() * 2000;
          await new Promise(resolve => setTimeout(resolve, processingDelay));
          
          // ✅ استخدام النموذج النصي القوي
          const response = await client.chat.completions.create({
            model: MODELS.TEXT,
            messages: messages,
            temperature: 0.7,
            max_tokens: 800,
          });
          
          aiResponse = response.choices[0]?.message?.content || "عذراً، لم أتمكن من الرد في الوقت الحالي.";
        }
        
      } else {
        // رسالة نصية عادية
        messages.push({ role: "user", content: userMessage });

        // محاكاة وقت المعالجة (1-3 ثواني)
        const processingDelay = 1000 + Math.random() * 2000;
        await new Promise(resolve => setTimeout(resolve, processingDelay));

        // ✅ استخدام النموذج النصي القوي من Groq
        const response = await client.chat.completions.create({
          model: MODELS.TEXT,
          messages: messages,
          temperature: 0.7,
          max_tokens: 800,
        });

        aiResponse = response.choices[0]?.message?.content || "عذراً، لم أتمكن من الرد في الوقت الحالي.";
      }
      
    } catch (groqError) {
      console.error('❌ Groq API Error:', groqError);
      
      // التحقق من نوع الخطأ
      if (groqError?.status === 429) {
        aiResponse = "⚠️ عذراً، الخادم مشغول حالياً. يرجى المحاولة مرة أخرى بعد لحظة.";
      } else if (groqError?.status === 401) {
        aiResponse = "⚠️ خطأ في المصادقة. يرجى التواصل مع الدعم التقني.";
      } else {
        aiResponse = "عذراً، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.";
      }
    }

    // 7. محاكاة الكتابة التدريجية (اختياري)
    await simulateTypingEffect(io, roomID, aiUser, aiResponse);

    // 8. تأخير قصير قبل إرسال الرد النهائي
    await new Promise(resolve => setTimeout(resolve, 500));

    // 9. إخفاء حالة الكتابة
    await showAITypingStatus(io, roomID, aiUser, false);

    // 10. إنشاء رسالة رد من AI
    const aiMessageData = {
      sender: aiUser._id,
      message: aiResponse,
      roomID: roomID,
      seen: [],
      voiceData: null,
      fileData: null,
      createdAt: new Date(),
      tempId: `ai_${Date.now()}`,
      status: 'sent',
    };

    const aiMessage = await Message.create(aiMessageData);
    const populatedAiMessage = await Message.findById(aiMessage._id)
      .populate('sender', 'name lastName username avatar _id')
      .lean();

    // 11. إضافة الرسالة للغرفة
    await Room.findOneAndUpdate(
      { _id: roomID },
      { $push: { messages: aiMessage._id } }
    );

    // 12. إرسال الرسالة النهائية عبر Socket.io
    io.to(roomID).emit('newMessage', populatedAiMessage);
    io.to(roomID).emit('lastMsgUpdate', populatedAiMessage);
    io.to(roomID).emit('updateLastMsgData', { msgData: populatedAiMessage, roomID });

    console.log('✅ Groq AI responded to message in room:', roomID);

  } catch (error) {
    console.error('❌ Error in AI message handler:', error);
    
    // في حالة الخطأ، تأكد من إخفاء حالة الكتابة
    const aiUser = await User.findOne({ username: AI_USERNAME });
    if (aiUser) {
      await showAITypingStatus(io, roomID, aiUser, false);
    }
  }
}

/**
 * التحقق من أن الغرفة تحتوي على AI
 */
export async function isAIRoom(Room, User, roomID) {
  try {
    const aiUser = await User.findOne({ username: AI_USERNAME });
    if (!aiUser) return false;

    const room = await Room.findById(roomID);
    if (!room) return false;

    return room.participants.some(p => p.toString() === aiUser._id.toString());
  } catch (error) {
    console.error('❌ Error checking AI room:', error);
    return false;
  }
}

/**
 * دالة تحديث حالة AI إلى متصل
 */
export async function setAIOnlineStatus(User, io) {
  try {
    const aiUser = await User.findOneAndUpdate(
      { username: AI_USERNAME },
      { 
        status: 'online',
        lastSeen: new Date()
      },
      { new: true }
    );

    if (aiUser) {
      // إرسال حالة الاتصال لجميع المستخدمين
      io.emit('userStatusUpdate', {
        userId: aiUser._id,
        status: 'online',
        isAI: true,
        timestamp: new Date()
      });
      
      console.log('🤖 AI status updated to ONLINE (Groq powered)');
    }
  } catch (error) {
    console.error('❌ Error updating AI status:', error);
  }
}
