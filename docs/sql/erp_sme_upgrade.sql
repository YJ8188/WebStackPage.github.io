-- =========================================================
-- WebStack ERP 中小企业增强 - 数据库升级脚本（Supabase/PostgreSQL）
-- 执行环境：Supabase SQL Editor
-- 说明：
-- 1) 可重复执行（幂等）
-- 2) 当前前端已支持“无此结构”时运行；本脚本用于后续结构化升级
-- =========================================================

-- ==================== 1) 客户主数据增强 ====================
ALTER TABLE IF EXISTS public.customers
    ADD COLUMN IF NOT EXISTS customer_tier text;

ALTER TABLE IF EXISTS public.customers
    ADD COLUMN IF NOT EXISTS credit_limit numeric(14,2) DEFAULT 0;

ALTER TABLE IF EXISTS public.customers
    ADD COLUMN IF NOT EXISTS payment_term_days integer DEFAULT 0;

-- 约束：非负
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'customers_credit_limit_non_negative'
    ) THEN
        ALTER TABLE public.customers
            ADD CONSTRAINT customers_credit_limit_non_negative CHECK (credit_limit >= 0);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'customers_payment_term_days_non_negative'
    ) THEN
        ALTER TABLE public.customers
            ADD CONSTRAINT customers_payment_term_days_non_negative CHECK (payment_term_days >= 0);
    END IF;
END $$;

-- ==================== 2) 企业经营设置（按用户） ====================
CREATE TABLE IF NOT EXISTS public.erp_business_settings (
    id bigserial PRIMARY KEY,
    user_id uuid NOT NULL,
    company_name text,
    default_tax_rate numeric(6,2) DEFAULT 0,
    default_payment_term_days integer DEFAULT 0,
    monthly_net_profit_target numeric(14,2) DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_erp_business_settings_user_id
    ON public.erp_business_settings(user_id);

-- 约束：非负
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'erp_business_settings_tax_rate_non_negative'
    ) THEN
        ALTER TABLE public.erp_business_settings
            ADD CONSTRAINT erp_business_settings_tax_rate_non_negative CHECK (default_tax_rate >= 0);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'erp_business_settings_payment_term_non_negative'
    ) THEN
        ALTER TABLE public.erp_business_settings
            ADD CONSTRAINT erp_business_settings_payment_term_non_negative CHECK (default_payment_term_days >= 0);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'erp_business_settings_target_non_negative'
    ) THEN
        ALTER TABLE public.erp_business_settings
            ADD CONSTRAINT erp_business_settings_target_non_negative CHECK (monthly_net_profit_target >= 0);
    END IF;
END $$;

-- ==================== 3) 建议的 RLS（如你已开启RLS） ====================
-- 仅当你项目使用 auth.uid() 且已启用 RLS 时执行；否则可先忽略
-- ALTER TABLE public.erp_business_settings ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "erp_business_settings_select_own"
-- ON public.erp_business_settings
-- FOR SELECT
-- USING (auth.uid() = user_id);
--
-- CREATE POLICY "erp_business_settings_insert_own"
-- ON public.erp_business_settings
-- FOR INSERT
-- WITH CHECK (auth.uid() = user_id);
--
-- CREATE POLICY "erp_business_settings_update_own"
-- ON public.erp_business_settings
-- FOR UPDATE
-- USING (auth.uid() = user_id)
-- WITH CHECK (auth.uid() = user_id);

