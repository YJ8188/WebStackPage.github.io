import crypto from 'node:crypto';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { createClient } from '@supabase/supabase-js';

const MAIL_AUTH_PROVIDER = 'qq_mail';

function requireEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`缺少环境变量：${name}`);
  }
  return value;
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNumber(value, fallback = NaN) {
  const cleaned = String(value ?? '').replace(/[¥￥,\s]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toYmd(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeText(rawText) {
  return String(rawText || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripHtmlToText(html) {
  const source = String(html || '');
  if (!source) return '';
  return source
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDateToken(rawText) {
  const source = String(rawText || '').trim();
  if (!source) return null;
  let normalized = source
    .replace(/年/g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, '')
    .replace(/\./g, '-')
    .replace(/\//g, '-')
    .replace(/\s+/g, '');

  let match = normalized.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 9, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  match = normalized.match(/(\d{1,2})-(\d{1,2})/);
  if (match) {
    const now = new Date();
    const date = new Date(now.getFullYear(), Number(match[1]) - 1, Number(match[2]), 9, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function extractAmount(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match || !match[1]) continue;
    const amount = toNumber(match[1], NaN);
    if (Number.isFinite(amount)) return amount;
  }
  return NaN;
}

function extractDate(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match || !match[1]) continue;
    const date = parseDateToken(match[1]);
    if (date) return date;
  }
  return null;
}

function toValidDay(value, fallback = 0) {
  const day = Math.floor(Number(value));
  if (!Number.isFinite(day) || day < 1 || day > 31) return fallback;
  return day;
}

function computeReminderDate(baseDate, repaymentDay, daysBefore) {
  const base = baseDate instanceof Date && !Number.isNaN(baseDate.getTime()) ? baseDate : new Date();
  const repayDay = toValidDay(repaymentDay, 0);
  if (!repayDay) return null;
  let dueDate = new Date(base.getFullYear(), base.getMonth(), repayDay, 9, 0, 0);
  if (dueDate.getTime() < base.getTime()) {
    dueDate = new Date(base.getFullYear(), base.getMonth() + 1, repayDay, 9, 0, 0);
  }
  const reminder = new Date(dueDate);
  reminder.setDate(reminder.getDate() - Math.max(0, daysBefore));
  return Number.isNaN(reminder.getTime()) ? null : reminder;
}

const BANK_NAMES = [
  '中国工商银行', '中国农业银行', '中国银行', '中国建设银行', '交通银行', '中国邮政储蓄银行',
  '招商银行', '浦发银行', '中信银行', '中国民生银行', '兴业银行', '平安银行', '华夏银行',
  '广发银行', '光大银行', '浙商银行', '北京银行', '上海银行', '江苏银行', '宁波银行',
  '杭州银行', '邮储银行', '农商银行'
];

function detectBankName(text) {
  const source = String(text || '');
  const exact = [...BANK_NAMES].sort((a, b) => b.length - a.length).find((name) => source.includes(name));
  if (exact) return exact;
  const match = source.match(/([^\s，。；、:：]{2,16}银行)/);
  return match ? String(match[1]).trim() : '';
}

function detectMode(text) {
  const source = String(text || '');
  const swipeSignals = ['刷卡金额', '到账金额', '到账卡', '手续费', '费率'];
  const hasSwipe = swipeSignals.some((keyword) => source.includes(keyword));
  return hasSwipe ? 'swipe' : 'repayment';
}

function hasCreditCardKeywords(subject, text, keywords, excludes) {
  const source = `${subject}\n${text}`;
  const matchedInclude = keywords.some((keyword) => keyword && source.includes(keyword));
  if (matchedInclude) return true;
  if (excludes.some((keyword) => keyword && source.includes(keyword))) return false;
  return false;
}

function buildReferenceId(userId, uid, mode, bankName, amount, billDay, repaymentDay, dateText) {
  const raw = [userId, uid, mode, bankName, String(amount), String(billDay), String(repaymentDay), dateText].join('|');
  const hash = crypto.createHash('sha1').update(raw).digest('hex').slice(0, 24);
  return `qqmail:${mode}:${hash}`;
}

function parseMailToFinance({ userId, uid, subject, fromText, bodyText, parsedDate, reminderDaysBefore }) {
  const text = normalizeText(`${subject}\n${fromText}\n${bodyText}`);
  if (!text) return null;
  const mode = detectMode(text);
  const bankName = detectBankName(text);

  const billDay = toValidDay((text.match(/账单日[：:\s]*(?:每月)?\s*(\d{1,2})\s*日?/) || [])[1], 0);
  const repaymentDay = toValidDay((text.match(/(?:还款日|最后还款日|到期还款日)[：:\s]*(?:每月)?\s*(\d{1,2})\s*日?/) || [])[1], 0);
  const statementDate = extractDate(text, [
    /(?:账单日期|账单日|交易日期|记账日)[：:\s]*([0-9]{4}[年\/\-.][0-9]{1,2}[月\/\-.][0-9]{1,2}日?)/,
    /(?:账单日期|账单日|交易日期|记账日)[：:\s]*([0-9]{1,2}[\/\-.][0-9]{1,2})/
  ]);
  const dueDate = extractDate(text, [
    /(?:最后还款日|到期还款日|本期还款日)[：:\s]*([0-9]{4}[年\/\-.][0-9]{1,2}[月\/\-.][0-9]{1,2}日?)/,
    /(?:最后还款日|到期还款日|本期还款日)[：:\s]*([0-9]{1,2}[\/\-.][0-9]{1,2})/
  ]);
  const mailDate = parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime()) ? parsedDate : new Date();
  const transactionDate = statementDate || mailDate;

  if (mode === 'swipe') {
    const swipeAmount = extractAmount(text, [
      /(?:刷卡(?:金额)?|交易金额)[^0-9¥￥]{0,12}([¥￥]?\s*[\d,]+(?:\.\d{1,2})?)/,
      /(?:消费金额)[^0-9¥￥]{0,12}([¥￥]?\s*[\d,]+(?:\.\d{1,2})?)/
    ]);
    if (!Number.isFinite(swipeAmount) || swipeAmount <= 0) return null;
    const actualAmount = extractAmount(text, [
      /(?:到账(?:金额)?|实到(?:金额)?|入账金额)[^0-9¥￥]{0,12}([¥￥]?\s*[\d,]+(?:\.\d{1,2})?)/
    ]);
    const feeAmountFromMail = extractAmount(text, [
      /(?:手续费|服务费|通道费)[^0-9¥￥]{0,12}([¥￥]?\s*[\d,]+(?:\.\d{1,2})?)/
    ]);
    const feeRateMatch = text.match(/费率[^0-9]{0,8}([0-9]+(?:\.[0-9]+)?)\s*%/);
    const feeRateFromMail = feeRateMatch ? Number(feeRateMatch[1]) : NaN;
    const finalActualAmount = Number.isFinite(actualAmount) && actualAmount > 0 ? actualAmount : swipeAmount;
    const finalFeeAmount = Number.isFinite(feeAmountFromMail) ? feeAmountFromMail : Math.max(0, swipeAmount - finalActualAmount);
    const finalFeeRate = Number.isFinite(feeRateFromMail)
      ? feeRateFromMail
      : (swipeAmount > 0 ? (finalFeeAmount / swipeAmount) * 100 : 0);

    const settlementBankMatch = text.match(/(?:到账卡|储蓄卡|收款卡)[：:\s]*([^\s；，。]+)/);
    const settlementTailMatch = text.match(/(?:到账卡|储蓄卡|收款卡)[^0-9]{0,16}(?:尾号|末(?:四|4)位)?\s*(\d{4})/);
    const settlementBank = settlementBankMatch ? String(settlementBankMatch[1]).trim() : bankName;
    const settlementTail = settlementTailMatch ? String(settlementTailMatch[1]) : null;
    const dateText = toYmd(transactionDate);
    const referenceId = buildReferenceId(userId, uid, mode, bankName, swipeAmount, billDay, repaymentDay, dateText);

    return {
      type: 'income',
      category: '信用卡刷卡',
      amount: Number(finalActualAmount.toFixed(2)),
      description: `来源：QQ邮箱自动同步；银行：${bankName || '未识别'}；刷卡：¥${swipeAmount.toFixed(2)}；到账：¥${finalActualAmount.toFixed(2)}；手续费：¥${finalFeeAmount.toFixed(2)}；费率：${finalFeeRate.toFixed(2)}%`,
      transaction_date: transactionDate.toISOString(),
      business_type: 'credit_card_swipe',
      card_bank: bankName || null,
      card_bill_day: billDay || null,
      card_repayment_day: repaymentDay || null,
      card_swipe_amount: Number(swipeAmount.toFixed(2)),
      card_actual_amount: Number(finalActualAmount.toFixed(2)),
      card_fee_amount: Number(finalFeeAmount.toFixed(2)),
      card_fee_rate: Number(finalFeeRate.toFixed(4)),
      swipe_card_bank: bankName || null,
      settlement_bank: settlementBank || null,
      settlement_card_tail: settlementTail,
      reminder_enabled: false,
      reminder_days_before: null,
      reminder_date: null,
      reference_id: referenceId
    };
  }

  const repaymentAmount = extractAmount(text, [
    /(?:本期应还(?:金额)?|应还金额|到期应还|本期还款总额)[^0-9¥￥]{0,12}([¥￥]?\s*[\d,]+(?:\.\d{1,2})?)/,
    /(?:最低应还(?:金额|款额)?)[^0-9¥￥]{0,12}([¥￥]?\s*[\d,]+(?:\.\d{1,2})?)/
  ]);
  if (!Number.isFinite(repaymentAmount) || repaymentAmount <= 0) return null;

  const finalRepaymentDay = repaymentDay || (dueDate ? dueDate.getDate() : 0);
  const reminderDate = computeReminderDate(dueDate || transactionDate, finalRepaymentDay, reminderDaysBefore);
  const dateText = toYmd(transactionDate);
  const referenceId = buildReferenceId(userId, uid, mode, bankName, repaymentAmount, billDay, finalRepaymentDay, dateText);

  return {
    type: 'expense',
    category: '信用卡还款',
    amount: Number(repaymentAmount.toFixed(2)),
    description: `来源：QQ邮箱自动同步；银行：${bankName || '未识别'}；应还：¥${repaymentAmount.toFixed(2)}；账单日：${billDay || '-'}；还款日：${finalRepaymentDay || '-'}`,
    transaction_date: transactionDate.toISOString(),
    business_type: 'credit_card_repayment',
    card_bank: bankName || null,
    card_bill_day: billDay || null,
    card_repayment_day: finalRepaymentDay || null,
    card_repayment_amount: Number(repaymentAmount.toFixed(2)),
    reminder_enabled: true,
    reminder_days_before: reminderDaysBefore,
    reminder_date: reminderDate ? reminderDate.toISOString() : null,
    reference_id: referenceId
  };
}

async function fetchLatestMessagesFromMailbox({ client, mailbox, maxMessages, lookbackDays }) {
  const lock = await client.getMailboxLock(mailbox);
  try {
    const exists = Number(client.mailbox?.exists || 0);
    if (!exists) return [];
    const fromSeq = Math.max(1, exists - maxMessages + 1);
    const sinceTime = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
    const rows = [];
    for await (const msg of client.fetch(`${fromSeq}:${exists}`, { uid: true, envelope: true, source: true })) {
      const msgDate = msg?.envelope?.date instanceof Date ? msg.envelope.date : null;
      if (msgDate && msgDate.getTime() < sinceTime) continue;
      const parsed = await simpleParser(msg.source);
      const bodyText = normalizeText(
        parsed.text
        || parsed.textAsHtml
        || stripHtmlToText(parsed.html)
        || ''
      );
      rows.push({
        uid: msg.uid,
        mailbox,
        subject: parsed.subject || msg?.envelope?.subject || '',
        fromText: parsed.from?.text || '',
        bodyText,
        date: parsed.date || msgDate || new Date()
      });
    }
    return rows;
  } finally {
    lock.release();
  }
}

async function fetchLatestMessages({ client, mailboxText, maxMessages, lookbackDays }) {
  const mailboxes = String(mailboxText || 'INBOX')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const allRows = [];
  for (const mailbox of mailboxes) {
    try {
      const rows = await fetchLatestMessagesFromMailbox({ client, mailbox, maxMessages, lookbackDays });
      allRows.push(...rows);
      console.log(`[QQ同步] 文件夹 ${mailbox} 拉取 ${rows.length} 封`);
    } catch (error) {
      console.warn(`[QQ同步] 文件夹 ${mailbox} 读取失败：${error?.message || error}`);
    }
  }
  return allRows;
}

async function fetchExistingReferenceIds(supabase, userId, refs) {
  const existing = new Set();
  const chunkSize = 100;
  for (let i = 0; i < refs.length; i += chunkSize) {
    const chunk = refs.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('erp_finances')
      .select('reference_id')
      .eq('user_id', userId)
      .in('reference_id', chunk);
    if (error) throw error;
    (data || []).forEach((item) => existing.add(String(item.reference_id || '')));
  }
  return existing;
}

async function insertFinanceRowsCompat(supabase, rows) {
  if (!rows.length) return 0;
  let payloadRows = rows.map((row) => ({ ...row }));
  const removedColumns = new Set();
  while (true) {
    const { data, error } = await supabase
      .from('erp_finances')
      .insert(payloadRows)
      .select('id');
    if (!error) return Array.isArray(data) ? data.length : payloadRows.length;
    if (String(error.code || '') !== '42703') {
      throw error;
    }
    const message = String(error.message || '');
    const columnMatch = message.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+of/i)
      || message.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i);
    const missingColumn = columnMatch?.[1] || '';
    if (!missingColumn || removedColumns.has(missingColumn)) {
      throw error;
    }
    removedColumns.add(missingColumn);
    payloadRows = payloadRows.map((row) => {
      const next = { ...row };
      delete next[missingColumn];
      return next;
    });
  }
}

function buildFunctionsBaseUrl(supabaseUrl) {
  const custom = String(process.env.SUPABASE_FUNCTIONS_URL || '').trim();
  if (custom) return custom.replace(/\/+$/, '');
  return String(supabaseUrl || '').replace('.supabase.co', '.functions.supabase.co').replace(/\/+$/, '');
}

async function resolveQQMailCredential({ supabaseUrl, userId }) {
  const legacyEmail = String(process.env.QQ_EMAIL_ADDRESS || '').trim();
  const legacyAuthCode = String(process.env.QQ_EMAIL_AUTH_CODE || '').trim();
  const legacyHost = String(process.env.QQ_IMAP_HOST || 'imap.qq.com').trim();
  const legacyPort = toInt(process.env.QQ_IMAP_PORT, 993);
  if (legacyEmail && legacyAuthCode) {
    return {
      email: legacyEmail,
      authCode: legacyAuthCode,
      host: legacyHost,
      port: legacyPort,
      source: 'legacy-env'
    };
  }

  const syncToken = requireEnv('QQ_MAIL_SYNC_TOKEN');
  const functionsBase = buildFunctionsBaseUrl(supabaseUrl);
  const endpoint = `${functionsBase}/qq-mail-auth`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-sync-token': syncToken
    },
    body: JSON.stringify({
      action: 'resolve',
      user_id: userId
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.message || `解析QQ邮箱授权失败（HTTP ${response.status}）`);
  }
  const data = payload?.data || {};
  return {
    email: String(data.email_address || '').trim(),
    authCode: String(data.auth_code || '').trim(),
    host: String(data.imap_host || 'imap.qq.com').trim(),
    port: toInt(data.imap_port, 993),
    source: 'supabase-edge'
  };
}

async function reportSyncStatus({ supabaseUrl, supabase, userId, syncStatus, syncMessage }) {
  const syncToken = String(process.env.QQ_MAIL_SYNC_TOKEN || '').trim();
  const payload = {
    last_sync_status: String(syncStatus || '').trim() || 'unknown',
    last_sync_message: String(syncMessage || '').trim().slice(0, 500),
    last_sync_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  let updated = false;

  if (syncToken) {
    const functionsBase = buildFunctionsBaseUrl(supabaseUrl);
    const endpoint = `${functionsBase}/qq-mail-auth`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sync-token': syncToken
        },
        body: JSON.stringify({
          action: 'update_sync_status',
          user_id: userId,
          sync_status: payload.last_sync_status,
          sync_message: payload.last_sync_message,
          last_sync_at: payload.last_sync_at
        })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        console.warn('[QQ同步] 通过函数回写状态失败:', body?.message || `HTTP ${response.status}`);
      } else {
        updated = true;
      }
    } catch (error) {
      console.warn('[QQ同步] 通过函数回写状态失败:', error?.message || error);
    }
  }

  if (updated || !supabase) return;
  try {
    const { data, error } = await supabase
      .from('erp_mail_authorizations')
      .update(payload)
      .eq('user_id', userId)
      .eq('provider', MAIL_AUTH_PROVIDER)
      .select('id')
      .maybeSingle();
    if (error || !data) {
      console.warn('[QQ同步] 通过数据库回写状态失败:', error?.message || '未找到邮箱授权配置');
    }
  } catch (error) {
    console.warn('[QQ同步] 通过数据库回写状态失败:', error?.message || error);
  }
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function buildReadableSyncError(error) {
  const message = String(error?.message || '').trim();
  const responseStatus = String(error?.responseStatus || '').trim();
  const responseText = String(error?.responseText || '').trim();
  const serverResponse = String(error?.serverResponse || '').trim();
  const raw = [responseText, serverResponse, message].join(' ');
  const rawLower = raw.toLowerCase();

  if (rawLower.includes('no login fail') || rawLower.includes('authenticate plain')) {
    const reasons = [];
    if (rawLower.includes('service is not open')) reasons.push('未开启QQ邮箱IMAP/SMTP服务');
    if (rawLower.includes('password is incorrect')) reasons.push('IMAP授权码错误或已失效');
    if (rawLower.includes('account is abnormal')) reasons.push('QQ账号异常（需先在网页邮箱完成验证）');
    if (rawLower.includes('login frequency limited') || rawLower.includes('system is busy')) {
      reasons.push('登录过于频繁或系统繁忙（建议30分钟后重试）');
    }
    const reasonText = reasons.length ? reasons.join('；') : '请检查QQ邮箱IMAP开通状态与授权码';
    return `QQ邮箱IMAP登录失败：${reasonText}`;
  }

  if (responseStatus) {
    return `同步失败（${responseStatus}）：${message || responseText || '未知错误'}`;
  }

  return message || responseText || serverResponse || '同步失败（未知错误）';
}

async function resolveTargetUserIds({ supabase, explicitUserId }) {
  const forcedUserId = String(explicitUserId || '').trim();
  if (forcedUserId) {
    if (!isUuid(forcedUserId)) {
      throw new Error('ERP_USER_ID 格式错误（必须是 UUID）');
    }
    return [forcedUserId];
  }

  const { data, error } = await supabase
    .from('erp_mail_authorizations')
    .select('user_id')
    .eq('provider', MAIL_AUTH_PROVIDER)
    .eq('is_enabled', true);
  if (error) throw error;

  const userIds = Array.from(new Set((data || [])
    .map((item) => String(item?.user_id || '').trim())
    .filter((value) => isUuid(value))));

  if (!userIds.length) {
    throw new Error('未找到已启用的QQ邮箱授权账号，请先在ERP中完成授权并启用自动同步');
  }
  return userIds;
}

async function syncOneUser({
  supabaseUrl,
  supabase,
  userId,
  mailboxText,
  lookbackDays,
  maxMessages,
  reminderDaysBefore,
  dryRun,
  keywordList,
  excludeKeywords
}) {
  let syncStatus = 'failed';
  let syncMessage = '';
  let client = null;
  let clientConnected = false;

  try {
    const credential = await resolveQQMailCredential({ supabaseUrl, userId });
    const email = String(credential.email || '').trim();
    const password = String(credential.authCode || '').trim();
    const host = String(credential.host || 'imap.qq.com').trim();
    const port = toInt(credential.port, 993);
    if (!email || !password) {
      throw new Error('邮箱授权不存在或已失效，请先在ERP页面完成QQ邮箱授权');
    }

    client = new ImapFlow({
      host,
      port,
      secure: true,
      auth: {
        user: email,
        pass: password
      }
    });

    console.log(`[QQ同步][${userId}] 启动：邮箱=${email}, 时间窗=${lookbackDays}天, 来源=${credential.source}`);
    await client.connect();
    clientConnected = true;
    const messages = await fetchLatestMessages({ client, mailboxText, maxMessages, lookbackDays });
    await client.logout();
    clientConnected = false;

    console.log(`[QQ同步][${userId}] 拉取邮件数量：${messages.length}`);

    const parsedRows = [];
    let skippedByKeyword = 0;
    let parseFailed = 0;
    const keywordSkippedMessages = [];

    for (const mail of messages) {
      if (!hasCreditCardKeywords(mail.subject, mail.bodyText, keywordList, excludeKeywords)) {
        skippedByKeyword += 1;
        keywordSkippedMessages.push(mail);
        continue;
      }
      const row = parseMailToFinance({
        userId,
        uid: mail.uid,
        subject: mail.subject,
        fromText: mail.fromText,
        bodyText: mail.bodyText,
        parsedDate: mail.date,
        reminderDaysBefore
      });
      if (!row) {
        parseFailed += 1;
        continue;
      }
      parsedRows.push({
        ...row,
        user_id: userId
      });
    }

    if (!parsedRows.length && keywordSkippedMessages.length) {
      let fallbackParsed = 0;
      for (const mail of keywordSkippedMessages) {
        const row = parseMailToFinance({
          userId,
          uid: mail.uid,
          subject: mail.subject,
          fromText: mail.fromText,
          bodyText: mail.bodyText,
          parsedDate: mail.date,
          reminderDaysBefore
        });
        if (!row) continue;
        fallbackParsed += 1;
        parsedRows.push({
          ...row,
          user_id: userId
        });
      }
      if (fallbackParsed > 0) {
        console.log(`[QQ同步][${userId}] 关键词兜底解析命中：${fallbackParsed} 条`);
      }
    }

    if (!parsedRows.length) {
      syncStatus = 'partial';
      syncMessage = `无可导入账单（关键词跳过${skippedByKeyword}，解析失败${parseFailed}）。请确认账单邮件是否为文本内容（非纯图片/PDF）`;
      console.log(`[QQ同步][${userId}] ${syncMessage}`);
      return { userId, ok: true, syncStatus, syncMessage };
    }

    const refs = parsedRows.map((item) => item.reference_id).filter(Boolean);
    const existingRefs = await fetchExistingReferenceIds(supabase, userId, refs);
    const insertRows = parsedRows.filter((item) => !existingRefs.has(String(item.reference_id || '')));

    if (!insertRows.length) {
      syncStatus = 'partial';
      syncMessage = `无新增（已存在${existingRefs.size}条）`;
      console.log(`[QQ同步][${userId}] ${syncMessage}`);
      return { userId, ok: true, syncStatus, syncMessage };
    }

    if (dryRun) {
      syncStatus = 'success';
      syncMessage = `DRY_RUN：解析${parsedRows.length}条，新增候选${insertRows.length}条`;
      console.log(`[QQ同步][${userId}][DRY_RUN] ${syncMessage}`);
      insertRows.slice(0, 5).forEach((row, index) => {
        console.log(`[预览][${userId}][${index + 1}] ${row.category} ${row.card_bank || '-'} ${row.amount} ${toYmd(new Date(row.transaction_date))}`);
      });
      return { userId, ok: true, syncStatus, syncMessage };
    }

    const inserted = await insertFinanceRowsCompat(supabase, insertRows);
    syncStatus = inserted > 0 ? 'success' : 'partial';
    syncMessage = `解析${parsedRows.length}，新增${inserted}，关键词跳过${skippedByKeyword}，解析失败${parseFailed}`;
    console.log(`[QQ同步][${userId}] 完成：${syncMessage}`);
    return { userId, ok: true, syncStatus, syncMessage };
  } catch (error) {
    syncStatus = 'failed';
    syncMessage = buildReadableSyncError(error).slice(0, 500);
    console.error(`[QQ同步][${userId}] 失败：${syncMessage}`);
    return { userId, ok: false, syncStatus, syncMessage };
  } finally {
    if (clientConnected && client) {
      try {
        await client.logout();
      } catch (_error) {
      }
    }
    await reportSyncStatus({
      supabaseUrl,
      supabase,
      userId,
      syncStatus,
      syncMessage
    });
  }
}

async function main() {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const explicitUserId = String(process.env.ERP_USER_ID || '').trim();
  const mailboxText = String(process.env.QQ_MAILBOX || 'INBOX').trim();
  const lookbackDays = Math.max(1, toInt(process.env.QQ_SYNC_LOOKBACK_DAYS, 35));
  const maxMessages = Math.max(20, toInt(process.env.QQ_SYNC_MAX_MESSAGES, 250));
  const reminderDaysBefore = Math.max(0, toInt(process.env.QQ_SYNC_REMINDER_DAYS_BEFORE, 3));
  const dryRun = ['1', 'true', 'yes'].includes(String(process.env.QQ_SYNC_DRY_RUN || '').toLowerCase());
  const keywordList = String(process.env.QQ_SYNC_INCLUDE_KEYWORDS || '信用卡,账单,还款,到期')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const excludeKeywords = String(process.env.QQ_SYNC_EXCLUDE_KEYWORDS || '验证码,动态码,OTP,one-time password')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const userIds = await resolveTargetUserIds({ supabase, explicitUserId });
  console.log(`[QQ同步] 本次同步账号数：${userIds.length}${explicitUserId ? '（指定单用户）' : '（自动多用户）'}`);

  let successCount = 0;
  let partialCount = 0;
  let failedCount = 0;

  for (const userId of userIds) {
    const result = await syncOneUser({
      supabaseUrl,
      supabase,
      userId,
      mailboxText,
      lookbackDays,
      maxMessages,
      reminderDaysBefore,
      dryRun,
      keywordList,
      excludeKeywords
    });
    if (result.syncStatus === 'success') successCount += 1;
    else if (result.syncStatus === 'partial') partialCount += 1;
    else failedCount += 1;
  }

  console.log(`[QQ同步] 总结：成功${successCount}，部分成功${partialCount}，失败${failedCount}`);
  if (failedCount > 0 && successCount === 0 && partialCount === 0) {
    throw new Error(`全部账号同步失败（${failedCount}）`);
  }
}

main().catch((error) => {
  console.error('[QQ同步] 失败:', error);
  process.exitCode = 1;
});
