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
  const source = String(value ?? '').trim();
  if (!source) return fallback;
  const cleaned = source
    .replace(/(?:CNY|RMB)/ig, '')
    .replace(/[¥￥\s]/g, '');
  if (!cleaned) return fallback;
  const digitsOnly = cleaned.replace(/[^\d]/g, '');
  const hasDecimal = cleaned.includes('.');
  const hasComma = cleaned.includes(',');
  if (!hasDecimal && !hasComma && digitsOnly.length >= 9) {
    return fallback;
  }
  const normalized = cleaned.replace(/,/g, '');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed <= 0 || parsed > 1_000_000_000) return fallback;
  if (!hasDecimal && !hasComma && digitsOnly.length === 4 && parsed >= 1900 && parsed <= 2100) {
    return fallback;
  }
  return parsed;
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
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
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

function mergeMailBodyText(parsed) {
  const textParts = [
    String(parsed?.text || '').trim(),
    stripHtmlToText(parsed?.textAsHtml || ''),
    stripHtmlToText(parsed?.html || '')
  ].filter(Boolean);
  return normalizeText(textParts.join('\n'));
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

function extractDateByLabels(text, labels = []) {
  const source = String(text || '');
  if (!source || !labels.length) return null;
  const escapedLabels = labels
    .map((label) => String(label || '').trim())
    .filter(Boolean)
    .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!escapedLabels.length) return null;
  const labelGroup = escapedLabels.join('|');
  const regex = new RegExp(
    `(?:${labelGroup})[\\s\\S]{0,420}?((?:20\\d{2}[年/\\-.]\\d{1,2}[月/\\-.]\\d{1,2}日?)|(?:\\d{1,2}[\\/\\-.]\\d{1,2}))`,
    'i'
  );
  const match = source.match(regex);
  if (!match || !match[1]) return null;
  return parseDateToken(match[1]);
}

function extractAmountByLabels(text, labels = []) {
  const source = String(text || '');
  if (!source || !labels.length) return NaN;
  const escapedLabels = labels
    .map((label) => String(label || '').trim())
    .filter(Boolean);
  if (!escapedLabels.length) return NaN;

  const findAmountInWindow = (windowText) => {
    const patterns = [
      /(?:CNY|RMB|¥|￥)\s*([0-9][0-9,]{0,15}(?:\.\d{1,2})?)/i,
      /([0-9][0-9,]{0,15}(?:\.\d{1,2})?)\s*(?:CNY|RMB|元)/i,
      /([0-9]{1,3}(?:,[0-9]{3})+(?:\.\d{1,2})?)/,
      /([1-9][0-9]{0,7}(?:\.\d{1,2})?)/
    ];
    for (const pattern of patterns) {
      const match = String(windowText || '').match(pattern);
      if (!match || !match[1]) continue;
      const amount = toNumber(match[1], NaN);
      if (Number.isFinite(amount)) return amount;
    }
    return NaN;
  };

  const sourceLower = source.toLowerCase();
  for (const label of escapedLabels) {
    const labelText = String(label || '').trim();
    if (!labelText) continue;
    const lowerLabel = labelText.toLowerCase();
    const startIndex = sourceLower.indexOf(lowerLabel);
    if (startIndex < 0) continue;
    const windowText = source.slice(startIndex, Math.min(source.length, startIndex + 520));
    const amount = findAmountInWindow(windowText);
    if (Number.isFinite(amount)) return amount;
  }
  return NaN;
}

function extractStatementPeriodEndDate(text) {
  const source = String(text || '');
  if (!source) return null;
  const match = source.match(
    /([0-9]{4}[年\/\-.][0-9]{1,2}[月\/\-.][0-9]{1,2}日?)[^0-9]{0,10}(?:至|到|-|~|—)[^0-9]{0,10}([0-9]{4}[年\/\-.][0-9]{1,2}[月\/\-.][0-9]{1,2}日?)/i
  );
  if (!match) return null;
  const endDate = parseDateToken(match[2] || '');
  return endDate || null;
}

function extractDay(text, patterns) {
  const source = String(text || '');
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (!match || !match[1]) continue;
    const day = toValidDay(match[1], 0);
    if (day) return day;
  }
  return 0;
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
  const strongSwipeSignals = ['刷卡金额', '到账金额', '实到金额', '到账卡', '收款卡', '储蓄卡'];
  const weakSwipeSignals = ['手续费', '费率', '服务费', '通道费'];
  const hasStrongSwipeSignal = strongSwipeSignals.some((keyword) => source.includes(keyword));
  if (hasStrongSwipeSignal) return 'swipe';
  const hasWeakSwipeSignal = weakSwipeSignals.some((keyword) => source.includes(keyword));
  if (hasWeakSwipeSignal && /(刷卡|交易|到账|收款)/.test(source)) return 'swipe';
  return 'repayment';
}

function hasCreditCardKeywords(subject, text, fromText, keywords, excludes) {
  const source = `${subject}\n${fromText}\n${text}`;
  const sourceLower = source.toLowerCase();
  const sourceCompact = sourceLower.replace(/\s+/g, '');
  const matchedInclude = keywords.some((keyword) => {
    const key = String(keyword || '').trim();
    if (!key) return false;
    const keyLower = key.toLowerCase();
    const keyCompact = keyLower.replace(/\s+/g, '');
    return sourceLower.includes(keyLower) || sourceCompact.includes(keyCompact);
  });
  if (matchedInclude) return true;
  const statementLike = /(账单|statement|billing)/i.test(source);
  const cardLike = /(信用卡|credit\s*card|银行|bank)/i.test(source);
  if (statementLike && cardLike) return true;
  if (/(citiccard\.com|中信银行信用卡中心|信用卡中心|信用卡电子账单)/i.test(source)) return true;
  if (excludes.some((keyword) => keyword && source.includes(keyword))) return false;
  return false;
}

function buildReferenceId(userId, uid, messageId, mode, bankName, amount, dateText) {
  const normalizedMessageId = String(messageId || '').trim().toLowerCase();
  const stableMailId = normalizedMessageId || `uid:${uid}`;
  const raw = [userId, stableMailId, mode, bankName, String(amount), dateText].join('|');
  const hash = crypto.createHash('sha1').update(raw).digest('hex');
  const bigintSafeHex = hash.slice(0, 15);
  const numericId = BigInt(`0x${bigintSafeHex}`).toString();
  return numericId;
}

function isCalendarReminderMail(subject, fromText, bodyText) {
  const subjectText = String(subject || '');
  const from = String(fromText || '');
  const body = String(bodyText || '');
  const source = `${subjectText}\n${from}\n${body}`;
  const isReminderSource = /(日历提醒|calendar@qq\.com|还款提醒)/i.test(source);
  if (!isReminderSource) return false;
  const isStatementMail = /(电子账单|账单已产生|Statement Information|Total Statement Balance|本期应还款总额)/i.test(source);
  return !isStatementMail;
}

function parseMailToFinance({ userId, uid, messageId, subject, fromText, bodyText, parsedDate, reminderDaysBefore }) {
  if (isCalendarReminderMail(subject, fromText, bodyText)) {
    return null;
  }
  const text = normalizeText(`${subject}\n${fromText}\n${bodyText}`);
  if (!text) return null;
  const mode = detectMode(text);
  const bankName = detectBankName(text);
  const forcedBankName = /(中信银行信用卡|citiccard\.com)/i.test(text) ? '中信银行' : '';
  const hasStatementSignal = /(账单|statement|billing|电子账单)/i.test(text);
  const isCiticStatement = /(中信银行信用卡|citiccard\.com|总账信息\s*\|\s*Statement Information|Total Payment)/i.test(text);

  const statementDateByLabel = extractDateByLabels(text, [
    '账单日',
    '账单日期',
    '出账日期',
    '结单日期',
    'Statement Date'
  ]);
  const dueDateByLabel = extractDateByLabels(text, [
    '最后还款日',
    '到期还款日',
    '本期还款日',
    '最迟还款日',
    'Payment Due Date',
    'Due Date'
  ]);
  const statementPeriodEndDate = extractStatementPeriodEndDate(text);

  const billDay = extractDay(text, [
    /(?:账单日|账单日期|出账日|结单日|账单生成日)[：:\s]{0,16}(?:每月|每期)?\s*((?:[12]?\d|3[01]))\s*日/i,
    /(?:每月|每期)\s*((?:[12]?\d|3[01]))\s*日[^。\n]{0,20}(?:账单日|出账日|结单日)/i
  ]);
  const repaymentDay = extractDay(text, [
    /(?:还款日|最后还款日|到期还款日|本期还款日|最迟还款日)[：:\s]{0,16}(?:每月|每期)?\s*((?:[12]?\d|3[01]))\s*日/i,
    /(?:每月|每期)\s*((?:[12]?\d|3[01]))\s*日(?:为)?[^。\n]{0,8}(?:还款日|最后还款日|到期还款日|最迟还款日)/i
  ]);
  const statementDate = statementDateByLabel || statementPeriodEndDate || extractDate(text, [
    /(?:账单日期|账单日|交易日期|记账日)[：:\s]*([0-9]{4}[年\/\-.][0-9]{1,2}[月\/\-.][0-9]{1,2}日?)/,
    /(?:账单日期|账单日|交易日期|记账日|出账日期|结单日期)[：:\s]*([0-9]{1,2}[\/\-.][0-9]{1,2})/
  ]);
  const dueDate = dueDateByLabel || extractDate(text, [
    /(?:最后还款日|到期还款日|本期还款日)[：:\s]*([0-9]{4}[年\/\-.][0-9]{1,2}[月\/\-.][0-9]{1,2}日?)/,
    /(?:最后还款日|到期还款日|本期还款日|最迟还款日)[：:\s]*([0-9]{1,2}[\/\-.][0-9]{1,2})/
  ]);
  const mailDate = parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime()) ? parsedDate : new Date();
  const transactionDate = statementDate || mailDate;
  const finalBillDay = billDay || (statementDate ? statementDate.getDate() : 0) || mailDate.getDate();

  if (mode === 'swipe') {
    const swipeAmount = extractAmount(text, [
      /(?:刷卡(?:金额)?|交易金额)[^0-9¥￥]{0,40}([¥￥]?\s*[\d,]+(?:\.\d{1,2})?)/,
      /(?:消费金额)[^0-9¥￥]{0,40}([¥￥]?\s*[\d,]+(?:\.\d{1,2})?)/
    ]);
    if (!Number.isFinite(swipeAmount) || swipeAmount <= 0) return null;
    const actualAmount = extractAmount(text, [
      /(?:到账(?:金额)?|实到(?:金额)?|入账金额)[^0-9¥￥]{0,40}([¥￥]?\s*[\d,]+(?:\.\d{1,2})?)/
    ]);
    const feeAmountFromMail = extractAmount(text, [
      /(?:手续费|服务费|通道费)[^0-9¥￥]{0,40}([¥￥]?\s*[\d,]+(?:\.\d{1,2})?)/
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
    const referenceId = buildReferenceId(userId, uid, messageId, mode, bankName, swipeAmount, dateText);

    return {
      type: 'income',
      category: '信用卡刷卡',
      amount: Number(finalActualAmount.toFixed(2)),
      description: `来源：QQ邮箱自动同步；银行：${bankName || '未识别'}；刷卡：¥${swipeAmount.toFixed(2)}；到账：¥${finalActualAmount.toFixed(2)}；手续费：¥${finalFeeAmount.toFixed(2)}；费率：${finalFeeRate.toFixed(2)}%`,
      transaction_date: transactionDate.toISOString(),
      business_type: 'credit_card_swipe',
      card_bank: bankName || null,
      card_bill_day: finalBillDay || null,
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

  const repaymentAmountByLabel = extractAmountByLabels(text, [
    '本期应还款总额',
    '本期应还款金额',
    '本期应还款',
    '应还款总额',
    '应还款额',
    'Total Payment',
    'Total Statement Balance',
    'Statement Balance'
  ]);
  const repaymentAmountByCiticTemplate = extractAmount(text, [
    /(?:本期应还款总额|Total\s*Payment)[\s\S]{0,260}?(?:CNY|RMB|¥|￥)\s*([0-9][0-9,]{0,15}(?:\.\d{1,2})?)/i,
    /(?:总账信息[\s\S]{0,200}?Statement Information)[\s\S]{0,320}?(?:CNY|RMB|¥|￥)\s*([0-9][0-9,]{0,15}(?:\.\d{1,2})?)/i,
    /(?:本期应还款总额|Total Payment)[^0-9¥￥CNY]{0,120}(?:CNY|¥|￥)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:Total Payment)[^0-9¥￥CNY]{0,120}(?:CNY|¥|￥)?\s*([\d,]+(?:\.\d{1,2})?)/i
  ]);
  const repaymentAmountByCiticStrict = extractAmount(text, [
    /Total\s*Payment[\s\S]{0,120}?([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{1,2})?)/i,
    /本期应还款总额[\s\S]{0,120}?([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{1,2})?)/i,
    /(?:CNY|RMB)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{1,2})?)[\s\S]{0,60}?(?:Total\s*Payment|本期应还款总额)/i
  ]);
  const repaymentAmountByStatementCurrency = extractAmount(text, [
    /(?:Statement Information|总账信息)[\s\S]{0,400}?(?:本期应还款总额|Total\s*Payment)[\s\S]{0,220}?([¥￥]?\s*(?:CNY|RMB)?\s*[\d,]+(?:\.\d{1,2})?)/i
  ]);
  const repaymentAmountByCiticCurrencyMax = (() => {
    if (!isCiticStatement) return NaN;
    const matches = Array.from(text.matchAll(/(?:CNY|RMB|¥|￥)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{1,2})?)/ig));
    const amounts = matches
      .map((match) => toNumber(match?.[1], NaN))
      .filter((value) => Number.isFinite(value) && value > 0 && value < 100000000);
    if (!amounts.length) return NaN;
    return Math.max(...amounts);
  })();
  const repaymentAmount = Number.isFinite(repaymentAmountByLabel)
    ? repaymentAmountByLabel
    : (Number.isFinite(repaymentAmountByCiticTemplate)
      ? repaymentAmountByCiticTemplate
      : (Number.isFinite(repaymentAmountByCiticStrict)
        ? repaymentAmountByCiticStrict
        : (Number.isFinite(repaymentAmountByStatementCurrency)
          ? repaymentAmountByStatementCurrency
          : (Number.isFinite(repaymentAmountByCiticCurrencyMax)
            ? repaymentAmountByCiticCurrencyMax
            : extractAmount(text, [
    /(?:本期应还(?:金额|款总额|总额)?|本期应还款总额|应还金额|应还款额|应还款总额|到期应还|本期还款总额|本期账单金额|Total Statement Balance|Statement Balance)[^0-9¥￥]{0,80}([¥￥]?\s*[\d,]+(?:\.\d{1,2})?)/i,
    /(?:本期应还款金额|本期应还款|总账信息)[^0-9¥￥]{0,80}([¥￥]?\s*[\d,]+(?:\.\d{1,2})?)/i,
    /(?:最低应还(?:金额|款额)?|最低还款额|最低还款|Minimum Payment)[^0-9¥￥]{0,80}([¥￥]?\s*[\d,]+(?:\.\d{1,2})?)/i
  ])))));
  if (!Number.isFinite(repaymentAmount) || repaymentAmount <= 0) return null;
  if (!hasStatementSignal && !statementDate && !billDay && !isCiticStatement) return null;
  if (/(本期账单已还清|已还清|已结清)/.test(text) && !/(本期应还|应还款|Total Statement Balance)/i.test(text)) {
    return null;
  }

  let finalRepaymentDay = repaymentDay || (dueDate ? dueDate.getDate() : 0);
  if (
    finalRepaymentDay
    && finalBillDay
    && finalRepaymentDay === finalBillDay
    && !dueDateByLabel
    && !/(Payment Due Date|到期还款日|最后还款日|最迟还款日)/i.test(text)
  ) {
    finalRepaymentDay = 0;
  }
  const reminderDate = computeReminderDate(dueDate || transactionDate, finalRepaymentDay, reminderDaysBefore);
  const dateText = toYmd(transactionDate);
  const stableBankName = forcedBankName || bankName;
  const referenceId = buildReferenceId(userId, uid, messageId, mode, stableBankName, repaymentAmount, dateText);

  return {
    type: 'expense',
    category: '信用卡还款',
    amount: Number(repaymentAmount.toFixed(2)),
    description: `来源：QQ邮箱自动同步；银行：${stableBankName || '未识别'}；应还：¥${repaymentAmount.toFixed(2)}；账单日：${finalBillDay || '-'}；还款日：${finalRepaymentDay || '-'}`,
    transaction_date: transactionDate.toISOString(),
    business_type: 'credit_card_repayment',
    card_bank: stableBankName || null,
    card_bill_day: finalBillDay || null,
    card_repayment_day: finalRepaymentDay || null,
    card_repayment_amount: Number(repaymentAmount.toFixed(2)),
    reminder_enabled: true,
    reminder_days_before: reminderDaysBefore,
    reminder_date: reminderDate ? reminderDate.toISOString() : null,
    reference_id: referenceId
  };
}

async function fetchLatestMessagesFromMailbox({ client, mailbox, maxMessages, lookbackDays, dateScope }) {
  const lock = await client.getMailboxLock(mailbox);
  try {
    const exists = Number(client.mailbox?.exists || 0);
    if (!exists) return [];
    const isCurrentMonthScope = String(dateScope || '').toLowerCase() === 'current_month';
    let isCappedByMax = exists > maxMessages;
    let cappedTruncateCount = isCappedByMax ? Math.max(0, exists - maxMessages) : 0;
    let fetchRange = Math.max(1, exists - maxMessages + 1) + ':' + exists;
    let fetchOptions = undefined;
    let plannedScanCount = Math.min(exists, maxMessages);
    const lookbackEnabled = Number(lookbackDays || 0) > 0;
    const sinceTime = lookbackEnabled
      ? Date.now() - lookbackDays * 24 * 60 * 60 * 1000
      : 0;
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth();
    if (isCurrentMonthScope) {
      try {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        const monthlyUids = await client.search({ since: monthStart }, { uid: true });
        const uidList = Array.isArray(monthlyUids) ? monthlyUids.filter((item) => Number.isFinite(Number(item))) : [];
        isCappedByMax = uidList.length > maxMessages;
        cappedTruncateCount = isCappedByMax ? Math.max(0, uidList.length - maxMessages) : 0;
        const selectedUids = isCappedByMax ? uidList.slice(-maxMessages) : uidList;
        if (!selectedUids.length) {
          console.log(`[QQ同步] 文件夹 ${mailbox}：当月无可扫描邮件`);
          return [];
        }
        fetchRange = selectedUids;
        fetchOptions = { uid: true };
        plannedScanCount = selectedUids.length;
        console.log(`[QQ同步] 文件夹 ${mailbox}：当月候选${uidList.length}封，实际扫描${plannedScanCount}封`);
      } catch (error) {
        console.warn(`[QQ同步] 文件夹 ${mailbox}：当月服务端筛选失败，回退到序号扫描：${error?.message || error}`);
      }
    }
    const rows = [];
    let scannedCount = 0;
    let skippedByLookback = 0;
    let skippedByMonthScope = 0;
    for await (const msg of client.fetch(fetchRange, { uid: true, envelope: true, source: true }, fetchOptions)) {
      scannedCount += 1;
      if (scannedCount % 100 === 0) {
        console.log(`[QQ同步] 文件夹 ${mailbox}：进度 ${scannedCount}/${plannedScanCount}`);
      }
      const msgDate = msg?.envelope?.date instanceof Date ? msg.envelope.date : null;
      if (isCurrentMonthScope && msgDate) {
        if (msgDate.getUTCFullYear() !== currentYear || msgDate.getUTCMonth() !== currentMonth) {
          skippedByMonthScope += 1;
          continue;
        }
      }
      if (lookbackEnabled && msgDate && msgDate.getTime() < sinceTime) {
        skippedByLookback += 1;
        continue;
      }
      const parsed = await simpleParser(msg.source);
      const bodyText = mergeMailBodyText(parsed);
      rows.push({
        uid: msg.uid,
        messageId: parsed.messageId || msg?.envelope?.messageId || '',
        mailbox,
        subject: parsed.subject || msg?.envelope?.subject || '',
        fromText: parsed.from?.text || '',
        bodyText,
        date: parsed.date || msgDate || new Date()
      });
    }
    console.log(
      `[QQ同步] 文件夹 ${mailbox}：总邮件${exists}，扫描${scannedCount}，当月过滤${skippedByMonthScope}，时间窗过滤${skippedByLookback}，保留${rows.length}${isCappedByMax ? `，上限截断${cappedTruncateCount}` : ''}`
    );
    return rows;
  } finally {
    lock.release();
  }
}

async function resolveMailboxesToScan({ client, mailboxText, autoDiscover }) {
  const flattenMailboxEntries = (items, output = []) => {
    for (const item of Array.isArray(items) ? items : []) {
      if (!item) continue;
      output.push(item);
      if (Array.isArray(item.children) && item.children.length) {
        flattenMailboxEntries(item.children, output);
      }
    }
    return output;
  };
  const hasMailboxFlag = (folder, flagName) => {
    const flags = folder?.flags;
    if (!flags) return false;
    if (typeof flags.has === 'function') return flags.has(flagName);
    if (Array.isArray(flags)) return flags.includes(flagName);
    return false;
  };

  const configured = String(mailboxText || 'INBOX')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const wantsAll = configured.some((item) => /^(all|\*)$/i.test(item));
  const selected = new Set(configured.length ? configured : ['INBOX']);
  if (wantsAll) {
    selected.clear();
  }
  if (!autoDiscover && !wantsAll) {
    if (!selected.has('INBOX')) selected.add('INBOX');
    return Array.from(selected);
  }

  try {
    const folders = flattenMailboxEntries(await client.list());
    const selectableFolders = [];
    const keywordRegex = /(信用卡|账单|银行|中信|浦发|民生|光大|张家口|credit|statement|billing|card|repay|payment)/i;
    for (const folder of folders || []) {
      const path = String(folder?.path || '').trim();
      if (!path) continue;
      const isDisabled = !!folder?.disabled || hasMailboxFlag(folder, '\\Noselect') || hasMailboxFlag(folder, '\\NonExistent');
      if (isDisabled) continue;
      selectableFolders.push(path);
      if (wantsAll) {
        selected.add(path);
        continue;
      }
      const name = String(folder?.name || '').trim();
      const specialUse = String(folder?.specialUse || '').trim();
      if (specialUse === '\\Inbox' || path.toUpperCase() === 'INBOX') {
        selected.add(path);
        continue;
      }
      if (keywordRegex.test(path) || keywordRegex.test(name)) {
        selected.add(path);
      }
    }
    if (wantsAll) {
      console.log(`[QQ同步] 已启用全量文件夹扫描，共 ${selectableFolders.length} 个文件夹`);
      console.log(`[QQ同步] 全量文件夹清单：${selectableFolders.join(', ')}`);
    }
  } catch (error) {
    console.warn('[QQ同步] 自动发现邮箱文件夹失败，改用手动配置：', error?.message || error);
  }

  if (!selected.size) selected.add('INBOX');
  const mailboxList = Array.from(selected);
  return wantsAll ? mailboxList : mailboxList.slice(0, 60);
}

async function fetchLatestMessages({ client, mailboxText, maxMessages, lookbackDays, dateScope, autoDiscover }) {
  const mailboxes = await resolveMailboxesToScan({ client, mailboxText, autoDiscover });
  console.log(`[QQ同步] 扫描文件夹：${mailboxes.join(', ')}`);
  const allRows = [];
  for (const mailbox of mailboxes) {
    try {
      const rows = await fetchLatestMessagesFromMailbox({ client, mailbox, maxMessages, lookbackDays, dateScope });
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

function safeIsoSecond(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 19);
}

function buildFinanceDedupKey(row) {
  const businessType = String(row?.business_type || '').trim();
  const bank = String(row?.card_bank || row?.swipe_card_bank || '').trim();
  const amount = Number(row?.amount || 0);
  const amountText = Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
  const timestamp = safeIsoSecond(row?.transaction_date);
  if (businessType === 'credit_card_repayment') {
    const monthText = timestamp ? timestamp.slice(0, 7) : '';
    return [businessType, bank, amountText, monthText].join('|');
  }
  return [businessType, bank, amountText, timestamp].join('|');
}

async function fetchExistingDedupKeys(supabase, userId, candidateRows) {
  if (!Array.isArray(candidateRows) || !candidateRows.length) return new Set();
  const since = candidateRows
    .map((row) => new Date(row?.transaction_date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const sinceIso = since ? new Date(since.getTime() - 24 * 60 * 60 * 1000).toISOString() : null;

  let query = supabase
    .from('erp_finances')
    .select('business_type, card_bank, swipe_card_bank, amount, transaction_date, description')
    .eq('user_id', userId)
    .in('business_type', ['credit_card_repayment', 'credit_card_swipe']);
  if (sinceIso) query = query.gte('transaction_date', sinceIso);
  const { data, error } = await query;
  if (error) throw error;

  const keys = new Set();
  (data || []).forEach((item) => {
    const desc = String(item?.description || '');
    if (!desc.includes('QQ邮箱自动同步')) return;
    keys.add(buildFinanceDedupKey(item));
  });
  return keys;
}

async function fetchExistingSyncedRowsByDedup(supabase, userId, candidateRows) {
  if (!Array.isArray(candidateRows) || !candidateRows.length) return new Map();
  const since = candidateRows
    .map((row) => new Date(row?.transaction_date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const sinceIso = since ? new Date(since.getTime() - 24 * 60 * 60 * 1000).toISOString() : null;

  let query = supabase
    .from('erp_finances')
    .select('id, business_type, card_bank, swipe_card_bank, amount, transaction_date, card_bill_day, card_repayment_day, description')
    .eq('user_id', userId)
    .in('business_type', ['credit_card_repayment', 'credit_card_swipe']);
  if (sinceIso) query = query.gte('transaction_date', sinceIso);

  const { data, error } = await query;
  if (error) throw error;
  const map = new Map();
  (data || []).forEach((item) => {
    const desc = String(item?.description || '');
    if (!desc.includes('QQ邮箱自动同步')) return;
    const key = buildFinanceDedupKey(item);
    if (!key || map.has(key)) return;
    map.set(key, item);
  });
  return map;
}

function pickBestDuplicateRow(rows) {
  const scored = rows
    .map((row) => {
      let score = 0;
      if (row.card_bill_day) score += 2;
      if (row.card_repayment_day) score += 2;
      if (row.card_bill_day && row.card_repayment_day && Number(row.card_bill_day) !== Number(row.card_repayment_day)) {
        score += 2;
      }
      if (row.card_bill_day && row.card_repayment_day && Number(row.card_bill_day) === Number(row.card_repayment_day)) {
        score -= 2;
      }
      if (String(row.description || '').includes('应还')) score += 1;
      if (String(row.description || '').includes('账单日')) score += 1;
      return { row, score };
    })
    .sort((a, b) => b.score - a.score || Number(b.row.id) - Number(a.row.id));
  return scored[0]?.row || rows[0] || null;
}

async function cleanupSyncedDuplicatesForUser(supabase, userId) {
  const sinceDate = new Date();
  sinceDate.setFullYear(sinceDate.getFullYear() - 1);
  const { data, error } = await supabase
    .from('erp_finances')
    .select('id, business_type, card_bank, swipe_card_bank, amount, transaction_date, card_bill_day, card_repayment_day, description, created_at')
    .eq('user_id', userId)
    .in('business_type', ['credit_card_repayment', 'credit_card_swipe'])
    .gte('transaction_date', sinceDate.toISOString())
    .order('created_at', { ascending: false });
  if (error) throw error;

  const grouped = new Map();
  (data || []).forEach((row) => {
    const desc = String(row?.description || '');
    if (!desc.includes('QQ邮箱自动同步')) return;
    const key = buildFinanceDedupKey(row);
    if (!key) return;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  });

  const deleteIds = [];
  const patchRows = [];
  for (const rows of grouped.values()) {
    if (!Array.isArray(rows) || rows.length <= 1) continue;
    const keeper = pickBestDuplicateRow(rows);
    if (!keeper) continue;
    const candidates = rows.filter((row) => String(row.id) !== String(keeper.id));
    candidates.forEach((row) => deleteIds.push(row.id));

    const fallbackBill = keeper.card_bill_day || rows.find((row) => row.card_bill_day)?.card_bill_day || null;
    const fallbackRepay = keeper.card_repayment_day || rows.find((row) => row.card_repayment_day)?.card_repayment_day || null;
    if ((fallbackBill && !keeper.card_bill_day) || (fallbackRepay && !keeper.card_repayment_day)) {
      patchRows.push({
        id: keeper.id,
        card_bill_day: fallbackBill || null,
        card_repayment_day: fallbackRepay || null
      });
    }
  }

  for (const patch of patchRows) {
    const { error: patchError } = await supabase
      .from('erp_finances')
      .update({
        card_bill_day: patch.card_bill_day,
        card_repayment_day: patch.card_repayment_day
      })
      .eq('id', patch.id);
    if (patchError) throw patchError;
  }

  if (deleteIds.length) {
    const chunkSize = 100;
    for (let index = 0; index < deleteIds.length; index += chunkSize) {
      const chunk = deleteIds.slice(index, index + chunkSize);
      const { error: deleteError } = await supabase
        .from('erp_finances')
        .delete()
        .in('id', chunk);
      if (deleteError) throw deleteError;
    }
  }

  return {
    removed: deleteIds.length,
    patched: patchRows.length
  };
}

async function cleanupSuspiciousSyncedRows(supabase, userId) {
  const sinceDate = new Date();
  sinceDate.setFullYear(sinceDate.getFullYear() - 2);
  const { data, error } = await supabase
    .from('erp_finances')
    .select('id, amount, description, business_type')
    .eq('user_id', userId)
    .in('business_type', ['credit_card_repayment', 'credit_card_swipe'])
    .gte('transaction_date', sinceDate.toISOString());
  if (error) throw error;

  const suspiciousIds = (data || [])
    .filter((row) => String(row?.description || '').includes('QQ邮箱自动同步'))
    .filter((row) => Number(row?.amount || 0) > 10_000_000)
    .map((row) => row.id);

  if (!suspiciousIds.length) {
    return { removed: 0 };
  }

  const chunkSize = 100;
  for (let index = 0; index < suspiciousIds.length; index += chunkSize) {
    const chunk = suspiciousIds.slice(index, index + chunkSize);
    const { error: deleteError } = await supabase
      .from('erp_finances')
      .delete()
      .in('id', chunk);
    if (deleteError) throw deleteError;
  }
  return { removed: suspiciousIds.length };
}

async function cleanupCurrentMonthSyncedRows(supabase, userId, keepReferenceIds = []) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  const keepSet = new Set(
    (Array.isArray(keepReferenceIds) ? keepReferenceIds : [])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  );
  const { data, error } = await supabase
    .from('erp_finances')
    .select('id, reference_id, description')
    .eq('user_id', userId)
    .in('business_type', ['credit_card_repayment', 'credit_card_swipe'])
    .gte('transaction_date', monthStart.toISOString())
    .lt('transaction_date', nextMonthStart.toISOString());
  if (error) throw error;

  const deleteIds = (data || [])
    .filter((row) => String(row?.description || '').includes('QQ邮箱自动同步'))
    .filter((row) => !keepSet.has(String(row?.reference_id || '').trim()))
    .map((row) => row.id);

  if (!deleteIds.length) {
    return { removed: 0 };
  }
  const chunkSize = 100;
  for (let index = 0; index < deleteIds.length; index += chunkSize) {
    const chunk = deleteIds.slice(index, index + chunkSize);
    const { error: deleteError } = await supabase
      .from('erp_finances')
      .delete()
      .in('id', chunk);
    if (deleteError) throw deleteError;
  }
  return { removed: deleteIds.length };
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

function shouldRetryImapError(error) {
  const message = String(error?.message || '').toLowerCase();
  const responseText = String(error?.responseText || '').toLowerCase();
  const source = `${message} ${responseText}`;
  if (!source) return false;
  if (source.includes('login frequency limited')) return true;
  if (source.includes('system is busy')) return true;
  if (source.includes('timeout')) return true;
  if (source.includes('connection closed')) return true;
  if (source.includes('socket hang up')) return true;
  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
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
  dateScope,
  maxMessages,
  reminderDaysBefore,
  dryRun,
  keywordList,
  excludeKeywords,
  autoDiscoverMailbox,
  imapVerboseLog
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

    console.log(`[QQ同步][${userId}] 启动：邮箱=${email}, 范围=${dateScope === 'current_month' ? '当月' : `最近${lookbackDays}天`}, 来源=${credential.source}`);
    let messages = [];
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const clientOptions = {
        host,
        port,
        secure: true,
        auth: {
          user: email,
          pass: password
        }
      };
      if (!imapVerboseLog) {
        clientOptions.logger = false;
      }
      client = new ImapFlow(clientOptions);
      try {
        await client.connect();
        clientConnected = true;
        messages = await fetchLatestMessages({
          client,
          mailboxText,
          maxMessages,
          lookbackDays,
          dateScope,
          autoDiscover: autoDiscoverMailbox
        });
        await client.logout();
        clientConnected = false;
        break;
      } catch (imapError) {
        if (clientConnected && client) {
          try {
            await client.logout();
          } catch (_closeErr) {
          }
        }
        clientConnected = false;
        if (attempt < maxAttempts && shouldRetryImapError(imapError)) {
          const waitMs = 15000 * attempt;
          console.warn(`[QQ同步][${userId}] IMAP连接失败，${waitMs / 1000}秒后重试（第${attempt + 1}次）`);
          await sleep(waitMs);
          continue;
        }
        throw imapError;
      }
    }

    console.log(`[QQ同步][${userId}] 拉取邮件数量：${messages.length}`);

    const parsedRows = [];
    let skippedByKeyword = 0;
    let parseFailed = 0;
    const parseFailedSubjects = [];
    const keywordSkippedMessages = [];

    for (const mail of messages) {
      if (!hasCreditCardKeywords(mail.subject, mail.bodyText, mail.fromText, keywordList, excludeKeywords)) {
        skippedByKeyword += 1;
        keywordSkippedMessages.push(mail);
        continue;
      }
      const row = parseMailToFinance({
        userId,
        uid: mail.uid,
        messageId: mail.messageId,
        subject: mail.subject,
        fromText: mail.fromText,
        bodyText: mail.bodyText,
        parsedDate: mail.date,
        reminderDaysBefore
      });
      if (!row) {
        parseFailed += 1;
        parseFailedSubjects.push(mail.subject || '(无主题)');
        if (/(中信银行信用卡|citiccard\.com|电子账单)/i.test(`${mail.subject}\n${mail.fromText}\n${mail.bodyText}`)) {
          const snippet = String(mail.bodyText || '').slice(0, 260).replace(/\s+/g, ' ');
          console.log(`[QQ同步][${userId}] 中信解析失败调试：主题=${String(mail.subject || '').replace(/\s+/g, ' ')}；片段=${snippet}`);
        }
        continue;
      }
      parsedRows.push({
        ...row,
        user_id: userId
      });
    }

    if (keywordSkippedMessages.length) {
      let fallbackParsed = 0;
      const parsedRefSet = new Set(parsedRows.map((item) => String(item?.reference_id || '').trim()).filter(Boolean));
      for (const mail of keywordSkippedMessages) {
        const row = parseMailToFinance({
          userId,
          uid: mail.uid,
          messageId: mail.messageId,
          subject: mail.subject,
          fromText: mail.fromText,
          bodyText: mail.bodyText,
          parsedDate: mail.date,
          reminderDaysBefore
        });
        if (!row) continue;
        const ref = String(row.reference_id || '').trim();
        if (ref && parsedRefSet.has(ref)) continue;
        if (ref) parsedRefSet.add(ref);
        fallbackParsed += 1;
        parsedRows.push({
          ...row,
          user_id: userId
        });
      }
      if (fallbackParsed > 0) {
        console.log(`[QQ同步][${userId}] 关键词补充解析命中：${fallbackParsed} 条`);
      }
    }

    if (parseFailedSubjects.length) {
      const failedPreview = parseFailedSubjects
        .slice(0, 10)
        .map((item) => String(item || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join(' | ');
      if (failedPreview) {
        console.log(`[QQ同步][${userId}] 解析失败样例：${failedPreview}`);
      }
    }

    const skippedPreview = keywordSkippedMessages
      .slice(0, 8)
      .map((mail) => String(mail.subject || '(无主题)').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' | ');
    if (skippedPreview) {
      console.log(`[QQ同步][${userId}] 关键词跳过样例：${skippedPreview}`);
    }

    if (!parsedRows.length) {
      const skippedPreview = keywordSkippedMessages
        .slice(0, 5)
        .map((mail) => String(mail.subject || '(无主题)').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join(' | ');
      if (skippedPreview) {
        console.log(`[QQ同步][${userId}] 关键词跳过样例：${skippedPreview}`);
      }
      syncStatus = 'partial';
      syncMessage = `无可导入账单（关键词跳过${skippedByKeyword}，解析失败${parseFailed}）。请确认账单邮件是否为文本内容（非纯图片/PDF）`;
      console.log(`[QQ同步][${userId}] ${syncMessage}`);
      return { userId, ok: true, syncStatus, syncMessage };
    }

    const refs = parsedRows.map((item) => item.reference_id).filter(Boolean);
    const existingRefs = await fetchExistingReferenceIds(supabase, userId, refs);
    const existingDedupKeys = await fetchExistingDedupKeys(supabase, userId, parsedRows);
    const existingRowsByDedup = await fetchExistingSyncedRowsByDedup(supabase, userId, parsedRows);
    const updateRows = [];
    const insertRows = parsedRows.filter((item) => {
      const referenceExists = existingRefs.has(String(item.reference_id || ''));
      if (referenceExists) return false;
      const dedupKey = buildFinanceDedupKey(item);
      if (dedupKey && existingDedupKeys.has(dedupKey)) {
        const existing = existingRowsByDedup.get(dedupKey);
        if (existing) {
          const nextBillDay = item.card_bill_day || null;
          const nextRepaymentDay = item.card_repayment_day || null;
          const changed = (
            (nextBillDay && Number(nextBillDay) !== Number(existing.card_bill_day || 0))
            || (nextRepaymentDay && Number(nextRepaymentDay) !== Number(existing.card_repayment_day || 0))
          );
          if (changed) {
            updateRows.push({
              id: existing.id,
              card_bill_day: nextBillDay || existing.card_bill_day || null,
              card_repayment_day: nextRepaymentDay || existing.card_repayment_day || null
            });
          }
        }
        return false;
      }
      return true;
    });

    if (!insertRows.length) {
      let patchedExisting = 0;
      const dedupedUpdates = new Map();
      updateRows.forEach((row) => {
        if (!row?.id) return;
        dedupedUpdates.set(String(row.id), row);
      });
      for (const row of dedupedUpdates.values()) {
        const { error: patchError } = await supabase
          .from('erp_finances')
          .update({
            card_bill_day: row.card_bill_day,
            card_repayment_day: row.card_repayment_day
          })
          .eq('id', row.id);
        if (!patchError) patchedExisting += 1;
      }
      const cleanupResult = await cleanupSyncedDuplicatesForUser(supabase, userId);
      const suspiciousCleanup = await cleanupSuspiciousSyncedRows(supabase, userId);
      syncStatus = 'partial';
      syncMessage = `无新增（已存在${existingRefs.size}条），更新日期${patchedExisting}，去重删除${cleanupResult.removed}，异常清理${suspiciousCleanup.removed}，补全日期${cleanupResult.patched}`;
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
    let patchedExisting = 0;
    const dedupedUpdates = new Map();
    updateRows.forEach((row) => {
      if (!row?.id) return;
      dedupedUpdates.set(String(row.id), row);
    });
    for (const row of dedupedUpdates.values()) {
      const { error: patchError } = await supabase
        .from('erp_finances')
        .update({
          card_bill_day: row.card_bill_day,
          card_repayment_day: row.card_repayment_day
        })
        .eq('id', row.id);
      if (!patchError) patchedExisting += 1;
    }
    const cleanupResult = await cleanupSyncedDuplicatesForUser(supabase, userId);
    const suspiciousCleanup = await cleanupSuspiciousSyncedRows(supabase, userId);
    syncStatus = inserted > 0 ? 'success' : 'partial';
    syncMessage = `解析${parsedRows.length}，新增${inserted}，更新日期${patchedExisting}，关键词跳过${skippedByKeyword}，解析失败${parseFailed}，去重删除${cleanupResult.removed}，异常清理${suspiciousCleanup.removed}，补全日期${cleanupResult.patched}`;
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
  const dateScope = String(process.env.QQ_SYNC_DATE_SCOPE || '').trim().toLowerCase() === 'current_month'
    ? 'current_month'
    : 'lookback';
  const lookbackDays = Math.max(0, toInt(process.env.QQ_SYNC_LOOKBACK_DAYS, 120));
  const maxMessages = Math.max(20, toInt(process.env.QQ_SYNC_MAX_MESSAGES, 1200));
  const reminderDaysBefore = Math.max(0, toInt(process.env.QQ_SYNC_REMINDER_DAYS_BEFORE, 3));
  const autoDiscoverMailbox = !['0', 'false', 'no'].includes(String(process.env.QQ_MAILBOX_AUTO_DISCOVER || 'true').toLowerCase());
  const imapVerboseLog = ['1', 'true', 'yes'].includes(String(process.env.QQ_IMAP_VERBOSE_LOG || '').toLowerCase());
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
  const failureMessages = [];

  for (const userId of userIds) {
    const result = await syncOneUser({
      supabaseUrl,
      supabase,
      userId,
      mailboxText,
      lookbackDays,
      dateScope,
      maxMessages,
      reminderDaysBefore,
      dryRun,
      keywordList,
      excludeKeywords,
      autoDiscoverMailbox,
      imapVerboseLog
    });
    if (result.syncStatus === 'success') successCount += 1;
    else if (result.syncStatus === 'partial') partialCount += 1;
    else {
      failedCount += 1;
      failureMessages.push(`[${result.userId}]${result.syncMessage}`);
    }
  }

  console.log(`[QQ同步] 总结：成功${successCount}，部分成功${partialCount}，失败${failedCount}`);
  if (failedCount > 0 && successCount === 0 && partialCount === 0) {
    const reason = failureMessages.length ? `：${failureMessages.join('；')}` : '';
    throw new Error(`全部账号同步失败（${failedCount}）${reason}`);
  }
}

main().catch((error) => {
  console.error('[QQ同步] 失败:', error);
  process.exitCode = 1;
});
