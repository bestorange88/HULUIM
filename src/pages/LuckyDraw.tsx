import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Gift, Sparkles, ScrollText, Trophy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DrawRecord {
  id: string;
  prize_amount: number;
  created_at: string;
}

interface WinnerAnnouncement {
  id: string;
  username: string;
  prize: number;
}

interface PrizeConfig {
  points: number;
  type: 'points' | 'balance';
}

// Default prizes (used if no config in database)
const DEFAULT_PRIZES: PrizeConfig[] = [
  { points: 100, type: 'points' },
  { points: 5, type: 'points' },
  { points: 50, type: 'points' },
  { points: 2, type: 'points' },
  { points: 200, type: 'points' },
  { points: 1, type: 'points' },
  { points: 10, type: 'points' },
  { points: 500, type: 'points' },
];

// Background colors for prize slots
const PRIZE_BG_COLORS = [
  "bg-pink-200 dark:bg-pink-300",
  "bg-blue-200 dark:bg-blue-300",
  "bg-purple-200 dark:bg-purple-300",
  "bg-green-200 dark:bg-green-300",
  "bg-yellow-200 dark:bg-yellow-300",
  "bg-red-200 dark:bg-red-300",
  "bg-cyan-200 dark:bg-cyan-300",
  "bg-orange-200 dark:bg-orange-300",
];

export default function LuckyDraw() {
  const navigate = useNavigate();
  const [spinning, setSpinning] = useState(false);
  const [hasMembership, setHasMembership] = useState(false);
  const [loading, setLoading] = useState(true);
  const [remainingDraws, setRemainingDraws] = useState(0);
  const [showRules, setShowRules] = useState(false);
  const [showRecords, setShowRecords] = useState(false);
  const [drawRecords, setDrawRecords] = useState<DrawRecord[]>([]);
  const [winners, setWinners] = useState<WinnerAnnouncement[]>([]);
  const [prizeConfig, setPrizeConfig] = useState<PrizeConfig[]>(DEFAULT_PRIZES);

  // Build prizes array from config (8 prizes + 1 center button)
  const prizes = [
    ...prizeConfig.slice(0, 4).map((p, i) => ({
      id: i,
      name: p.type === 'points' ? `${p.points}积分` : `¥${p.points}`,
      points: p.points,
      type: p.type,
      bgColor: PRIZE_BG_COLORS[i % PRIZE_BG_COLORS.length],
    })),
    { id: 4, name: "立即抽奖", points: 0, type: 'points' as const, bgColor: "bg-gradient-to-br from-amber-400 to-orange-500" }, // 中心按钮
    ...prizeConfig.slice(4, 8).map((p, i) => ({
      id: i + 5,
      name: p.type === 'points' ? `${p.points}积分` : `¥${p.points}`,
      points: p.points,
      type: p.type,
      bgColor: PRIZE_BG_COLORS[(i + 4) % PRIZE_BG_COLORS.length],
    })),
  ];

  const [activeIndex, setActiveIndex] = useState<number>(-1);

  useEffect(() => {
    loadPrizeConfig();
    checkMembership();
    loadDrawRecords();
    const interval = startWinnerAnnouncements();
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  // Load prize configuration from database (synced with admin panel)
  const loadPrizeConfig = async () => {
    try {
      const { data } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'lucky_draw_prizes')
        .single();
      
      if (data?.value) {
        const parsed = JSON.parse(data.value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPrizeConfig(parsed);
        }
      }
    } catch (error) {
      console.log('Using default prizes');
    }
  };

  // Generate masked member ID like "ALO1***12"
  const generateMaskedMemberId = () => {
    const prefix = "ALO";
    const num1 = Math.floor(Math.random() * 10);
    const num2 = Math.floor(Math.random() * 10);
    const num3 = Math.floor(Math.random() * 10);
    return `${prefix}${num1}***${num2}${num3}`;
  };

  const startWinnerAnnouncements = () => {
    const mockPrizes = [1, 2, 5, 10, 50, 100, 200, 500];
    
    const interval = setInterval(() => {
      const newWinner: WinnerAnnouncement = {
        id: Date.now().toString(),
        username: generateMaskedMemberId(),
        prize: mockPrizes[Math.floor(Math.random() * mockPrizes.length)],
      };
      
      setWinners(prev => [newWinner, ...prev].slice(0, 5));
    }, 3000);
    
    return interval;
  };

  const checkMembership = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check if user has active membership
      const { data: memberships } = await supabase
        .from("user_memberships")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1);

      const membership = memberships && memberships.length > 0 ? memberships[0] : null;
      setHasMembership(!!membership);
      
      // Calculate remaining draws (会员每月3次)
      if (membership) {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        const { data: monthDraws } = await supabase
          .from("lucky_draws")
          .select("id")
          .eq("user_id", user.id)
          .gte("created_at", `${firstDayOfMonth}T00:00:00`)
          .lte("created_at", `${lastDayOfMonth}T23:59:59`);
        
        setRemainingDraws(Math.max(0, 3 - (monthDraws?.length || 0)));
      } else {
        setRemainingDraws(0);
      }
    } catch (error) {
      console.error("Error checking membership:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadDrawRecords = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("lucky_draws")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) {
        setDrawRecords(data);
      }
    } catch (error) {
      console.error("Error loading draw records:", error);
    }
  };

  const handleSpin = async () => {
    if (spinning) return;
    
    if (!hasMembership) {
      toast.error("请先开通会员才能参与抽奖");
      setTimeout(() => navigate("/referral"), 1000);
      return;
    }

    if (remainingDraws <= 0) {
      toast.error("本月抽奖次数已用完");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setSpinning(true);
      
      // 抽奖动画：按顺序高亮格子
      const sequence = [0, 1, 2, 5, 8, 7, 6, 3]; // 顺时针顺序，跳过中心
      let currentStep = 0;
      const totalSteps = 24; // 转3圈
      
      const interval = setInterval(() => {
        setActiveIndex(sequence[currentStep % 8]);
        currentStep++;
        
        if (currentStep >= totalSteps) {
          clearInterval(interval);
          
          // 随机选择中奖位置（排除中心按钮）
          const validPrizes = prizes.filter(p => p.id !== 4);
          const randomPrize = validPrizes[Math.floor(Math.random() * validPrizes.length)];
          
          // 最后几步减速到中奖位置
          let finalSteps = 0;
          const finalInterval = setInterval(() => {
            const currentIndex = sequence.indexOf(randomPrize.id);
            const targetIndex = (currentIndex + finalSteps) % 8;
            setActiveIndex(sequence[targetIndex]);
            finalSteps++;
            
            if (sequence[targetIndex] === randomPrize.id && finalSteps > 3) {
              clearInterval(finalInterval);
              
              // 显示中奖结果
              setTimeout(async () => {
                setSpinning(false);
                setActiveIndex(-1);
                
                // Save draw record
                const prizeType = (randomPrize as any).type || 'points';
                const { error: drawError } = await supabase
                  .from("lucky_draws")
                  .insert({
                    user_id: user.id,
                    prize_type: prizeType,
                    prize_amount: randomPrize.points,
                  });

                if (drawError) throw drawError;

                if (prizeType === 'balance') {
                  // Add to wallet balance
                  const { data: wallet } = await supabase
                    .from("wallets")
                    .select("balance")
                    .eq("user_id", user.id)
                    .maybeSingle();

                  let oldBalance = 0;
                  if (!wallet) {
                    await supabase.from("wallets").insert({
                      user_id: user.id,
                      balance: 0,
                    });
                  } else {
                    oldBalance = Number(wallet.balance);
                  }

                  const newBalance = oldBalance + randomPrize.points;
                  await supabase
                    .from("wallets")
                    .update({ balance: newBalance })
                    .eq("user_id", user.id);

                  await supabase.from("transactions").insert({
                    user_id: user.id,
                    type: "lucky_draw",
                    amount: randomPrize.points,
                    balance_before: oldBalance,
                    balance_after: newBalance,
                    description: `幸运抽奖获得¥${randomPrize.points}`,
                  });

                  toast.success(`🎉 恭喜获得 ¥${randomPrize.points}！`);
                } else {
                  // Add points to user
                  const { data: userPoints } = await supabase
                    .from("user_points")
                    .select("balance")
                    .eq("user_id", user.id)
                    .maybeSingle();

                  let oldBalance = 0;
                  if (!userPoints) {
                    // Create user_points record if it doesn't exist
                    await supabase.from("user_points").insert({
                      user_id: user.id,
                      balance: 0,
                    });
                  } else {
                    oldBalance = Number(userPoints.balance);
                  }

                  const newBalance = oldBalance + randomPrize.points;
                  await supabase
                    .from("user_points")
                    .update({ balance: newBalance })
                    .eq("user_id", user.id);

                  await supabase.from("point_transactions").insert({
                    user_id: user.id,
                    type: "lucky_draw",
                    amount: randomPrize.points,
                    balance_before: oldBalance,
                    balance_after: newBalance,
                    description: `幸运抽奖获得${randomPrize.points}积分`,
                  });

                  toast.success(`🎉 恭喜获得 ${randomPrize.points} 积分！`);
                }
                setRemainingDraws(prev => prev - 1);
                loadDrawRecords();
              }, 500);
            }
          }, 200);
        }
      }, 100);
    } catch (error) {
      console.error("Error during draw:", error);
      toast.error("抽奖失败，请重试");
      setSpinning(false);
      setActiveIndex(-1);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* 背景 */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400 via-sky-300 to-sky-200 dark:from-sky-900 dark:via-sky-800 dark:to-sky-700">
        {/* 烟花装饰 */}
        <div className="absolute top-10 left-10 opacity-40">
          <Sparkles className="h-16 w-16 text-white animate-pulse" />
        </div>
        <div className="absolute top-20 right-16 opacity-30">
          <Sparkles className="h-12 w-12 text-yellow-200 animate-ping" />
        </div>
        <div className="absolute top-32 left-1/3 opacity-25">
          <Sparkles className="h-10 w-10 text-white" />
        </div>
        
        {/* 飘动的奖品图标 */}
        <div className="absolute top-1/4 right-8 animate-bounce opacity-60" style={{ animationDuration: "3s" }}>
          <Gift className="h-12 w-12 text-pink-300" />
        </div>
        <div className="absolute top-1/3 left-12 animate-bounce opacity-50" style={{ animationDuration: "4s", animationDelay: "1s" }}>
          <Trophy className="h-10 w-10 text-yellow-300" />
        </div>
      </div>

      {/* Header */}
      <div className="relative z-10 px-4 py-3 flex items-center">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-white/20">
          <ChevronLeft className="h-6 w-6" />
        </Button>
      </div>

      {/* 标题 */}
      <div className="relative z-10 text-center mb-4">
        <h1 className="text-4xl font-bold text-white drop-shadow-lg tracking-wider">
          幸运抽奖
        </h1>
        <p className="text-white/90 mt-2">
          本月剩余抽奖次数：<span className="font-bold text-yellow-300">{remainingDraws}</span>
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 relative z-10">
        {!hasMembership && (
          <Card className="mb-4 p-4 bg-white/90 backdrop-blur-sm border-2 border-white shadow-lg">
            <div className="text-center space-y-3 py-2">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
                  <Gift className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <p className="font-medium mb-1 text-gray-800">开通会员即可参与抽奖</p>
                <p className="text-sm text-gray-600">每月3次免费抽奖机会</p>
              </div>
              <Button 
                onClick={() => navigate("/referral")} 
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                立即开通会员
              </Button>
            </div>
          </Card>
        )}

        {/* 9宫格抽奖 */}
        <div className="max-w-sm mx-auto mb-6">
          <div 
            className="relative p-4 rounded-3xl shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3), inset 0 -2px 20px rgba(0,0,0,0.2)'
            }}
          >
            {/* 装饰灯泡 */}
            <div className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-yellow-300 animate-pulse" />
            <div className="absolute -top-2 left-8 w-3 h-3 rounded-full bg-white animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="absolute -top-2 left-16 w-4 h-4 rounded-full bg-yellow-300 animate-pulse" style={{ animationDelay: '0.4s' }} />
            <div className="absolute -top-2 right-16 w-3 h-3 rounded-full bg-white animate-pulse" style={{ animationDelay: '0.6s' }} />
            <div className="absolute -top-2 right-8 w-4 h-4 rounded-full bg-yellow-300 animate-pulse" style={{ animationDelay: '0.8s' }} />
            <div className="absolute -top-2 -right-2 w-3 h-3 rounded-full bg-white animate-pulse" style={{ animationDelay: '1s' }} />
            
            {/* 右侧灯泡 */}
            <div className="absolute top-8 -right-2 w-3 h-3 rounded-full bg-yellow-300 animate-pulse" style={{ animationDelay: '0.3s' }} />
            <div className="absolute top-16 -right-2 w-4 h-4 rounded-full bg-white animate-pulse" style={{ animationDelay: '0.5s' }} />
            
            {/* 底部灯泡 */}
            <div className="absolute -bottom-2 -left-2 w-4 h-4 rounded-full bg-yellow-300 animate-pulse" style={{ animationDelay: '0.7s' }} />
            <div className="absolute -bottom-2 left-1/4 w-3 h-3 rounded-full bg-white animate-pulse" style={{ animationDelay: '0.9s' }} />
            <div className="absolute -bottom-2 right-1/4 w-4 h-4 rounded-full bg-yellow-300 animate-pulse" style={{ animationDelay: '1.1s' }} />
            <div className="absolute -bottom-2 -right-2 w-3 h-3 rounded-full bg-white animate-pulse" style={{ animationDelay: '1.3s' }} />
            
            {/* 左侧灯泡 */}
            <div className="absolute top-8 -left-2 w-4 h-4 rounded-full bg-white animate-pulse" style={{ animationDelay: '0.4s' }} />
            <div className="absolute top-16 -left-2 w-3 h-3 rounded-full bg-yellow-300 animate-pulse" style={{ animationDelay: '0.6s' }} />

            <div className="grid grid-cols-3 gap-3 bg-white/10 p-3 rounded-2xl backdrop-blur-sm">
              {prizes.map((prize, index) => (
                <div
                  key={prize.id}
                  className={`aspect-square rounded-2xl flex items-center justify-center transition-all duration-200 ${
                    prize.id === 4
                      ? 'bg-gradient-to-br from-amber-400 to-orange-500 cursor-pointer hover:scale-105 active:scale-95 shadow-lg'
                      : `${prize.bgColor} ${activeIndex === prize.id ? 'ring-4 ring-yellow-400 scale-105 shadow-xl' : ''}`
                  } ${spinning && prize.id !== 4 ? 'cursor-not-allowed' : ''}`}
                  onClick={() => prize.id === 4 && handleSpin()}
                  style={{
                    boxShadow: prize.id === 4 ? '0 4px 20px rgba(245, 158, 11, 0.4)' : '0 2px 8px rgba(0,0,0,0.1)',
                  }}
                >
                  {prize.id === 4 ? (
                    <div className="text-center">
                      {spinning ? (
                        <div className="animate-spin">
                          <Sparkles className="h-8 w-8 text-white mx-auto" />
                        </div>
                      ) : (
                        <Sparkles className="h-8 w-8 text-white mx-auto mb-1 animate-pulse" />
                      )}
                      <span className="text-white font-bold text-sm drop-shadow-md">
                        {spinning ? '抽奖中' : '立即\n抽奖'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-800 dark:text-gray-900 font-bold text-center text-sm px-2">
                      {prize.name}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Button
            variant="outline"
            className="w-full bg-white/90 backdrop-blur-sm border-2 border-white hover:bg-white text-sky-700 font-medium shadow-lg"
            onClick={() => setShowRules(true)}
          >
            <ScrollText className="h-4 w-4 mr-2" />
            抽奖规则
          </Button>
          <Button
            variant="outline"
            className="w-full bg-white/90 backdrop-blur-sm border-2 border-white hover:bg-white text-sky-700 font-medium shadow-lg"
            onClick={() => setShowRecords(true)}
          >
            <Trophy className="h-4 w-4 mr-2" />
            中奖记录
          </Button>
        </div>

        {/* 中奖播报滚动区域 */}
        <Card className="bg-white/90 backdrop-blur-sm border-2 border-white shadow-lg overflow-hidden">
          <div className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-white animate-pulse" />
            <span className="text-white font-semibold text-sm">中奖播报</span>
          </div>
          <div className="relative h-32 overflow-hidden">
            <div className="absolute inset-0 animate-scroll-up">
              {winners.concat(winners).map((winner, index) => (
                <div
                  key={`${winner.id}-${index}`}
                  className="flex items-center justify-between px-4 py-2 border-b border-gray-100 hover:bg-orange-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                      <Gift className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-sm text-gray-700">
                      恭喜 <span className="font-semibold text-orange-600">{winner.username}</span>
                    </span>
                  </div>
                  <span className="text-sm font-bold text-orange-600">
                    +{winner.prize}积分
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* 抽奖规则弹窗 */}
      <Dialog open={showRules} onOpenChange={setShowRules}>
                <DialogContent className="max-w-md max-h-[85vh] overflow-hidden">
                  {/* 礼物装饰 - 放在内部避免被裁剪 */}
                  <div className="flex justify-center mb-2">
                    <div className="relative">
                      <Gift className="h-12 w-12 text-amber-500" />
                    </div>
                  </div>
          
                  <DialogHeader>
                    <DialogTitle className="text-center text-xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                      抽奖规则
                    </DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="max-h-[65vh]">
            <div className="space-y-4 text-sm pr-4">
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                <h4 className="font-bold mb-2 text-amber-900 dark:text-amber-100 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white text-xs">1</span>
                  参与条件
                </h4>
                <p className="text-muted-foreground leading-relaxed pl-8">
                  • 开通讯达会员，即可获得抽奖资格
                </p>
                <p className="text-muted-foreground leading-relaxed pl-8">
                  • 所有会员等级每月均可免费抽奖3次
                </p>
                <p className="text-muted-foreground leading-relaxed pl-8">
                  • 抽奖次数每月1日0点自动刷新
                </p>
              </div>
              
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <h4 className="font-bold mb-2 text-blue-900 dark:text-blue-100 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs">2</span>
                  抽奖流程
                </h4>
                <p className="text-muted-foreground leading-relaxed pl-8 mb-2">
                  • 点击中心"立即抽奖"按钮启动抽奖
                </p>
                <p className="text-muted-foreground leading-relaxed pl-8 mb-2">
                  • 九宫格转盘开始旋转，自动停止在中奖格子
                </p>
                <p className="text-muted-foreground leading-relaxed pl-8 mb-2">
                  • 系统弹窗显示中奖结果，积分自动发放
                </p>
                <p className="text-muted-foreground leading-relaxed pl-8">
                  • 可在"中奖记录"中查看历史记录
                </p>
              </div>
              
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                <h4 className="font-bold mb-2 text-purple-900 dark:text-purple-100 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-500 text-white text-xs">3</span>
                  奖品说明
                </h4>
                <p className="text-muted-foreground leading-relaxed pl-8 mb-2">
                  • 积分奖品：1、2、5、10、50、100、200、500积分
                </p>
                <p className="text-muted-foreground leading-relaxed pl-8 mb-2">
                  • 所有奖品随机分配，中奖概率公平公正
                </p>
                <p className="text-muted-foreground leading-relaxed pl-8">
                  • 获得的积分可在积分商城兑换商品
                </p>
              </div>
              
              <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 rounded-lg p-4 border border-red-200 dark:border-red-800">
                <h4 className="font-bold mb-2 text-red-900 dark:text-red-100 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500 text-white text-xs">4</span>
                  温馨提示
                </h4>
                <p className="text-muted-foreground leading-relaxed pl-8 mb-2">
                  • 抽奖记录永久保存，可随时查看
                </p>
                <p className="text-muted-foreground leading-relaxed pl-8 mb-2">
                  • 积分奖励即时到账，可立即使用
                </p>
                <p className="text-muted-foreground leading-relaxed pl-8 mb-2">
                  • 禁止使用外挂或作弊工具，违者封号处理
                </p>
                <p className="text-muted-foreground leading-relaxed pl-8">
                  • 本活动最终解释权归讯达所有
                </p>
              </div>
            </div>
          </ScrollArea>
          <div className="mt-4">
            <Button 
              className="w-full bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white"
              onClick={() => setShowRules(false)}
            >
              我知道了
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 中奖记录弹窗 */}
      <Dialog open={showRecords} onOpenChange={setShowRecords}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-3 text-xl">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg">
                <Trophy className="h-5 w-5 text-white" />
              </div>
              <span className="bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent font-bold">
                我的中奖记录
              </span>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {drawRecords.length === 0 ? (
              <div className="py-16 text-center">
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 mb-4 border-4 border-orange-200 dark:border-orange-800">
                  <Gift className="h-10 w-10 text-orange-400" />
                </div>
                <p className="text-muted-foreground font-medium mb-2">暂无抽奖记录</p>
                <p className="text-sm text-muted-foreground">快去参与抽奖，赢取丰厚积分吧！</p>
              </div>
            ) : (
              <div className="space-y-3 pr-4">
                <div className="flex items-center justify-between px-2 mb-2">
                  <span className="text-sm text-muted-foreground">共 {drawRecords.length} 次中奖</span>
                  <span className="text-sm font-semibold text-orange-600">
                    累计获得 {drawRecords.reduce((sum, r) => sum + r.prize_amount, 0)} 积分
                  </span>
                </div>
                {drawRecords.map((record, index) => (
                  <Card
                    key={record.id}
                    className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border-2 border-orange-200 dark:border-orange-800 hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 flex items-center justify-center shadow-lg">
                            <span className="text-white font-bold text-xl">
                              {index + 1}
                            </span>
                          </div>
                          {index < 3 && (
                            <div className="absolute -top-1 -right-1">
                              <Trophy className={`h-4 w-4 ${
                                index === 0 ? 'text-yellow-400' : 
                                index === 1 ? 'text-gray-400' : 
                                'text-amber-600'
                              }`} />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg text-orange-900 dark:text-orange-100">
                              +{record.prize_amount}
                            </span>
                            <span className="text-orange-700 dark:text-orange-300 font-medium">
                              积分
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <span>{formatTime(record.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Sparkles className="h-6 w-6 text-amber-500 animate-pulse" />
                        <span className="text-[10px] text-amber-600 font-medium">
                          恭喜中奖
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
