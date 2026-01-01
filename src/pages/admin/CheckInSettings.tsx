import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save, Gift, Calendar } from 'lucide-react';

export default function CheckInSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // 7天连续签到循环奖励设置 (第1天到第7天)
  const [dayRewards, setDayRewards] = useState({
    day1: '1',  // 连续签到第1天
    day2: '2',  // 连续签到第2天
    day3: '3',  // 连续签到第3天
    day4: '4',  // 连续签到第4天
    day5: '5',  // 连续签到第5天
    day6: '8',  // 连续签到第6天
    day7: '10', // 连续签到第7天
  });
  
  // 会员加成倍数
  const [memberMultiplier, setMemberMultiplier] = useState({
    gold: '1.5',
    diamond: '2',
    elite: '3',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('key, value')
        .like('key', 'checkin_%');

      if (error) throw error;

      if (data) {
        data.forEach(setting => {
          if (setting.key.startsWith('checkin_day_')) {
            const day = setting.key.replace('checkin_day_', '');
            setDayRewards(prev => ({ ...prev, [day]: setting.value || '1' }));
          } else if (setting.key === 'checkin_multiplier_gold') {
            setMemberMultiplier(prev => ({ ...prev, gold: setting.value || '1.5' }));
          } else if (setting.key === 'checkin_multiplier_diamond') {
            setMemberMultiplier(prev => ({ ...prev, diamond: setting.value || '2' }));
          } else if (setting.key === 'checkin_multiplier_elite') {
            setMemberMultiplier(prev => ({ ...prev, elite: setting.value || '3' }));
          }
        });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('加载设置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const settings = [
        { key: 'checkin_day_day1', value: dayRewards.day1, type: 'number', description: '连续签到第1天奖励积分' },
        { key: 'checkin_day_day2', value: dayRewards.day2, type: 'number', description: '连续签到第2天奖励积分' },
        { key: 'checkin_day_day3', value: dayRewards.day3, type: 'number', description: '连续签到第3天奖励积分' },
        { key: 'checkin_day_day4', value: dayRewards.day4, type: 'number', description: '连续签到第4天奖励积分' },
        { key: 'checkin_day_day5', value: dayRewards.day5, type: 'number', description: '连续签到第5天奖励积分' },
        { key: 'checkin_day_day6', value: dayRewards.day6, type: 'number', description: '连续签到第6天奖励积分' },
        { key: 'checkin_day_day7', value: dayRewards.day7, type: 'number', description: '连续签到第7天奖励积分' },
        { key: 'checkin_multiplier_gold', value: memberMultiplier.gold, type: 'number', description: '黄金会员签到倍数' },
        { key: 'checkin_multiplier_diamond', value: memberMultiplier.diamond, type: 'number', description: '钻石会员签到倍数' },
        { key: 'checkin_multiplier_elite', value: memberMultiplier.elite, type: 'number', description: '至尊会员签到倍数' },
      ];

      for (const setting of settings) {
        const { error } = await supabase
          .from('platform_settings')
          .upsert({
            key: setting.key,
            value: setting.value,
            type: setting.type,
            description: setting.description,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'key'
          });

        if (error) throw error;
      }

      toast.success('设置已保存');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const dayNames = ['第1天', '第2天', '第3天', '第4天', '第5天', '第6天', '第7天'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-text">
      <div>
        <h1 className="text-3xl font-bold">签到设置</h1>
        <p className="text-muted-foreground mt-2">配置连续签到奖励规则（7天循环）</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              连续签到奖励（7天循环）
            </CardTitle>
            <CardDescription>设置连续签到各天的基础积分奖励（第8天重置回第1天）</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-3">
              {dayNames.map((name, index) => {
                const dayKey = `day${index + 1}` as keyof typeof dayRewards;
                return (
                  <div key={dayKey} className="space-y-2">
                    <Label className="text-center block text-sm font-medium">{name}</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={dayRewards[dayKey]}
                        onChange={(e) => setDayRewards(prev => ({ ...prev, [dayKey]: e.target.value }))}
                        min="0"
                        className="text-center"
                      />
                    </div>
                    <p className="text-xs text-center text-muted-foreground">积分</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>说明：</strong>签到积分按连续签到天数循环。例如设置为 1/2/3/4/5/8/10，
                则连续签到第1天得1分，第2天得2分...第7天得10分，第8天重新从第1天的1分开始循环。断签后重新从第1天开始。
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5" />
              会员等级加成倍数
            </CardTitle>
            <CardDescription>不同会员等级签到积分的倍数加成（基础积分 × 倍数）</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gold">黄金会员</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="gold"
                    type="number"
                    step="0.1"
                    value={memberMultiplier.gold}
                    onChange={(e) => setMemberMultiplier(prev => ({ ...prev, gold: e.target.value }))}
                    min="1"
                  />
                  <span className="text-sm text-muted-foreground">倍</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="diamond">钻石会员</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="diamond"
                    type="number"
                    step="0.1"
                    value={memberMultiplier.diamond}
                    onChange={(e) => setMemberMultiplier(prev => ({ ...prev, diamond: e.target.value }))}
                    min="1"
                  />
                  <span className="text-sm text-muted-foreground">倍</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="elite">至尊会员</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="elite"
                    type="number"
                    step="0.1"
                    value={memberMultiplier.elite}
                    onChange={(e) => setMemberMultiplier(prev => ({ ...prev, elite: e.target.value }))}
                    min="1"
                  />
                  <span className="text-sm text-muted-foreground">倍</span>
                </div>
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>示例：</strong>连续签到第1天基础积分为1分，黄金会员倍数1.5，则黄金会员签到获得 1 × 1.5 = 1.5 分（向下取整为1分）
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="h-4 w-4 mr-2" />
          {saving ? '保存中...' : '保存设置'}
        </Button>
      </div>
    </div>
  );
}
