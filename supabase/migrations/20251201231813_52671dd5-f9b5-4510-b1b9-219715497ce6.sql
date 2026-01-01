-- Create system_messages table
CREATE TABLE public.system_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  type text NOT NULL DEFAULT 'info', -- info, warning, announcement
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by text NOT NULL
);

-- Enable RLS
ALTER TABLE public.system_messages ENABLE ROW LEVEL SECURITY;

-- Users can view active system messages
CREATE POLICY "Users can view active system messages"
  ON public.system_messages
  FOR SELECT
  USING (is_active = true);

-- Service role (admin) can manage all
CREATE POLICY "Service role can manage system messages"
  ON public.system_messages
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create conversation_settings table for user-specific conversation settings
CREATE TABLE public.conversation_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  is_muted boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, conversation_id)
);

-- Enable RLS
ALTER TABLE public.conversation_settings ENABLE ROW LEVEL SECURITY;

-- Users can manage their own conversation settings
CREATE POLICY "Users can view their own conversation settings"
  ON public.conversation_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversation settings"
  ON public.conversation_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversation settings"
  ON public.conversation_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversation settings"
  ON public.conversation_settings
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add foreign keys
ALTER TABLE public.conversation_settings
  ADD CONSTRAINT conversation_settings_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.conversation_settings
  ADD CONSTRAINT conversation_settings_conversation_id_fkey
  FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX idx_conversation_settings_user_id ON public.conversation_settings(user_id);
CREATE INDEX idx_conversation_settings_conversation_id ON public.conversation_settings(conversation_id);
CREATE INDEX idx_conversation_settings_pinned ON public.conversation_settings(user_id, is_pinned) WHERE is_pinned = true;
CREATE INDEX idx_system_messages_active ON public.system_messages(is_active, priority DESC) WHERE is_active = true;