import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Download, ArrowLeftRight, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { exportToCSV } from '@/utils/exportUtils';

interface Transfer {
  id: string;
  sender_id: string;
  receiver_id: string;
  conversation_id: string;
  amount: number;
  message: string | null;
  status: string;
  created_at: string;
  accepted_at: string | null;
  expire_at: string;
  sender?: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
  receiver?: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

export default function AdminTransfers() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [filteredTransfers, setFilteredTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadTransfers();
  }, []);

  useEffect(() => {
    filterTransfers();
  }, [searchQuery, transfers]);

  const filterTransfers = () => {
    let filtered = [...transfers];

    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (t) =>
          t.sender?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.sender?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.receiver?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.receiver?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.message?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredTransfers(filtered);
  };

  const loadTransfers = async () => {
    try {
      const adminToken = localStorage.getItem('admin_token');
      if (!adminToken) {
        console.error('No admin token');
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-transactions', {
        body: { token: adminToken, action: 'list_transfers', limit: 200 }
      });

      if (error) throw error;

      const transfersWithUsers = data?.data || [];
      setTransfers(transfersWithUsers);
      setFilteredTransfers(transfersWithUsers);
    } catch (error) {
      console.error('Failed to load transfers:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'pending') {
      return <Badge variant="secondary">待领取</Badge>;
    }
    if (status === 'accepted') {
      return <Badge className="bg-green-500">已领取</Badge>;
    }
    if (status === 'expired') {
      return <Badge variant="destructive">已过期</Badge>;
    }
    if (status === 'refunded') {
      return <Badge variant="outline">已退回</Badge>;
    }
    return <Badge>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">转账记录</h1>
        <p className="text-muted-foreground mt-2">查看所有转账交易记录</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-orange-500" />
                转账列表
              </CardTitle>
              <CardDescription>最近 200 条转账记录</CardDescription>
            </div>
            <Button onClick={() => {
              const exportData = filteredTransfers.map(t => ({
                '发送人': t.sender?.display_name || '-',
                '发送人用户名': t.sender?.username || '-',
                '接收人': t.receiver?.display_name || '-',
                '接收人用户名': t.receiver?.username || '-',
                '金额': t.amount,
                '留言': t.message || '-',
                '状态': t.status,
                '发送时间': format(new Date(t.created_at), 'yyyy-MM-dd HH:mm:ss'),
                '领取时间': t.accepted_at ? format(new Date(t.accepted_at), 'yyyy-MM-dd HH:mm:ss') : '-',
              }));
              exportToCSV(exportData, '转账记录');
            }} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              导出数据
            </Button>
          </div>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索发送人、接收人或留言..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : filteredTransfers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">暂无转账记录</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>发送人</TableHead>
                  <TableHead></TableHead>
                  <TableHead>接收人</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>留言</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>发送时间</TableHead>
                  <TableHead>领取时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransfers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={t.sender?.avatar_url || ''} />
                          <AvatarFallback>{t.sender?.display_name?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{t.sender?.display_name || '未知'}</div>
                          <div className="text-xs text-muted-foreground">@{t.sender?.username || '未知'}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={t.receiver?.avatar_url || ''} />
                          <AvatarFallback>{t.receiver?.display_name?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{t.receiver?.display_name || '未知'}</div>
                          <div className="text-xs text-muted-foreground">@{t.receiver?.username || '未知'}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-primary font-semibold">
                      ¥{t.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-muted-foreground">
                      {t.message || '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(t.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(t.created_at), 'MM-dd HH:mm')}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.accepted_at ? format(new Date(t.accepted_at), 'MM-dd HH:mm') : '-'}
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
