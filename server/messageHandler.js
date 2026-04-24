// Enhanced Message Handler for Better Performance
// معالج رسائل محسن للأداء الأفضل

import { PerformanceOptimizer } from './performance.js';

export class MessageHandler {
  constructor(io, Message, Room, User) {
    this.io = io;
    this.Message = Message;
    this.Room = Room;
    this.User = User;
    this.optimizer = new PerformanceOptimizer();
    this.messageQueue = new Map();
    this.processingQueue = new Map();
  }

  // معالجة الرسالة مع تحسين الأداء
  async handleMessage(socket, data, callback) {
    const startTime = Date.now();
    
    try {
      const { roomID, sender, message, replayData, voiceData, tempId, fileData } = data;
      
      // التحقق من صحة البيانات
      if (!roomID || !sender) {
        if (callback) callback({ success: false, error: 'Invalid data' });
        return;
      }

      // التحقق من جودة الاتصال
      const connectionQuality = this.optimizer.connectionMetrics.get(socket.id)?.quality || 'good';
      
      // معالجة متقدمة حسب جودة الاتصال
      if (connectionQuality === 'poor' || connectionQuality === 'slow') {
        return await this.handleSlowConnection(socket, data, callback);
      } else {
        return await this.handleNormalMessage(socket, data, callback);
      }
      
    } catch (error) {
      console.error('❌ Error in message handler:', error);
      if (callback) callback({ success: false, error: 'Processing failed' });
    } finally {
      // تحديث إحصائيات الأداء
      const responseTime = Date.now() - startTime;
      this.optimizer.performanceStats.avgResponseTime = 
        (this.optimizer.performanceStats.avgResponseTime + responseTime) / 2;
      this.optimizer.performanceStats.totalMessages++;
    }
  }

  // معالجة الاتصالات البطيئة
  async handleSlowConnection(socket, data, callback) {
    const { roomID } = data;
    
    // إضافة الرسالة للـ queue
    if (!this.messageQueue.has(roomID)) {
      this.messageQueue.set(roomID, []);
    }
    
    this.messageQueue.get(roomID).push({ socket, data, callback });
    
    // معالجة الـ queue إذا امتلأ أو بعد وقت معين
    const shouldProcess = this.optimizer.batchMessages(roomID, data, 'poor');
    
    if (shouldProcess) {
      await this.processBatchedMessages(roomID);
    } else {
      // إعداد timer للمعالجة
      if (!this.processingQueue.has(roomID)) {
        this.processingQueue.set(roomID, setTimeout(() => {
          this.processBatchedMessages(roomID);
          this.processingQueue.delete(roomID);
        }, 2000));
      }
    }
  }

  // معالجة رسالة عادية
  async handleNormalMessage(socket, data, callback) {
    return await this.processMessage(socket, data, callback);
  }

  // معالجة الرسائل المجمعة
  async processBatchedMessages(roomID) {
    const batch = this.messageQueue.get(roomID);
    if (!batch || batch.length === 0) return;

    console.log(`📦 Processing batch of ${batch.length} messages for room ${roomID}`);

    try {
      // معالجة الرسائل بشكل متوازي
      const promises = batch.map(({ socket, data, callback }) => 
        this.processMessage(socket, data, callback)
      );
      
      await Promise.allSettled(promises);
      
      // تنظيف الـ queue
      this.messageQueue.set(roomID, []);
      
    } catch (error) {
      console.error('❌ Error processing batch:', error);
    }
  }

  // معالجة رسالة واحدة
  async processMessage(socket, data, callback) {
    try {
      const { roomID, sender, message, replayData, voiceData, tempId, fileData } = data;
      
      // التحقق من الحظر
      const isBlocked = await this.checkBlocking(sender, roomID);
      if (isBlocked) {
        if (callback) callback({ success: true, _id: 'blocked_' + Date.now() });
        return;
      }
      
      const msgData = {
        sender,
        message,
        roomID,
        seen: [],
        voiceData,
        fileData,
        createdAt: Date.now(),
        tempId,
        status: 'sent',
      };

      // التحقق من وجود الرسالة
      let newMsg = await this.Message.findOne({ tempId }).lean();

      if (newMsg) {
        // الرسالة موجودة مسبقاً
        await this.handleExistingMessage(socket, newMsg, roomID, replayData, callback);
      } else {
        // إنشاء رسالة جديدة
        await this.createNewMessage(socket, msgData, roomID, replayData, callback);
      }
      
    } catch (error) {
      console.error('❌ Error processing message:', error);
      if (callback) callback({ success: false, error: 'Failed to send message' });
    }
  }

  // التحقق من الحظر
  async checkBlocking(senderId, roomID) {
    try {
      const room = await this.Room.findById(roomID).populate('participants', 'blockedUsers _id');
      if (!room || room.type !== 'private') return false;

      const senderUser = await this.User.findById(senderId).select('blockedUsers');
      if (!senderUser || !senderUser.blockedUsers) return false;

      const otherParticipant = room.participants.find(
        (p) => p && p._id && p._id.toString() !== senderId.toString()
      );

      if (!otherParticipant) return false;

      return senderUser.blockedUsers.some(
        (blockedId) => blockedId && blockedId.toString() === otherParticipant._id.toString()
      );
    } catch (error) {
      console.error('❌ Error checking blocking:', error);
      return false;
    }
  }

  // معالجة رسالة موجودة
  async handleExistingMessage(socket, existingMsg, roomID, replayData, callback) {
    const populatedMsg = await this.Message.findById(existingMsg._id)
      .populate('sender', 'name lastName username avatar _id')
      .lean();

    socket.to(roomID).emit('newMessage', {
      ...populatedMsg,
      replayedTo: replayData ? replayData.replayedTo : null,
    });

    socket.emit('newMessageIdUpdate', { tempId: existingMsg.tempId, _id: existingMsg._id });
    this.io.to(roomID).emit('lastMsgUpdate', populatedMsg);
    this.io.to(roomID).emit('updateLastMsgData', { msgData: populatedMsg, roomID });
    
    if (callback) callback({ success: true, _id: existingMsg._id });
  }

  // إنشاء رسالة جديدة
  async createNewMessage(socket, msgData, roomID, replayData, callback) {
    const newMsg = await this.Message.create(msgData);
    const populatedMsg = await this.Message.findById(newMsg._id)
      .populate('sender', 'name lastName username avatar _id')
      .lean();

    socket.to(roomID).emit('newMessage', {
      ...populatedMsg,
      replayedTo: replayData ? replayData.replayedTo : null,
    });

    socket.emit('newMessageIdUpdate', { tempId: msgData.tempId, _id: newMsg._id });
    this.io.to(roomID).emit('lastMsgUpdate', populatedMsg);
    this.io.to(roomID).emit('updateLastMsgData', { msgData: populatedMsg, roomID });

    // معالجة الرد على رسالة
    if (replayData) {
      await this.Message.findOneAndUpdate(
        { _id: replayData.targetID },
        { $push: { replays: newMsg._id } }
      );
      newMsg.replayedTo = replayData.replayedTo;
      await newMsg.save();
    }

    // إضافة الرسالة للغرفة
    await this.Room.findOneAndUpdate(
      { _id: roomID },
      { $push: { messages: newMsg._id } }
    );

    if (callback) callback({ success: true, _id: newMsg._id });
  }

  // تنظيف الذاكرة
  cleanup(socketId) {
    this.optimizer.cleanup(socketId);
    
    // تنظيف الـ queues
    this.messageQueue.forEach((queue, roomId) => {
      const filteredQueue = queue.filter(item => item.socket.id !== socketId);
      if (filteredQueue.length > 0) {
        this.messageQueue.set(roomId, filteredQueue);
      } else {
        this.messageQueue.delete(roomId);
      }
    });
  }

  // الحصول على إحصائيات
  getStats() {
    return {
      ...this.optimizer.getPerformanceStats(),
      queuedMessages: Array.from(this.messageQueue.values())
        .reduce((sum, queue) => sum + queue.length, 0),
      activeQueues: this.messageQueue.size
    };
  }
}

export default MessageHandler;