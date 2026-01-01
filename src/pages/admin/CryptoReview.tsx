import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

import { useToast } from '@/hooks/use-toast';

interface CryptoTransaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  usdt_amount: number;
  trc20_address: string;
  tx_hash: string | null;
  status: string;
  review_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  notes: string | null;
  created_at: string;
  profiles?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

export default function CryptoReview() {
  const [transactions, setTransactions] = useState<CryptoTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewDialog, setReviewDialog] = useState(false);
  const [selectedTx, setSelectedTx] = useState<CryptoTransaction | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      
      const { data, error } = await supabase.functions.invoke('admin-review-transaction', {
        body: {
          action: 'getAll',
          token
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (data.success) {
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error('Failed to load transactions:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      toast({
        title: '加载失败',
        description: error instanceof Error ? error.message : '无法加载交易记录',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!selectedTx) return;

    setReviewing(true);
    try {
      const token = localStorage.getItem('admin_token');
      
      const { data, error } = await supabase.functions.invoke('admin-review-transaction', {
        body: {
          action: 'review',
          token,
          transactionId: selectedTx.id,
          reviewStatus: status,
          reviewNotes: reviewNotes || null
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        console.error('Error status:', (error as any).status);
        console.error('Error message:', (error as any).message);
        throw error;
      }

      if (data.success) {
        toast({
          title: '审核成功',
          description: `交易已${status === 'approved' ? '通过' : '拒绝'}`,
        });
        setReviewDialog(false);
        setSelectedTx(null);
        setReviewNotes('');
        loadTransactions();
      }
    } catch (error) {
      console.error('Review failed:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      toast({
        title: '审核失败',
        description: error instanceof Error ? error.message : '操作失败，请重试',
        variant: 'destructive',
      });
    } finally {
      setReviewing(false);
    }
  };

  const openReviewDialog = (tx: CryptoTransaction) => {
    setSelectedTx(tx);
    setReviewNotes('');
    setReviewDialog(true);
  };

  const getStatusBadge = (reviewStatus: string) => {
    if (reviewStatus === 'approved') {
      return (
        <Badge className="bg-green-500">
          <CheckCircle className="h-3 w-3 mr-1" />
          已通过
        </Badge>
      );
    }
    if (reviewStatus === 'rejected') {
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          已拒绝
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <Clock className="h-3 w-3 mr-1" />
        待审核
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'deposit':
        return <Badge className="bg-blue-500">USDT充值</Badge>;
      case 'withdraw':
        return <Badge className="bg-purple-500">USDT提现</Badge>;
      case 'fiat_deposit':
        return <Badge className="bg-green-500">法币充值</Badge>;
      case 'fiat_withdraw':
        return <Badge className="bg-orange-500">法币提现</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const pendingTransactions = transactions.filter(tx => tx.review_status === 'pending');
  const reviewedTransactions = transactions.filter(tx => tx.review_status !== 'pending');

  const TransactionTable = ({ data }: { data: CryptoTransaction[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>用户</TableHead>
          <TableHead>类型</TableHead>
          <TableHead>金额</TableHead>
          <TableHead>USDT</TableHead>
          <TableHead>地址/收款信息</TableHead>
          <TableHead>状态</TableHead>
          <TableHead>时间</TableHead>
          <TableHead>操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((tx) => (
          <TableRow key={tx.id}>
            <TableCell>
              <div>
                <div className="font-medium">{tx.profiles?.display_name || '未知用户'}</div>
                <div className="text-sm text-muted-foreground">@{tx.profiles?.username || '未知'}</div>
              </div>
            </TableCell>
            <TableCell>{getTypeBadge(tx.type)}</TableCell>
            <TableCell className="font-mono">¥{tx.amount.toFixed(2)}</TableCell>
            <TableCell className="font-mono">
              {tx.type.includes('fiat') ? '-' : `${tx.usdt_amount.toFixed(2)} USDT`}
            </TableCell>
            <TableCell>
              <div className="max-w-[200px] truncate text-sm font-mono">
                {tx.type.includes('fiat') && tx.type === 'fiat_withdraw' 
                  ? tx.trc20_address.split('|').join(' / ')
                  : tx.trc20_address}
              </div>
            </TableCell>
            <TableCell>{getStatusBadge(tx.review_status)}</TableCell>
            <TableCell className="text-sm whitespace-nowrap">
              {format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm')}
            </TableCell>
            <TableCell>
              {tx.review_status === 'pending' ? (
                <Button
                  size="sm"
                  onClick={() => openReviewDialog(tx)}
                >
                  审核
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openReviewDialog(tx)}
                >
                  查看
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">充值提现审核</h1>
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">充值提现审核</h1>
          <p className="text-muted-foreground mt-2">审核用户的充值和提现申请</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 px-4 py-2 rounded-lg">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">{pendingTransactions.length} 条待审核</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending">
            待审核 ({pendingTransactions.length})
          </TabsTrigger>
          <TabsTrigger value="reviewed">
            已审核 ({reviewedTransactions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>待审核申请</CardTitle>
              <CardDescription>需要您审核的充值和提现申请</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingTransactions.length > 0 ? (
                <TransactionTable data={pendingTransactions} />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  暂无待审核的交易
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviewed" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>已审核记录</CardTitle>
              <CardDescription>历史审核记录</CardDescription>
            </CardHeader>
            <CardContent>
              <TransactionTable data={reviewedTransactions} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={reviewDialog} onOpenChange={setReviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>审核交易</DialogTitle>
            <DialogDescription>
              {selectedTx?.review_status === 'pending' 
                ? '请仔细核对交易信息后进行审核' 
                : '查看审核详情'}
            </DialogDescription>
          </DialogHeader>

          {selectedTx && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">用户</div>
                  <div className="font-medium">{selectedTx.profiles?.display_name}</div>
                  <div className="text-sm text-muted-foreground">@{selectedTx.profiles?.username}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">交易类型</div>
                  <div>{getTypeBadge(selectedTx.type)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">金额</div>
                  <div className="font-mono font-medium">¥{selectedTx.amount.toFixed(2)}</div>
                </div>
                {!selectedTx.type.includes('fiat') && (
                  <div>
                    <div className="text-sm text-muted-foreground">USDT金额</div>
                    <div className="font-mono font-medium">{selectedTx.usdt_amount.toFixed(2)} USDT</div>
                  </div>
                )}
                <div className="col-span-2">
                  <div className="text-sm text-muted-foreground">
                    {selectedTx.type === 'fiat_withdraw' ? '收款银行信息' : selectedTx.type === 'fiat_deposit' ? '充值方式' : 'TRC20地址'}
                  </div>
                  <div className="font-mono text-sm break-all bg-muted p-2 rounded">
                    {selectedTx.type === 'fiat_withdraw' 
                      ? selectedTx.trc20_address.split('|').map((item, i) => (
                          <div key={i}>{['银行', '户名', '账号'][i]}: {item}</div>
                        ))
                      : selectedTx.trc20_address}
                  </div>
                </div>
                {selectedTx.tx_hash && (
                  <div className="col-span-2">
                    <div className="text-sm text-muted-foreground">交易哈希</div>
                    <div className="font-mono text-sm break-all bg-muted p-2 rounded">
                      {selectedTx.tx_hash}
                    </div>
                  </div>
                )}
                {selectedTx.notes && (
                  <div className="col-span-2">
                    <div className="text-sm text-muted-foreground">用户备注</div>
                    <div className="text-sm bg-muted p-2 rounded">{selectedTx.notes}</div>
                  </div>
                )}
                {selectedTx.review_status !== 'pending' && (
                  <>
                    <div className="col-span-2">
                      <div className="text-sm text-muted-foreground">审核状态</div>
                      <div className="mt-1">{getStatusBadge(selectedTx.review_status)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">审核人</div>
                      <div className="font-medium">{selectedTx.reviewed_by || '-'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">审核时间</div>
                      <div className="text-sm">
                        {selectedTx.reviewed_at
                          ? format(new Date(selectedTx.reviewed_at), 'yyyy-MM-dd HH:mm')
                          : '-'}
                      </div>
                    </div>
                    {selectedTx.review_notes && (
                      <div className="col-span-2">
                        <div className="text-sm text-muted-foreground">审核备注</div>
                        <div className="text-sm bg-muted p-2 rounded">{selectedTx.review_notes}</div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {selectedTx.review_status === 'pending' && (
                <div>
                  <label className="text-sm font-medium">审核备注（可选）</label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="输入审核备注..."
                    rows={3}
                    className="mt-2"
                  />
                </div>
              )}
            </div>
          )}

          {selectedTx?.review_status === 'pending' && (
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setReviewDialog(false)}
                disabled={reviewing}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleReview('rejected')}
                disabled={reviewing}
              >
                拒绝
              </Button>
              <Button
                onClick={() => handleReview('approved')}
                disabled={reviewing}
                className="bg-green-500 hover:bg-green-600"
              >
                {reviewing ? '处理中...' : '通过'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}