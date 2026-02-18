-- =========================================================
-- WebStack ERP / Supabase 安全加固脚本（幂等）
-- 目标：
-- 1) 修复 Security Advisor: RLS Disabled in Public（erp_business_settings）
-- 2) 修复 Security Definer View（erp_product_stock / erp_order_stats）
-- 3) 收紧视图授权（默认仅 authenticated 可读）
-- 执行位置：Supabase -> SQL Editor
-- =========================================================

-- ==================== 1) erp_business_settings 启用 RLS ====================
DO $$
BEGIN
    IF to_regclass('public.erp_business_settings') IS NULL THEN
        RAISE NOTICE 'Skip: public.erp_business_settings does not exist.';
        RETURN;
    END IF;

    EXECUTE 'ALTER TABLE public.erp_business_settings ENABLE ROW LEVEL SECURITY';

    -- 删除可能过宽的历史策略（若存在）
    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'erp_business_settings'
          AND policyname = 'erp_business_settings_public_read'
    ) THEN
        EXECUTE 'DROP POLICY erp_business_settings_public_read ON public.erp_business_settings';
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'erp_business_settings'
          AND policyname = 'erp_business_settings_public_write'
    ) THEN
        EXECUTE 'DROP POLICY erp_business_settings_public_write ON public.erp_business_settings';
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.erp_business_settings') IS NULL THEN
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'erp_business_settings'
          AND policyname = 'erp_business_settings_select_own'
    ) THEN
        EXECUTE $SQL$
            CREATE POLICY erp_business_settings_select_own
            ON public.erp_business_settings
            FOR SELECT
            TO authenticated
            USING (auth.uid() = user_id)
        $SQL$;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'erp_business_settings'
          AND policyname = 'erp_business_settings_insert_own'
    ) THEN
        EXECUTE $SQL$
            CREATE POLICY erp_business_settings_insert_own
            ON public.erp_business_settings
            FOR INSERT
            TO authenticated
            WITH CHECK (auth.uid() = user_id)
        $SQL$;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'erp_business_settings'
          AND policyname = 'erp_business_settings_update_own'
    ) THEN
        EXECUTE $SQL$
            CREATE POLICY erp_business_settings_update_own
            ON public.erp_business_settings
            FOR UPDATE
            TO authenticated
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id)
        $SQL$;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'erp_business_settings'
          AND policyname = 'erp_business_settings_delete_own'
    ) THEN
        EXECUTE $SQL$
            CREATE POLICY erp_business_settings_delete_own
            ON public.erp_business_settings
            FOR DELETE
            TO authenticated
            USING (auth.uid() = user_id)
        $SQL$;
    END IF;
END $$;

-- ==================== 2) Security Definer View -> Security Invoker ====================
-- Supabase(PostgreSQL 15+) 支持 security_invoker，开启后会按调用者权限/RLS 计算。
DO $$
BEGIN
    IF to_regclass('public.erp_product_stock') IS NOT NULL THEN
        BEGIN
            EXECUTE 'ALTER VIEW public.erp_product_stock SET (security_invoker = true)';
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'erp_product_stock: failed to set security_invoker=true (%).', SQLERRM;
        END;
    END IF;

    IF to_regclass('public.erp_order_stats') IS NOT NULL THEN
        BEGIN
            EXECUTE 'ALTER VIEW public.erp_order_stats SET (security_invoker = true)';
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'erp_order_stats: failed to set security_invoker=true (%).', SQLERRM;
        END;
    END IF;
END $$;

-- ==================== 3) 收紧视图授权（ERP 场景不建议 anon 读） ====================
DO $$
BEGIN
    IF to_regclass('public.erp_product_stock') IS NOT NULL THEN
        EXECUTE 'REVOKE ALL ON TABLE public.erp_product_stock FROM anon';
        EXECUTE 'GRANT SELECT ON TABLE public.erp_product_stock TO authenticated';
    END IF;

    IF to_regclass('public.erp_order_stats') IS NOT NULL THEN
        EXECUTE 'REVOKE ALL ON TABLE public.erp_order_stats FROM anon';
        EXECUTE 'GRANT SELECT ON TABLE public.erp_order_stats TO authenticated';
    END IF;
END $$;

-- ==================== 4)（可选）历史数据修正：已签收+已支付 -> 已完成 ====================
-- 说明：若你希望“签收并支付”自动算已完成，可执行；否则注释掉此段。
-- UPDATE public.erp_orders
-- SET status = 'completed'
-- WHERE status = 'signed'
--   AND payment_status = 'paid'
--   AND COALESCE(shipping_status, '') IN ('delivered', 'signed');

