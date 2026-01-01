import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fieldValid, setFieldValid] = useState<Record<string, boolean>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const validateField = (field: string, value: string) => {
    const errors: Record<string, string> = { ...fieldErrors };
    const valid: Record<string, boolean> = { ...fieldValid };
    
    switch (field) {
      case 'username':
        if (!value) {
          errors.username = "用户名不能为空";
          valid.username = false;
        } else if (value.length < 3) {
          errors.username = `用户名还需${3 - value.length}个字符`;
          valid.username = false;
        } else if (value.length > 20) {
          errors.username = "用户名不能超过20个字符";
          valid.username = false;
        } else if (!/^[a-zA-Z0-9_]+$/.test(value)) {
          errors.username = "用户名只能包含字母、数字和下划线";
          valid.username = false;
        } else {
          delete errors.username;
          valid.username = true;
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
    }
    
    setFieldErrors(errors);
    setFieldValid(valid);
  };

  const getInputClass = (field: string) => {
    const baseClass = "h-12 text-base bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-400";
    if (fieldErrors[field]) return `${baseClass} border-red-500 focus-visible:ring-red-500`;
    if (fieldValid[field]) return `${baseClass} border-green-500 focus-visible:ring-green-500`;
    return baseClass;
  };

  const checkUsernameAvailability = async (usernameVal: string) => {
    if (!usernameVal || usernameVal.length < 3) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', usernameVal)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setGlobalError(null);

    try {
      if (isLogin) {
        if (!username || username.length < 3) {
          throw new Error("请输入有效的用户名");
        }
        if (!password || password.length < 6) {
          throw new Error("密码至少需要6个字符");
        }

        const email = `${username}@user.local`;
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw new Error("用户名或密码错误");
        }

        toast({
          title: "登录成功",
          description: "欢迎回来！",
        });
        navigate("/");
      } else {
        if (!username || username.length < 3) {
          throw new Error("用户名至少需要3个字符");
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
          throw new Error("用户名只能包含字母、数字和下划线");
        }
        if (!displayName || displayName.length < 2) {
          throw new Error("显示名称至少需要2个字符");
        }
        if (!password || password.length < 6) {
          throw new Error("密码至少需要6个字符");
        }

        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username)
          .maybeSingle();

        if (existingUser) {
          setFieldErrors(prev => ({ ...prev, username: "该用户名已被使用" }));
          throw new Error("该用户名已被使用，请换一个");
        }

        const email = `${username}@user.local`;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
              display_name: displayName,
            },
          },
        });

        if (error) {
          if (error.message.includes('already registered')) {
            throw new Error("该用户名已被注册");
          }
          throw new Error(error.message || "注册失败，请稍后重试");
        }

        if (data.user) {
          await supabase
            .from('profiles')
            .update({
              username,
              display_name: displayName,
            })
            .eq('id', data.user.id);
        }

        toast({
          title: "注册成功",
          description: "账号已创建，正在登录...",
        });
        navigate("/");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "发生了未知错误，请稍后重试";
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
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Card className="w-full max-w-md shadow-2xl bg-slate-900/80 backdrop-blur-xl border-slate-800">
        <CardHeader className="space-y-4 pb-6 pt-8">
          <div className="flex justify-center">
            <img
              src="/logo.png"
              alt="迅达"
              className="h-24 w-24 object-contain rounded-2xl"
            />
          </div>
          <CardTitle className="text-2xl font-bold text-center text-white">
            {isLogin ? "欢迎回来" : "创建账号"}
          </CardTitle>
          <CardDescription className="text-center text-slate-400">
            {isLogin ? "登录您的迅达账号" : "注册一个新账号开始聊天"}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-8 px-6">
          {globalError && (
            <Alert variant="destructive" className="mb-4 bg-red-900/50 border-red-800">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="ml-2 text-red-200">
                {globalError}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm text-slate-300 flex items-center gap-2">
                用户名
                {fieldValid.username && <CheckCircle className="h-4 w-4 text-green-500" />}
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="输入用户名（字母、数字、下划线）"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  validateField('username', e.target.value);
                  setGlobalError(null);
                }}
                onBlur={(e) => {
                  validateField('username', e.target.value);
                  if (!isLogin) {
                    checkUsernameAvailability(e.target.value);
                  }
                }}
                required
                className={getInputClass('username')}
              />
              {fieldErrors.username && (
                <p className="text-sm text-red-400 flex items-center gap-1">
                  <XCircle className="h-3 w-3 flex-shrink-0" />
                  {fieldErrors.username}
                </p>
              )}
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="displayName" className="text-sm text-slate-300 flex items-center gap-2">
                  显示名称（昵称）
                  {fieldValid.displayName && <CheckCircle className="h-4 w-4 text-green-500" />}
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
                  <p className="text-sm text-red-400 flex items-center gap-1">
                    <XCircle className="h-3 w-3 flex-shrink-0" />
                    {fieldErrors.displayName}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm text-slate-300 flex items-center gap-2">
                {isLogin ? '密码' : '设置密码'}
                {fieldValid.password && <CheckCircle className="h-4 w-4 text-green-500" />}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder={isLogin ? "请输入密码" : "设置登录密码（至少6位）"}
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
                <p className="text-sm text-red-400 flex items-center gap-1">
                  <XCircle className="h-3 w-3 flex-shrink-0" />
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-medium bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transition-all"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  处理中...
                </>
              ) : (
                <>{isLogin ? "登录" : "注册"}</>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setFieldErrors({});
                setFieldValid({});
                setGlobalError(null);
                setUsername("");
                setPassword("");
                setDisplayName("");
              }}
              className="text-purple-400 hover:text-purple-300 hover:underline transition-colors"
            >
              {isLogin ? "还没有账号？立即注册" : "已有账号？立即登录"}
            </button>
          </div>
        </CardContent>
      </Card>
      
      <p className="mt-6 text-slate-500 text-sm">
        迅达 - 即时通讯应用
      </p>
    </div>
  );
}
