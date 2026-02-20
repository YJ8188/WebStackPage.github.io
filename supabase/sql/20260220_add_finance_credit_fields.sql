alter table if exists public.erp_finances
  add column if not exists business_type text,
  add column if not exists card_bank text,
  add column if not exists card_bill_day integer,
  add column if not exists card_repayment_day integer,
  add column if not exists card_repayment_amount numeric(14,2),
  add column if not exists card_swipe_amount numeric(14,2),
  add column if not exists card_actual_amount numeric(14,2),
  add column if not exists card_fee_amount numeric(14,2),
  add column if not exists swipe_card_bank text,
  add column if not exists settlement_bank text,
  add column if not exists settlement_card_tail text,
  add column if not exists reminder_enabled boolean,
  add column if not exists reminder_days_before integer,
  add column if not exists reminder_date timestamptz;

comment on column public.erp_finances.business_type is '业务类型：life_expense/salary_income/credit_card';
comment on column public.erp_finances.card_bank is '信用卡发卡银行';
comment on column public.erp_finances.card_bill_day is '信用卡账单日(1-31)';
comment on column public.erp_finances.card_repayment_day is '信用卡还款日(1-31)';
comment on column public.erp_finances.card_repayment_amount is '信用卡本期应还金额';
comment on column public.erp_finances.card_swipe_amount is '信用卡刷卡金额';
comment on column public.erp_finances.card_actual_amount is '信用卡实际到账金额';
comment on column public.erp_finances.card_fee_amount is '信用卡扣费金额(刷卡-到账)';
comment on column public.erp_finances.swipe_card_bank is '刷卡信用卡银行';
comment on column public.erp_finances.settlement_bank is '到账储蓄卡银行';
comment on column public.erp_finances.settlement_card_tail is '到账储蓄卡尾号';
comment on column public.erp_finances.reminder_enabled is '是否开启还款提醒';
comment on column public.erp_finances.reminder_days_before is '提前提醒天数';
comment on column public.erp_finances.reminder_date is '最近一次提醒日期';
