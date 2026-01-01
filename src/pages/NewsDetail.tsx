import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Clock, Eye, Share2 } from "lucide-react";
import { toast } from "sonner";

interface NewsArticle {
  title: string;
  content: string | null;
  description: string | null;
  source: string;
  author: string | null;
  published_at: string;
  image_url: string | null;
  views_count: number;
}

export default function NewsDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArticle();
  }, [id]);

  const fetchArticle = async () => {
    try {
      if (!id) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('news_articles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setArticle(data);
        // Increment view count
        await supabase
          .from('news_articles')
          .update({ views_count: (data.views_count || 0) + 1 })
          .eq('id', id);
      }
    } catch (error) {
      console.error("Error fetching article:", error);
      toast.error("加载文章失败");
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: article?.title,
        text: article?.description || article?.content?.substring(0, 100) || '',
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("链接已复制到剪贴板");
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffHours < 1) return "刚刚";
    if (diffHours < 24) return `${diffHours}小时前`;
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  const formatViews = (count: number): string => {
    if (count >= 10000) {
      return (count / 10000).toFixed(1) + '万';
    }
    return String(count);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">文章未找到</p>
        <Button onClick={() => navigate(-1)}>返回</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card shadow-card">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold flex-1">资讯详情</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleShare}
        >
          <Share2 className="h-5 w-5" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <article className="max-w-3xl mx-auto p-4 space-y-4">
          {/* Featured Image */}
          {article.image_url && (
            <img
              src={article.image_url}
              alt={article.title}
              className="w-full aspect-video object-cover rounded-lg"
            />
          )}

          {/* Title */}
          <h1 className="text-2xl font-bold leading-tight">
            {article.title}
          </h1>

          {/* Meta Info */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground pb-4 border-b border-border">
            <span>{article.source}</span>
            {article.author && <span>作者：{article.author}</span>}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(article.published_at)}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {formatViews(article.views_count)}
            </span>
          </div>

          {/* Content */}
          <div className="prose prose-sm max-w-none">
            {(article.content || article.description || '').split('\n\n').map((paragraph, index) => (
              <p key={index} className="mb-4 text-foreground leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
        </article>
      </ScrollArea>
    </div>
  );
}
