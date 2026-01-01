-- Add USDT exchange rate setting
INSERT INTO public.platform_settings (key, value, type, description)
VALUES ('usdt_exchange_rate', '7.2', 'text', 'USDT兑换人民币汇率')
ON CONFLICT (key) DO NOTHING;