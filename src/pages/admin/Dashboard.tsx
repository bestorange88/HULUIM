import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, MessageSquare, Wallet, TrendingUp, AlertCircle, FileText, Gift, CreditCard, Crown } from 'lucide-react';

interface Stats {
  totalUsers: number;
  totalConversations: number;
  totalTransactions: number;
  totalWalletBalance: number;
  todayNewUsers: number;
  todayTransactions: number;
  pendingReviews: number;
  pendingVerifications: number;
  totalMessages: number;
  todayRechargeAmount: number;
  todayWithdrawAmount: number;
  redEnvelopeFixed: number;
  redEnvelopeRandom: number;
  redEnvelopeDesignated: number;
  membershipGold: number;
  membershipDiamond: number;
  membershipSupreme: number;
}

const defaultStats: Stats = {
  totalUsers: 0,
  totalConversations: 0,
  totalTransactions: 0,
  totalWalletBalance: 0,
  todayNewUsers: 0,
  todayTransactions: 0,
  pendingReviews: 0,
  pendingVerifications: 0,
  totalMessages: 0,
  todayRechargeAmount: 0,
  todayWithdrawAmount: 0,
  redEnvelopeFixed: 0,
  redEnvelopeRandom: 0,
  redEnvelopeDesignated: 0,
  membershipGold: 0,
  membershipDiamond: 0,
  membershipSupreme: 0,
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>(defaultStats);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const adminToken = localStorage.getItem('admin_token');
      
      if (!adminToken) {
        console.error('No admin token found');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-dashboard-stats', {
        body: { adminToken }
      });

      if (error) {
        console.error('Failed to load stats:', error);
        throw error;
      }

      if (data?.stats) {
        setStats({ ...defaultStats, ...data.stats });
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (value: number | undefined | null): string => {
    const num = value ?? 0;
    return num.toFixed(2);
  };

  const statCards = [
    {
      title: '总用户数',
      value: stats.totalUsers ?? 0,
      description: `今日新增 ${stats.todayNewUsers ?? 0} 人`,
      icon: Users,
      gradient: 'from-blue-500 to-blue-600',
    },
    {
      title: '总对话数',
      value: stats.totalConversations ?? 0,
      description: '所有用户创建的对话',
      icon: MessageSquare,
      gradient: 'from-green-500 to-green-600',
    },
    {
      title: '总交易数',
      value: stats.totalTransactions ?? 0,
      description: `今日交易 ${stats.todayTransactions ?? 0} 笔`,
      icon: TrendingUp,
      gradient: 'from-purple-500 to-purple-600',
    },
    {
      title: '钱包总余额',
      value: `¥${formatAmount(stats.totalWalletBalance)}`,
      description: '所有用户钱包余额总和',
      icon: Wallet,
      gradient: 'from-orange-500 to-orange-600',
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">仪表盘</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-20" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-16 mb-2" />
                <div className="h-3 bg-muted rounded w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">仪表盘</h1>
        <p className="text-muted-foreground mt-2">平台数据概览</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <div className={`p-2 rounded-lg bg-gradient-to-br ${card.gradient}`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <CardDescription className="text-xs mt-1">{card.description}</CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-green-500" />
              充值/提现统计
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">今日充值</span>
                <span className="font-bold text-green-500">¥{formatAmount(stats.todayRechargeAmount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">今日提现</span>
                <span className="font-bold text-red-500">¥{formatAmount(stats.todayWithdrawAmount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-red-500" />
              红包发放统计
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">私发红包</span>
                <span className="font-bold text-red-500">¥{formatAmount(stats.redEnvelopeFixed)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">拼手气红包</span>
                <span className="font-bold text-orange-500">¥{formatAmount(stats.redEnvelopeRandom)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">专属红包</span>
                <span className="font-bold text-purple-500">¥{formatAmount(stats.redEnvelopeDesignated)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              会员人数统计
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">黄金会员</span>
                <span className="font-bold text-amber-500">{stats.membershipGold ?? 0} 人</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">钻石会员</span>
                <span className="font-bold text-blue-500">{stats.membershipDiamond ?? 0} 人</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">至尊会员</span>
                <span className="font-bold text-purple-500">{stats.membershipSupreme ?? 0} 人</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              待审核事项
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">充值/提现审核</span>
                <span className="font-bold text-orange-500">{stats.pendingReviews ?? 0} 笔</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">实名认证审核</span>
                <span className="font-bold text-orange-500">{stats.pendingVerifications ?? 0} 笔</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              消息统计
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">总消息数</span>
                <span className="font-bold">{stats.totalMessages ?? 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
