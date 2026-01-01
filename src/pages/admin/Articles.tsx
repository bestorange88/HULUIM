import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Edit, Eye, Save } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Article {
  id: string;
  slug: string;
  title: string;
  content: string;
  updated_at: string;
  created_at: string;
}

const ARTICLE_LABELS: Record<string, string> = {
  'help-feedback': '帮助与反馈',
  'about-us': '关于我们',
  'privacy-policy': '隐私政策',
  'terms-of-service': '用户协议',
};

export default function AdminArticles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setArticles(data || []);
    } catch (error) {
      console.error('Failed to load articles:', error);
      toast({ title: '加载文章失败', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (article: Article) => {
    setSelectedArticle(article);
    setEditTitle(article.title);
    setEditContent(article.content);
    setEditDialogOpen(true);
  };

  const handlePreview = (article: Article) => {
    setSelectedArticle(article);
    setPreviewDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedArticle) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('articles')
        .update({
          title: editTitle,
          content: editContent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedArticle.id);

      if (error) throw error;

      toast({ title: '保存成功' });
      setEditDialogOpen(false);
      loadArticles();
    } catch (error) {
      console.error('Failed to save article:', error);
      toast({ title: '保存失败', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const getArticleLabel = (slug: string) => {
    return ARTICLE_LABELS[slug] || slug;
  };

  const renderMarkdown = (content: string) => {
    // Simple markdown rendering
    return content
      .split('\n')
      .map((line, index) => {
        // Headers
        if (line.startsWith('### ')) {
          return <h3 key={index} className="text-base font-semibold mt-4 mb-2">{line.slice(4)}</h3>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={index} className="text-lg font-semibold mt-6 mb-3">{line.slice(3)}</h2>;
        }
        if (line.startsWith('# ')) {
          return <h1 key={index} className="text-xl font-bold mt-6 mb-4">{line.slice(2)}</h1>;
        }
        // List items
        if (line.startsWith('- ')) {
          return <li key={index} className="ml-4 list-disc">{line.slice(2)}</li>;
        }
        // Bold text (simple)
        if (line.includes('**')) {
          const parts = line.split('**');
          return (
            <p key={index} className="mb-2">
              {parts.map((part, i) => 
                i % 2 === 1 ? <strong key={i}>{part}</strong> : part
              )}
            </p>
          );
        }
        // Empty line
        if (line.trim() === '') {
          return <br key={index} />;
        }
        // Regular paragraph
        return <p key={index} className="mb-2 text-muted-foreground">{line}</p>;
      });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">文章管理</h1>
        <p className="text-muted-foreground mt-2">管理应用内的文案内容</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>文章列表</CardTitle>
          <CardDescription>编辑帮助与反馈、关于我们、隐私政策、用户协议等页面内容</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>页面</TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead>内容预览</TableHead>
                  <TableHead>最后更新</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {articles.map((article) => (
                  <TableRow key={article.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{getArticleLabel(article.slug)}</span>
                      </div>
                    </TableCell>
                    <TableCell>{article.title}</TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate text-muted-foreground text-sm">
                        {article.content.slice(0, 50)}...
                      </p>
                    </TableCell>
                    <TableCell>
                      {format(new Date(article.updated_at), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreview(article)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          预览
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(article)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          编辑
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              编辑文章 - {selectedArticle ? getArticleLabel(selectedArticle.slug) : ''}
            </DialogTitle>
            <DialogDescription>
              使用 Markdown 格式编辑内容。支持标题（#）、列表（-）、加粗（**文字**）等格式。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">标题</Label>
              <Input
                id="title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="输入文章标题"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">内容（Markdown 格式）</Label>
              <Textarea
                id="content"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="输入文章内容..."
                rows={20}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              预览 - {selectedArticle ? getArticleLabel(selectedArticle.slug) : ''}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="prose prose-sm max-w-none">
              {selectedArticle && renderMarkdown(selectedArticle.content)}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
