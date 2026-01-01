import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Download, Gift, Users, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { exportToCSV } from '@/utils/exportUtils';

interface RedEnvelope {
  id: string;
  sender_id: string;
  conversation_id: string;
  type: string;
  amount: number;
  quantity: number;
  remaining_quantity: number;
  remaining_amount: number;
  message: string | null;
  status: string;
  created_at: string;
  expire_at: string;
  sender?: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

interface ClaimRecord {
  id: string;
  user_id: string;
  amount: number;
  claimed_at: string;
  profile?: {
    display_name: string;
    avatar_url: string | null;
    username: string;
  };
}

export default function AdminRedEnvelopes() {
  const [envelopes, setEnvelopes] = useState<RedEnvelope[]>([]);
  const [filteredEnvelopes, setFilteredEnvelopes] = useState<RedEnvelope[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEnvelope, setSelectedEnvelope] = useState<RedEnvelope | null>(null);
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);

  useEffect(() => {
    loadEnvelopes();
  }, []);

  useEffect(() => {
    filterEnvelopes();
  }, [searchQuery, envelopes]);

  const filterEnvelopes = () => {
    let filtered = [...envelopes];

    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (env) =>
          env.sender?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          env.sender?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          env.message?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredEnvelopes(filtered);
  };

  const loadEnvelopes = async () => {
    try {
      const adminToken = localStorage.getItem('admin_token');
      if (!adminToken) {
        console.error('No admin token');
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-transactions', {
        body: { token: adminToken, action: 'list_red_envelopes', limit: 200 }
      });

      if (error) throw error;

      const envelopesWithSenders = data?.data || [];
      setEnvelopes(envelopesWithSenders);
      setFilteredEnvelopes(envelopesWithSenders);
    } catch (error) {
      console.error('Failed to load red envelopes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadClaims = async (envelopeId: string) => {
    setLoadingClaims(true);
    try {
      const { data: claimsData } = await supabase
        .from('red_envelope_claims')
        .select('*')
        .eq('red_envelope_id', envelopeId)
        .order('claimed_at', { ascending: false });

      if (claimsData && claimsData.length > 0) {
        const userIds = claimsData.map(c => c.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, username')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        
        const claimsWithProfiles = claimsData.map(claim => ({
          ...claim,
          profile: profileMap.get(claim.user_id)
        }));
        
        setClaims(claimsWithProfiles);
      } else {
        setClaims([]);
      }
    } catch (error) {
      console.error('Failed to load claims:', error);
    } finally {
      setLoadingClaims(false);
    }
  };

  const handleViewClaims = (envelope: RedEnvelope) => {
    setSelectedEnvelope(envelope);
    loadClaims(envelope.id);
  };

  const getStatusBadge = (status: string, remainingQty: number) => {
    if (status === 'active' && remainingQty > 0) {
      return <Badge className="bg-green-500">进行中</Badge>;
    }
    if (status === 'claimed' || remainingQty === 0) {
      return <Badge variant="secondary">已领完</Badge>;
    }
    if (status === 'expired') {
      return <Badge variant="destructive">已过期</Badge>;
    }
    return <Badge>{status}</Badge>;
  };

  const getTypeLabel = (type: string) => {
    return type === 'random' ? '拼手气红包' : '普通红包';
  };

  // Calculate max claim for "手气最佳"
  const maxClaimAmount = claims.length > 0 ? Math.max(...claims.map(c => c.amount)) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">红包记录</h1>
        <p className="text-muted-foreground mt-2">查看所有红包发送和领取记录</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-red-500" />
                红包列表
              </CardTitle>
              <CardDescription>最近 200 条红包记录</CardDescription>
            </div>
            <Button onClick={() => {
              const exportData = filteredEnvelopes.map(env => ({
                '发送人': env.sender?.display_name || '-',
                '用户名': env.sender?.username || '-',
                '类型': getTypeLabel(env.type),
                '总金额': env.amount,
                '个数': env.quantity,
                '已领取': env.quantity - env.remaining_quantity,
                '剩余金额': env.remaining_amount,
                '祝福语': env.message || '-',
                '状态': env.status,
                '发送时间': format(new Date(env.created_at), 'yyyy-MM-dd HH:mm:ss'),
                '过期时间': format(new Date(env.expire_at), 'yyyy-MM-dd HH:mm:ss'),
              }));
              exportToCSV(exportData, '红包记录');
            }} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              导出数据
            </Button>
          </div>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索发送人或祝福语..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : filteredEnvelopes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">暂无红包记录</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>发送人</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>领取进度</TableHead>
                  <TableHead>祝福语</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>发送时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEnvelopes.map((env) => (
                  <TableRow key={env.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={env.sender?.avatar_url || ''} />
                          <AvatarFallback>{env.sender?.display_name?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{env.sender?.display_name || '未知'}</div>
                          <div className="text-xs text-muted-foreground">@{env.sender?.username || '未知'}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getTypeLabel(env.type)}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-primary">
                      ¥{env.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-green-500 font-medium">{env.quantity - env.remaining_quantity}</span>
                        <span className="text-muted-foreground">/{env.quantity}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-muted-foreground">
                      {env.message || '恭喜发财'}
                    </TableCell>
                    <TableCell>{getStatusBadge(env.status, env.remaining_quantity)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(env.created_at), 'MM-dd HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => handleViewClaims(env)}>
                        <Eye className="h-4 w-4 mr-1" />
                        查看领取
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Claims Dialog */}
      <Dialog open={!!selectedEnvelope} onOpenChange={() => setSelectedEnvelope(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-red-500" />
              领取详情
            </DialogTitle>
          </DialogHeader>

          {selectedEnvelope && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">发送人</span>
                  <span className="font-medium">{selectedEnvelope.sender?.display_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">类型</span>
                  <span>{getTypeLabel(selectedEnvelope.type)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">总金额</span>
                  <span className="font-semibold text-primary">¥{selectedEnvelope.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">已领取</span>
                  <span className="text-green-500">{selectedEnvelope.quantity - selectedEnvelope.remaining_quantity}/{selectedEnvelope.quantity}</span>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">领取记录 ({claims.length}人)</h4>
                {loadingClaims ? (
                  <div className="text-center py-4 text-muted-foreground">加载中...</div>
                ) : claims.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">暂无人领取</div>
                ) : (
                  <ScrollArea className="h-64 border rounded-lg">
                    <div className="p-2 space-y-2">
                      {claims.map((claim) => (
                        <div key={claim.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={claim.profile?.avatar_url || ''} />
                            <AvatarFallback>{claim.profile?.display_name?.[0] || '?'}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{claim.profile?.display_name || '用户'}</p>
                            <p className="text-xs text-muted-foreground">@{claim.profile?.username}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-primary">¥{claim.amount.toFixed(2)}</p>
                            {selectedEnvelope.type === 'random' && claim.amount === maxClaimAmount && claims.length > 1 && (
                              <span className="text-xs text-orange-500 font-medium">手气最佳</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(claim.claimed_at), 'MM-dd HH:mm')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
