import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, MessageCircle, Download } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { exportToCSV } from '@/utils/exportUtils';
import { toast } from 'sonner';

interface Message {
  id: string;
  content: string;
  type: string;
  created_at: string;
  sender?: {
    username: string;
    display_name: string;
  } | null;
  conversation?: {
    name: string | null;
    type: string;
  } | null;
}

export default function AdminMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadMessages();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = messages.filter(
        (msg) =>
          msg.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          msg.sender?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          msg.sender?.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredMessages(filtered);
    } else {
      setFilteredMessages(messages);
    }
  }, [searchQuery, messages]);

  const loadMessages = async () => {
    try {
      const adminToken = localStorage.getItem('admin_token');
      if (!adminToken) {
        toast.error('请先登录管理后台');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-messages-list', {
        body: { token: adminToken, limit: 200 }
      });

      if (error) {
        console.error('Failed to load messages:', error);
        toast.error('加载消息失败');
        setMessages([]);
        setFilteredMessages([]);
        return;
      }

      if (data?.error) {
        console.error('API error:', data.error);
        toast.error(data.error === 'Invalid or expired session' ? '会话已过期，请重新登录' : '加载消息失败');
        setMessages([]);
        setFilteredMessages([]);
        return;
      }

      const messagesData = data?.data || [];
      setMessages(messagesData);
      setFilteredMessages(messagesData);
    } catch (error) {
      console.error('Failed to load messages:', error);
      toast.error('加载消息失败');
    } finally {
      setLoading(false);
    }
  };

  const getTypeBadge = (type: string) => {
    const typeMap: Record<string, { label: string; variant: any }> = {
      text: { label: '文本', variant: 'secondary' },
      image: { label: '图片', variant: 'default' },
      video: { label: '视频', variant: 'default' },
      audio: { label: '语音', variant: 'default' },
      file: { label: '文件', variant: 'default' },
    };
    const config = typeMap[type] || { label: type, variant: 'secondary' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const truncateContent = (content: string, maxLength: number = 50) => {
    if (!content) return '';
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">聊天记录</h1>
        <p className="text-muted-foreground mt-2">查看和管理所有聊天消息</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                消息列表
              </CardTitle>
              <CardDescription>最近 200 条消息记录</CardDescription>
            </div>
            <Button onClick={() => {
              const exportData = filteredMessages.map(msg => ({
                '发送人': msg.sender?.display_name || '-',
                '用户名': msg.sender?.username || '-',
                '类型': msg.type,
                '内容': msg.content,
                '时间': new Date(msg.created_at).toLocaleString('zh-CN'),
              }));
              exportToCSV(exportData, '聊天记录');
            }} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索消息内容或发送者..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : filteredMessages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">暂无消息记录</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>发送者</TableHead>
                  <TableHead>消息类型</TableHead>
                  <TableHead>消息内容</TableHead>
                  <TableHead>对话</TableHead>
                  <TableHead>发送时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMessages.map((msg) => (
                  <TableRow key={msg.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {msg.sender?.display_name || '未知用户'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          @{msg.sender?.username || '未知'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getTypeBadge(msg.type)}</TableCell>
                    <TableCell className="max-w-md">
                      <p className="text-sm">{truncateContent(msg.content)}</p>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {msg.conversation?.name ||
                          `${msg.conversation?.type === 'group' ? '群聊' : '私聊'}`}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(msg.created_at), {
                        addSuffix: true,
                        locale: zhCN,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
