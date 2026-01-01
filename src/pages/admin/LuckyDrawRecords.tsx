import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Sparkles, Download, Settings, Save, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { exportToCSV } from '@/utils/exportUtils';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface LuckyDrawRecord {
  id: string;
  user_id: string;
  prize_amount: number;
  prize_type: string;
  created_at: string;
  user?: {
    username: string;
    display_name: string;
  };
}

interface Prize {
  points: number;
  type: 'points' | 'balance';
}

const DEFAULT_PRIZES: Prize[] = [
  { points: 1, type: 'points' },
  { points: 2, type: 'points' },
  { points: 5, type: 'points' },
  { points: 10, type: 'points' },
  { points: 50, type: 'points' },
  { points: 100, type: 'points' },
  { points: 200, type: 'points' },
  { points: 500, type: 'points' },
];

export default function AdminLuckyDrawRecords() {
  const [records, setRecords] = useState<LuckyDrawRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<LuckyDrawRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Prize settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prizes, setPrizes] = useState<Prize[]>(DEFAULT_PRIZES);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    loadRecords();
    loadPrizeSettings();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = records.filter(
        (record) =>
          record.user?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          record.user?.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredRecords(filtered);
    } else {
      setFilteredRecords(records);
    }
  }, [searchQuery, records]);

  const loadPrizeSettings = async () => {
    try {
      const { data } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'lucky_draw_prizes')
        .single();
      
      if (data?.value) {
        const parsed = JSON.parse(data.value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPrizes(parsed);
        }
      }
    } catch (error) {
      console.log('Using default prizes');
    }
  };

  const savePrizeSettings = async () => {
    setSavingSettings(true);
    try {
      const { data: existing } = await supabase
        .from('platform_settings')
        .select('id')
        .eq('key', 'lucky_draw_prizes')
        .single();

      if (existing) {
        await supabase
          .from('platform_settings')
          .update({ value: JSON.stringify(prizes), updated_at: new Date().toISOString() })
          .eq('key', 'lucky_draw_prizes');
      } else {
        await supabase
          .from('platform_settings')
          .insert({ key: 'lucky_draw_prizes', value: JSON.stringify(prizes), description: '抽奖奖品配置' });
      }
      
      toast.success('奖品配置已保存');
      setSettingsOpen(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('保存失败');
    } finally {
      setSavingSettings(false);
    }
  };

  const loadRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('lucky_draws')
        .select(`
          id,
          user_id,
          prize_amount,
          prize_type,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const recordsWithUsers = await Promise.all(
        (data || []).map(async (record) => {
          const { data: userData } = await supabase
            .from('profiles')
            .select('username, display_name')
            .eq('id', record.user_id)
            .single();

          return {
            ...record,
            user: userData,
          };
        })
      );

      setRecords(recordsWithUsers);
      setFilteredRecords(recordsWithUsers);
    } catch (error) {
      console.error('Failed to load records:', error);
      toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const getPrizeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      points: '积分',
      balance: '余额',
    };
    return labels[type] || type;
  };

  const totalDraws = records.length;
  const totalPoints = records
    .filter((r) => r.prize_type === 'points')
    .reduce((sum, r) => sum + r.prize_amount, 0);
  const totalBalance = records
    .filter((r) => r.prize_type === 'balance')
    .reduce((sum, r) => sum + r.prize_amount, 0);

  const handleExport = () => {
    const exportData = filteredRecords.map(record => ({
      用户名: record.user?.display_name || '',
      用户账号: record.user?.username || '',
      奖品类型: getPrizeTypeLabel(record.prize_type),
      奖品金额: record.prize_amount,
      抽奖时间: record.created_at,
    }));
    exportToCSV(exportData, '抽奖记录');
    toast.success('导出成功');
  };

  const updatePrize = (index: number, field: keyof Prize, value: number | string) => {
    const newPrizes = [...prizes];
    if (field === 'points') {
      newPrizes[index].points = Number(value);
    } else if (field === 'type') {
      newPrizes[index].type = value as 'points' | 'balance';
    }
    setPrizes(newPrizes);
  };

  const addPrize = () => {
    setPrizes([...prizes, { points: 1, type: 'points' }]);
  };

  const removePrize = (index: number) => {
    if (prizes.length <= 1) {
      toast.error('至少需要保留一个奖品');
      return;
    }
    setPrizes(prizes.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">抽奖管理</h1>
          <p className="text-muted-foreground mt-2">管理抽奖奖品和查看抽奖记录</p>
        </div>
        <Button onClick={() => setSettingsOpen(true)}>
          <Settings className="h-4 w-4 mr-2" />
          奖品设置
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总抽奖次数</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDraws}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">送出积分总计</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPoints}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">送出余额总计</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">¥{totalBalance.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle>抽奖记录</CardTitle>
              <CardDescription>最近 {records.length} 条抽奖记录</CardDescription>
            </div>
            <Button onClick={handleExport} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              导出数据
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索用户名..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>奖品类型</TableHead>
                  <TableHead>奖品金额</TableHead>
                  <TableHead>抽奖时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {record.user?.display_name || '未知用户'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          @{record.user?.username || 'unknown'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getPrizeTypeLabel(record.prize_type)}</TableCell>
                    <TableCell>
                      <span className="font-semibold text-red-500">
                        {record.prize_type === 'points'
                          ? `${record.prize_amount} 积分`
                          : `¥${record.prize_amount.toFixed(2)}`}
                      </span>
                    </TableCell>
                    <TableCell>
                      {format(new Date(record.created_at), 'yyyy-MM-dd HH:mm:ss')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Prize Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>奖品设置</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">配置抽奖转盘的8个奖品（第9个格子为抽奖按钮）</p>
            
            <div className="space-y-3">
              {prizes.map((prize, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                  <span className="text-sm font-medium w-8">#{index + 1}</span>
                  <Select value={prize.type} onValueChange={(v) => updatePrize(index, 'type', v)}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="points">积分</SelectItem>
                      <SelectItem value="balance">余额</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    value={prize.points}
                    onChange={(e) => updatePrize(index, 'points', e.target.value)}
                    className="w-24"
                    min={1}
                  />
                  <span className="text-sm text-muted-foreground">
                    {prize.type === 'points' ? '积分' : '元'}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => removePrize(index)} className="ml-auto">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>

            {prizes.length < 8 && (
              <Button variant="outline" onClick={addPrize} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                添加奖品
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>取消</Button>
            <Button onClick={savePrizeSettings} disabled={savingSettings}>
              <Save className="h-4 w-4 mr-2" />
              {savingSettings ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
