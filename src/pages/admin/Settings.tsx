import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Key, Shield, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import QRCode from 'qrcode';

export default function AdminSettings() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [totpDialog, setTotpDialog] = useState(false);
  const [totpQrCode, setTotpQrCode] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [settingUpTotp, setSettingUpTotp] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [disableTotpDialog, setDisableTotpDialog] = useState(false);
  const [disableTotpPassword, setDisableTotpPassword] = useState('');
  const { toast } = useToast();

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: '密码不匹配',
        description: '新密码和确认密码不一致',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: '密码太短',
        description: '密码长度至少为6位',
        variant: 'destructive',
      });
      return;
    }

    setChangingPassword(true);
    try {
      const token = localStorage.getItem('admin_token');
      const { data, error } = await supabase.functions.invoke('admin-auth', {
        body: {
          action: 'changePassword',
          token,
          password: currentPassword,
          newPassword,
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: '密码已更新',
          description: '您的密码已成功修改',
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        throw new Error(data.error || '密码修改失败');
      }
    } catch (error: any) {
      toast({
        title: '修改失败',
        description: error.message || '当前密码不正确',
        variant: 'destructive',
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSetupTotp = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const { data, error } = await supabase.functions.invoke('admin-auth', {
        body: {
          action: 'setupTotp',
          token,
        }
      });

      if (error) throw error;

      if (data.success) {
        setTotpSecret(data.secret);
        
        // 生成二维码
        const qrCodeDataUrl = await QRCode.toDataURL(data.qrCodeUrl);
        setTotpQrCode(qrCodeDataUrl);
        setTotpDialog(true);
      }
    } catch (error) {
      toast({
        title: '设置失败',
        description: '无法生成谷歌验证码',
        variant: 'destructive',
      });
    }
  };

  const handleEnableTotp = async () => {
    if (!totpToken || totpToken.length !== 6) {
      toast({
        title: '验证码错误',
        description: '请输入6位验证码',
        variant: 'destructive',
      });
      return;
    }

    setSettingUpTotp(true);
    try {
      const token = localStorage.getItem('admin_token');
      const { data, error } = await supabase.functions.invoke('admin-auth', {
        body: {
          action: 'enableTotp',
          token,
          totpToken,
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: '谷歌验证已启用',
          description: '您的账号已绑定谷歌验证器',
        });
        setTotpEnabled(true);
        setTotpDialog(false);
        setTotpToken('');
      } else {
        throw new Error(data.error || '验证失败');
      }
    } catch (error: any) {
      toast({
        title: '启用失败',
        description: error.message || '验证码不正确',
        variant: 'destructive',
      });
    } finally {
      setSettingUpTotp(false);
    }
  };

  const handleDisableTotp = async () => {
    setSettingUpTotp(true);
    try {
      const token = localStorage.getItem('admin_token');
      const { data, error } = await supabase.functions.invoke('admin-auth', {
        body: {
          action: 'disableTotp',
          token,
          password: disableTotpPassword,
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: '谷歌验证已禁用',
          description: '您的账号已解绑谷歌验证器',
        });
        setTotpEnabled(false);
        setDisableTotpDialog(false);
        setDisableTotpPassword('');
      } else {
        throw new Error(data.error || '禁用失败');
      }
    } catch (error: any) {
      toast({
        title: '禁用失败',
        description: error.message || '密码不正确',
        variant: 'destructive',
      });
    } finally {
      setSettingUpTotp(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">管理员设置</h1>
        <p className="text-muted-foreground mt-2">管理您的账号安全设置</p>
      </div>

      {/* 修改密码 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            <CardTitle>修改密码</CardTitle>
          </div>
          <CardDescription>更新您的管理员账号密码</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">当前密码</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="输入当前密码"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">新密码</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="输入新密码（至少6位）"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">确认新密码</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入新密码"
            />
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
          >
            {changingPassword ? '修改中...' : '修改密码'}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* 谷歌验证器 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>谷歌验证器（2FA）</CardTitle>
          </div>
          <CardDescription>
            {totpEnabled 
              ? '您的账号已启用谷歌验证器保护' 
              : '启用谷歌验证器增强账号安全性'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {totpEnabled ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-600">
                <Shield className="h-5 w-5" />
                <span className="font-medium">已启用</span>
              </div>
              <Button
                variant="destructive"
                onClick={() => setDisableTotpDialog(true)}
              >
                禁用验证器
              </Button>
            </div>
          ) : (
            <Button onClick={handleSetupTotp}>
              <QrCode className="h-4 w-4 mr-2" />
              绑定谷歌验证器
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 绑定谷歌验证器对话框 */}
      <Dialog open={totpDialog} onOpenChange={setTotpDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>绑定谷歌验证器</DialogTitle>
            <DialogDescription>
              使用 Google Authenticator 或类似应用扫描二维码
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {totpQrCode && (
              <div className="flex flex-col items-center gap-4">
                <img src={totpQrCode} alt="QR Code" className="w-48 h-48" />
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">或手动输入密钥：</p>
                  <code className="bg-muted px-3 py-1 rounded text-sm font-mono">
                    {totpSecret}
                  </code>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="totp-token">验证码</Label>
              <Input
                id="totp-token"
                type="text"
                value={totpToken}
                onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="输入6位验证码"
                maxLength={6}
              />
              <p className="text-sm text-muted-foreground">
                输入您的验证器应用中显示的6位数字
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTotpDialog(false);
                setTotpToken('');
              }}
            >
              取消
            </Button>
            <Button
              onClick={handleEnableTotp}
              disabled={settingUpTotp || totpToken.length !== 6}
            >
              {settingUpTotp ? '验证中...' : '确认绑定'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 禁用谷歌验证器对话框 */}
      <Dialog open={disableTotpDialog} onOpenChange={setDisableTotpDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>禁用谷歌验证器</DialogTitle>
            <DialogDescription>
              请输入密码以确认禁用谷歌验证器
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="disable-password">管理员密码</Label>
              <Input
                id="disable-password"
                type="password"
                value={disableTotpPassword}
                onChange={(e) => setDisableTotpPassword(e.target.value)}
                placeholder="输入密码确认"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDisableTotpDialog(false);
                setDisableTotpPassword('');
              }}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisableTotp}
              disabled={settingUpTotp || !disableTotpPassword}
            >
              {settingUpTotp ? '处理中...' : '确认禁用'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}