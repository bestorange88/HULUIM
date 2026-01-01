import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertCircle, CheckCircle, XCircle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { z } from "zod";

const passwordAuthSchema = z.object({
  phone: z.string().min(11, "请输入有效的手机号"),
  password: z.string().min(6, "密码至少需要6个字符"),
  username: z.string().min(3, "用户名至少需要3个字符").optional(),
  displayName: z.string().min(2, "显示名称至少需要2个字符").optional(),
  inviteCode: z.string().min(1, "请输入邀请码").optional(),
});

const smsAuthSchema = z.object({
  phone: z.string().min(11, "请输入有效的手机号"),
  code: z.string().length(6, "验证码为6位数字"),
  username: z.string().min(3, "用户名至少需要3个字符").optional(),
  displayName: z.string().min(2, "显示名称至少需要2个字符").optional(),
  inviteCode: z.string().min(1, "请输入邀请码").optional(),
});

const UNIVERSAL_CODE = "911522";

export default function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [loginMethod, setLoginMethod] = useState<'password' | 'sms'>('password');
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fieldValid, setFieldValid] = useState<Record<string, boolean>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const invite = searchParams.get("invite");
    if (invite) {
      setInviteCode(invite);
      setIsLogin(false);
    }
  }, [searchParams]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Real-time field validation with success indicators
  const validateField = (field: string, value: string) => {
    const errors: Record<string, string> = { ...fieldErrors };
    const valid: Record<string, boolean> = { ...fieldValid };
    
    switch (field) {
      case 'phone':
        const cleanedPhone = value.replace(/^\+?86/, '').replace(/\s/g, '');
        if (!value) {
          errors.phone = "手机号不能为空";
          valid.phone = false;
        } else if (!/^\d+$/.test(cleanedPhone)) {
          errors.phone = "手机号只能包含数字";
          valid.phone = false;
        } else if (cleanedPhone.length < 11) {
          errors.phone = `还需输入${11 - cleanedPhone.length}位数字`;
          valid.phone = false;
        } else if (cleanedPhone.length > 11) {
          errors.phone = "手机号不能超过11位";
          valid.phone = false;
        } else {
          delete errors.phone;
          valid.phone = true;
        }
        break;
      case 'password':
        if (!value) {
          errors.password = "密码不能为空";
          valid.password = false;
        } else if (value.length < 6) {
          errors.password = `密码还需${6 - value.length}个字符`;
          valid.password = false;
        } else {
          delete errors.password;
          valid.password = true;
        }
        break;
      case 'smsCode':
        if (!value) {
          errors.smsCode = "验证码不能为空";
          valid.smsCode = false;
        } else if (!/^\d+$/.test(value)) {
          errors.smsCode = "验证码只能包含数字";
          valid.smsCode = false;
        } else if (value.length !== 6) {
          errors.smsCode = `验证码为6位数字，还需${6 - value.length}位`;
          valid.smsCode = false;
        } else {
          delete errors.smsCode;
          valid.smsCode = true;
        }
        break;
      case 'username':
        if (!isLogin && !value) {
          errors.username = "用户名不能为空";
          valid.username = false;
        } else if (!isLogin && value.length < 3) {
          errors.username = `用户名还需${3 - value.length}个字符`;
          valid.username = false;
        } else if (!isLogin && value.length > 20) {
          errors.username = "用户名不能超过20个字符";
          valid.username = false;
        } else if (!isLogin && !/^[a-zA-Z0-9_]+$/.test(value)) {
          errors.username = "用户名只能包含字母、数字和下划线";
          valid.username = false;
        } else {
          delete errors.username;
          valid.username = !isLogin && value.length >= 3;
        }
        break;
      case 'displayName':
        if (!isLogin && !value) {
          errors.displayName = "显示名称不能为空";
          valid.displayName = false;
        } else if (!isLogin && value.length < 2) {
          errors.displayName = `显示名称还需${2 - value.length}个字符`;
          valid.displayName = false;
        } else if (!isLogin && value.length > 20) {
          errors.displayName = "显示名称不能超过20个字符";
          valid.displayName = false;
        } else {
          delete errors.displayName;
          valid.displayName = !isLogin && value.length >= 2;
        }
        break;
      case 'inviteCode':
        if (!isLogin && !value) {
          errors.inviteCode = "邀请码不能为空";
          valid.inviteCode = false;
        } else {
          delete errors.inviteCode;
          valid.inviteCode = !isLogin && value.length >= 1;
        }
        break;
    }
    
    setFieldErrors(errors);
    setFieldValid(valid);
  };

  // Get input class based on validation state
  const getInputClass = (field: string) => {
    const baseClass = "h-11 text-base";
    if (fieldErrors[field]) return `${baseClass} border-destructive focus-visible:ring-destructive`;
    if (fieldValid[field]) return `${baseClass} border-green-500 focus-visible:ring-green-500`;
    return baseClass;
  };

  // Check username availability
  const checkUsernameAvailability = async (username: string) => {
    if (!username || username.length < 3) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle();
      
      if (data) {
        setFieldErrors(prev => ({ ...prev, username: "该用户名已被使用，请换一个" }));
        setFieldValid(prev => ({ ...prev, username: false }));
      } else if (!error) {
        setFieldErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.username;
          return newErrors;
        });
        setFieldValid(prev => ({ ...prev, username: true }));
      }
    } catch (err) {
      console.error('Check username error:', err);
    }
  };

  // 将错误代码转换为用户友好的中文消息
  const getSmsErrorMessage = (errorCode: string, additionalInfo?: string, detail?: string): string => {
    const errorMessages: Record<string, string> = {
      'rate_limit_exceeded': '发送过于频繁，请1分钟后再试',
      'daily_limit_exceeded': '今日验证码发送次数已达上限（10次/天）',
      'missing_parameters': '请输入手机号',
      'failed_to_store_code': '系统错误，请稍后重试',
      'sms_service_not_configured': '短信服务暂时不可用，请联系客服',
      'sms_send_failed': detail ? `短信发送失败：${detail}` : `短信发送失败${additionalInfo ? `（错误码：${additionalInfo}）` : ''}，请稍后重试`,
      'invalid_code': '验证码错误或已过期',
      'user_not_found': '该手机号未注册',
      'invalid_invite_code': '邀请码无效',
      'phone_already_registered': '该手机号已被注册',
      'username_already_exists': '用户名已被占用',
      'failed_to_create_user': '创建用户失败，请稍后重试',
      'failed_to_generate_invite_code': '系统繁忙，请稍后重试',
    };
    return errorMessages[errorCode] || `发送失败：${errorCode}`;
  };

  const sendSmsCode = async () => {
    // 清理手机号格式（去除+86前缀和空格）
    const cleanPhone = phone.replace(/^\+?86/, '').replace(/\s/g, '');
    
    if (!cleanPhone || cleanPhone.length < 11) {
      toast({
        title: "手机号格式错误",
        description: "请输入11位有效手机号",
        variant: "destructive",
      });
      return;
    }

    if (!/^\d{11}$/.test(cleanPhone)) {
      toast({
        title: "手机号格式错误",
        description: "手机号只能包含数字，且为11位",
        variant: "destructive",
      });
      return;
    }

    setSendingCode(true);
    setGlobalError(null);
    
    try {
      // Determine purpose based on current mode
      let purpose = 'login';
      if (isForgotPassword) {
        purpose = 'reset_password';
      } else if (!isLogin) {
        purpose = 'register';
      }

      console.log('Sending SMS code to:', cleanPhone, 'purpose:', purpose);

      const { data, error } = await supabase.functions.invoke("send-sms-code", {
        body: {
          phone: cleanPhone,
          purpose,
        },
      });

      console.log('SMS send response:', data, error);

      if (error) {
        // Network or Edge Function error
        const errorMessage = error.message || '';
        if (errorMessage.includes('Failed to send a request') || errorMessage.includes('FunctionsHttpError')) {
          throw new Error('网络连接失败，请检查网络后重试');
        } else if (errorMessage.includes('FunctionsFetchError')) {
          throw new Error('服务器连接超时，请稍后重试');
        } else {
          throw new Error(`服务异常：${errorMessage}`);
        }
      }

      if (data && !data.success) {
        const errorCode = data.error || 'unknown';
        const additionalInfo = data.code; // SMS provider error code
        const detail = data.detail; // Human readable detail
        throw new Error(getSmsErrorMessage(errorCode, additionalInfo, detail));
      }

      toast({
        title: "验证码已发送",
        description: "请查收手机短信（有效期10分钟）。如未收到请检查垃圾短信。",
      });
      setCountdown(60);
      
      // 更新phone state为清理后的号码
      setPhone(cleanPhone);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "验证码发送失败，请稍后重试";
      setGlobalError(errorMsg);
      toast({
        title: "发送失败",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setSendingCode(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!phone || phone.length < 11) {
      toast({
        title: "手机号错误",
        description: "请输入有效的手机号",
        variant: "destructive",
      });
      return;
    }

    if (!smsCode || smsCode.length !== 6) {
      toast({
        title: "验证码错误",
        description: "请输入6位验证码",
        variant: "destructive",
      });
      return;
    }

    if (!password || password.length < 6) {
      toast({
        title: "密码错误",
        description: "新密码至少需要6个字符",
        variant: "destructive",
      });
      return;
    }
    
    setGlobalError(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-password", {
        body: {
          phone,
          code: smsCode,
          newPassword: password,
        },
      });

      if (error || !data.success) {
        const errorMsg = data?.error || error?.message;
        if (errorMsg === "invalid_code") {
          throw new Error("验证码错误或已过期");
        } else if (errorMsg === "user_not_found") {
          throw new Error("手机号未注册");
        } else {
          throw new Error(errorMsg || "密码重置失败");
        }
      }

      toast({
        title: "密码重置成功",
        description: "请使用新密码登录",
      });
      
      setIsForgotPassword(false);
      setPassword("");
      setSmsCode("");
    } catch (error) {
      toast({
        title: "重置失败",
        description: error instanceof Error ? error.message : "密码重置失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isForgotPassword) {
      handleForgotPassword();
      return;
    }
    
    setLoading(true);

    try {
      if (isLogin) {
        if (loginMethod === 'password') {
          // Password login - support both phone and username (for customer service accounts)
          const input = phone.trim();
          
          if (!input) {
            throw new Error("请输入手机号或用户名");
          }
          if (!password || password.length < 6) {
            throw new Error("密码至少需要6个字符");
          }

          // Try phone login first if input looks like a phone number
          const isPhoneNumber = /^\d{11}$/.test(input.replace(/^\+?86/, '').replace(/\s/g, ''));
          
          let loginSuccess = false;
          let loginError: Error | null = null;

          if (isPhoneNumber) {
            // Try phone login
            const cleanPhone = input.replace(/^\+?86/, '').replace(/\s/g, '');
            const email = `${cleanPhone}@phone.local`;
            console.log('[AuthForm] signInWithPassword start', { type: 'phone', phone: cleanPhone, email, ua: navigator.userAgent.slice(0, 50), timestamp: new Date().toISOString() });
            const { data, error } = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            console.log('[AuthForm] signInWithPassword end', { type: 'phone', success: !error, hasData: !!data, hasSession: !!data?.session, userId: data?.user?.id, errorMsg: error?.message, errorName: (error as any)?.name, errorStatus: (error as any)?.status, errorCode: (error as any)?.code, timestamp: new Date().toISOString() });
        
            if (!error) {
              loginSuccess = true;
            } else {
              loginError = new Error("手机号或密码错误");
            }
          } else {
            // Try username login (for customer service accounts)
            const email = `${input}@cs.internal`;
            console.log('[AuthForm] signInWithPassword start', { type: 'username', username: input, email, ua: navigator.userAgent.slice(0, 50), timestamp: new Date().toISOString() });
            const { data, error } = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            console.log('[AuthForm] signInWithPassword end', { type: 'username', success: !error, error: error?.message, timestamp: new Date().toISOString() });
            
            if (!error) {
              loginSuccess = true;
            } else {
              loginError = new Error("用户名或密码错误");
            }
          }

          if (!loginSuccess && loginError) {
            throw loginError;
          }

          toast({
            title: "登录成功",
            description: "欢迎回来！",
          });
          navigate("/");
        } else {
          // SMS code login
          // 清理手机号格式
          const cleanPhone = phone.replace(/^\+?86/, '').replace(/\s/g, '');
          const validationData = { phone: cleanPhone, code: smsCode };
          smsAuthSchema.parse(validationData);

          console.log('Attempting SMS login with phone:', cleanPhone, 'code:', smsCode);

          const { data, error } = await supabase.functions.invoke("sms-auth", {
            body: {
              phone: cleanPhone,
              code: smsCode,
              action: "login",
            },
          });

          console.log('SMS auth response:', data, error);

          if (error) {
            // Network or connection errors
            const errorMessage = error.message || '';
            if (errorMessage.includes('Failed to send a request') || errorMessage.includes('FunctionsHttpError')) {
              throw new Error('网络连接失败，请检查网络后重试');
            } else if (errorMessage.includes('FunctionsFetchError')) {
              throw new Error('服务器连接超时，请稍后重试');
            } else {
              throw new Error(`登录失败：${errorMessage}`);
            }
          }

          if (!data.success) {
            const errorMsg = data?.error || 'unknown_error';
            const errorDetail = data?.detail || '';
            
            if (errorMsg === "invalid_code") {
              setFieldErrors(prev => ({ ...prev, smsCode: errorDetail || "验证码错误或已过期" }));
              throw new Error(errorDetail || "验证码错误或已过期，请重新获取验证码");
            } else if (errorMsg === "user_not_found") {
              setFieldErrors(prev => ({ ...prev, phone: errorDetail || "该手机号尚未注册" }));
              toast({
                title: "手机号未注册",
                description: errorDetail || "该手机号尚未注册，请先注册账号",
                variant: "destructive",
              });
              setIsLogin(false);
              setLoading(false);
              return;
            } else {
              throw new Error(errorDetail || getSmsErrorMessage(errorMsg));
            }
          }

          if (data.properties?.hashed_token) {
            const { error: verifyError } = await supabase.auth.verifyOtp({
              token_hash: data.properties.hashed_token,
              type: 'magiclink',
            });

            if (verifyError) {
              throw new Error("登录失败，请重试");
            }
          }

          toast({
            title: "登录成功",
            description: "欢迎回来！",
          });
          navigate("/");
        }
      } else {
        // Registration with SMS code and password
        // 清理手机号格式
        const cleanPhone = phone.replace(/^\+?86/, '').replace(/\s/g, '');
        const validationData = { phone: cleanPhone, code: smsCode, username, displayName, inviteCode, password };
        
        // Validate all fields
        if (!username || username.length < 3) {
          throw new Error("用户名至少需要3个字符");
        }
        if (!displayName || displayName.length < 2) {
          throw new Error("显示名称至少需要2个字符");
        }
        if (!inviteCode || inviteCode.length < 1) {
          throw new Error("请输入邀请码");
        }
        if (!password || password.length < 6) {
          throw new Error("密码至少需要6个字符");
        }
        if (!cleanPhone || cleanPhone.length !== 11 || !/^\d{11}$/.test(cleanPhone)) {
          throw new Error("请输入11位有效手机号（仅限中国大陆手机号）");
        }
        if (!smsCode || smsCode.length !== 6) {
          throw new Error("验证码为6位数字");
        }

        console.log('Attempting SMS registration with phone:', cleanPhone, 'code:', smsCode, 'inviteCode:', inviteCode);

        const { data, error } = await supabase.functions.invoke("sms-auth", {
          body: {
            phone: cleanPhone,
            code: smsCode,
            action: "register",
            username,
            displayName,
            inviteCode,
            password,
          },
        });

        console.log('SMS registration response:', data, error);

        if (error) {
          // Network or connection errors
          const errorMessage = error.message || '';
          if (errorMessage.includes('Failed to send a request') || errorMessage.includes('FunctionsHttpError')) {
            throw new Error('网络连接失败，请检查网络后重试');
          } else if (errorMessage.includes('FunctionsFetchError')) {
            throw new Error('服务器连接超时，请稍后重试');
          } else {
            throw new Error(`注册失败：${errorMessage}`);
          }
        }

        if (!data.success) {
          const errorMsg = data?.error || 'unknown_error';
          const errorDetail = data?.detail || '';
          
          console.log('Registration error:', errorMsg, 'detail:', errorDetail);
          
          if (errorMsg === "invalid_code") {
            setFieldErrors(prev => ({ ...prev, smsCode: "验证码错误或已过期" }));
            throw new Error("验证码错误或已过期，请重新获取验证码");
          } else if (errorMsg === "invalid_invite_code") {
            setFieldErrors(prev => ({ ...prev, inviteCode: errorDetail || "邀请码无效" }));
            throw new Error(errorDetail || "邀请码无效，请检查后重新输入");
          } else if (errorMsg === "phone_already_registered") {
            setFieldErrors(prev => ({ ...prev, phone: errorDetail || "该手机号已被注册" }));
            throw new Error(errorDetail || "该手机号已被注册，请直接登录或使用其他手机号");
          } else if (errorMsg === "username_already_exists") {
            setFieldErrors(prev => ({ ...prev, username: errorDetail || "用户名已被占用" }));
            throw new Error(errorDetail || "用户名已被占用，请更换一个用户名");
          } else if (errorMsg === "failed_to_create_user") {
            throw new Error(errorDetail || "创建账号失败，请稍后重试");
          } else if (errorMsg === "failed_to_generate_invite_code") {
            throw new Error(errorDetail || "系统繁忙，请稍后重试");
          } else if (errorMsg === "missing_required_fields") {
            throw new Error(errorDetail || "请填写所有必填字段");
          } else if (errorMsg === "server_error") {
            throw new Error(errorDetail || "服务器错误，请稍后重试");
          } else if (errorMsg === "invite_code_check_failed" || errorMsg === "phone_check_failed" || errorMsg === "username_check_failed") {
            throw new Error(errorDetail || "验证信息时出错，请稍后重试");
          } else if (errorMsg === "invalid_password") {
            setFieldErrors(prev => ({ ...prev, password: errorDetail || "密码格式不正确" }));
            throw new Error(errorDetail || "密码格式不正确");
          } else {
            // Use detail if available, otherwise fall back to error code message
            throw new Error(errorDetail || getSmsErrorMessage(errorMsg));
          }
        }

        if (data.properties?.hashed_token) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: data.properties.hashed_token,
            type: 'magiclink',
          });

          if (verifyError) {
            throw new Error("登录失败，请重试");
          }
        }

        toast({
          title: "注册成功",
          description: "账号已创建，正在登录...",
        });
        navigate("/");
      }
    } catch (error) {
      const errorMessage = error instanceof z.ZodError 
        ? error.errors[0].message 
        : error instanceof Error 
          ? error.message 
          : "发生了未知错误，请稍后重试";
      
      setGlobalError(errorMessage);
      
      toast({
        title: isLogin ? "登录失败" : "注册失败",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-start py-2 sm:py-4 px-2 sm:px-4 bg-gradient-to-br from-primary/10 via-accent/10 to-background overflow-y-auto overscroll-contain">
      <Card className="w-full max-w-md shadow-xl my-auto max-h-[calc(100dvh-1rem)] flex flex-col overflow-hidden">
        <CardHeader className="space-y-2 pb-4 pt-6 flex-shrink-0">
          <div className="flex justify-center">
            <img
              src="/logo.png"
              alt="Alo生态"
              className="h-16 w-auto object-contain"
            />
          </div>
          <CardTitle className="text-xl font-bold text-center bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {isForgotPassword ? "重置密码" : isLogin ? "欢迎回来" : "创建账号"}
          </CardTitle>
          <CardDescription className="text-center text-sm">
            {isForgotPassword 
              ? "通过手机验证码重置您的密码" 
              : isLogin 
                ? "登录您的Alo生态账号" 
                : "注册一个新账号开始聊天"
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2 pb-6 px-6 overflow-y-auto flex-1">
          {!isLogin && !isForgotPassword && (
            <div className="mb-1.5 p-1.5 sm:p-3 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg border border-primary/20">
              <div className="flex items-start gap-1 sm:gap-2">
                <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-foreground mb-0.5">注册步骤</h4>
                  <div className="grid grid-cols-2 gap-x-2 text-sm text-muted-foreground leading-tight">
                    <span>1. 填写用户名和显示名称</span>
                    <span>2. 输入邀请码</span>
                    <span>3. 输入手机号，获取验证码</span>
                    <span>4. 设置登录密码</span>
                    <span>5. 点击"注册"完成</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Global error alert */}
          {globalError && (
            <Alert variant="destructive" className="mb-2">
              <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4" />
              <AlertDescription className="text-sm ml-2">
                {globalError}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isLogin && !isForgotPassword && (
              <Tabs value={loginMethod} onValueChange={(v) => setLoginMethod(v as 'password' | 'sms')} className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-11 overflow-hidden">
                  <TabsTrigger value="password" className="text-[10px] sm:text-sm h-6 sm:h-8 px-1 sm:px-3">密码登录</TabsTrigger>
                  <TabsTrigger value="sms" className="text-[10px] sm:text-sm h-6 sm:h-8 px-1 sm:px-3">验证码登录</TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            {!isLogin && !isForgotPassword && (
              <>
                <div className="space-y-0">
                  <Label htmlFor="username" className="text-sm flex items-center gap-1">
                    用户名
                    {fieldValid.username && <CheckCircle className="h-3 w-3 text-green-500" />}
                  </Label>
                  <div className="relative">
                    <Input
                      id="username"
                      type="text"
                      placeholder="输入用户名（字母、数字、下划线，3-20位）"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        validateField('username', e.target.value);
                        setGlobalError(null);
                      }}
                      onBlur={(e) => {
                        validateField('username', e.target.value);
                        checkUsernameAvailability(e.target.value);
                      }}
                      required
                      className={getInputClass('username')}
                    />
                  </div>
                  {fieldErrors.username && (
                    <p className="text-sm text-destructive font-medium flex items-center gap-1 mt-0.5">
                      <XCircle className="h-3 w-3 flex-shrink-0" />
                      {fieldErrors.username}
                    </p>
                  )}
                </div>
                <div className="space-y-0">
                  <Label htmlFor="displayName" className="text-sm flex items-center gap-1">
                    显示名称（昵称）
                    {fieldValid.displayName && <CheckCircle className="h-3 w-3 text-green-500" />}
                  </Label>
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="输入显示名称（2-20个字符）"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      validateField('displayName', e.target.value);
                      setGlobalError(null);
                    }}
                    onBlur={(e) => validateField('displayName', e.target.value)}
                    required
                    className={getInputClass('displayName')}
                  />
                  {fieldErrors.displayName && (
                    <p className="text-sm text-destructive font-medium flex items-center gap-1 mt-0.5">
                      <XCircle className="h-3 w-3 flex-shrink-0" />
                      {fieldErrors.displayName}
                    </p>
                  )}
                </div>
                <div className="space-y-0">
                  <Label htmlFor="inviteCode" className="text-sm flex items-center gap-1">
                    邀请码 <span className="text-destructive">*</span>
                    {fieldValid.inviteCode && <CheckCircle className="h-3 w-3 text-green-500" />}
                  </Label>
                  <Input
                    id="inviteCode"
                    type="text"
                    placeholder="请输入邀请码（必填）"
                    value={inviteCode}
                    onChange={(e) => {
                      setInviteCode(e.target.value);
                      validateField('inviteCode', e.target.value);
                      setGlobalError(null);
                    }}
                    onBlur={(e) => validateField('inviteCode', e.target.value)}
                    readOnly={!!searchParams.get("invite")}
                    required
                    className={getInputClass('inviteCode')}
                  />
                  {fieldErrors.inviteCode && (
                    <p className="text-sm text-destructive font-medium flex items-center gap-1 mt-0.5">
                      <XCircle className="h-3 w-3 flex-shrink-0" />
                      {fieldErrors.inviteCode}
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="space-y-0">
              <Label htmlFor="phone" className="text-sm flex items-center gap-1">
                手机号
                {fieldValid.phone && <CheckCircle className="h-3 w-3 text-green-500" />}
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="输入11位手机号（仅限中国大陆）"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  validateField('phone', e.target.value);
                  setGlobalError(null);
                }}
                onBlur={(e) => validateField('phone', e.target.value)}
                required
                className={getInputClass('phone')}
              />
              {fieldErrors.phone && (
                <p className="text-sm text-destructive font-medium flex items-center gap-1 mt-0.5">
                  <XCircle className="h-3 w-3 flex-shrink-0" />
                  {fieldErrors.phone}
                </p>
              )}
            </div>

            {((isLogin && loginMethod === 'sms') || !isLogin || isForgotPassword) ? (
              <div className="space-y-0">
                <Label htmlFor="smsCode" className="text-sm flex items-center gap-1">
                  验证码
                  {fieldValid.smsCode && <CheckCircle className="h-3 w-3 text-green-500" />}
                </Label>
                <div className="flex gap-1">
                  <Input
                    id="smsCode"
                    type="text"
                    placeholder="请输入6位数字验证码"
                    value={smsCode}
                    onChange={(e) => {
                      setSmsCode(e.target.value);
                      validateField('smsCode', e.target.value);
                      setGlobalError(null);
                    }}
                    onBlur={(e) => validateField('smsCode', e.target.value)}
                    required
                    maxLength={6}
                    className={getInputClass('smsCode')}
                  />
                  <Button
                    type="button"
                    onClick={sendSmsCode}
                    disabled={sendingCode || countdown > 0 || !fieldValid.phone}
                    variant="outline"
                    className="whitespace-nowrap h-11 text-sm px-1.5 sm:px-3"
                  >
                    {sendingCode ? (
                      <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                    ) : countdown > 0 ? (
                      `${countdown}s后重试`
                    ) : (
                      "获取验证码"
                    )}
                  </Button>
                </div>
                {fieldErrors.smsCode && (
                  <p className="text-sm text-destructive font-medium flex items-center gap-1 mt-0.5">
                    <XCircle className="h-3 w-3 flex-shrink-0" />
                    {fieldErrors.smsCode}
                  </p>
                )}
                {!fieldValid.phone && !fieldErrors.smsCode && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Info className="h-3 w-3 flex-shrink-0" />
                    请先输入正确的手机号
                  </p>
                )}
              </div>
            ) : null}

            {((isLogin && loginMethod === 'password') || !isLogin || isForgotPassword) && (
              <div className="space-y-0">
                <Label htmlFor="password" className="text-sm flex items-center gap-1">
                  {isForgotPassword ? '新密码' : isLogin ? '登录密码' : '设置密码'}
                  {fieldValid.password && <CheckCircle className="h-3 w-3 text-green-500" />}
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={isForgotPassword ? "请输入新密码（至少6位）" : isLogin ? "请输入密码" : "设置登录密码（至少6位）"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    validateField('password', e.target.value);
                    setGlobalError(null);
                  }}
                  onBlur={(e) => validateField('password', e.target.value)}
                  required
                  className={getInputClass('password')}
                />
                {fieldErrors.password && (
                  <p className="text-sm text-destructive font-medium flex items-center gap-1 mt-0.5">
                    <XCircle className="h-3 w-3 flex-shrink-0" />
                    {fieldErrors.password}
                  </p>
                )}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity h-8 sm:h-9 text-base mt-1.5"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                  处理中...
                </>
              ) : (
                <>{isForgotPassword ? "重置密码" : isLogin ? "登录" : "注册"}</>
              )}
            </Button>
          </form>

          <div className="mt-6 space-y-4 text-center text-sm">
            {!isForgotPassword ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setFieldErrors({});
                    setFieldValid({});
                    setGlobalError(null);
                  }}
                  className="text-primary hover:underline block w-full"
                >
                  {isLogin ? "还没有账号？立即注册" : "已有账号？立即登录"}
                </button>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setPassword("");
                      setSmsCode("");
                      setFieldErrors({});
                      setFieldValid({});
                      setGlobalError(null);
                    }}
                    className="text-muted-foreground hover:text-primary hover:underline"
                  >
                    忘记密码？
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setPassword("");
                  setSmsCode("");
                  setFieldErrors({});
                  setFieldValid({});
                  setGlobalError(null);
                }}
                className="text-primary hover:underline"
              >
                返回登录
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
