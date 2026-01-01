/**
 * TRTC Service - 腾讯云实时音视频服务封装
 * 
 * 使用 trtc-js-sdk v4.x API
 * 文档: https://web.sdk.qcloud.com/trtc/webrtc/doc/zh-cn/
 */

import TRTC from 'trtc-js-sdk';
import { supabase } from '@/integrations/supabase/client';

// TRTC SDK types
type TRTCClient = ReturnType<typeof TRTC.createClient>;
type TRTCLocalStream = ReturnType<typeof TRTC.createStream>;
type TRTCRemoteStream = any; // Remote stream type from SDK events

export interface TRTCConfig {
  sdkAppId: number;
  userId: string;
  userSig: string;
  roomId: number;
}

export interface TRTCCallbacks {
  onRemoteUserJoin?: (userId: string) => void;
  onRemoteUserLeave?: (userId: string) => void;
  onRemoteStreamAdd?: (stream: TRTCRemoteStream) => void;
  onRemoteStreamRemove?: (stream: TRTCRemoteStream) => void;
  onConnectionStateChange?: (state: string) => void;
  onError?: (error: Error) => void;
}

class TRTCService {
  private client: TRTCClient | null = null;
  private localStream: TRTCLocalStream | null = null;
  private remoteStreams: Map<string, TRTCRemoteStream> = new Map();
  private config: TRTCConfig | null = null;
  private callbacks: TRTCCallbacks = {};
  private isJoined: boolean = false;
  private isPublished: boolean = false;

  /**
   * 获取TRTC凭证
   * 从Edge Function获取当前用户的userSig
   */
  async getCredentials(): Promise<{ sdkAppId: number; userId: string; userSig: string } | null> {
    try {
      console.log('[TRTCService] Fetching TRTC credentials...');
      
      const { data, error } = await supabase.functions.invoke('generate-trtc-usersig');
      
      if (error) {
        console.error('[TRTCService] Error fetching credentials:', error);
        return null;
      }
      
      if (!data?.success) {
        console.error('[TRTCService] Failed to get credentials:', data?.error);
        return null;
      }
      
      console.log('[TRTCService] Got credentials, SDKAppID:', data.SDKAppID, 'userId:', data.userId);
      
      return {
        sdkAppId: data.SDKAppID,
        userId: data.userId,
        userSig: data.userSig
      };
    } catch (err) {
      console.error('[TRTCService] Exception fetching credentials:', err);
      return null;
    }
  }

  /**
   * 生成房间号
   * 将UUID转换为数字房间号（取前8位hex转为32位整数）
   */
  generateRoomId(invitationId: string): number {
    // 取UUID的前8个字符（去掉连字符后），转为32位整数
    const cleanId = invitationId.replace(/-/g, '');
    const hex8 = cleanId.substring(0, 8);
    const roomId = parseInt(hex8, 16);
    console.log('[TRTCService] Generated roomId:', roomId, 'from invitation:', invitationId);
    return roomId;
  }

  /**
   * 初始化TRTC客户端
   */
  async initialize(
    invitationId: string,
    callType: 'audio' | 'video',
    callbacks: TRTCCallbacks
  ): Promise<boolean> {
    try {
      console.log('[TRTCService] Initializing TRTC for invitation:', invitationId, 'type:', callType);
      
      // 获取凭证
      const credentials = await this.getCredentials();
      if (!credentials) {
        throw new Error('Failed to get TRTC credentials');
      }
      
      // 生成房间号
      const roomId = this.generateRoomId(invitationId);
      
      this.config = {
        ...credentials,
        roomId
      };
      
      this.callbacks = callbacks;
      
      // 创建客户端
      this.client = TRTC.createClient({
        sdkAppId: this.config.sdkAppId,
        userId: this.config.userId,
        userSig: this.config.userSig,
        mode: 'rtc' // 实时通话模式
      });
      
      // 设置事件监听
      this.setupEventListeners();
      
      console.log('[TRTCService] Client created successfully');
      return true;
    } catch (err) {
      console.error('[TRTCService] Initialize error:', err);
      this.callbacks.onError?.(err as Error);
      return false;
    }
  }

  /**
   * 设置事件监听
   */
  private setupEventListeners(): void {
    if (!this.client) return;
    
    // 远端用户进入房间
    this.client.on('peer-join', (event: any) => {
      console.log('[TRTCService] Remote user joined:', event.userId);
      this.callbacks.onRemoteUserJoin?.(event.userId);
    });
    
    // 远端用户离开房间
    this.client.on('peer-leave', (event: any) => {
      console.log('[TRTCService] Remote user left:', event.userId);
      this.remoteStreams.delete(event.userId);
      this.callbacks.onRemoteUserLeave?.(event.userId);
    });
    
    // 远端流添加
    this.client.on('stream-added', (event: any) => {
      const remoteStream = event.stream;
      const userId = remoteStream.getUserId();
      console.log('[TRTCService] Remote stream added from:', userId);
      
      // 自动订阅远端流
      this.client?.subscribe(remoteStream).then(() => {
        console.log('[TRTCService] Subscribed to remote stream:', userId);
      }).catch((err: Error) => {
        console.error('[TRTCService] Subscribe error:', err);
      });
    });
    
    // 远端流订阅成功
    this.client.on('stream-subscribed', (event: any) => {
      const remoteStream = event.stream;
      const userId = remoteStream.getUserId();
      console.log('[TRTCService] Remote stream subscribed:', userId);
      
      this.remoteStreams.set(userId, remoteStream);
      this.callbacks.onRemoteStreamAdd?.(remoteStream);
    });
    
    // 远端流移除
    this.client.on('stream-removed', (event: any) => {
      const remoteStream = event.stream;
      const userId = remoteStream.getUserId();
      console.log('[TRTCService] Remote stream removed:', userId);
      
      this.remoteStreams.delete(userId);
      this.callbacks.onRemoteStreamRemove?.(remoteStream);
    });
    
    // 连接状态变化
    this.client.on('connection-state-changed', (event: any) => {
      console.log('[TRTCService] Connection state changed:', event.prevState, '->', event.state);
      this.callbacks.onConnectionStateChange?.(event.state);
    });
    
    // 错误事件
    this.client.on('error', (error: Error) => {
      console.error('[TRTCService] Client error:', error);
      this.callbacks.onError?.(error);
    });
  }

  /**
   * 进入房间
   */
  async joinRoom(): Promise<boolean> {
    if (!this.client || !this.config) {
      console.error('[TRTCService] Client not initialized');
      return false;
    }
    
    try {
      console.log('[TRTCService] Joining room:', this.config.roomId);
      
      await this.client.join({
        roomId: this.config.roomId
      });
      
      this.isJoined = true;
      console.log('[TRTCService] Joined room successfully');
      return true;
    } catch (err) {
      console.error('[TRTCService] Join room error:', err);
      this.callbacks.onError?.(err as Error);
      return false;
    }
  }

  /**
   * 创建并发布本地流
   */
  async publishLocalStream(callType: 'audio' | 'video'): Promise<TRTCLocalStream | null> {
    if (!this.client || !this.isJoined) {
      console.error('[TRTCService] Cannot publish - not joined');
      return null;
    }
    
    try {
      console.log('[TRTCService] Creating local stream, type:', callType);
      
      // 创建本地流
      this.localStream = TRTC.createStream({
        userId: this.config!.userId,
        audio: true,
        video: callType === 'video'
      });
      
      // 初始化本地流（获取媒体设备权限）
      await this.localStream.initialize();
      console.log('[TRTCService] Local stream initialized');
      
      // 发布本地流
      await this.client.publish(this.localStream);
      this.isPublished = true;
      console.log('[TRTCService] Local stream published');
      
      return this.localStream;
    } catch (err: any) {
      // 详细记录错误信息以便诊断
      console.error('[TRTCService] Publish error:', {
        name: err?.name,
        message: err?.message,
        code: err?.code,
        stack: err?.stack
      });
      
      // 提供更友好的错误信息
      let userMessage = err?.message || '发布本地流失败';
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        userMessage = '摄像头/麦克风权限被拒绝，请在浏览器设置中允许访问';
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        userMessage = '未找到摄像头或麦克风设备';
      } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
        userMessage = '摄像头/麦克风被其他应用占用，请关闭其他使用摄像头的应用后重试';
      } else if (err?.name === 'OverconstrainedError') {
        userMessage = '摄像头不支持请求的分辨率';
      } else if (err?.name === 'AbortError') {
        userMessage = '设备访问被中断';
      }
      
      const enhancedError = new Error(userMessage);
      (enhancedError as any).originalError = err;
      this.callbacks.onError?.(enhancedError);
      return null;
    }
  }

  /**
   * 播放本地流到指定元素
   */
  playLocalStream(elementId: string): void {
    if (!this.localStream) {
      console.error('[TRTCService] No local stream to play');
      return;
    }
    
    try {
      this.localStream.play(elementId);
      console.log('[TRTCService] Playing local stream on:', elementId);
    } catch (err) {
      console.error('[TRTCService] Play local stream error:', err);
    }
  }

  /**
   * 播放远端流到指定元素
   */
  playRemoteStream(userId: string, elementId: string): void {
    const remoteStream = this.remoteStreams.get(userId);
    if (!remoteStream) {
      console.error('[TRTCService] No remote stream for user:', userId);
      return;
    }
    
    try {
      remoteStream.play(elementId);
      console.log('[TRTCService] Playing remote stream on:', elementId);
    } catch (err) {
      console.error('[TRTCService] Play remote stream error:', err);
    }
  }

  /**
   * 静音/取消静音本地音频
   */
  muteLocalAudio(mute: boolean): void {
    if (!this.localStream) return;
    
    if (mute) {
      this.localStream.muteAudio();
      console.log('[TRTCService] Local audio muted');
    } else {
      this.localStream.unmuteAudio();
      console.log('[TRTCService] Local audio unmuted');
    }
  }

  /**
   * 关闭/开启本地视频
   */
  muteLocalVideo(mute: boolean): void {
    if (!this.localStream) return;
    
    if (mute) {
      this.localStream.muteVideo();
      console.log('[TRTCService] Local video muted');
    } else {
      this.localStream.unmuteVideo();
      console.log('[TRTCService] Local video unmuted');
    }
  }

  /**
   * 切换摄像头
   */
  async switchCamera(): Promise<boolean> {
    if (!this.localStream) return false;
    
    try {
      const devices = await TRTC.getCameras();
      if (devices.length < 2) {
        console.log('[TRTCService] Only one camera available');
        return false;
      }
      
      // 获取当前摄像头
      const currentTrack = this.localStream.getVideoTrack();
      const currentDeviceId = currentTrack?.getSettings()?.deviceId;
      
      // 找到下一个摄像头
      const currentIndex = devices.findIndex(d => d.deviceId === currentDeviceId);
      const nextIndex = (currentIndex + 1) % devices.length;
      const nextDevice = devices[nextIndex];
      
      await this.localStream.switchDevice('video', nextDevice.deviceId);
      console.log('[TRTCService] Switched to camera:', nextDevice.label);
      return true;
    } catch (err) {
      console.error('[TRTCService] Switch camera error:', err);
      return false;
    }
  }

  /**
   * 获取本地流
   */
  getLocalStream(): TRTCLocalStream | null {
    return this.localStream;
  }

  /**
   * 获取远端流
   */
  getRemoteStream(userId: string): TRTCRemoteStream | null {
    return this.remoteStreams.get(userId) || null;
  }

  /**
   * 获取所有远端流
   */
  getAllRemoteStreams(): Map<string, TRTCRemoteStream> {
    return this.remoteStreams;
  }

  /**
   * 获取当前用户ID
   */
  getUserId(): string | null {
    return this.config?.userId || null;
  }

  /**
   * 获取房间号
   */
  getRoomId(): number | null {
    return this.config?.roomId || null;
  }

  /**
   * 检查是否已加入房间
   */
  isInRoom(): boolean {
    return this.isJoined;
  }

  /**
   * 离开房间并清理资源
   */
  async leave(): Promise<void> {
    console.log('[TRTCService] Leaving room and cleaning up...');
    
    try {
      // 停止本地流
      if (this.localStream) {
        if (this.isPublished && this.client) {
          await this.client.unpublish(this.localStream).catch(() => {});
        }
        this.localStream.stop();
        this.localStream.close();
        this.localStream = null;
        this.isPublished = false;
      }
      
      // 离开房间
      if (this.client && this.isJoined) {
        await this.client.leave().catch(() => {});
        this.isJoined = false;
      }
      
      // 清理远端流
      this.remoteStreams.clear();
      
      // 销毁客户端
      if (this.client) {
        this.client = null;
      }
      
      this.config = null;
      this.callbacks = {};
      
      console.log('[TRTCService] Cleanup complete');
    } catch (err) {
      console.error('[TRTCService] Leave error:', err);
    }
  }

  /**
   * 检查浏览器是否支持TRTC
   */
  static async checkSupport(): Promise<{ isSupported: boolean; reason?: string }> {
    try {
      const result = await TRTC.checkSystemRequirements();
      
      if (!result.result) {
        return {
          isSupported: false,
          reason: result.detail?.join(', ') || 'Browser not supported'
        };
      }
      
      return { isSupported: true };
    } catch (err) {
      return {
        isSupported: false,
        reason: (err as Error).message
      };
    }
  }

  /**
   * 获取可用的摄像头列表
   */
  static async getCameras(): Promise<MediaDeviceInfo[]> {
    try {
      return await TRTC.getCameras();
    } catch (err) {
      console.error('[TRTCService] Get cameras error:', err);
      return [];
    }
  }

  /**
   * 获取可用的麦克风列表
   */
  static async getMicrophones(): Promise<MediaDeviceInfo[]> {
    try {
      return await TRTC.getMicrophones();
    } catch (err) {
      console.error('[TRTCService] Get microphones error:', err);
      return [];
    }
  }
}

// 导出单例实例
export const trtcService = new TRTCService();

// 也导出类以便需要时创建新实例
export default TRTCService;
