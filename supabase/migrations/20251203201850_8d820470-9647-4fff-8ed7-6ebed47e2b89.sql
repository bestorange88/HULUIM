-- Add daily_draw_tickets column to membership_tiers table
ALTER TABLE public.membership_tiers
ADD COLUMN daily_draw_tickets integer DEFAULT 3;