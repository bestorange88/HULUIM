import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, TrendingUp, TrendingDown, Gift, ArrowLeftRight, Wallet, Settings, Download } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { exportToCSV } from '@/utils/exportUtils';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string | null;
  status: string;
  created_at: string;
  user?: {
    username: string;
    display_name: string;
  };
}

type TabType = 'all' | 'red_envelope' | 'transfer' | 'crypto' | 'admin';

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');

  useEffect(() => {
    loadTransactions();
  }, []);

  useEffect(() => {
    filterTransactions();
  }, [searchQuery, transactions, activeTab]);

  const filterTransactions = () => {
    let filtered = [...transactions];

    // Filter by tab
    if (activeTab !== 'all') {
      filtered = filtered.filter((tx) => {
        switch (activeTab) {
          case 'red_envelope':
            return tx.type.includes('red_envelope');
          case 'transfer':
            return tx.type.includes('transfer');
          case 'crypto':
            return tx.type === 'deposit' || tx.type === 'withdraw';
          case 'admin':
            return tx.type === 'admin_add' || tx.type === 'admin_subtract';
          default:
            return true;
        }
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (tx) =>
          tx.user?.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tx.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tx.type.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredTransactions(filtered);
  };

  const loadTransactions = async () => {
    try {
      const adminToken = localStorage.getItem('admin_token');
      if (!adminToken) {
        console.error('No admin token');
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-transactions', {
        body: { token: adminToken, action: 'list_transactions', limit: 100 }
      });

      if (error) throw error;

      const transactionsWithUsers = data?.data || [];
      setTransactions(transactionsWithUsers);
      setFilteredTransactions(transactionsWithUsers);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeDisplay = (type: string) => {
    const typeMap: Record<string, string> = {
      red_envelope_send: '发送红包',
      red_envelope_receive: '领取红包',
      transfer_send: '发起转账',
      transfer_receive: '收款',
      deposit: '充值',
      withdraw: '提现',
      admin_add: '管理员加款',
      admin_subtract: '管理员扣款',
    };
    return typeMap[type] || type;
  };

  const getTypeBadge = (type: string) => {
    const isIncome = type.includes('receive') || type === 'deposit' || type === 'admin_add';
    return isIncome ? (
      <Badge className="bg-green-500">
        <TrendingUp className="h-3 w-3 mr-1" />
        收入
      </Badge>
    ) : (
      <Badge variant="destructive">
        <TrendingDown className="h-3 w-3 mr-1" />
        支出
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    if (status === 'completed') {
      return <Badge className="bg-green-500">已完成</Badge>;
    }
    if (status === 'pending') {
      return <Badge variant="secondary">处理中</Badge>;
    }
    return <Badge variant="destructive">失败</Badge>;
  };

  const getTabCount = (tab: TabType) => {
    if (tab === 'all') return transactions.length;
    return transactions.filter((tx) => {
      switch (tab) {
        case 'red_envelope':
          return tx.type.includes('red_envelope');
        case 'transfer':
          return tx.type.includes('transfer');
        case 'crypto':
          return tx.type === 'deposit' || tx.type === 'withdraw';
        case 'admin':
          return tx.type === 'admin_add' || tx.type === 'admin_subtract';
        default:
          return true;
      }
    }).length;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">交易管理</h1>
        <p className="text-muted-foreground mt-2">管理所有交易记录</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>交易列表</CardTitle>
              <CardDescription>最近 100 条交易记录</CardDescription>
            </div>
            <Button onClick={() => {
              const exportData = filteredTransactions.map(tx => ({
                '用户名': tx.user?.username || '-',
                '昵称': tx.user?.display_name || '-',
                '交易类型': tx.type,
                '金额': tx.amount,
                '交易前余额': tx.balance_before,
                '交易后余额': tx.balance_after,
                '描述': tx.description || '-',
                '状态': tx.status,
                '时间': new Date(tx.created_at).toLocaleString('zh-CN'),
              }));
              exportToCSV(exportData, '交易记录');
            }} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              导出数据
            </Button>
          </div>
          
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="mt-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all" className="flex items-center gap-1">
                全部
                <span className="text-xs text-muted-foreground">({getTabCount('all')})</span>
              </TabsTrigger>
              <TabsTrigger value="red_envelope" className="flex items-center gap-1">
                <Gift className="h-4 w-4" />
                红包
                <span className="text-xs text-muted-foreground">({getTabCount('red_envelope')})</span>
              </TabsTrigger>
              <TabsTrigger value="transfer" className="flex items-center gap-1">
                <ArrowLeftRight className="h-4 w-4" />
                转账
                <span className="text-xs text-muted-foreground">({getTabCount('transfer')})</span>
              </TabsTrigger>
              <TabsTrigger value="crypto" className="flex items-center gap-1">
                <Wallet className="h-4 w-4" />
                充提
                <span className="text-xs text-muted-foreground">({getTabCount('crypto')})</span>
              </TabsTrigger>
              <TabsTrigger value="admin" className="flex items-center gap-1">
                <Settings className="h-4 w-4" />
                管理
                <span className="text-xs text-muted-foreground">({getTabCount('admin')})</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索用户名、描述或交易类型..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">暂无交易记录</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>交易类型</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead>时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{tx.user?.display_name || '未知用户'}</div>
                        <div className="text-sm text-muted-foreground">@{tx.user?.username || '未知'}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeBadge(tx.type)}
                        <span className="text-sm">{getTypeDisplay(tx.type)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      <span className={tx.amount >= 0 ? 'text-green-500' : 'text-red-500'}>
                        ¥{Math.abs(tx.amount).toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(tx.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {tx.description || '-'}
                    </TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(tx.created_at), {
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
