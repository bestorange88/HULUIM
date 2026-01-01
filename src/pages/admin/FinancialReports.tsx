import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownLeft, Wallet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

interface DailyStats {
  date: string;
  deposits: number;
  withdrawals: number;
  deposit_count: number;
  withdrawal_count: number;
}

interface SummaryStats {
  total_deposits: number;
  total_withdrawals: number;
  deposit_count: number;
  withdrawal_count: number;
  pending_deposits: number;
  pending_withdrawals: number;
}

export default function FinancialReports() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [chartData, setChartData] = useState<DailyStats[]>([]);
  const [summary, setSummary] = useState<SummaryStats>({
    total_deposits: 0,
    total_withdrawals: 0,
    deposit_count: 0,
    withdrawal_count: 0,
    pending_deposits: 0,
    pending_withdrawals: 0,
  });

  useEffect(() => {
    loadStats();
  }, [period]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        console.error("No admin token found");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("admin-financial-reports", {
        body: { action: "getStats", token, period },
      });

      if (error) {
        console.error("Failed to load stats:", error);
        return;
      }

      if (data?.summary) {
        setSummary(data.summary);
      }
      if (data?.chartData) {
        setChartData(data.chartData);
      }
    } catch (error) {
      console.error("Failed to load stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (period === "monthly") {
      const [year, month] = dateStr.split("-");
      return `${year}年${month}月`;
    }
    const date = new Date(dateStr);
    if (period === "weekly") {
      return `${date.getMonth() + 1}/${date.getDate()}周`;
    }
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatCurrency = (value: number) => {
    return `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">财务报表</h1>
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">财务报表</h1>
        <p className="text-muted-foreground mt-2">充值提现统计数据分析</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总充值金额</CardTitle>
            <ArrowDownLeft className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.total_deposits)}
            </div>
            <p className="text-xs text-muted-foreground">
              共 {summary.deposit_count} 笔，待审核 {summary.pending_deposits} 笔
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总提现金额</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(summary.total_withdrawals)}
            </div>
            <p className="text-xs text-muted-foreground">
              共 {summary.withdrawal_count} 笔，待审核 {summary.pending_withdrawals} 笔
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">净流入</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.total_deposits - summary.total_withdrawals >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(summary.total_deposits - summary.total_withdrawals)}
            </div>
            <p className="text-xs text-muted-foreground">
              充值 - 提现
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">交易笔数</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.deposit_count + summary.withdrawal_count}
            </div>
            <p className="text-xs text-muted-foreground">
              已完成交易总数
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>充值提现趋势</CardTitle>
              <CardDescription>
                {period === "daily" ? "最近30天" : period === "weekly" ? "最近12周" : "最近12个月"}数据统计
              </CardDescription>
            </div>
            <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
              <TabsList>
                <TabsTrigger value="daily">日报</TabsTrigger>
                <TabsTrigger value="weekly">周报</TabsTrigger>
                <TabsTrigger value="monthly">月报</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                  className="text-xs"
                />
                <YAxis 
                  tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
                  className="text-xs"
                />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), ""]}
                  labelFormatter={formatDate}
                />
                <Legend />
                <Bar dataKey="deposits" name="充值" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="withdrawals" name="提现" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>详细数据</CardTitle>
          <CardDescription>按{period === "daily" ? "日" : period === "weekly" ? "周" : "月"}统计的充值提现明细</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead className="text-right">充值金额</TableHead>
                  <TableHead className="text-right">充值笔数</TableHead>
                  <TableHead className="text-right">提现金额</TableHead>
                  <TableHead className="text-right">提现笔数</TableHead>
                  <TableHead className="text-right">净流入</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chartData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  [...chartData].reverse().map((row) => (
                    <TableRow key={row.date}>
                      <TableCell className="font-medium">{formatDate(row.date)}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(row.deposits)}
                      </TableCell>
                      <TableCell className="text-right">{row.deposit_count}</TableCell>
                      <TableCell className="text-right text-orange-600">
                        {formatCurrency(row.withdrawals)}
                      </TableCell>
                      <TableCell className="text-right">{row.withdrawal_count}</TableCell>
                      <TableCell className={`text-right font-medium ${row.deposits - row.withdrawals >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(row.deposits - row.withdrawals)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
