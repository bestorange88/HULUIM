import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Edit, Plus, Trash2, Crown, Download } from 'lucide-react';
import { toast } from 'sonner';
import { exportToCSV } from '@/utils/exportUtils';

interface MembershipTier {
  id: string;
  name: string;
  price: number;
  benefits: any;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  withdrawal_minimum?: number;
  daily_check_in_bonus?: number;
  daily_draw_tickets?: number;
}

export default function AdminMembershipTiers() {
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<MembershipTier | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formBenefits, setFormBenefits] = useState('');
  const [formSortOrder, setFormSortOrder] = useState('0');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formWithdrawalMin, setFormWithdrawalMin] = useState('0');
  const [formCheckInBonus, setFormCheckInBonus] = useState('10');
  const [formDrawTickets, setFormDrawTickets] = useState('3');

  useEffect(() => {
    loadTiers();
  }, []);

  const loadTiers = async () => {
    try {
      const adminToken = localStorage.getItem('admin_token');
      if (!adminToken) {
        toast.error('请先登录');
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-membership-tiers', {
        body: { token: adminToken, action: 'list' }
      });

      if (error) throw error;
      setTiers(data?.data || []);
    } catch (error) {
      console.error('Failed to load tiers:', error);
      toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setSelectedTier(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (tier: MembershipTier) => {
    setSelectedTier(tier);
    setFormName(tier.name);
    setFormPrice(tier.price.toString());
    setFormBenefits(Array.isArray(tier.benefits) ? tier.benefits.join('\n') : '');
    setFormSortOrder(tier.sort_order.toString());
    setFormIsActive(tier.is_active);
    setFormWithdrawalMin(tier.withdrawal_minimum?.toString() || '0');
    setFormCheckInBonus(tier.daily_check_in_bonus?.toString() || '10');
    setFormDrawTickets(tier.daily_draw_tickets?.toString() || '3');
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormName('');
    setFormPrice('');
    setFormBenefits('');
    setFormSortOrder('0');
    setFormIsActive(true);
    setFormWithdrawalMin('0');
    setFormCheckInBonus('10');
    setFormDrawTickets('3');
  };

  const handleSubmit = async () => {
    if (!formName || !formPrice) {
      toast.error('请填写必填项');
      return;
    }

    setSubmitting(true);
    try {
      const adminToken = localStorage.getItem('admin_token');
      const benefitsArray = formBenefits.split('\n').filter(b => b.trim());
      
      const tierData = {
        name: formName,
        price: parseFloat(formPrice),
        benefits: benefitsArray,
        sort_order: parseInt(formSortOrder) || 0,
        is_active: formIsActive,
        withdrawal_minimum: parseFloat(formWithdrawalMin) || 0,
        daily_check_in_bonus: parseInt(formCheckInBonus) || 10,
        daily_draw_tickets: parseInt(formDrawTickets) || 3,
      };

      if (selectedTier) {
        const { error } = await supabase.functions.invoke('admin-membership-tiers', {
          body: { token: adminToken, action: 'update', id: selectedTier.id, tierData }
        });

        if (error) throw error;
        toast.success('会员等级已更新');
      } else {
        const { error } = await supabase.functions.invoke('admin-membership-tiers', {
          body: { token: adminToken, action: 'create', tierData }
        });

        if (error) throw error;
        toast.success('会员等级已创建');
      }

      setDialogOpen(false);
      loadTiers();
    } catch (error) {
      console.error('Failed to save tier:', error);
      toast.error('保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个会员等级吗？')) return;

    try {
      const adminToken = localStorage.getItem('admin_token');
      const { error } = await supabase.functions.invoke('admin-membership-tiers', {
        body: { token: adminToken, action: 'delete', id }
      });

      if (error) throw error;
      toast.success('会员等级已删除');
      loadTiers();
    } catch (error) {
      console.error('Failed to delete tier:', error);
      toast.error('删除失败');
    }
  };

  return (
    <div className="space-y-6 select-text">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">会员等级管理</h1>
          <p className="text-muted-foreground mt-2">管理会员等级和权益</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => {
            const exportData = tiers.map(t => ({
              '等级名称': t.name,
              '价格': `¥${t.price}`,
              '提现限额': `¥${t.withdrawal_minimum || 0}`,
              '签到奖励': `${t.daily_check_in_bonus || 10}积分`,
              '每月抽奖券': `${t.daily_draw_tickets || 3}张`,
              '权益数量': Array.isArray(t.benefits) ? t.benefits.length : 0,
              '状态': t.is_active ? '启用' : '禁用',
              '排序': t.sort_order,
            }));
            exportToCSV(exportData, '会员等级列表');
          }} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            导出数据
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            添加等级
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>会员等级列表</CardTitle>
          <CardDescription>共 {tiers.length} 个等级</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>等级名称</TableHead>
                  <TableHead>价格</TableHead>
                  <TableHead>提现限额</TableHead>
                  <TableHead>签到奖励</TableHead>
                  <TableHead>抽奖券</TableHead>
                  <TableHead>权益</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>排序</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiers.map((tier) => (
                  <TableRow key={tier.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Crown className="h-5 w-5 text-amber-500" />
                        <span className="font-medium">{tier.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-lg">
                        ¥{tier.price.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-green-600">
                        ¥{tier.withdrawal_minimum || 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-orange-500">
                        {tier.daily_check_in_bonus || 10} 积分
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-purple-500">
                        {tier.daily_draw_tickets || 3} 张/月
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {Array.isArray(tier.benefits) && tier.benefits.slice(0, 2).map((benefit, index) => (
                          <div key={index} className="text-sm text-muted-foreground">
                            • {benefit}
                          </div>
                        ))}
                        {Array.isArray(tier.benefits) && tier.benefits.length > 2 && (
                          <div className="text-xs text-muted-foreground">
                            +{tier.benefits.length - 2} 项权益
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {tier.is_active ? (
                        <Badge className="bg-green-500">启用</Badge>
                      ) : (
                        <Badge variant="secondary">禁用</Badge>
                      )}
                    </TableCell>
                    <TableCell>{tier.sort_order}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(tier)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(tier.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTier ? '编辑会员等级' : '添加会员等级'}</DialogTitle>
            <DialogDescription>
              {selectedTier ? '修改会员等级信息' : '创建新的会员等级'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">等级名称 *</Label>
                <Input
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="例如：黄金会员"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">价格 (¥) *</Label>
                <Input
                  id="price"
                  type="number"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="benefits">会员权益</Label>
              <Textarea
                id="benefits"
                value={formBenefits}
                onChange={(e) => setFormBenefits(e.target.value)}
                placeholder="每行一个权益，例如：&#10;专属客服&#10;提现优先&#10;专属头像框"
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                每行输入一个权益内容
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="withdrawalMin">最低提现额 (¥)</Label>
                <Input
                  id="withdrawalMin"
                  type="number"
                  value={formWithdrawalMin}
                  onChange={(e) => setFormWithdrawalMin(e.target.value)}
                  placeholder="0"
                  step="1"
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkInBonus">每日签到奖励</Label>
                <Input
                  id="checkInBonus"
                  type="number"
                  value={formCheckInBonus}
                  onChange={(e) => setFormCheckInBonus(e.target.value)}
                  placeholder="10"
                  step="1"
                  min="1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="drawTickets">每月抽奖券数量</Label>
              <Input
                id="drawTickets"
                type="number"
                value={formDrawTickets}
                onChange={(e) => setFormDrawTickets(e.target.value)}
                placeholder="3"
                step="1"
                min="0"
              />
              <p className="text-xs text-muted-foreground">
                会员每月可获得的免费抽奖次数
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortOrder">排序</Label>
              <Input
                id="sortOrder"
                type="number"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                数字越小越靠前
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="isActive">启用等级</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
