import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, MessageSquare, Download } from 'lucide-react';
import { exportToCSV } from '@/utils/exportUtils';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { toast } from 'sonner';

interface SystemMessage {
  id: string;
  title: string;
  content: string;
  type: string;
  is_active: boolean;
  priority: number;
  created_at: string;
  created_by: string;
}

export default function AdminSystemMessages() {
  const [messages, setMessages] = useState<SystemMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<SystemMessage | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('info');
  const [priority, setPriority] = useState('0');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('system_messages')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      setMessages(data || []);
    } catch (error) {
      console.error('Failed to load system messages:', error);
      toast.error('加载系统消息失败');
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setSelectedMessage(null);
    setTitle('');
    setContent('');
    setType('info');
    setPriority('0');
    setIsActive(true);
    setDialogOpen(true);
  };

  const openEditDialog = (message: SystemMessage) => {
    setSelectedMessage(message);
    setTitle(message.title);
    setContent(message.content);
    setType(message.type);
    setPriority(message.priority.toString());
    setIsActive(message.is_active);
    setDialogOpen(true);
  };

  const openDeleteDialog = (message: SystemMessage) => {
    setSelectedMessage(message);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('请填写标题和内容');
      return;
    }

    setSubmitting(true);
    try {
      const messageData = {
        title: title.trim(),
        content: content.trim(),
        type,
        priority: parseInt(priority),
        is_active: isActive,
        created_by: 'admin',
      };

      if (selectedMessage) {
        // Update existing message
        const { error } = await supabase
          .from('system_messages')
          .update(messageData)
          .eq('id', selectedMessage.id);

        if (error) throw error;
        toast.success('更新成功');
      } else {
        // Create new message
        const { error } = await supabase
          .from('system_messages')
          .insert(messageData);

        if (error) throw error;
        toast.success('创建成功');
      }

      setDialogOpen(false);
      loadMessages();
    } catch (error) {
      console.error('Failed to save system message:', error);
      toast.error('保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMessage) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('system_messages')
        .delete()
        .eq('id', selectedMessage.id);

      if (error) throw error;

      toast.success('删除成功');
      setDeleteDialogOpen(false);
      loadMessages();
    } catch (error) {
      console.error('Failed to delete system message:', error);
      toast.error('删除失败');
    } finally {
      setSubmitting(false);
    }
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      info: { label: '通知', className: 'bg-blue-500' },
      warning: { label: '警告', className: 'bg-yellow-500' },
      announcement: { label: '公告', className: 'bg-purple-500' },
    };
    const config = variants[type] || variants.info;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const handleExport = () => {
    const exportData = messages.map(msg => ({
      标题: msg.title,
      内容: msg.content,
      类型: getTypeBadge(msg.type).props.children,
      优先级: msg.priority,
      状态: msg.is_active ? '已发布' : '已下线',
      发布时间: msg.created_at,
      发布者: msg.created_by,
    }));
    exportToCSV(exportData, '系统消息');
    toast.success('导出成功');
  };

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>系统消息管理</CardTitle>
              <CardDescription>发布和管理系统通知消息</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleExport} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                导出数据
              </Button>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                发布新消息
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标题</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>优先级</TableHead>
                  <TableHead>状态</TableHead>
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
                ) : messages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      暂无系统消息
                    </TableCell>
                  </TableRow>
                ) : (
                  messages.map((message) => (
                    <TableRow key={message.id}>
                      <TableCell className="max-w-md">
                        <p className="font-medium">{message.title}</p>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {message.content}
                        </p>
                      </TableCell>
                      <TableCell>{getTypeBadge(message.type)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{message.priority}</Badge>
                      </TableCell>
                      <TableCell>
                        {message.is_active ? (
                          <Badge className="bg-green-500">已发布</Badge>
                        ) : (
                          <Badge variant="secondary">已下线</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(message.created_at), {
                            addSuffix: true,
                            locale: zhCN,
                          })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(message)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => openDeleteDialog(message)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedMessage ? '编辑系统消息' : '发布新消息'}
            </DialogTitle>
            <DialogDescription>
              填写系统消息内容，发布后将在用户对话页面置顶显示
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">标题</Label>
              <Input
                id="title"
                placeholder="输入消息标题"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">内容</Label>
              <Textarea
                id="content"
                placeholder="输入消息内容"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">消息类型</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">通知</SelectItem>
                    <SelectItem value="warning">警告</SelectItem>
                    <SelectItem value="announcement">公告</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">优先级</Label>
                <Input
                  id="priority"
                  type="number"
                  placeholder="0"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="active">立即发布</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除系统消息</DialogTitle>
            <DialogDescription>
              确定要删除这条系统消息吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="font-medium">{selectedMessage?.title}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {selectedMessage?.content}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={submitting}
            >
              {submitting ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
