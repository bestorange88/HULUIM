import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Users as UsersIcon, MessageCircle, Trash2, XCircle, UserX, Download } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { exportToCSV } from '@/utils/exportUtils';

interface Participant {
  id: string;
  user_id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
}

interface Message {
  id: string;
  content: string;
  type: string;
  created_at: string;
  sender: {
    display_name: string;
    username: string;
  };
}

interface Conversation {
  id: string;
  name: string | null;
  type: 'direct' | 'group';
  created_at: string;
  participantCount?: number;
  messageCount?: number;
  participants?: Participant[];
}

export default function AdminConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  
  // Dialog states
  const [messagesDialogOpen, setMessagesDialogOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  // Action dialogs
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dissolveDialogOpen, setDissolveDialogOpen] = useState(false);
  const [actionConversation, setActionConversation] = useState<Conversation | null>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const adminToken = localStorage.getItem('admin_token');
      if (!adminToken) {
        console.error('No admin token');
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-conversations', {
        body: { token: adminToken, action: 'list' }
      });

      if (error) throw error;
      setConversations(data?.data || []);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterConversations = () => {
    let filtered = conversations;
    
    // Filter by type
    if (activeTab === 'direct') {
      filtered = filtered.filter(c => c.type === 'direct');
    } else if (activeTab === 'group') {
      filtered = filtered.filter(c => c.type === 'group');
    }
    
    // Filter by search
    if (searchQuery.trim()) {
      filtered = filtered.filter((conv) =>
        conv.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.participants?.some(p => 
          p.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.username.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }
    
    return filtered;
  };

  const filteredConversations = filterConversations();
  const directCount = conversations.filter(c => c.type === 'direct').length;
  const groupCount = conversations.filter(c => c.type === 'group').length;

  const getTypeBadge = (type: string) => {
    if (type === 'group') {
      return <Badge className="bg-blue-500">群聊</Badge>;
    }
    return <Badge variant="secondary">私聊</Badge>;
  };

  const loadMessages = async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const adminToken = localStorage.getItem('admin_token');
      const { data, error } = await supabase.functions.invoke('admin-conversations', {
        body: { token: adminToken, action: 'list_messages', conversationId, limit: 100 }
      });

      if (error) throw error;
      setMessages(data?.data || []);
    } catch (error) {
      console.error('Failed to load messages:', error);
      toast({ title: '加载消息失败', variant: 'destructive' });
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleViewMessages = (conv: Conversation) => {
    setSelectedConversation(conv);
    setMessagesDialogOpen(true);
    loadMessages(conv.id);
  };

  const handleClearMessages = async () => {
    if (!actionConversation) return;
    try {
      const adminToken = localStorage.getItem('admin_token');
      const { error } = await supabase.functions.invoke('admin-conversations', {
        body: { token: adminToken, action: 'clear_messages', conversationId: actionConversation.id }
      });

      if (error) throw error;

      toast({ title: '消息已清空' });
      setClearDialogOpen(false);
      loadConversations();
    } catch (error) {
      console.error('Failed to clear messages:', error);
      toast({ title: '清空失败', variant: 'destructive' });
    }
  };

  const handleDeleteConversation = async () => {
    if (!actionConversation) return;
    try {
      const adminToken = localStorage.getItem('admin_token');
      const { error } = await supabase.functions.invoke('admin-conversations', {
        body: { token: adminToken, action: 'delete', conversationId: actionConversation.id }
      });

      if (error) throw error;

      toast({ title: '对话已删除' });
      setDeleteDialogOpen(false);
      loadConversations();
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      toast({ title: '删除失败', variant: 'destructive' });
    }
  };

  const handleDissolveGroup = async () => {
    if (!actionConversation) return;
    try {
      const adminToken = localStorage.getItem('admin_token');
      const { error } = await supabase.functions.invoke('admin-conversations', {
        body: { token: adminToken, action: 'dissolve', conversationId: actionConversation.id }
      });

      if (error) throw error;

      toast({ title: '群组已解散' });
      setDissolveDialogOpen(false);
      loadConversations();
    } catch (error) {
      console.error('Failed to dissolve group:', error);
      toast({ title: '解散失败', variant: 'destructive' });
    }
  };

  const getMessageTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      text: '文本',
      image: '图片',
      video: '视频',
      audio: '语音',
      file: '文件',
      emoji: '表情',
    };
    return types[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">对话管理</h1>
          <p className="text-muted-foreground mt-2">管理所有对话记录</p>
        </div>
        <Button onClick={() => {
          const exportData = filteredConversations.map(c => ({
            '类型': c.type === 'group' ? '群聊' : '私聊',
            '名称': c.name || '私聊',
            '成员数': c.participantCount || 0,
            '消息数': c.messageCount || 0,
            '创建时间': new Date(c.created_at).toLocaleString('zh-CN'),
          }));
          exportToCSV(exportData, '对话列表');
        }} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          导出
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>对话列表</CardTitle>
          <CardDescription>共 {conversations.length} 个对话</CardDescription>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList>
              <TabsTrigger value="all" className="gap-2">
                全部
                <Badge variant="secondary" className="ml-1">{conversations.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="direct" className="gap-2">
                私聊
                <Badge variant="secondary" className="ml-1">{directCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="group" className="gap-2">
                群聊
                <Badge variant="secondary" className="ml-1">{groupCount}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索对话名称或参与者..."
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
                  <TableHead>对话名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>参与人数</TableHead>
                  <TableHead>消息数</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConversations.map((conv) => (
                  <TableRow key={conv.id}>
                    <TableCell className="font-medium">
                      {conv.name || `${conv.type === 'group' ? '群聊' : '私聊'} ${conv.id.slice(0, 8)}`}
                    </TableCell>
                    <TableCell>{getTypeBadge(conv.type)}</TableCell>
                    <TableCell>
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <div className="flex items-center gap-2 cursor-pointer hover:text-primary">
                            <UsersIcon className="h-4 w-4 text-muted-foreground" />
                            {conv.participantCount}
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-64">
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold">参与成员</h4>
                            <ScrollArea className="h-32">
                              <div className="space-y-2">
                                {conv.participants?.map((p) => (
                                  <div key={p.id} className="flex items-center gap-2 text-sm">
                                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">
                                      {p.display_name.charAt(0)}
                                    </div>
                                    <div>
                                      <div className="font-medium">{p.display_name}</div>
                                      <div className="text-xs text-muted-foreground">@{p.username}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    </TableCell>
                    <TableCell>
                      <div 
                        className="flex items-center gap-2 cursor-pointer hover:text-primary"
                        onClick={() => handleViewMessages(conv)}
                      >
                        <MessageCircle className="h-4 w-4 text-muted-foreground" />
                        {conv.messageCount}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(conv.created_at), {
                        addSuffix: true,
                        locale: zhCN,
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setActionConversation(conv);
                            setClearDialogOpen(true);
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          清空
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setActionConversation(conv);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          删除
                        </Button>
                        {conv.type === 'group' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setActionConversation(conv);
                              setDissolveDialogOpen(true);
                            }}
                          >
                            <UserX className="h-4 w-4 mr-1" />
                            解散
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Messages Dialog */}
      <Dialog open={messagesDialogOpen} onOpenChange={setMessagesDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              聊天记录 - {selectedConversation?.name || `${selectedConversation?.type === 'group' ? '群聊' : '私聊'}`}
            </DialogTitle>
            <DialogDescription>
              最近 100 条消息
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[50vh]">
            {loadingMessages ? (
              <div className="text-center py-8 text-muted-foreground">加载中...</div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">暂无消息</div>
            ) : (
              <div className="space-y-3 pr-4">
                {messages.map((msg) => (
                  <div key={msg.id} className="border-b pb-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{msg.sender.display_name}</span>
                      <span className="text-muted-foreground text-xs">
                        {format(new Date(msg.created_at), 'yyyy-MM-dd HH:mm:ss')}
                      </span>
                    </div>
                    <div className="mt-1 text-sm">
                      {msg.type !== 'text' && (
                        <Badge variant="outline" className="mr-2 text-xs">
                          {getMessageTypeLabel(msg.type)}
                        </Badge>
                      )}
                      <span className="text-muted-foreground">
                        {msg.type === 'text' ? msg.content : `[${getMessageTypeLabel(msg.type)}]`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Clear Messages Dialog */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清空消息</AlertDialogTitle>
            <AlertDialogDescription>
              确定要清空该对话的所有消息吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearMessages}>确认清空</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Conversation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除对话</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除该对话吗？所有消息和参与者记录都将被删除，此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConversation} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dissolve Group Dialog */}
      <AlertDialog open={dissolveDialogOpen} onOpenChange={setDissolveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>解散群组</AlertDialogTitle>
            <AlertDialogDescription>
              确定要解散该群组吗？所有消息、成员和邀请链接都将被删除，此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDissolveGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              确认解散
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
