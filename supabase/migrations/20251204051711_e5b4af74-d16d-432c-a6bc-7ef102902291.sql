-- Create table to store user's locally deleted messages
CREATE TABLE public.user_deleted_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, message_id)
);

-- Create index for faster queries
CREATE INDEX idx_user_deleted_messages_user_conversation 
ON public.user_deleted_messages(user_id, conversation_id);

-- Enable RLS
ALTER TABLE public.user_deleted_messages ENABLE ROW LEVEL SECURITY;

-- Users can only view their own deleted messages
CREATE POLICY "Users can view own deleted messages" 
ON public.user_deleted_messages 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own deleted messages
CREATE POLICY "Users can insert own deleted messages" 
ON public.user_deleted_messages 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own records (to undo deletion)
CREATE POLICY "Users can delete own deleted message records" 
ON public.user_deleted_messages 
FOR DELETE 
USING (auth.uid() = user_id);