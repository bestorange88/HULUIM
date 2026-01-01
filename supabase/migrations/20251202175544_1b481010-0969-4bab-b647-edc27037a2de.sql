-- Create feedback table for user feedback submissions
CREATE TABLE public.user_feedbacks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'suggestion',
  content TEXT NOT NULL,
  contact_info TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_feedbacks ENABLE ROW LEVEL SECURITY;

-- Users can view their own feedbacks
CREATE POLICY "Users can view their own feedbacks"
ON public.user_feedbacks
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own feedbacks
CREATE POLICY "Users can create their own feedbacks"
ON public.user_feedbacks
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_user_feedbacks_updated_at
BEFORE UPDATE ON public.user_feedbacks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();