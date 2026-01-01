import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Trash2, ExternalLink, RefreshCw, Download, Eye } from 'lucide-react';
import { exportToCSV } from '@/utils/exportUtils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

interface NewsArticle {
  id: string;
  title: string;
  description: string | null;
  source: string;
  author: string | null;
  image_url: string | null;
  content: string | null;
  views_count: number;
  published_at: string;
  fetched_at: string;
  created_at: string;
}

export default function AdminNews() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    loadNews();
  }, [page]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = articles.filter(
        (article) =>
          article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          article.source.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredArticles(filtered);
    } else {
      setFilteredArticles(articles);
    }
  }, [searchQuery, articles]);

  const loadNews = async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * pageSize;
      
      const { data, error, count } = await supabase
        .from('news_articles')
        .select('*', { count: 'exact' })
        .order('published_at', { ascending: false })
        .range(offset, offset + pageSize - 1);
      
      if (error) throw error;
      
      setArticles(data || []);
      setFilteredArticles(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Failed to load news:', error);
      toast.error('加载资讯失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-news', {
        body: { forceRefresh: true, page: 1, pageSize: 10 }
      });
      
      if (error) throw error;
      
      toast.success('资讯已刷新');
      loadNews();
    } catch (error) {
      console.error('Failed to refresh news:', error);
      toast.error('刷新资讯失败');
    } finally {
      setRefreshing(false);
    }
  };

  const openDeleteDialog = (article: NewsArticle) => {
    setSelectedArticle(article);
    setDeleteDialogOpen(true);
  };

  const openPreviewDialog = (article: NewsArticle) => {
    setSelectedArticle(article);
    setPreviewDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedArticle) return;

    try {
      const { error } = await supabase
        .from('news_articles')
        .delete()
        .eq('id', selectedArticle.id);

      if (error) throw error;

      toast.success('删除成功');
      setDeleteDialogOpen(false);
      loadNews();
    } catch (error) {
      console.error('Failed to delete news:', error);
      toast.error('删除失败');
    }
  };

  const handleExport = () => {
    const exportData = filteredArticles.map(article => ({
      标题: article.title,
      来源: article.source,
      作者: article.author || '',
      阅读量: article.views_count,
      发布时间: format(new Date(article.published_at), 'yyyy-MM-dd HH:mm'),
      抓取时间: format(new Date(article.fetched_at), 'yyyy-MM-dd HH:mm'),
    }));
    exportToCSV(exportData, '资讯列表');
    toast.success('导出成功');
  };

  const formatViews = (count: number): string => {
    if (count >= 10000) {
      return (count / 10000).toFixed(1) + '万';
    }
    return String(count);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>资讯管理</CardTitle>
              <CardDescription>
                管理发现页面的新闻资讯（每3小时自动更新）
                <span className="ml-2 text-xs">共 {totalCount} 条</span>
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleExport} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                导出数据
              </Button>
              <Button onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                立即刷新
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索标题或来源..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[400px]">标题</TableHead>
                  <TableHead>来源</TableHead>
                  <TableHead>阅读量</TableHead>
                  <TableHead>发布时间</TableHead>
                  <TableHead>抓取时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : filteredArticles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      暂无资讯
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredArticles.map((article) => (
                    <TableRow key={article.id}>
                      <TableCell className="max-w-md">
                        <div className="flex items-start gap-3">
                          {article.image_url && (
                            <img
                              src={article.image_url}
                              alt={article.title}
                              className="w-16 h-12 object-cover rounded"
                            />
                          )}
                          <div className="flex-1">
                            <p className="font-medium line-clamp-2">{article.title}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{article.source}</Badge>
                      </TableCell>
                      <TableCell>{formatViews(article.views_count)}</TableCell>
                      <TableCell>
                        {format(new Date(article.published_at), 'yyyy-MM-dd HH:mm')}
                      </TableCell>
                      <TableCell>
                        {format(new Date(article.fetched_at), 'yyyy-MM-dd HH:mm')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPreviewDialog(article)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => openDeleteDialog(article)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          onClick={() => setPage(pageNum)}
                          isActive={page === pageNum}
                          className="cursor-pointer"
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}

                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除资讯</DialogTitle>
            <DialogDescription>
              确定要删除这条资讯吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground line-clamp-2">{selectedArticle?.title}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>资讯预览</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {selectedArticle && (
              <div className="space-y-4">
                {selectedArticle.image_url && (
                  <img
                    src={selectedArticle.image_url}
                    alt={selectedArticle.title}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                )}
                <h2 className="text-xl font-bold">{selectedArticle.title}</h2>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <Badge variant="outline">{selectedArticle.source}</Badge>
                  {selectedArticle.author && <span>{selectedArticle.author}</span>}
                  <span>{format(new Date(selectedArticle.published_at), 'yyyy-MM-dd HH:mm')}</span>
                  <span>{formatViews(selectedArticle.views_count)} 阅读</span>
                </div>
                {selectedArticle.description && (
                  <p className="text-muted-foreground">{selectedArticle.description}</p>
                )}
                {selectedArticle.content && (
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap">{selectedArticle.content}</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
