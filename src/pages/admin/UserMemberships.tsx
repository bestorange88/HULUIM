import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Crown } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface UserMembership {
  id: string;
  user_id: string;
  tier_id: string;
  payment_amount: number;
  payment_method: string | null;
  purchased_at: string;
  expires_at: string | null;
  is_active: boolean;
  user?: {
    user_id: string | null;
    username: string;
    display_name: string;
  };
  tier?: {
    name: string;
  };
}

export default function AdminUserMemberships() {
  const [memberships, setMemberships] = useState<UserMembership[]>([]);
  const [filteredMemberships, setFilteredMemberships] = useState<UserMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadMemberships();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = memberships.filter(
        (membership) =>
          membership.user?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          membership.user?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          membership.tier?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredMemberships(filtered);
    } else {
      setFilteredMemberships(memberships);
    }
  }, [searchQuery, memberships]);

  const loadMemberships = async () => {
    try {
      const adminToken = localStorage.getItem('admin_token');
      if (!adminToken) {
        toast.error('请先登录');
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-membership-tiers', {
        body: { token: adminToken, action: 'list_user_memberships', limit: 500 }
      });

      if (error) throw error;

      const membershipsWithDetails = data?.data || [];
      setMemberships(membershipsWithDetails);
      setFilteredMemberships(membershipsWithDetails);
    } catch (error) {
      console.error('Failed to load memberships:', error);
      toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = memberships.reduce((sum, m) => sum + m.payment_amount, 0);
  const activeMemberships = memberships.filter((m) => m.is_active).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">会员购买记录</h1>
        <p className="text-muted-foreground mt-2">查看用户会员购买和续费记录</p>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总购买次数</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{memberships.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">当前活跃会员</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeMemberships}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总收入</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">¥{totalRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>购买记录</CardTitle>
          <CardDescription>共 {memberships.length} 条购买记录</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索用户名或会员等级..."
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
                  <TableHead>ID</TableHead>
                  <TableHead>用户名</TableHead>
                  <TableHead>会员等级</TableHead>
                  <TableHead>支付金额</TableHead>
                  <TableHead>支付方式</TableHead>
                  <TableHead>购买时间</TableHead>
                  <TableHead>到期时间</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMemberships.map((membership) => (
                  <TableRow key={membership.id}>
                    <TableCell>
                      <span className="font-mono text-xs text-primary">
                        {membership.user?.user_id || '-'}
                      </span>
                    </TableCell>
                    <TableCell>@{membership.user?.username || 'unknown'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-amber-500" />
                        <span className="font-medium">
                          {membership.tier?.name || '未知等级'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">
                        ¥{membership.payment_amount.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {membership.payment_method || '-'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(membership.purchased_at), 'yyyy-MM-dd HH:mm')}
                    </TableCell>
                    <TableCell>
                      {membership.expires_at
                        ? format(new Date(membership.expires_at), 'yyyy-MM-dd')
                        : '永久'}
                    </TableCell>
                    <TableCell>
                      {membership.is_active ? (
                        <Badge className="bg-green-500">有效</Badge>
                      ) : (
                        <Badge variant="secondary">已过期</Badge>
                      )}
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
