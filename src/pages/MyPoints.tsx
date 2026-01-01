import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Gift, ArrowLeft, ArrowRightLeft, Sparkles, Check } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, getDaysInMonth, startOfMonth, getDay } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckInSuccessDialog } from "@/components/points/CheckInSuccessDialog";

interface CheckInDay {
  day: number;
  checked: boolean;
  date: string;
  isToday: boolean;
  isFuture: boolean;
}

interface PointTransaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

export default function MyPoints() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [points, setPoints] = useState(0);
  const [consecutiveDays, setConsecutiveDays] = useState(0);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [checkInDays, setCheckInDays] = useState<CheckInDay[]>([]);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load user points
      const { data: pointsData } = await supabase
        .from("user_points")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();

      if (pointsData) {
        setPoints(Number(pointsData.balance));
      } else {
        // Create initial points record
        await supabase.from("user_points").insert({
          user_id: user.id,
          balance: 0,
        });
        setPoints(0);
      }

      // Load check-in data for current month
      const firstDay = startOfMonth(currentMonth);
      const daysInMonth = getDaysInMonth(currentMonth);
      const monthStart = format(firstDay, 'yyyy-MM-01');
      const monthEnd = format(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0), 'yyyy-MM-dd');
      
      const { data: checkInData } = await supabase
        .from("daily_check_ins")
        .select("*")
        .eq("user_id", user.id)
        .gte("check_in_date", monthStart)
        .lte("check_in_date", monthEnd);

      if (checkInData && checkInData.length > 0) {
        setConsecutiveDays(checkInData[0]?.consecutive_days || 0);
      }
      
      // Generate full month check-in calendar
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const checkedDates = new Set(checkInData?.map(c => c.check_in_date) || []);
      
      const days: CheckInDay[] = [];
      for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const isToday = dateStr === todayStr;
        const isFuture = date > today;
        
        days.push({
          day: i,
          checked: checkedDates.has(dateStr),
          date: dateStr,
          isToday,
          isFuture,
        });
      }
      setCheckInDays(days);

      // Load transactions
      const { data: transData } = await supabase
        .from("point_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (transData) {
        setTransactions(transData.map(t => ({
          id: t.id,
          type: t.type,
          amount: Number(t.amount),
          description: t.description || '',
          created_at: t.created_at,
        })));
      }
    } catch (error) {
      console.error("Failed to load points data:", error);
      toast.error(t("points.loadError"));
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (checking) return;
    
    setChecking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t("common.pleaseLogin"));
        return;
      }

      const today = new Date().toISOString().split('T')[0];

      // Check if already checked in today
      const { data: existingCheckIn } = await supabase
        .from("daily_check_ins")
        .select("*")
        .eq("user_id", user.id)
        .eq("check_in_date", today)
        .maybeSingle();

      if (existingCheckIn) {
        toast.info(t("points.alreadyCheckedIn"));
        return;
      }

      // Get yesterday's check-in
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const { data: yesterdayCheckIn } = await supabase
        .from("daily_check_ins")
        .select("*")
        .eq("user_id", user.id)
        .eq("check_in_date", yesterdayStr)
        .maybeSingle();

      // 如果昨天没签到，连续天数重置为1
      const newConsecutiveDays = yesterdayCheckIn 
        ? yesterdayCheckIn.consecutive_days + 1 
        : 1;

      // 获取7天循环签到积分设置（基于连续签到天数，不是星期几）
      // 连续签到第1天=day1, 第2天=day2, ..., 第7天=day7, 第8天=day1（循环）
      const cycleDay = ((newConsecutiveDays - 1) % 7) + 1; // 1-7循环
      const dayKey = `day${cycleDay}`;
      
      const { data: dayRewardSetting } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', `checkin_day_${dayKey}`)
        .maybeSingle();
      
      let basePoints = dayRewardSetting ? parseInt(dayRewardSetting.value || '1') : 1;
      
      // 获取用户会员等级倍数
      const { data: membershipData } = await supabase
        .from('user_memberships')
        .select(`
          tier_id,
          membership_tiers (name)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      
      let multiplier = 1;
      if (membershipData) {
        const tierName = (membershipData.membership_tiers as any)?.name?.toLowerCase();
        if (tierName) {
          let multiplierKey = '';
          if (tierName.includes('黄金') || tierName.includes('gold')) {
            multiplierKey = 'checkin_multiplier_gold';
          } else if (tierName.includes('钻石') || tierName.includes('diamond')) {
            multiplierKey = 'checkin_multiplier_diamond';
          } else if (tierName.includes('至尊') || tierName.includes('elite')) {
            multiplierKey = 'checkin_multiplier_elite';
          }
          
          if (multiplierKey) {
            const { data: multiplierSetting } = await supabase
              .from('platform_settings')
              .select('value')
              .eq('key', multiplierKey)
              .maybeSingle();
            
            if (multiplierSetting) {
              multiplier = parseFloat(multiplierSetting.value || '1');
            }
          }
        }
      }
      
      const pointsEarned = Math.floor(basePoints * multiplier);

      // Create check-in record
      await supabase.from("daily_check_ins").insert({
        user_id: user.id,
        check_in_date: today,
        consecutive_days: newConsecutiveDays,
        points_earned: pointsEarned,
      });

      // Get current points
      const { data: currentPoints } = await supabase
        .from("user_points")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();

      let oldBalance = 0;
      if (!currentPoints) {
        // Create user_points record if it doesn't exist
        await supabase.from("user_points").insert({
          user_id: user.id,
          balance: 0,
        });
      } else {
        oldBalance = Number(currentPoints.balance);
      }

      const newBalance = oldBalance + pointsEarned;

      // Update points
      await supabase
        .from("user_points")
        .update({ balance: newBalance })
        .eq("user_id", user.id);

      // Create transaction record
      await supabase.from("point_transactions").insert({
        user_id: user.id,
        type: "check_in",
        amount: pointsEarned,
        balance_before: oldBalance,
        balance_after: newBalance,
        description: t("points.checkInReward"),
      });

      setEarnedPoints(pointsEarned);
      setShowSuccessDialog(true);
      loadData();
    } catch (error) {
      console.error("Check-in failed:", error);
      toast.error(t("points.checkInFailed"));
    } finally {
      setChecking(false);
    }
  };

  const filterTransactions = (type: 'all' | 'income' | 'expense') => {
    if (type === 'all') return transactions;
    if (type === 'income') return transactions.filter(t => t.amount > 0);
    return transactions.filter(t => t.amount < 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b border-border bg-card flex items-center gap-3">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/profile")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <h1 className="text-lg font-semibold">{t("points.myPoints")}</h1>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-4 py-6 space-y-6">
        {/* Points Display */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-primary via-accent to-purple-600 text-white p-8 shadow-xl">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMDUiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-30" />
          
          <div className="relative flex items-center justify-between mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-5 w-5 animate-pulse" />
                <p className="text-sm font-medium opacity-90">{t("points.myPoints")}</p>
              </div>
              <p className="text-6xl font-bold mb-3 tracking-tight">{points}</p>
              <p className="text-sm opacity-80 flex items-center gap-1">
                <Gift className="h-4 w-4" />
                {t("points.checkInEncouragement")}
              </p>
            </div>
            <div className="absolute right-0 top-0 opacity-10">
              <Gift className="h-40 w-40" />
            </div>
          </div>

          <div className="relative flex gap-3">
            <Button
              variant="secondary"
              className="flex-1 h-11 gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm shadow-lg"
              onClick={() => navigate("/points-mall")}
            >
              <Gift className="h-4 w-4" />
              {t("points.mallExchange")}
            </Button>
            <Button
              variant="secondary"
              className="flex-1 h-11 gap-2 bg-white/90 hover:bg-white text-primary border-0 shadow-lg"
              onClick={() => navigate("/points-exchange")}
            >
              <ArrowRightLeft className="h-4 w-4" />
              {t("points.pointsExchange")}
            </Button>
          </div>
        </Card>

        {/* Check-in Section */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{t("points.checkInEarnPoints")}</h3>
            <span className="text-sm text-muted-foreground">
              {t("points.consecutiveDays", { days: consecutiveDays })}
            </span>
          </div>

          {/* Month Header */}
          <div className="text-center mb-4">
            <span className="font-medium">
              {format(currentMonth, 'yyyy年M月', { locale: zhCN })}
            </span>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
              <div key={day} className="text-center text-xs text-muted-foreground font-medium py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {/* Empty cells for days before month starts */}
            {Array.from({ length: getDay(startOfMonth(currentMonth)) }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            
            {/* Day cells */}
            {checkInDays.map((day) => (
              <div
                key={day.day}
                className={`aspect-square flex items-center justify-center rounded-lg text-xs relative transition-all ${
                  day.checked
                    ? "bg-primary text-primary-foreground font-bold"
                    : day.isToday
                    ? "bg-primary/20 text-primary font-bold ring-2 ring-primary"
                    : day.isFuture
                    ? "bg-muted/50 text-muted-foreground/50"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {day.checked ? (
                  <Check className="h-4 w-4" />
                ) : (
                  day.day
                )}
              </div>
            ))}
          </div>

          <Button
            className="w-full"
            onClick={handleCheckIn}
            disabled={checking || checkInDays.find(d => d.isToday)?.checked}
          >
            {checking 
              ? t("points.checkingIn") 
              : checkInDays.find(d => d.isToday)?.checked 
                ? t("points.checkedInToday") 
                : t("points.checkInNow")
            }
          </Button>
        </Card>

        {/* Transaction History */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-primary rounded-full" />
            <h3 className="font-semibold">{t("points.transactionHistory")}</h3>
          </div>

          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">{t("common.all")}</TabsTrigger>
              <TabsTrigger value="income">{t("common.income")}</TabsTrigger>
              <TabsTrigger value="expense">{t("common.expense")}</TabsTrigger>
            </TabsList>

            {['all', 'income', 'expense'].map((type) => (
              <TabsContent key={type} value={type} className="space-y-3 mt-4">
                {filterTransactions(type as 'all' | 'income' | 'expense').length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t("common.noRecords")}
                  </div>
                ) : (
                  filterTransactions(type as 'all' | 'income' | 'expense').map((transaction) => (
                    <Card key={transaction.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{transaction.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(transaction.created_at), "yyyy-MM-dd HH:mm:ss")}
                          </p>
                        </div>
                        <span
                          className={`text-lg font-semibold ${
                            transaction.amount > 0 ? "text-red-500" : "text-muted-foreground"
                          }`}
                        >
                          {transaction.amount > 0 ? "+" : ""}{transaction.amount}
                        </span>
                      </div>
                    </Card>
                  ))
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
        </div>
      </ScrollArea>

      <CheckInSuccessDialog
        open={showSuccessDialog}
        onClose={() => setShowSuccessDialog(false)}
        points={earnedPoints}
        consecutiveDays={consecutiveDays}
      />
    </div>
  );
}
