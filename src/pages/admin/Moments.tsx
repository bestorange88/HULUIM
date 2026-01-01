import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Trash2, Heart, MessageCircle, Image as ImageIcon, Download } from 'lucide-react';
import { exportToCSV } from '@/utils/exportUtils';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { toast } from 'sonner';

interface Moment {
  id: string;
  user_id: string;
  content: string;
  images: any;
  likes_count: number;
  comments_count: number;
  created_at: string;
  profiles?: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
}

export default function AdminMoments() {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [filteredMoments, setFilteredMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMoment, setSelectedMoment] = useState<Moment | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadMoments();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = moments.filter(
        (moment) =>
          moment.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          moment.profiles?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          moment.profiles?.username?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredMoments(filtered);
    } else {
      setFilteredMoments(moments);
    }
  }, [searchQuery, moments]);

  const loadMoments = async () => {
    try {
      const adminToken = localStorage.getItem('admin_token');
      if (!adminToken) {
        toast.error('请先登录管理后台');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-moments-list', {
        body: { token: adminToken }
      });

      if (error) {
        console.error('Failed to load moments:', error);
        toast.error('加载朋友圈失败');
        setMoments([]);
        setFilteredMoments([]);
        return;
      }

      if (data?.error) {
        console.error('API error:', data.error);
        toast.error(data.error === 'Invalid or expired session' ? '会话已过期，请重新登录' : '加载朋友圈失败');
        setMoments([]);
        setFilteredMoments([]);
        return;
      }

      const momentsData = data?.data || [];
      setMoments(momentsData);
      setFilteredMoments(momentsData);
    } catch (error) {
      console.error('Failed to load moments:', error);
      toast.error('加载朋友圈失败');
    } finally {
      setLoading(false);
    }
  };

  const openDeleteDialog = (moment: Moment) => {
    setSelectedMoment(moment);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedMoment) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('moments')
        .delete()
        .eq('id', selectedMoment.id);

      if (error) throw error;

      toast.success('删除成功');
      setDeleteDialogOpen(false);
      loadMoments();
    } catch (error) {
      console.error('Failed to delete moment:', error);
      toast.error('删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const getImageCount = (images: any) => {
    if (!images) return 0;
    try {
      const parsed = Array.isArray(images) ? images : JSON.parse(images);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  };

  const handleExport = () => {
    const exportData = filteredMoments.map(moment => ({
      用户名: moment.profiles?.display_name || '',
      用户账号: moment.profiles?.username || '',
      内容: moment.content,
      图片数量: getImageCount(moment.images),
      点赞数: moment.likes_count,
      评论数: moment.comments_count,
      发布时间: moment.created_at,
    }));
    exportToCSV(exportData, '朋友圈动态');
    toast.success('导出成功');
  };

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle>朋友圈管理</CardTitle>
              <CardDescription>管理用户发布的朋友圈动态</CardDescription>
            </div>
            <Button onClick={handleExport} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              导出数据
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索内容或用户..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>内容</TableHead>
                  <TableHead>图片</TableHead>
                  <TableHead>互动</TableHead>
                  <TableHead>发布时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : filteredMoments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      暂无朋友圈动态
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMoments.map((moment) => (
                    <TableRow key={moment.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={moment.profiles?.avatar_url || ''} />
                            <AvatarFallback>
                              {moment.profiles?.display_name?.[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">
                              {moment.profiles?.display_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              @{moment.profiles?.username}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <p className="line-clamp-2 text-sm">{moment.content}</p>
                      </TableCell>
                      <TableCell>
                        {getImageCount(moment.images) > 0 && (
                          <Badge variant="outline">
                            <ImageIcon className="h-3 w-3 mr-1" />
                            {getImageCount(moment.images)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-3 text-sm">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Heart className="h-4 w-4" />
                            {moment.likes_count}
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <MessageCircle className="h-4 w-4" />
                            {moment.comments_count}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(moment.created_at), {
                            addSuffix: true,
                            locale: zhCN,
                          })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => openDeleteDialog(moment)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除朋友圈</DialogTitle>
            <DialogDescription>
              确定要删除这条朋友圈动态吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedMoment?.profiles?.avatar_url || ''} />
                <AvatarFallback>
                  {selectedMoment?.profiles?.display_name?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{selectedMoment?.profiles?.display_name}</p>
                <p className="text-sm text-muted-foreground">
                  @{selectedMoment?.profiles?.username}
                </p>
              </div>
            </div>
            <p className="text-sm">{selectedMoment?.content}</p>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              取消
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
