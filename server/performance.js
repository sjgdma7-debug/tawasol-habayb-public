// Performance optimization utilities
// أدوات تحسين الأداء

export class PerformanceOptimizer {
  constructor() {
    this.connectionMetrics = new Map();
    this.messageBuffers = new Map();
    this.performanceStats = {
      totalMessages: 0,
      avgResponseTime: 0,
      peakConnections: 0,
      memoryUsage: 0,
      startTime: Date.now()
    };
  }

  // مراقبة جودة الاتصال
  trackConnection(socketId, latency) {
    const quality = this.calculateConnectionQuality(latency);
    this.connectionMetrics.set(socketId, {
      latency,
      quality,
      lastUpdate: Date.now()
    });
    return quality;
  }

  // حساب جودة الاتصال
  calculateConnectionQuality(latency) {
    if (latency < 50) return 'excellent';
    if (latency < 100) return 'good';
    if (latency < 300) return 'fair';
    if (latency < 500) return 'poor';
    return 'slow';
  }

  // تحسين أحجام الـ buffers تلقائياً
  optimizeBuffers(activeConnections) {
    const baseSize = 5;
    let bufferSize = baseSize;
    
    if (activeConnections > 100) bufferSize = 10;
    if (activeConnections > 500) bufferSize = 20;
    if (activeConnections > 1000) bufferSize = 30;
    
    return bufferSize;
  }

  // ضغط البيانات للاتصالات البطيئة
  compressMessage(message, connectionQuality) {
    if (connectionQuality === 'poor' || connectionQuality === 'slow') {
      return {
        ...message,
        compressed: true,
        data: this.compress(message)
      };
    }
    return message;
  }

  // ضغط البيانات (simplified)
  compress(data) {
    // يمكن استخدام مكتبة ضغط فعلية هنا
    return JSON.stringify(data);
  }

  // تجميع الرسائل للاتصالات البطيئة
  batchMessages(roomId, message, connectionQuality) {
    const batchSize = connectionQuality === 'poor' ? 3 : 5;
    
    if (!this.messageBuffers.has(roomId)) {
      this.messageBuffers.set(roomId, []);
    }
    
    const buffer = this.messageBuffers.get(roomId);
    buffer.push(message);
    
    return buffer.length >= batchSize;
  }

  // إحصائيات الأداء
  getPerformanceStats() {
    const uptime = Date.now() - this.performanceStats.startTime;
    const memUsage = process.memoryUsage();
    
    return {
      ...this.performanceStats,
      uptime: uptime,
      memoryUsage: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
        external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100
      },
      connectionsCount: this.connectionMetrics.size
    };
  }

  // تنظيف الذاكرة
  cleanup(socketId) {
    this.connectionMetrics.delete(socketId);
    
    // تنظيف buffers فارغة
    this.messageBuffers.forEach((buffer, roomId) => {
      if (buffer.length === 0) {
        this.messageBuffers.delete(roomId);
      }
    });
  }

  // تحسين قاعدة البيانات
  getDatabaseOptimizations() {
    return {
      // Indexes للرسائل
      messageIndexes: [
        { roomID: 1, createdAt: -1 },
        { sender: 1 },
        { tempId: 1 },
        { seen: 1 }
      ],
      // Indexes للمستخدمين
      userIndexes: [
        { username: 1 },
        { phone: 1 },
        { status: 1 }
      ],
      // Indexes للغرف
      roomIndexes: [
        { participants: 1 },
        { type: 1, updatedAt: -1 },
        { creator: 1 }
      ]
    };
  }

  // اقتراحات التحسين
  getSuggestions(stats) {
    const suggestions = [];
    
    if (stats.memoryUsage.heapUsed > 200) {
      suggestions.push({
        type: 'memory',
        message: 'استخدام الذاكرة مرتفع، يُنصح بتشغيل garbage collection',
        action: 'run_gc'
      });
    }
    
    if (stats.avgResponseTime > 1000) {
      suggestions.push({
        type: 'performance',
        message: 'وقت الاستجابة بطيء، يُنصح بتحسين استعلامات قاعدة البيانات',
        action: 'optimize_queries'
      });
    }
    
    if (stats.connectionsCount > 500) {
      suggestions.push({
        type: 'scaling',
        message: 'عدد الاتصالات مرتفع، يُنصح بتوسيع الخادم',
        action: 'scale_server'
      });
    }
    
    return suggestions;
  }
}

export default PerformanceOptimizer;