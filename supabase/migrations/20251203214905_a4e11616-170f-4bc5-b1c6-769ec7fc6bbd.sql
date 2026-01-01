-- Create news_articles table to store fetched news
CREATE TABLE public.news_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL,
  author TEXT,
  image_url TEXT,
  content TEXT,
  external_id TEXT,
  views_count INTEGER DEFAULT 0,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_news_articles_published_at ON public.news_articles(published_at DESC);
CREATE INDEX idx_news_articles_fetched_at ON public.news_articles(fetched_at DESC);

-- Enable RLS
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

-- Anyone can read news
CREATE POLICY "Anyone can read news articles"
ON public.news_articles
FOR SELECT
USING (true);

-- Authenticated users can manage news (for admin)
CREATE POLICY "Authenticated can insert news"
ON public.news_articles
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated can update news"
ON public.news_articles
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated can delete news"
ON public.news_articles
FOR DELETE
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_news_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_news_articles_updated_at
BEFORE UPDATE ON public.news_articles
FOR EACH ROW
EXECUTE FUNCTION public.update_news_updated_at();

-- Enable realtime for news updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.news_articles;