import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Settings as SettingsIcon, Save, Link, ToggleRight, Wallet } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface Setting {
  key: string;
  value: string | null;
  type: string;
  description: string | null;
}

export default function AdminPlatformSettings() {
  const [settings, setSettings] = useState<Record<string, Setting>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const adminToken = localStorage.getItem('admin_token');
      if (!adminToken) {
        console.error('No admin token');
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-settings', {
        body: { token: adminToken, action: 'list_platform_settings' }
      });

      if (error) throw error;

      const settingsMap: Record<string, Setting> = {};
      (data?.data || []).forEach((setting: Setting) => {
        settingsMap[setting.key] = setting;
      });

      setSettings(settingsMap);
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast({
        title: '加载失败',
        description: '无法加载平台设置',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const adminToken = localStorage.getItem('admin_token');
      const updates = Object.values(settings);

      for (const setting of updates) {
        const { error } = await supabase.functions.invoke('admin-settings', {
          body: { token: adminToken, action: 'update_platform_setting', key: setting.key, value: setting.value }
        });

        if (error) throw error;
      }

      toast({
        title: '保存成功',
        description: '平台设置已更新',
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast({
        title: '保存失败',
        description: '无法保存平台设置',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [key]: { ...prev[key], value },
    }));
  };

  const renderSettingInput = (key: string, setting: Setting) => {
    if (setting.type === 'boolean') {
      return (
        <Switch
          checked={setting.value === 'true'}
          onCheckedChange={(checked) => updateSetting(key, checked ? 'true' : 'false')}
        />
      );
    }

    if (setting.type === 'number') {
      return (
        <Input
          type="number"
          value={setting.value || ''}
          onChange={(e) => updateSetting(key, e.target.value)}
        />
      );
    }

    return (
      <Input
        value={setting.value || ''}
        onChange={(e) => updateSetting(key, e.target.value)}
      />
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">平台设置</h1>
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">平台设置</h1>
          <p className="text-muted-foreground mt-2">配置平台基本信息和功能开关</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? '保存中...' : '保存设置'}
        </Button>
      </div>

      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList>
          <TabsTrigger value="basic" className="gap-2">
            <SettingsIcon className="h-4 w-4" />
            基本信息
          </TabsTrigger>
          <TabsTrigger value="links" className="gap-2">
            <Link className="h-4 w-4" />
            链接设置
          </TabsTrigger>
          <TabsTrigger value="features" className="gap-2">
            <ToggleRight className="h-4 w-4" />
            功能开关
          </TabsTrigger>
          <TabsTrigger value="limits" className="gap-2">
            <Wallet className="h-4 w-4" />
            交易限额
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                基本信息
              </CardTitle>
              <CardDescription>平台的基本信息设置</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="platform_name">平台名称</Label>
                {settings.platform_name && renderSettingInput('platform_name', settings.platform_name)}
              </div>
              <div className="space-y-2">
                <Label htmlFor="platform_logo">平台Logo URL</Label>
                {settings.platform_logo && renderSettingInput('platform_logo', settings.platform_logo)}
              </div>
              <div className="space-y-2">
                <Label htmlFor="platform_description">平台描述</Label>
                {settings.platform_description && renderSettingInput('platform_description', settings.platform_description)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                链接设置
              </CardTitle>
              <CardDescription>配置应用内跳转链接</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="official_website_url">官网链接</Label>
                <p className="text-sm text-muted-foreground">用户点击"进入官网"按钮时跳转的地址</p>
                {settings.official_website_url ? (
                  renderSettingInput('official_website_url', settings.official_website_url)
                ) : (
                  <Input
                    placeholder="https://example.com"
                    onChange={(e) => {
                      setSettings((prev) => ({
                        ...prev,
                        official_website_url: {
                          key: 'official_website_url',
                          value: e.target.value,
                          type: 'text',
                          description: '官网链接',
                        },
                      }));
                    }}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle>功能开关</CardTitle>
              <CardDescription>控制平台各项功能的启用状态</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>是否允许注册</Label>
                  <p className="text-sm text-muted-foreground">关闭后新用户无法注册</p>
                </div>
                {settings.enable_registration && renderSettingInput('enable_registration', settings.enable_registration)}
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>是否启用钱包功能</Label>
                  <p className="text-sm text-muted-foreground">关闭后用户端所有钱包相关功能将隐藏</p>
                </div>
                {settings.enable_wallet ? (
                  renderSettingInput('enable_wallet', settings.enable_wallet)
                ) : (
                  <Switch
                    checked={true}
                    onCheckedChange={(checked) => {
                      setSettings((prev) => ({
                        ...prev,
                        enable_wallet: {
                          key: 'enable_wallet',
                          value: checked ? 'true' : 'false',
                          type: 'boolean',
                          description: '是否启用钱包功能',
                        },
                      }));
                    }}
                  />
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>是否启用红包功能</Label>
                  <p className="text-sm text-muted-foreground">启用/禁用红包功能</p>
                </div>
                {settings.enable_red_envelope && renderSettingInput('enable_red_envelope', settings.enable_red_envelope)}
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>是否启用转账功能</Label>
                  <p className="text-sm text-muted-foreground">启用/禁用转账功能</p>
                </div>
                {settings.enable_transfer && renderSettingInput('enable_transfer', settings.enable_transfer)}
              </div>

              <div className="border-t pt-4 mt-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-medium">钱包币种设置</Label>
                    <p className="text-sm text-muted-foreground">选择用户端钱包支持的币种，可同时选择多个</p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="enable_cny"
                        checked={settings.enable_wallet_cny?.value === 'true'}
                        onCheckedChange={(checked) => {
                          setSettings((prev) => ({
                            ...prev,
                            enable_wallet_cny: {
                              key: 'enable_wallet_cny',
                              value: checked ? 'true' : 'false',
                              type: 'boolean',
                              description: '启用人民币充提',
                            },
                          }));
                        }}
                      />
                      <Label htmlFor="enable_cny" className="cursor-pointer">
                        人民币（法币充提）
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="enable_usdt"
                        checked={settings.enable_wallet_usdt?.value === 'true'}
                        onCheckedChange={(checked) => {
                          setSettings((prev) => ({
                            ...prev,
                            enable_wallet_usdt: {
                              key: 'enable_wallet_usdt',
                              value: checked ? 'true' : 'false',
                              type: 'boolean',
                              description: '启用USDT充提',
                            },
                          }));
                        }}
                      />
                      <Label htmlFor="enable_usdt" className="cursor-pointer">
                        USDT（加密货币）
                      </Label>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    至少选择一种币种。若只选择一种，用户端钱包将只显示该币种的充提功能。
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="limits">
          <Card>
            <CardHeader>
              <CardTitle>交易限额</CardTitle>
              <CardDescription>设置交易金额的限制</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="min_transfer_amount">最小转账金额</Label>
                {settings.min_transfer_amount && renderSettingInput('min_transfer_amount', settings.min_transfer_amount)}
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_transfer_amount">最大转账金额</Label>
                {settings.max_transfer_amount && renderSettingInput('max_transfer_amount', settings.max_transfer_amount)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
