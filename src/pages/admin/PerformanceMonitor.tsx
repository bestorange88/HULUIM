import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Database, Users, MessageSquare, Archive, TrendingUp } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface PerformanceStats {
  messages: {
    total: number;
    last_24h: number;
    last_7d: number;
    last_30d: number;
    deleted: number;
    table_size: string;
  };
  archive: {
    archived_messages: number;
    oldest_message: string;
    newest_message: string;
    archive_size: string;
  };
  realtime: {
    active_connections: number;
    online_users: number;
  };
  database: {
    total_size: string;
    active_connections: number;
  };
}

interface ChartData {
  time: string;
  messages: number;
  users: number;
}

export default function PerformanceMonitor() {
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const loadStats = async () => {
    try {
      // Get messages stats
      const { data: messagesStats } = await supabase
        .from('messages_stats_overview')
        .select('*')
        .single();

      // Get archive stats
      const { data: archiveStats } = await supabase
        .from('archive_stats')
        .select('*')
        .single();

      // Get online users count - ONLY based on last_seen within 2 minutes (real activity)
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { count: onlineCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('last_seen', twoMinutesAgo);

      // Get active conversations
      const { count: activeConvCount } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true });

      setStats({
        messages: {
          total: messagesStats?.total_messages || 0,
          last_24h: messagesStats?.messages_last_24h || 0,
          last_7d: messagesStats?.messages_last_7d || 0,
          last_30d: messagesStats?.messages_last_30d || 0,
          deleted: messagesStats?.deleted_messages || 0,
          table_size: messagesStats?.table_size || '0 MB',
        },
        archive: {
          archived_messages: archiveStats?.archived_messages || 0,
          oldest_message: archiveStats?.oldest_message || '-',
          newest_message: archiveStats?.newest_message || '-',
          archive_size: archiveStats?.archive_size || '0 MB',
        },
        realtime: {
          active_connections: activeConvCount || 0,
          online_users: onlineCount || 0,
        },
        database: {
          total_size: 'N/A',
          active_connections: 0,
        },
      });

      // Update chart data
      const now = new Date();
      const newDataPoint = {
        time: now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        messages: messagesStats?.messages_last_24h || 0,
        users: onlineCount || 0,
      };
      
      setChartData(prev => {
        const updated = [...prev, newDataPoint];
        return updated.slice(-20); // Keep last 20 data points
      });

      setLoading(false);
    } catch (error) {
      console.error('Failed to load performance stats:', error);
      setLoading(false);
    }
  };

  const StatCard = ({ 
    title, 
    value, 
    description, 
    icon: Icon, 
    gradient 
  }: { 
    title: string; 
    value: string | number; 
    description: string; 
    icon: any; 
    gradient: string;
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <CardDescription className="text-xs mt-1">{description}</CardDescription>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">性能监控</h1>
          <p className="text-muted-foreground mt-2">实时系统性能监控</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">性能监控</h1>
          <p className="text-muted-foreground mt-2">实时系统性能监控和统计</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">刷新间隔:</span>
          <select 
            value={refreshInterval} 
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="px-3 py-1 border rounded-md text-sm"
          >
            <option value={3000}>3秒</option>
            <option value={5000}>5秒</option>
            <option value={10000}>10秒</option>
            <option value={30000}>30秒</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="在线用户"
          value={stats.realtime.online_users}
          description="当前在线用户数"
          icon={Users}
          gradient="from-blue-500 to-blue-600"
        />
        <StatCard
          title="24小时消息"
          value={stats.messages.last_24h}
          description="过去24小时消息量"
          icon={MessageSquare}
          gradient="from-green-500 to-green-600"
        />
        <StatCard
          title="活跃会话"
          value={stats.realtime.active_connections}
          description="当前活跃对话数"
          icon={Activity}
          gradient="from-purple-500 to-purple-600"
        />
        <StatCard
          title="归档消息"
          value={stats.archive.archived_messages}
          description={stats.archive.archive_size}
          icon={Archive}
          gradient="from-orange-500 to-orange-600"
        />
      </div>

      {/* Charts */}
      <Tabs defaultValue="realtime" className="space-y-4">
        <TabsList>
          <TabsTrigger value="realtime">实时监控</TabsTrigger>
          <TabsTrigger value="messages">消息统计</TabsTrigger>
          <TabsTrigger value="database">数据库</TabsTrigger>
        </TabsList>

        <TabsContent value="realtime" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>实时数据趋势</CardTitle>
              <CardDescription>过去时间段的在线用户和消息量变化</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="users" 
                    stroke="hsl(var(--primary))" 
                    name="在线用户"
                    strokeWidth={2}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="messages" 
                    stroke="hsl(var(--accent))" 
                    name="24h消息"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>消息统计详情</CardTitle>
                <CardDescription>各时间段消息数量</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">总消息数</span>
                  <span className="font-bold text-lg">{stats.messages.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">24小时消息</span>
                  <span className="font-bold text-green-600">{stats.messages.last_24h.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">7天消息</span>
                  <span className="font-bold text-blue-600">{stats.messages.last_7d.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">30天消息</span>
                  <span className="font-bold text-purple-600">{stats.messages.last_30d.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">已删除消息</span>
                  <span className="font-bold text-red-600">{stats.messages.deleted.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>消息吞吐量对比</CardTitle>
                <CardDescription>不同时间段消息量对比</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={[
                    { name: '24小时', value: stats.messages.last_24h },
                    { name: '7天', value: stats.messages.last_7d },
                    { name: '30天', value: stats.messages.last_30d },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  数据库存储
                </CardTitle>
                <CardDescription>表空间使用情况</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">消息表大小</span>
                  <span className="font-bold">{stats.messages.table_size}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">归档表大小</span>
                  <span className="font-bold">{stats.archive.archive_size}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">活跃连接数</span>
                  <span className="font-bold">{stats.database.active_connections}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Archive className="h-5 w-5" />
                  消息归档统计
                </CardTitle>
                <CardDescription>历史消息归档信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">已归档消息</span>
                  <span className="font-bold">{stats.archive.archived_messages.toLocaleString()}</span>
                </div>
                <div className="flex flex-col gap-1 pb-2 border-b">
                  <span className="text-muted-foreground text-sm">最早归档消息</span>
                  <span className="font-mono text-xs">
                    {stats.archive.oldest_message !== '-' 
                      ? new Date(stats.archive.oldest_message).toLocaleString('zh-CN')
                      : '-'}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-sm">最新归档消息</span>
                  <span className="font-mono text-xs">
                    {stats.archive.newest_message !== '-'
                      ? new Date(stats.archive.newest_message).toLocaleString('zh-CN')
                      : '-'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Performance Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            性能建议
          </CardTitle>
          <CardDescription>基于当前数据的优化建议</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.messages.total > 1000000 && (
              <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <p className="text-sm text-orange-600">
                  💡 消息表数据量较大 ({stats.messages.total.toLocaleString()} 条)，建议检查归档策略
                </p>
              </div>
            )}
            {stats.realtime.online_users > 50000 && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-blue-600">
                  💡 在线用户数接近预警值，建议考虑启用消息队列和读写分离
                </p>
              </div>
            )}
            {stats.messages.last_24h > 10000 && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-sm text-green-600">
                  ✅ 系统运行良好，消息吞吐量在正常范围内
                </p>
              </div>
            )}
            {stats.archive.archived_messages === 0 && stats.messages.total > 100000 && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-sm text-yellow-600">
                  ⚠️ 建议启用自动归档功能，定期归档60天以前的历史消息
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
