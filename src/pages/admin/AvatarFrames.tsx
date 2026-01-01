import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Edit, Plus, Trash2, Frame, Upload, Crown, Image } from 'lucide-react';
import { toast } from 'sonner';

interface AvatarFrame {
  id: string;
  name: string;
  description: string | null;
  style_class: string;
  image_url: string | null;
  required_tier: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

interface MembershipTier {
  id: string;
  name: string;
  price: number;
  badge_image_url?: string;
}

export default function AdminAvatarFrames() {
  const [frames, setFrames] = useState<AvatarFrame[]>([]);
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState<AvatarFrame | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tierBadgeInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStyleClass, setFormStyleClass] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formRequiredTier, setFormRequiredTier] = useState('');
  const [formSortOrder, setFormSortOrder] = useState('0');
  const [formIsActive, setFormIsActive] = useState(true);

  useEffect(() => {
    loadFrames();
    loadTiers();
  }, []);

  const loadFrames = async () => {
    try {
      const { data, error } = await supabase
        .from('avatar_frames')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setFrames(data || []);
    } catch (error) {
      console.error('Failed to load frames:', error);
      toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadTiers = async () => {
    try {
      const { data, error } = await supabase
        .from('membership_tiers')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      
      // Load badge URLs from platform_settings
      const { data: settings } = await supabase
        .from('platform_settings')
        .select('key, value')
        .like('key', 'membership_badge_%');

      const badgeMap: Record<string, string> = {};
      settings?.forEach(s => {
        const tierId = s.key.replace('membership_badge_', '');
        badgeMap[tierId] = s.value || '';
      });

      const tiersWithBadges = (data || []).map(t => ({
        ...t,
        badge_image_url: badgeMap[t.id] || ''
      }));
      
      setTiers(tiersWithBadges);
    } catch (error) {
      console.error('Failed to load tiers:', error);
    }
  };

  const openCreateDialog = () => {
    setSelectedFrame(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (frame: AvatarFrame) => {
    setSelectedFrame(frame);
    setFormId(frame.id);
    setFormName(frame.name);
    setFormDescription(frame.description || '');
    setFormStyleClass(frame.style_class);
    setFormImageUrl(frame.image_url || '');
    setFormRequiredTier(frame.required_tier || '');
    setFormSortOrder(frame.sort_order.toString());
    setFormIsActive(frame.is_active);
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormId('');
    setFormName('');
    setFormDescription('');
    setFormStyleClass('frame-default');
    setFormImageUrl('');
    setFormRequiredTier('');
    setFormSortOrder('0');
    setFormIsActive(true);
  };

  const uploadImage = async (file: File, folder: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  const handleFrameImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }

    setUploading(true);
    const url = await uploadImage(file, 'frames');
    if (url) {
      setFormImageUrl(url);
      toast.success('图片上传成功');
    } else {
      toast.error('图片上传失败');
    }
    setUploading(false);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleTierBadgeUpload = async (tierId: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }

    setUploading(true);
    const url = await uploadImage(file, 'badges');
    if (url) {
      // Save to platform_settings
      const key = `membership_badge_${tierId}`;
      const { data: existing } = await supabase
        .from('platform_settings')
        .select('id')
        .eq('key', key)
        .single();

      if (existing) {
        await supabase
          .from('platform_settings')
          .update({ value: url })
          .eq('key', key);
      } else {
        await supabase
          .from('platform_settings')
          .insert({ key, value: url, description: '会员等级标识图片' });
      }

      toast.success('会员标识上传成功');
      loadTiers();
    } else {
      toast.error('上传失败');
    }
    setUploading(false);
    
    if (tierBadgeInputRef.current) {
      tierBadgeInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!formName) {
      toast.error('请填写头像框名称');
      return;
    }

    if (!selectedFrame && !formId) {
      toast.error('请输入头像框ID');
      return;
    }

    setSubmitting(true);
    try {
      const frameData = {
        id: formId,
        name: formName,
        description: formDescription || null,
        style_class: formStyleClass || 'frame-default',
        image_url: formImageUrl || null,
        required_tier: formRequiredTier || null,
        sort_order: parseInt(formSortOrder) || 0,
        is_active: formIsActive,
      };

      if (selectedFrame) {
        const { id, ...updateData } = frameData;
        const { error } = await supabase
          .from('avatar_frames')
          .update(updateData)
          .eq('id', selectedFrame.id);

        if (error) throw error;
        toast.success('头像框已更新');
      } else {
        const { error } = await supabase
          .from('avatar_frames')
          .insert(frameData);

        if (error) throw error;
        toast.success('头像框已创建');
      }

      setDialogOpen(false);
      loadFrames();
    } catch (error) {
      console.error('Failed to save frame:', error);
      toast.error('保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个头像框吗？')) return;

    try {
      const { error } = await supabase
        .from('avatar_frames')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('头像框已删除');
      loadFrames();
    } catch (error) {
      console.error('Failed to delete frame:', error);
      toast.error('删除失败');
    }
  };

  const getTierLabel = (tier: string | null) => {
    if (!tier) return '所有会员';
    const labels: Record<string, string> = {
      gold: '黄金会员',
      diamond: '钻石会员',
      elite: '至尊会员',
    };
    return labels[tier] || tier;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">头像框管理</h1>
        <p className="text-muted-foreground mt-2">管理用户可选的头像装饰框和会员等级标识</p>
      </div>

      <Tabs defaultValue="frames">
        <TabsList>
          <TabsTrigger value="frames" className="gap-2">
            <Frame className="h-4 w-4" />
            头像框
          </TabsTrigger>
          <TabsTrigger value="badges" className="gap-2">
            <Crown className="h-4 w-4" />
            会员标识
          </TabsTrigger>
        </TabsList>

        {/* Avatar Frames Tab */}
        <TabsContent value="frames" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              添加头像框
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>头像框列表</CardTitle>
              <CardDescription>共 {frames.length} 个头像框</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">加载中...</div>
              ) : frames.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">暂无头像框</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>预览</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>所需等级</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>排序</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {frames.map((frame) => (
                      <TableRow key={frame.id}>
                        <TableCell>
                          {frame.image_url ? (
                            <img
                              src={frame.image_url}
                              alt={frame.name}
                              className="w-16 h-16 object-contain border rounded"
                            />
                          ) : (
                            <div className="w-16 h-16 border-2 border-dashed rounded flex items-center justify-center">
                              <Frame className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{frame.name}</div>
                            {frame.description && (
                              <div className="text-sm text-muted-foreground">
                                {frame.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {frame.id}
                          </code>
                        </TableCell>
                        <TableCell>{getTierLabel(frame.required_tier)}</TableCell>
                        <TableCell>
                          {frame.is_active ? (
                            <Badge className="bg-green-500">启用</Badge>
                          ) : (
                            <Badge variant="secondary">禁用</Badge>
                          )}
                        </TableCell>
                        <TableCell>{frame.sort_order}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(frame)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(frame.id)}
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
        </TabsContent>

        {/* Membership Badges Tab */}
        <TabsContent value="badges" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>会员等级标识</CardTitle>
              <CardDescription>上传各会员等级的标识图片，用于展示在用户资料等位置</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                {tiers.map((tier) => (
                  <Card key={tier.id} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{tier.name}</CardTitle>
                      <CardDescription>¥{tier.price}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="aspect-square border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/50 overflow-hidden">
                        {tier.badge_image_url ? (
                          <img
                            src={tier.badge_image_url}
                            alt={tier.name}
                            className="w-full h-full object-contain p-2"
                          />
                        ) : (
                          <div className="text-center text-muted-foreground">
                            <Image className="h-12 w-12 mx-auto mb-2" />
                            <p className="text-sm">暂无标识</p>
                          </div>
                        )}
                      </div>
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          id={`badge-upload-${tier.id}`}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleTierBadgeUpload(tier.id, file);
                            e.target.value = '';
                          }}
                        />
                        <Button
                          variant="outline"
                          className="w-full"
                          disabled={uploading}
                          onClick={() => document.getElementById(`badge-upload-${tier.id}`)?.click()}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {tier.badge_image_url ? '更换标识' : '上传标识'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {tiers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  暂无会员等级，请先在"会员等级"页面添加
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedFrame ? '编辑头像框' : '添加头像框'}</DialogTitle>
            <DialogDescription>
              {selectedFrame ? '修改头像框信息' : '创建新的头像框供用户选择'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {!selectedFrame && (
              <div className="space-y-2">
                <Label htmlFor="id">头像框ID *</Label>
                <Input
                  id="id"
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                  placeholder="例如：gold_frame_1"
                />
                <p className="text-xs text-muted-foreground">
                  唯一标识符，只能包含字母、数字和下划线
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">名称 *</Label>
                <Input
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="例如：金色边框"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="requiredTier">所需会员等级</Label>
                <Select value={formRequiredTier} onValueChange={setFormRequiredTier}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择等级" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">所有会员</SelectItem>
                    <SelectItem value="gold">黄金会员</SelectItem>
                    <SelectItem value="diamond">钻石会员</SelectItem>
                    <SelectItem value="elite">至尊会员</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="头像框的描述信息"
                rows={2}
              />
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label>头像框图片 *</Label>
              <div className="flex gap-4 items-start">
                <div className="w-24 h-24 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/50 overflow-hidden shrink-0">
                  {formImageUrl ? (
                    <img
                      src={formImageUrl}
                      alt="预览"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Frame className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFrameImageUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? '上传中...' : '上传图片'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    建议使用PNG透明背景图片，尺寸建议200x200像素
                  </p>
                  {formImageUrl && (
                    <Input
                      value={formImageUrl}
                      onChange={(e) => setFormImageUrl(e.target.value)}
                      placeholder="或直接输入图片URL"
                      className="text-xs"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sortOrder">排序（数字越小越靠前）</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2 flex items-end">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="isActive">启用头像框</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !formImageUrl}>
              {submitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
