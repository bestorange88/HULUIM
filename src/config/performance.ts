/**
 * 性能配置中心 - 高并发优化版
 * 目标：支持 20 万在线用户
 */

export const PERFORMANCE_CONFIG = {
  // ============================================
  // Realtime 优化配置
  // ============================================
  
  /**
   * 大群聊 Typing 状态阈值
   * 超过此人数的群聊将禁用 typing 状态广播
   */
  TYPING_DISABLED_THRESHOLD: 100, // 降低阈值，更早禁用typing
  
  /**
   * Presence 心跳间隔（毫秒）
   */
  PRESENCE_HEARTBEAT_INTERVAL: 60000, // 60秒，降低心跳频率
  
  /**
   * Typing 状态自动清除时间（毫秒）
   */
  TYPING_AUTO_CLEAR_TIMEOUT: 5000, // 5秒
  
  /**
   * 同一用户多窗口合并
   */
  ENABLE_MULTI_TAB_MERGE: true,
  
  // ============================================
  // 消息加载优化
  // ============================================
  
  /**
   * 消息分页大小 - 初始加载
   */
  MESSAGE_PAGE_SIZE: 30, // 减少初始加载量
  
  /**
   * 消息预加载阈值
   */
  MESSAGE_PRELOAD_THRESHOLD: 5,
  
  /**
   * 历史消息缓存时间（毫秒）
   */
  MESSAGE_CACHE_TTL: 600000, // 10分钟
  
  /**
   * 消息虚拟列表阈值
   * 超过此数量启用虚拟滚动
   */
  MESSAGE_VIRTUAL_SCROLL_THRESHOLD: 100,
  
  // ============================================
  // 会话列表优化
  // ============================================
  
  /**
   * 会话列表初始加载数量
   */
  CONVERSATION_INITIAL_LOAD: 20,
  
  /**
   * 会话列表虚拟滚动阈值
   */
  CONVERSATION_VIRTUAL_SCROLL_THRESHOLD: 50,
  
  /**
   * 会话列表刷新间隔（毫秒）
   */
  CONVERSATION_REFRESH_INTERVAL: 30000, // 30秒
  
  // ============================================
  // 在线状态优化
  // ============================================
  
  /**
   * 在线状态更新节流（毫秒）
   */
  ONLINE_STATUS_THROTTLE: 10000, // 10秒
  
  /**
   * 离线判定时间（毫秒）
   */
  OFFLINE_TIMEOUT: 120000, // 120秒
  
  // ============================================
  // 网络请求优化
  // ============================================
  
  /**
   * API 请求并发限制
   */
  MAX_CONCURRENT_REQUESTS: 4, // 降低并发
  
  /**
   * 请求重试次数
   */
  REQUEST_RETRY_COUNT: 2,
  
  /**
   * 请求超时时间（毫秒）
   */
  REQUEST_TIMEOUT: 20000, // 20秒
  
  /**
   * 请求防抖延迟（毫秒）
   */
  REQUEST_DEBOUNCE_DELAY: 300,
  
  /**
   * 请求节流间隔（毫秒）
   */
  REQUEST_THROTTLE_INTERVAL: 1000,
  
  // ============================================
  // 媒体文件优化
  // ============================================
  
  /**
   * 图片压缩质量（0-1）
   */
  IMAGE_COMPRESSION_QUALITY: 0.7, // 降低质量减少传输
  
  /**
   * 图片最大尺寸（像素）
   */
  IMAGE_MAX_DIMENSION: 1280, // 降低最大尺寸
  
  /**
   * 语音消息最大时长（秒）
   */
  VOICE_MAX_DURATION: 60,
  
  /**
   * 文件上传分片大小（字节）
   */
  FILE_CHUNK_SIZE: 512 * 1024, // 512KB，减少分片大小
  
  /**
   * 最大同时上传文件数
   */
  MAX_CONCURRENT_UPLOADS: 2,
  
  // ============================================
  // 缓存配置
  // ============================================
  
  /**
   * 用户信息缓存时间（毫秒）
   */
  USER_CACHE_TTL: 300000, // 5分钟
  
  /**
   * 会话信息缓存时间（毫秒）
   */
  CONVERSATION_CACHE_TTL: 60000, // 1分钟
  
  /**
   * 启用本地存储缓存
   */
  ENABLE_LOCAL_STORAGE_CACHE: true,
} as const;

/**
 * 根据群聊人数判断是否应该禁用 Typing 状态
 */
export function shouldDisableTyping(memberCount: number): boolean {
  return memberCount >= PERFORMANCE_CONFIG.TYPING_DISABLED_THRESHOLD;
}

/**
 * 节流函数工厂
 */
export function createThrottle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  return function (...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (timeSinceLastCall >= delay) {
      lastCall = now;
      fn(...args);
    } else {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        fn(...args);
      }, delay - timeSinceLastCall);
    }
  };
}

/**
 * 防抖函数工厂
 */
export function createDebounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function (...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

/**
 * 简单的内存缓存
 */
class SimpleCache<T> {
  private cache = new Map<string, { data: T; expiry: number }>();
  
  set(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl,
    });
  }
  
  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }
  
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
}

// 全局缓存实例
export const userCache = new SimpleCache<any>();
export const conversationCache = new SimpleCache<any>();
export const messageCache = new SimpleCache<any[]>();

/**
 * 请求队列管理器
 */
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private running = 0;
  private maxConcurrent: number;

  constructor(maxConcurrent: number = PERFORMANCE_CONFIG.MAX_CONCURRENT_REQUESTS) {
    this.maxConcurrent = maxConcurrent;
  }

  async add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const request = this.queue.shift();
    
    if (request) {
      try {
        await request();
      } finally {
        this.running--;
        this.processQueue();
      }
    }
  }
}

export const requestQueue = new RequestQueue();
