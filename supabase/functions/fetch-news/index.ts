import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const CACHE_DURATION_HOURS = 3;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, page = 1, pageSize = 10, forceRefresh = false } = await req.json().catch(() => ({}));

    // Check if we need to fetch new data
    const { data: latestNews } = await supabase
      .from('news_articles')
      .select('fetched_at')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    const lastFetchTime = latestNews?.fetched_at ? new Date(latestNews.fetched_at) : null;
    const now = new Date();
    const hoursSinceLastFetch = lastFetchTime 
      ? (now.getTime() - lastFetchTime.getTime()) / (1000 * 60 * 60)
      : Infinity;

    // If data is stale or forced refresh, fetch new data from API
    if (forceRefresh || hoursSinceLastFetch >= CACHE_DURATION_HOURS) {
      console.log('Fetching new news from API...');
      await fetchAndStoreNews(supabase);
    }

    // Return paginated data from database
    const offset = (page - 1) * pageSize;
    
    const { data: articles, error: fetchError, count } = await supabase
      .from('news_articles')
      .select('*', { count: 'exact' })
      .order('published_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (fetchError) throw fetchError;

    return new Response(
      JSON.stringify({
        success: true,
        data: articles?.map(article => ({
          id: article.id,
          title: article.title,
          description: article.description,
          source: article.source,
          author: article.author,
          publishTime: article.published_at,
          imageUrl: article.image_url,
          content: article.content,
          views: formatViews(article.views_count)
        })) || [],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-news:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function fetchAndStoreNews(supabase: any) {
  const ALAPI_TOKEN = Deno.env.get('ALAPI_TOKEN');
  
  let newsToStore: any[] = [];
  
  if (ALAPI_TOKEN) {
    try {
      // Fetch from ALAPI
      const response = await fetch('https://v2.alapi.cn/api/new/toutiao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: ALAPI_TOKEN, format: 'json' })
      });
      
      const data = await response.json();
      
      if (data.code === 200 && data.data) {
        newsToStore = data.data.map((item: any) => ({
          title: item.title,
          description: item.digest || item.abstract || '',
          source: item.source || '今日头条',
          author: item.author || '',
          image_url: item.image_url || item.thumbnail || '',
          content: item.content || item.digest || '',
          external_id: item.id || `alapi-${Date.now()}-${Math.random()}`,
          views_count: parseViews(item.read_count || item.comment_count || '0'),
          published_at: item.publish_time || new Date().toISOString(),
          fetched_at: new Date().toISOString()
        }));
      }
    } catch (e) {
      console.error('ALAPI fetch failed:', e);
    }
  }
  
  // Fallback to mock data if no real data
  if (newsToStore.length === 0) {
    newsToStore = generateMockNews();
  }
  
  // Clear ALL existing news and insert fresh data to avoid duplicates
  await supabase.from('news_articles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  // Insert new news
  const { error } = await supabase.from('news_articles').insert(newsToStore);
  if (error) {
    console.error('Error inserting news:', error);
  } else {
    console.log(`Stored ${newsToStore.length} news articles`);
  }
}

function generateMockNews() {
  const now = Date.now();
  return [
    {
      title: "全球科技创新大会在京举行，多项前沿技术发布",
      description: "今日，备受瞩目的全球科技创新大会在北京国家会议中心隆重开幕，多家企业发布了最新的技术成果和产品。",
      source: "科技日报",
      author: "张明",
      image_url: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800",
      content: "今日，备受瞩目的全球科技创新大会在北京国家会议中心隆重开幕。本届大会汇聚了来自世界各地的科技领军企业、创新创业公司以及学术研究机构的代表，共同探讨科技发展的未来趋势。",
      external_id: `mock-1-${now}`,
      views_count: 125000,
      published_at: new Date(now - 2 * 3600000).toISOString(),
      fetched_at: new Date().toISOString()
    },
    {
      title: "央行：继续保持流动性合理充裕",
      description: "中国人民银行今日表示，将继续实施稳健的货币政策，保持流动性合理充裕。",
      source: "财经新闻",
      author: "李华",
      image_url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800",
      content: "中国人民银行今日表示，将继续实施稳健的货币政策，保持流动性合理充裕。央行相关负责人在新闻发布会上指出，当前经济形势总体平稳，但仍面临一些挑战。",
      external_id: `mock-2-${now}`,
      views_count: 83000,
      published_at: new Date(now - 3 * 3600000).toISOString(),
      fetched_at: new Date().toISOString()
    },
    {
      title: "AI技术应用加速，多行业迎来智能化转型",
      description: "随着人工智能技术的快速发展，越来越多的行业开始拥抱AI技术，实现智能化转型。",
      source: "经济观察",
      author: "王强",
      image_url: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800",
      content: "随着人工智能技术的快速发展，越来越多的行业开始拥抱AI技术，实现智能化转型。从制造业到服务业，从医疗到教育，AI正在重塑传统产业格局。",
      external_id: `mock-3-${now}`,
      views_count: 157000,
      published_at: new Date(now - 5 * 3600000).toISOString(),
      fetched_at: new Date().toISOString()
    },
    {
      title: "新能源汽车市场持续升温，产销两旺",
      description: "最新数据显示，本月新能源汽车销量再创新高，同比增长超过40%。",
      source: "汽车周刊",
      author: "赵敏",
      image_url: "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800",
      content: "最新数据显示，本月新能源汽车销量再创新高，同比增长超过40%。业内人士分析，随着充电基础设施的完善和技术的不断进步，新能源汽车市场前景广阔。",
      external_id: `mock-4-${now}`,
      views_count: 92000,
      published_at: new Date(now - 6 * 3600000).toISOString(),
      fetched_at: new Date().toISOString()
    },
    {
      title: "数字经济发展迅猛，成为经济增长新引擎",
      description: "数字经济正在成为推动经济高质量发展的重要力量，各地积极布局数字产业。",
      source: "经济参考",
      author: "刘洋",
      image_url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800",
      content: "数字经济正在成为推动经济高质量发展的重要力量。各地积极布局数字产业，加快推进数字化转型，为经济发展注入新动能。",
      external_id: `mock-5-${now}`,
      views_count: 68000,
      published_at: new Date(now - 7 * 3600000).toISOString(),
      fetched_at: new Date().toISOString()
    },
    {
      title: "5G网络覆盖持续扩大，应用场景不断丰富",
      description: "5G网络建设加速推进，覆盖范围持续扩大，为各行业数字化转型提供有力支撑。",
      source: "通信世界",
      author: "陈明",
      image_url: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800",
      content: "5G网络建设加速推进，覆盖范围持续扩大。从智慧城市到工业互联网，5G正在各行各业发挥重要作用，为数字化转型提供有力支撑。",
      external_id: `mock-6-${now}`,
      views_count: 54000,
      published_at: new Date(now - 8 * 3600000).toISOString(),
      fetched_at: new Date().toISOString()
    }
  ];
}

function parseViews(viewStr: string): number {
  if (typeof viewStr === 'number') return viewStr;
  const str = String(viewStr);
  if (str.includes('万')) {
    return Math.round(parseFloat(str.replace('万', '')) * 10000);
  }
  return parseInt(str) || 0;
}

function formatViews(count: number): string {
  if (count >= 10000) {
    return (count / 10000).toFixed(1) + '万';
  }
  return String(count);
}
