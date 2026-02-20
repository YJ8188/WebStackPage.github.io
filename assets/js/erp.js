/**
 * ERP 系统模块
 * 功能：客户管理、产品管理、订单管理、库存管理、财务管理
 * 作者：何哥
 * 版本：1.0.0
 */

// 兼容兜底：防止旧缓存脚本缺少 parseERPDate 导致统计面板报错
if (typeof window !== 'undefined') {
    if (typeof window.parseFinanceDate !== 'function') {
        window.parseFinanceDate = function parseFinanceDateFallback(value) {
            if (value instanceof Date) {
                return Number.isNaN(value.getTime()) ? null : value;
            }
            const raw = String(value || '').trim();
            if (!raw) {
                return null;
            }
            const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
            const date = new Date(normalized);
            return Number.isNaN(date.getTime()) ? null : date;
        };
    }
    if (typeof window.parseERPDate !== 'function') {
        window.parseERPDate = function parseERPDateFallback(value) {
            return window.parseFinanceDate(value);
        };
    }
}

const ERP = {
    // ==================== 配置 ====================
    config: {
        currentModule: 'dashboard', // 当前模块：dashboard, customers, products, orders, inventory, finance
        itemsPerPage: 10, // 每页显示数量
        requestTimeout: 30000, // 请求超时时间（毫秒）
    },

    runtime: {
        initPromise: null,
        initializedUserId: null,
        auditLogDisabled: false,
        orderMutationInProgress: false
    },

    orderStatusMeta: {
        pending: { text: '待处理' },
        confirmed: { text: '已确认' },
        shipped: { text: '已发货' },
        signed: { text: '已签收' },
        completed: { text: '已完成' },
        refunded: { text: '已退款' },
        cancelled: { text: '已取消' }
    },

    orderStatusTransitions: {
        pending: ['confirmed', 'cancelled'],
        confirmed: ['shipped', 'signed', 'completed', 'cancelled'],
        shipped: ['signed', 'refunded'],
        signed: ['completed', 'refunded'],
        completed: [],
        refunded: [],
        cancelled: []
    },

    // ==================== 工具函数 ====================
    /**
     * 为 Promise 添加超时处理
     * @param {Promise} promise - 要执行的 Promise
     * @param {number} timeout - 超时时间（毫秒）
     * @returns {Promise} 带超时的 Promise
     */
    withTimeout(promise, timeout = this.config.requestTimeout) {
        return Promise.race([
            promise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('请求超时，请检查网络连接')), timeout)
            )
        ]);
    },

    emitEvent(name, detail = {}) {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(name, { detail }));
        }
    },

    normalizeOrderStatus(status) {
        const raw = String(status || '').trim().toLowerCase();
        const legacyMap = {
            processing: 'confirmed'
        };
        const normalized = legacyMap[raw] || raw || 'pending';
        return Object.prototype.hasOwnProperty.call(this.orderStatusMeta, normalized) ? normalized : 'pending';
    },

    getOrderAllowedTransitions(currentStatus) {
        const normalizedCurrent = this.normalizeOrderStatus(currentStatus);
        return this.orderStatusTransitions[normalizedCurrent] || [];
    },

    ensureOrderStatusTransition(currentStatus, targetStatus) {
        const from = this.normalizeOrderStatus(currentStatus);
        const to = this.normalizeOrderStatus(targetStatus);

        if (from === to) {
            return to;
        }

        const allowed = this.getOrderAllowedTransitions(from);
        if (!allowed.includes(to)) {
            const fromText = this.orderStatusMeta[from]?.text || from;
            const toText = this.orderStatusMeta[to]?.text || to;
            const allowedText = allowed.map(item => this.orderStatusMeta[item]?.text || item).join('、') || '无';
            throw new Error(`订单状态不允许从「${fromText}」变更为「${toText}」，允许流转：${allowedText}`);
        }

        return to;
    },

    isSameId(left, right) {
        if (left === null || left === undefined || right === null || right === undefined) {
            return false;
        }
        return String(left) === String(right);
    },

    getConfiguredAdminEmails() {
        const values = [];
        const append = (source) => {
            if (!source) return;
            if (Array.isArray(source)) {
                source.forEach(item => append(item));
                return;
            }
            if (typeof source === 'string') {
                source
                    .split(/[\n,;，；\s]+/)
                    .map(item => String(item || '').trim().toLowerCase())
                    .filter(Boolean)
                    .forEach(item => values.push(item));
                return;
            }
            if (typeof source === 'object') {
                append(source.erpAdminEmails);
                append(source.adminEmails);
            }
        };

        append(typeof window !== 'undefined' ? window.ERP_ADMIN_EMAILS : null);
        append(userData?.config?.erpAdminEmails);
        append(userData?.config?.adminEmails);

        try {
            if (typeof localStorage !== 'undefined') {
                append(localStorage.getItem('erp_admin_emails'));
            }
        } catch (error) {
            console.warn('[ERP] 读取管理员配置失败:', error?.message || error);
        }

        return Array.from(new Set(values));
    },

    isCurrentUserAdmin() {
        const email = String(userData?.user?.email || '').trim().toLowerCase();
        const adminEmails = this.getConfiguredAdminEmails();
        if (!adminEmails.length) {
            return true;
        }
        if (!email) {
            return false;
        }
        return adminEmails.includes(email);
    },

    sanitizeAuditData(value) {
        try {
            if (value === null || value === undefined) {
                return {};
            }

            if (typeof value === 'string') {
                return { message: value };
            }

            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            return {
                fallback: String(value),
                sanitizeError: String(error?.message || error)
            };
        }
    },

    parseAuditDetails(value) {
        if (value === null || value === undefined) {
            return {};
        }

        if (typeof value === 'object') {
            return this.sanitizeAuditData(value);
        }

        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) {
                return {};
            }
            try {
                return this.sanitizeAuditData(JSON.parse(trimmed));
            } catch (error) {
                return { message: trimmed };
            }
        }

        return this.sanitizeAuditData(value);
    },

    isAuditTableMissingError(error) {
        const message = String(error?.message || '').toLowerCase();
        return error?.code === '42P01'
            || (message.includes('relation') && message.includes('erp_audit_logs') && message.includes('does not exist'));
    },

    isAuditColumnMissingError(error) {
        const message = String(error?.message || '').toLowerCase();
        return error?.code === '42703'
            || (message.includes('column') && message.includes('does not exist'));
    },

    logAudit(payload) {
        this.addAuditLog(payload).catch((error) => {
            console.error('[ERP审计] 异步写入失败:', error);
        });
    },

    async addAuditLog(payload = {}) {
        if (this.runtime.auditLogDisabled) {
            return false;
        }

        if (!userData?.isLoggedIn || !userData?.user?.id || !window.supabaseClient) {
            return false;
        }

        const now = new Date().toISOString();
        const moduleName = String(payload.module || 'system');
        const action = String(payload.action || 'unknown');
        const entityType = String(payload.entityType || moduleName);
        const entityId = payload.entityId ?? null;
        const entityName = String(payload.entityName || '');
        const details = this.sanitizeAuditData(payload.details);
        const description = String(
            payload.description
            || `${moduleName} ${action}${entityName ? `: ${entityName}` : (entityId !== null ? `#${entityId}` : '')}`
        );

        const basePayload = {
            user_id: userData.user.id,
            module: moduleName,
            action,
            entity_type: entityType,
            entity_id: entityId === null ? null : String(entityId),
            entity_name: entityName,
            description,
            details,
            created_at: now
        };

        const candidates = [
            basePayload,
            { ...basePayload, details: JSON.stringify(details) },
            { ...basePayload, entity_name: undefined, details: undefined },
            {
                user_id: userData.user.id,
                module: moduleName,
                action,
                description,
                created_at: now
            },
            {
                user_id: userData.user.id,
                action,
                description
            }
        ];

        for (const rawCandidate of candidates) {
            const candidate = Object.fromEntries(
                Object.entries(rawCandidate).filter(([, value]) => value !== undefined)
            );

            const { error } = await supabaseClient
                .from('erp_audit_logs')
                .insert([candidate]);

            if (!error) {
                return true;
            }

            if (this.isAuditTableMissingError(error)) {
                this.runtime.auditLogDisabled = true;
                console.warn('[ERP审计] 未检测到 erp_audit_logs 表，已自动关闭审计写入');
                return false;
            }

            if (this.isAuditColumnMissingError(error)) {
                continue;
            }

            console.error('[ERP审计] 写入失败:', error);
            return false;
        }

        return false;
    },

    async loadOrderApprovalLogs(orderId, limit = 50) {
        if (!userData?.isLoggedIn || !userData?.user?.id || !window.supabaseClient) {
            return [];
        }

        const normalizedOrderId = orderId === null || orderId === undefined ? '' : String(orderId);
        if (!normalizedOrderId) {
            return [];
        }
        const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
        const currentOrder = this.state.orders.find(order => this.isSameId(order.id, normalizedOrderId));
        const currentOrderNumber = String(currentOrder?.order_number || '').trim();

        const queryPlans = [
            {
                select: 'id,module,action,entity_type,entity_id,entity_name,description,details,created_at,user_id',
                filters: [
                    ['user_id', userData.user.id],
                    ['module', 'orders'],
                    ['action', 'update_status'],
                    ['entity_type', 'order'],
                    ['entity_id', normalizedOrderId]
                ]
            },
            {
                select: 'id,module,action,entity_type,entity_id,entity_name,description,details,created_at,user_id',
                filters: [
                    ['user_id', userData.user.id],
                    ['module', 'orders'],
                    ['action', 'update_status']
                ]
            },
            {
                select: 'id,module,action,entity_id,entity_name,description,details,created_at,user_id',
                filters: [
                    ['user_id', userData.user.id],
                    ['action', 'update_status']
                ]
            },
            {
                select: 'id,module,action,entity_id,description,details,created_at',
                filters: [
                    ['action', 'update_status']
                ]
            },
            {
                select: '*',
                filters: [
                    ['action', 'update_status']
                ]
            }
        ];

        let rows = [];
        let lastError = null;

        for (const plan of queryPlans) {
            let query = supabaseClient
                .from('erp_audit_logs')
                .select(plan.select)
                .order('created_at', { ascending: false })
                .limit(Math.min(safeLimit * 3, 300));

            for (const [field, value] of plan.filters) {
                query = query.eq(field, value);
            }

            const { data, error } = await this.withTimeout(query, this.config.requestTimeout);
            if (!error) {
                rows = Array.isArray(data) ? data : [];
                lastError = null;
                break;
            }

            if (this.isAuditTableMissingError(error)) {
                return [];
            }

            if (this.isAuditColumnMissingError(error)) {
                lastError = error;
                continue;
            }

            lastError = error;
            continue;
        }

        if (!rows.length) {
            if (lastError) {
                console.warn('[ERP审计] 订单审批记录查询使用了降级策略:', lastError?.message || lastError);
            }
            return [];
        }

        const normalizedRows = rows.map((row, index) => {
            const details = this.parseAuditDetails(row?.details);
            const beforeStatus = this.normalizeOrderStatus(details?.before?.status || details?.from_status || row?.from_status || '');
            const toStatus = this.normalizeOrderStatus(details?.after?.status || details?.to_status || row?.to_status || '');
            const approvalMeta = this.parseAuditDetails(details?.approval);
            const actionLabel = String(approvalMeta?.action_label || details?.action_label || '').trim();
            const remark = String(approvalMeta?.remark || details?.remark || details?.note || '').trim();
            const operator = String(
                approvalMeta?.operator
                || details?.operator
                || details?.operator_name
                || row?.operator
                || row?.user_email
                || row?.user_id
                || ''
            ).trim();
            const createdAt = row?.created_at || row?.createdAt || row?.updated_at || '';
            let actionText = actionLabel || '状态变更';

            if (!actionLabel) {
                if (beforeStatus === 'pending' && toStatus === 'confirmed') {
                    actionText = '订单审批通过';
                } else if (beforeStatus === 'pending' && toStatus === 'cancelled') {
                    actionText = '订单审批驳回';
                } else if (toStatus === 'refunded') {
                    actionText = '退款审批';
                }
            }

            return {
                id: row?.id || `approval_${index}`,
                orderId: row?.entity_id ?? details?.order_id ?? details?.before?.id ?? details?.after?.id ?? null,
                description: String(row?.description || ''),
                createdAt,
                actionText,
                operator,
                remark,
                fromStatus: beforeStatus,
                toStatus,
                fromStatusText: this.orderStatusMeta[beforeStatus]?.text || beforeStatus || '-',
                toStatusText: this.orderStatusMeta[toStatus]?.text || toStatus || '-',
                details
            };
        });

        const filtered = normalizedRows.filter(item => {
            const matchByEntityId = this.isSameId(item.orderId, normalizedOrderId);
            const matchByDescriptionHash = !!normalizedOrderId && item.description.includes(`#${normalizedOrderId}`);
            const matchByOrderNumber = !!currentOrderNumber && item.description.includes(currentOrderNumber);
            return matchByEntityId || matchByDescriptionHash || matchByOrderNumber;
        });

        const candidateRows = normalizedOrderId ? filtered : (filtered.length > 0 ? filtered : normalizedRows);
        const finalRows = candidateRows
            .sort((left, right) => {
                const leftTime = new Date(left.createdAt || 0).getTime();
                const rightTime = new Date(right.createdAt || 0).getTime();
                return rightTime - leftTime;
            })
            .slice(0, safeLimit);

        return finalRows;
    },

    // ==================== 状态 ====================
    state: {
        customers: [],
        products: [],
        orders: [],
        finances: [],
        currentCustomerId: null,
        currentProductId: null,
        currentOrderId: null,
        cart: [], // 购物车（用于创建订单）
        // 加载状态标记
        loaded: {
            customers: false,
            products: false,
            orders: false,
            finances: false
        }
    },

    // ==================== 初始化 ====================
    async init() {
        // 检查用户登录状态
        if (!userData.isLoggedIn) {
            return;
        }

        const currentUserId = userData?.user?.id || null;

        if (this.runtime.initPromise) {
            return this.runtime.initPromise;
        }

        if (this.runtime.initializedUserId && this.runtime.initializedUserId === currentUserId) {
            return;
        }

        this.runtime.initPromise = (async () => {
            try {
                // 初始化时只加载统计数据，不加载详细数据
                await this.loadStatisticsOnly();
                this.runtime.initializedUserId = currentUserId;
            } finally {
                this.runtime.initPromise = null;
            }
        })();

        return this.runtime.initPromise;
    },

    // ==================== 只加载统计数据（快速初始化） ====================
    async loadStatisticsOnly() {
        try {
            const shouldKeepFullCustomers = this.state.loaded.customers && Array.isArray(this.state.customers) && this.state.customers.length > 0;

            // 只加载统计数据，不加载详细记录
            let [customers, products, orders, finances] = await Promise.all([
                shouldKeepFullCustomers ? Promise.resolve(this.state.customers) : this.loadCustomers({ lite: true }),
                this.loadProducts(true),
                this.loadOrders(true),
                this.loadFinances(true)
            ]);

            if (!shouldKeepFullCustomers) {
                this.state.customers = customers;
            } else {
                customers = this.state.customers;
            }
            this.state.products = products;
            this.state.orders = orders;
            this.state.finances = finances;

            // 触发数据加载完成事件
            window.dispatchEvent(new CustomEvent('erpDataLoaded', {
                detail: {
                    customers,
                    products,
                    orders,
                    finances
                }
            }));
        } catch (error) {
            console.error('[ERP] 加载统计数据失败:', error);
        }
    },

    // ==================== 数据加载 ====================
    async loadAllData() {
        try {
            // 并行加载所有数据
            const [customers, products, orders, finances] = await Promise.all([
                this.loadCustomers(),
                this.loadProducts(),
                this.loadOrders(),
                this.loadFinances()
            ]);

            this.state.customers = customers;
            this.state.products = products;
            this.state.orders = orders;
            this.state.finances = finances;

            // 触发数据加载完成事件
            window.dispatchEvent(new CustomEvent('erpDataLoaded', {
                detail: {
                    customers,
                    products,
                    orders,
                    finances
                }
            }));

        } catch (error) {
            console.error('[ERP] 加载数据失败:', error);
            if (typeof showToast === 'function') {
                showToast('加载数据失败，请刷新页面重试', 'error');
            }
        }
    },

    // ==================== 按需加载数据 ====================
    async loadCustomers(options = false) {
        let lite = false;
        let forceRefresh = false;

        if (typeof options === 'object' && options !== null) {
            lite = !!options.lite;
            forceRefresh = !!options.forceRefresh;
        } else {
            lite = options === true;
        }

        if (forceRefresh) {
            this.state.loaded.customers = false;
        }
        // 如果已加载且不是强制刷新，直接返回缓存
        if (this.state.loaded.customers && !forceRefresh) {
            return this.state.customers;
        }

        try {
            // 轻量模式只加载必要字段
            const selectFields = lite ? 'id, name, status' : '*';

            const { data, error } = await supabaseClient
                .from('erp_customers')
                .select(selectFields)
                .eq('user_id', userData.user.id)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            this.state.customers = data || [];
            this.state.loaded.customers = !lite;
            return this.state.customers;

        } catch (error) {
            console.error('[ERP] 加载客户数据失败:', error);
            return [];
        }
    },

    async loadProducts(options = false) {
        let lite = false;
        let forceRefresh = false;

        if (typeof options === 'object' && options !== null) {
            lite = !!options.lite;
            forceRefresh = !!options.forceRefresh;
        } else {
            lite = options === true;
        }

        if (forceRefresh) {
            this.state.loaded.products = false;
        }

        // 如果已加载且不是强制刷新，直接返回缓存
        if (this.state.loaded.products && !lite && !forceRefresh) {
            return this.state.products;
        }

        try {
            // 轻量模式只加载必要字段
            const selectFields = lite ? 'id, name, sku, category, unit, price, cost, stock_quantity, min_stock, status' : '*';

            const { data, error } = await supabaseClient
                .from('erp_products')
                .select(selectFields)
                .eq('user_id', userData.user.id)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            this.state.products = data || [];
            this.state.loaded.products = !lite;
            return this.state.products;

        } catch (error) {
            console.error('[ERP] 加载产品数据失败:', error);
            return [];
        }
    },

    async loadOrders(lite = false) {
        // 如果已加载且不是强制刷新，直接返回缓存
        if (this.state.loaded.orders && !lite) {
            return this.state.orders;
        }

        try {
            const selectFields = lite
                ? 'id, user_id, customer_id, order_number, order_date, total_amount, total_cost, net_profit, status, payment_status, shipping_status, shipping_company, tracking_number'
                : '*, customer:erp_customers(id, name, contact_person), items:erp_order_items(*)';

            const { data, error } = await supabaseClient
                .from('erp_orders')
                .select(selectFields)
                .eq('user_id', userData.user.id)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            this.state.orders = data || [];
            this.state.loaded.orders = !lite;
            return this.state.orders;

        } catch (error) {
            console.error('[ERP] 加载订单数据失败:', error);
            return [];
        }
    },

    async loadOrderDetail(orderId) {
        try {
            const { data, error } = await supabaseClient
                .from('erp_orders')
                .select('*, customer:erp_customers(id, name, contact_person), items:erp_order_items(*)')
                .eq('id', orderId)
                .eq('user_id', userData.user.id)
                .single();

            if (error) {
                throw error;
            }

            if (data) {
                const index = this.state.orders.findIndex(order => this.isSameId(order.id, data.id));
                if (index >= 0) {
                    this.state.orders[index] = data;
                } else {
                    this.state.orders.unshift(data);
                }
            }

            return data || null;
        } catch (error) {
            console.error('[ERP] 加载订单详情失败:', error);
            return null;
        }
    },

    async loadFinances(lite = false) {
        // 如果已加载且不是强制刷新，直接返回缓存
        if (this.state.loaded.finances && !lite) {
            return this.state.finances;
        }

        try {
            const selectFields = lite
                ? 'id, user_id, type, category, amount, description, reference_id, order_id, transaction_date'
                : '*';

            const { data, error } = await supabaseClient
                .from('erp_finances')
                .select(selectFields)
                .eq('user_id', userData.user.id)
                .order('transaction_date', { ascending: false });

            if (error) {
                throw error;
            }

            this.state.finances = data || [];
            this.state.loaded.finances = !lite;
            return this.state.finances;

        } catch (error) {
            console.error('[ERP] 加载财务数据失败:', error);
            return [];
        }
    },

    // ==================== 客户管理 ====================
    async loadCustomersLegacy() {
        try {
            const { data, error } = await supabaseClient
                .from('erp_customers')
                .select('*')
                .eq('user_id', userData.user.id)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            return data || [];

        } catch (error) {
            console.error('[ERP] 加载客户数据失败:', error);
            return [];
        }
    },

    async addCustomer(customerData) {
        try {
            const { data, error } = await supabaseClient
                .from('erp_customers')
                .insert([{
                    user_id: userData.user.id,
                    name: customerData.name,
                    contact_person: customerData.contact_person || '',
                    phone: customerData.phone || '',
                    email: customerData.email || '',
                    address: customerData.address || '',
                    notes: customerData.notes || '',
                    status: customerData.status || 'active'
                }])
                .select()
                .single();

            if (error) {
                throw error;
            }

            this.state.customers.unshift(data);
            this.logAudit({
                module: 'customers',
                action: 'create',
                entityType: 'customer',
                entityId: data.id,
                entityName: data.name,
                details: { after: data }
            });

            if (typeof showToast === 'function') {
                showToast('客户添加成功', 'success');
            }

            return data;

        } catch (error) {
            console.error('[ERP] 添加客户失败:', error);
            if (typeof showToast === 'function') {
                showToast('添加客户失败: ' + error.message, 'error');
            }
            return null;
        }
    },

    async updateCustomer(customerId, customerData) {
        try {
            const before = this.state.customers.find(c => this.isSameId(c.id, customerId)) || null;
            const { data, error } = await supabaseClient
                .from('erp_customers')
                .update({
                    name: customerData.name,
                    contact_person: customerData.contact_person || '',
                    phone: customerData.phone || '',
                    email: customerData.email || '',
                    address: customerData.address || '',
                    notes: customerData.notes || '',
                    status: customerData.status || 'active'
                })
                .eq('id', customerId)
                .eq('user_id', userData.user.id)
                .select()
                .single();

            if (error) {
                throw error;
            }

            // 更新本地状态
            const index = this.state.customers.findIndex(c => this.isSameId(c.id, customerId));
            if (index !== -1) {
                this.state.customers[index] = data;
            }
            this.logAudit({
                module: 'customers',
                action: 'update',
                entityType: 'customer',
                entityId: customerId,
                entityName: data?.name || before?.name || '',
                details: {
                    before,
                    after: data
                }
            });

            if (typeof showToast === 'function') {
                showToast('客户更新成功', 'success');
            }

            return data;

        } catch (error) {
            console.error('[ERP] 更新客户失败:', error);
            if (typeof showToast === 'function') {
                showToast('更新客户失败: ' + error.message, 'error');
            }
            return null;
        }
    },

    async deleteCustomer(customerId) {
        try {
            const removedCustomer = this.state.customers.find(c => this.isSameId(c.id, customerId)) || null;
            const { error } = await supabaseClient
                .from('erp_customers')
                .delete()
                .eq('id', customerId)
                .eq('user_id', userData.user.id);

            if (error) {
                throw error;
            }

            // 更新本地状态
            this.state.customers = this.state.customers.filter(c => !this.isSameId(c.id, customerId));
            this.logAudit({
                module: 'customers',
                action: 'delete',
                entityType: 'customer',
                entityId: customerId,
                entityName: removedCustomer?.name || '',
                details: { before: removedCustomer }
            });

            if (typeof showToast === 'function') {
                showToast('客户删除成功', 'success');
            }

            return true;

        } catch (error) {
            console.error('[ERP] 删除客户失败:', error);
            if (typeof showToast === 'function') {
                showToast('删除客户失败: ' + error.message, 'error');
            }
            return false;
        }
    },

    // ==================== 产品管理 ====================
    async loadProductsLegacy() {
        try {
            const { data, error } = await supabaseClient
                .from('erp_products')
                .select('*')
                .eq('user_id', userData.user.id)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            return data || [];

        } catch (error) {
            console.error('[ERP] 加载产品数据失败:', error);
            return [];
        }
    },

    async addProduct(productData) {
        try {
            const { data, error } = await supabaseClient
                .from('erp_products')
                .insert([{
                    user_id: userData.user.id,
                    name: productData.name,
                    sku: productData.sku || null,
                    category: productData.category || '',
                    description: productData.description || '',
                    price: parseFloat(productData.price) || 0,
                    cost: parseFloat(productData.cost) || 0,
                    stock_quantity: parseInt(productData.stock_quantity) || 0,
                    min_stock: parseInt(productData.min_stock) || 0,
                    unit: productData.unit || 'piece',
                    status: productData.status || 'active'
                }])
                .select()
                .single();

            if (error) {
                throw error;
            }

            this.state.products.unshift(data);
            this.logAudit({
                module: 'products',
                action: 'create',
                entityType: 'product',
                entityId: data.id,
                entityName: data.name,
                details: { after: data }
            });

            if (typeof showToast === 'function') {
                showToast('产品添加成功', 'success');
            }

            return data;

        } catch (error) {
            console.error('[ERP] 添加产品失败:', error);
            if (typeof showToast === 'function') {
                showToast('添加产品失败: ' + error.message, 'error');
            }
            return null;
        }
    },

    async updateProduct(productId, productData) {
        try {
            const before = this.state.products.find(p => this.isSameId(p.id, productId)) || null;
            const { data, error } = await supabaseClient
                .from('erp_products')
                .update({
                    name: productData.name,
                    sku: productData.sku || null,
                    category: productData.category || '',
                    description: productData.description || '',
                    price: parseFloat(productData.price) || 0,
                    cost: parseFloat(productData.cost) || 0,
                    stock_quantity: parseInt(productData.stock_quantity) || 0,
                    min_stock: parseInt(productData.min_stock) || 0,
                    unit: productData.unit || 'piece',
                    status: productData.status || 'active'
                })
                .eq('id', productId)
                .eq('user_id', userData.user.id)
                .select()
                .single();

            if (error) {
                throw error;
            }

            // 更新本地状态
            const index = this.state.products.findIndex(p => this.isSameId(p.id, productId));
            if (index !== -1) {
                this.state.products[index] = data;
            }
            this.logAudit({
                module: 'products',
                action: 'update',
                entityType: 'product',
                entityId: productId,
                entityName: data?.name || before?.name || '',
                details: {
                    before,
                    after: data
                }
            });

            if (typeof showToast === 'function') {
                showToast('产品更新成功', 'success');
            }

            return data;

        } catch (error) {
            console.error('[ERP] 更新产品失败:', error);
            if (typeof showToast === 'function') {
                showToast('更新产品失败: ' + error.message, 'error');
            }
            return null;
        }
    },

    async deleteProduct(productId) {
        try {
            const removedProduct = this.state.products.find(p => this.isSameId(p.id, productId)) || null;
            const { error } = await supabaseClient
                .from('erp_products')
                .delete()
                .eq('id', productId)
                .eq('user_id', userData.user.id);

            if (error) {
                throw error;
            }

            // 更新本地状态
            this.state.products = this.state.products.filter(p => !this.isSameId(p.id, productId));
            this.logAudit({
                module: 'products',
                action: 'delete',
                entityType: 'product',
                entityId: productId,
                entityName: removedProduct?.name || '',
                details: { before: removedProduct }
            });

            if (typeof showToast === 'function') {
                showToast('产品删除成功', 'success');
            }

            return true;

        } catch (error) {
            console.error('[ERP] 删除产品失败:', error);
            if (typeof showToast === 'function') {
                showToast('删除产品失败: ' + error.message, 'error');
            }
            return false;
        }
    },

    // ==================== 订单管理 ====================
    async loadOrdersLegacy() {
        try {
            const { data, error } = await supabaseClient
                .from('erp_orders')
                .select(`
                    *,
                    customer:erp_customers(id, name, contact_person),
                    items:erp_order_items(*)
                `)
                .eq('user_id', userData.user.id)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            return data || [];

        } catch (error) {
            console.error('[ERP] 加载订单数据失败:', error);
            return [];
        }
    },

    async createOrder(orderData, items) {
        try {
            // 生成订单号
            const { data: orderNumData, error: orderNumError } = await supabaseClient
                .rpc('generate_order_number');

            if (orderNumError) {
                throw orderNumError;
            }

            const orderNumber = orderNumData;

            // 计算订单总金额
            const totalAmount = items.reduce((sum, item) => {
                return sum + (item.quantity * item.unit_price);
            }, 0);

            // 计算订单总成本
            let totalCost = 0;
            for (const item of items) {
                const product = this.state.products.find(p => this.isSameId(p.id, item.product_id));
                if (product) {
                    totalCost += (product.cost || 0) * item.quantity;
                }
            }

            // 计算净利润
            const netProfit = totalAmount - totalCost;

            // 创建订单
            const { data: order, error: orderError } = await supabaseClient
                .from('erp_orders')
                .insert([{
                    user_id: userData.user.id,
                    customer_id: orderData.customer_id || null,
                    order_number: orderNumber,
                    order_date: new Date().toISOString(),
                    total_amount: totalAmount,
                    total_cost: totalCost,
                    net_profit: netProfit,
                    status: 'pending',
                    payment_status: 'unpaid',
                    notes: orderData.notes || '',
                    shipping_company: orderData.shipping_company || null,
                    tracking_number: orderData.tracking_number || null,
                    shipping_status: orderData.shipping_status || 'not_shipped'
                }])
                .select()
                .single();

            if (orderError) {
                throw orderError;
            }

            // 创建订单明细
            const orderItems = items.map(item => {
                const product = this.state.products.find(p => this.isSameId(p.id, item.product_id));
                const unitCost = product ? (product.cost || 0) : 0;
                const itemTotalCost = unitCost * item.quantity;
                const itemTotalPrice = item.quantity * item.unit_price;
                const itemNetProfit = itemTotalPrice - itemTotalCost;

                return {
                    order_id: order.id,
                    product_id: item.product_id,
                    product_name: item.product_name,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    unit_cost: unitCost,
                    total_cost: itemTotalCost,
                    net_profit: itemNetProfit
                };
            });

            const { data: itemsData, error: itemsError } = await supabaseClient
                .from('erp_order_items')
                .insert(orderItems)
                .select();

            if (itemsError) {
                throw itemsError;
            }

            // 更新库存
            for (const item of items) {
                if (item.product_id) {
                    await this.updateStock(item.product_id, -item.quantity, 'sale', order.id);
                }
            }

            const { incomeDescription, costDescription, profitDescription } = this.buildOrderFinanceDescriptions(
                orderNumber,
                order.customer_id,
                items,
                totalAmount,
                totalCost,
                netProfit
            );

            // 创建财务记录（收入）
            await this.addFinanceRecord({
                type: 'income',
                category: '销售订单',
                amount: totalAmount,
                description: incomeDescription,
                reference_id: order.id,
                order_id: order.id
            });

            // 创建财务记录（成本）
            if (totalCost > 0) {
                await this.addFinanceRecord({
                    type: 'expense',
                    category: '销售成本',
                    amount: totalCost,
                    description: costDescription,
                    reference_id: order.id,
                    order_id: order.id
                });
            }

            // 创建财务记录（系统利润）
            await this.addOrderProfitFinance(order.id, orderNumber, netProfit, profitDescription);

            // 更新本地状态
            order.items = itemsData;
            this.state.orders.unshift(order);
            this.state.loaded.finances = false;
            this.logAudit({
                module: 'orders',
                action: 'create',
                entityType: 'order',
                entityId: order.id,
                entityName: order.order_number || '',
                details: {
                    after: {
                        id: order.id,
                        order_number: order.order_number,
                        customer_id: order.customer_id,
                        total_amount: order.total_amount,
                        total_cost: order.total_cost,
                        net_profit: order.net_profit,
                        status: order.status,
                        payment_status: order.payment_status,
                        items_count: orderItems.length
                    }
                }
            });

            if (typeof showToast === 'function') {
                showToast('订单创建成功', 'success');
            }

            return order;

        } catch (error) {
            console.error('[ERP] 创建订单失败:', error);
            if (typeof showToast === 'function') {
                showToast('创建订单失败: ' + error.message, 'error');
            }
            return null;
        }
    },

    async updateOrderStatus(orderId, status, paymentStatus = null, auditContext = {}) {
        try {
            const before = this.state.orders.find(o => this.isSameId(o.id, orderId)) || null;
            const beforeStatus = this.normalizeOrderStatus(before?.status || 'pending');
            const nextStatus = this.ensureOrderStatusTransition(before?.status || 'pending', status);
            const auditMeta = this.sanitizeAuditData(auditContext);
            const actor = String(userData?.user?.email || userData?.user?.id || '').trim();
            const updateData = {
                status: nextStatus
            };

            if (paymentStatus) {
                updateData.payment_status = paymentStatus;
            }

            const { data, error } = await supabaseClient
                .from('erp_orders')
                .update(updateData)
                .eq('id', orderId)
                .eq('user_id', userData.user.id)
                .select()
                .single();

            if (error) {
                throw error;
            }

            // 更新本地状态
            const index = this.state.orders.findIndex(o => this.isSameId(o.id, orderId));
            if (index !== -1) {
                this.state.orders[index] = { ...this.state.orders[index], ...data };
            }

            const afterStatus = this.normalizeOrderStatus(data?.status || nextStatus);
            if ((afterStatus === 'cancelled' || afterStatus === 'refunded')
                && !['cancelled', 'refunded'].includes(beforeStatus)) {
                try {
                    await this.releaseOrderLockedInventory(
                        orderId,
                        [],
                        afterStatus === 'cancelled' ? '订单取消回补库存' : '订单退款回补库存',
                        'order_release'
                    );
                } catch (inventoryReleaseError) {
                    console.error('[ERP] 订单状态更新后库存回补失败:', inventoryReleaseError);
                    if (typeof showToast === 'function') {
                        showToast('状态已更新，但库存回补失败，请稍后重试', 'warning');
                    }
                }
            }

            this.emitEvent('erpOrderChanged', {
                orderId,
                action: 'status-updated',
                fromStatus: beforeStatus,
                toStatus: afterStatus
            });
            if ((afterStatus === 'cancelled' || afterStatus === 'refunded')
                && !['cancelled', 'refunded'].includes(beforeStatus)) {
                this.emitEvent('erpInventoryChanged', {
                    orderId,
                    action: 'order-status-release',
                    fromStatus: beforeStatus,
                    toStatus: afterStatus
                });
            }

            this.logAudit({
                module: 'orders',
                action: 'update_status',
                entityType: 'order',
                entityId: orderId,
                entityName: data?.order_number || before?.order_number || '',
                description: (() => {
                    const orderName = data?.order_number || before?.order_number || `订单#${orderId}`;
                    const fromText = this.orderStatusMeta[beforeStatus]?.text || beforeStatus;
                    const toText = this.orderStatusMeta[afterStatus]?.text || afterStatus;
                    const actionLabel = String(auditMeta?.action_label || '').trim() || '订单状态更新';
                    const remarkText = String(auditMeta?.remark || '').trim();
                    return `${actionLabel}：${orderName}（${fromText} → ${toText}）${remarkText ? `，备注：${remarkText}` : ''}`;
                })(),
                details: {
                    before: {
                        status: before?.status,
                        payment_status: before?.payment_status
                    },
                    after: {
                        status: data?.status,
                        payment_status: data?.payment_status
                    },
                    approval: {
                        action_label: String(auditMeta?.action_label || '').trim(),
                        remark: String(auditMeta?.remark || '').trim(),
                        operator: String(auditMeta?.operator || actor).trim(),
                        source: String(auditMeta?.source || 'erp-ui').trim(),
                        approved_at: new Date().toISOString()
                    }
                }
            });

            if (typeof showToast === 'function') {
                showToast('订单状态更新成功', 'success');
            }

            return data;

        } catch (error) {
            console.error('[ERP] 更新订单状态失败:', error);
            if (typeof showToast === 'function') {
                showToast('更新订单状态失败: ' + error.message, 'error');
            }
            return null;
        }
    },

    async addOrder(orderData) {
        this.runtime.orderMutationInProgress = true;
        try {
            // 生成订单号
            const { data: orderNumData, error: orderNumError } = await supabaseClient
                .rpc('generate_order_number');

            if (orderNumError) {
                throw orderNumError;
            }

            const orderNumber = orderNumData;

            const manualTotalAmount = parseFloat(orderData.total_amount);

            // 计算订单总金额
            const calculatedTotalAmount = orderData.items.reduce((sum, item) => {
                return sum + (item.quantity * item.unit_price);
            }, 0);

            const totalAmount = Number.isFinite(manualTotalAmount) && manualTotalAmount > 0
                ? manualTotalAmount
                : calculatedTotalAmount;

            // 计算订单总成本
            let totalCost = 0;
            for (const item of orderData.items) {
                const product = this.state.products.find(p => this.isSameId(p.id, item.product_id));
                if (product) {
                    const itemCost = (product.cost || 0) * item.quantity;
                    totalCost += itemCost;
                }
            }

            // 计算净利润
            const netProfit = totalAmount - totalCost;

            const requestedStatus = this.normalizeOrderStatus(orderData.status || 'pending');
            if (!['pending', 'confirmed'].includes(requestedStatus)) {
                throw new Error('新订单初始状态仅支持「待处理」或「已确认」');
            }

            // 创建订单
            const { data: order, error: orderError } = await supabaseClient
                .from('erp_orders')
                .insert([{
                    user_id: userData.user.id,
                    customer_id: orderData.customer_id || null,
                    order_number: orderNumber,
                    order_date: new Date().toISOString(),
                    total_amount: totalAmount,
                    total_cost: totalCost,
                    net_profit: netProfit,
                    status: requestedStatus,
                    payment_status: orderData.payment_status || 'unpaid',
                    notes: orderData.notes || '',
                    shipping_company: orderData.shipping_company || null,
                    tracking_number: orderData.tracking_number || null,
                    shipping_status: orderData.shipping_status || 'not_shipped'
                }])
                .select()
                .single();

            if (orderError) {
                throw orderError;
            }

            // 创建订单明细
            const orderItems = orderData.items.map(item => {
                const product = this.state.products.find(p => this.isSameId(p.id, item.product_id));
                const unitCost = product ? (product.cost || 0) : 0;
                const itemTotalCost = unitCost * item.quantity;
                const itemTotalPrice = item.quantity * item.unit_price;
                const itemNetProfit = itemTotalPrice - itemTotalCost;

                return {
                    order_id: order.id,
                    product_id: item.product_id,
                    product_name: item.product_name,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    unit_cost: unitCost,
                    total_cost: itemTotalCost,
                    net_profit: itemNetProfit
                };
            });

            const localItems = orderItems.map(item => ({ ...item }));

            // 先返回订单创建结果，减少用户等待体感
            order.items = localItems;
            this.state.orders.unshift(order);
            this.emitEvent('erpOrderChanged', { orderId: order.id, action: 'created' });
            this.logAudit({
                module: 'orders',
                action: 'create',
                entityType: 'order',
                entityId: order.id,
                entityName: order.order_number || '',
                details: {
                    after: {
                        id: order.id,
                        order_number: order.order_number,
                        customer_id: order.customer_id,
                        total_amount: order.total_amount,
                        total_cost: order.total_cost,
                        net_profit: order.net_profit,
                        status: order.status,
                        payment_status: order.payment_status,
                        items_count: orderItems.length
                    }
                }
            });

            const persistItemsTask = (async () => {
                const { error: itemsError } = await supabaseClient
                    .from('erp_order_items')
                    .insert(orderItems);
                if (itemsError) {
                    throw itemsError;
                }
                return true;
            })();

            const postProcessTask = this.postProcessOrder(order, orderData.items, {
                orderNumber,
                totalAmount,
                totalCost,
                netProfit
            }, {
                customerName: orderData.customer_name || ''
            });

            Promise.allSettled([persistItemsTask, postProcessTask]).then((results) => {
                const [itemsResult, processResult] = results;
                if (itemsResult.status === 'rejected') {
                    console.error('[ERP] 订单明细写入失败，稍后可在订单详情重试:', itemsResult.reason);
                    if (typeof showToast === 'function') {
                        showToast('订单明细同步稍慢，系统将自动重试', 'warning');
                    }
                }
                if (processResult.status === 'rejected') {
                    console.error('[ERP] 订单后处理失败:', processResult.reason);
                    if (typeof showToast === 'function') {
                        showToast('订单已保存，库存/财务同步稍后自动重试', 'warning');
                    }
                }
            }).catch((backgroundError) => {
                console.error('[ERP] 订单后台任务异常:', backgroundError);
            });

            if (typeof showToast === 'function') {
                showToast('订单创建成功', 'success');
            }

            return order;

        } catch (error) {
            console.error('[ERP] 创建订单失败:', error);
            if (typeof showToast === 'function') {
                showToast('创建订单失败: ' + error.message, 'error');
            }
            return null;
        } finally {
            this.runtime.orderMutationInProgress = false;
        }
    },

    buildOrderContext(orderNumber, customerId, items = [], context = {}) {
        const itemNames = (items || []).map(item => {
            const product = (this.state.products || []).find(p => this.isSameId(p.id, item?.product_id));
            const productName = item?.product_name || product?.name || '';
            const quantity = Number(item?.quantity);

            if (!productName) {
                return '';
            }

            if (Number.isFinite(quantity) && quantity > 0) {
                return `${productName}x${quantity}`;
            }

            return productName;
        }).filter(Boolean);

        const productSummary = itemNames.length === 0
            ? '未识别商品'
            : `${itemNames.slice(0, 3).join('、')}${itemNames.length > 3 ? ` 等${itemNames.length}项` : ''}`;

        return `商品:${productSummary}`;
    },

    buildOrderFinanceDescriptions(orderNumber, customerId, items = [], totalAmount = 0, totalCost = 0, netProfit = 0, context = {}) {
        const orderContext = this.buildOrderContext(orderNumber, customerId, items, context);
        const amountText = `¥${parseFloat(totalAmount || 0).toFixed(2)}`;
        const costText = `¥${parseFloat(totalCost || 0).toFixed(2)}`;
        const profitText = `¥${parseFloat(netProfit || 0).toFixed(2)}`;

        return {
            orderContext,
            incomeDescription: `${orderContext} | 销售额:${amountText} | 成本:${costText} | 利润:${profitText}`,
            costDescription: `${orderContext} | 销售成本:${costText}`,
            profitDescription: `${orderContext} | 系统利润:${profitText}`
        };
    },

    buildOrderItemQuantityMap(items = []) {
        const quantityMap = new Map();
        (items || []).forEach(item => {
            const productId = item?.product_id;
            const quantity = Number(item?.quantity);
            if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
                return;
            }
            const key = String(productId);
            quantityMap.set(key, (quantityMap.get(key) || 0) + quantity);
        });
        return quantityMap;
    },

    async resolveOrderItemsForInventory(orderId, fallbackItems = []) {
        if (Array.isArray(fallbackItems) && fallbackItems.length > 0) {
            return fallbackItems;
        }

        const localOrder = this.state.orders.find(order => this.isSameId(order.id, orderId));
        if (localOrder && Array.isArray(localOrder.items) && localOrder.items.length > 0) {
            return localOrder.items;
        }

        const { data, error } = await supabaseClient
            .from('erp_order_items')
            .select('product_id, quantity')
            .eq('order_id', orderId);

        if (error) {
            throw error;
        }

        return data || [];
    },

    async getOrderInventoryLogSummary(orderId) {
        const lockTypes = new Set(['order_lock', 'sale']);
        const releaseTypes = new Set(['order_release', 'sale_reversal', 'order_unlock']);

        const { data, error } = await supabaseClient
            .from('erp_inventory_logs')
            .select('product_id, quantity_change, type')
            .eq('user_id', userData.user.id)
            .eq('reference_id', orderId);

        if (error) {
            throw error;
        }

        const summaryMap = new Map();
        (data || []).forEach(log => {
            const productId = log?.product_id;
            if (!productId) {
                return;
            }

            const key = String(productId);
            const current = summaryMap.get(key) || { locked: 0, released: 0 };
            const quantityChange = Number(log?.quantity_change);
            const safeChange = Number.isFinite(quantityChange) ? quantityChange : 0;
            const type = String(log?.type || '');

            if (lockTypes.has(type) && safeChange < 0) {
                current.locked += Math.abs(safeChange);
            } else if (releaseTypes.has(type) && safeChange > 0) {
                current.released += safeChange;
            }

            summaryMap.set(key, current);
        });

        return summaryMap;
    },

    buildPurchaseOrderNumber(purchaseDate = null) {
        const date = purchaseDate ? new Date(purchaseDate) : new Date();
        const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
        const y = safeDate.getFullYear();
        const m = String(safeDate.getMonth() + 1).padStart(2, '0');
        const d = String(safeDate.getDate()).padStart(2, '0');
        const msTail = String(safeDate.getTime()).slice(-5);
        const randomTail = String(Math.floor(Math.random() * 90) + 10);
        return `CG-${y}${m}${d}-${msTail}${randomTail}`;
    },

    parsePurchaseMetaFromNotes(notes = '') {
        const raw = String(notes || '').trim();
        const result = {};
        if (!raw || !raw.includes('|')) {
            return result;
        }
        raw.split('|').forEach((segment, index) => {
            if (index === 0 && !segment.includes('=')) {
                result.tag = segment.trim();
                return;
            }
            const [key, ...valueParts] = String(segment || '').split('=');
            const keyText = String(key || '').trim();
            if (!keyText) {
                return;
            }
            result[keyText] = valueParts.join('=').trim();
        });
        return result;
    },

    stringifyPurchaseMeta(meta = {}) {
        const tag = String(meta?.tag || '采购入库').trim() || '采购入库';
        const keys = [
            '采购单号',
            '商品',
            '数量',
            '单价',
            '总额',
            '供应商',
            '付款',
            '已付',
            '待付',
            '审批',
            '审批人',
            '审批时间',
            '审批备注',
            '审批日志',
            '冲销状态',
            '冲销时间',
            '冲销备注',
            '时间',
            '备注'
        ];
        const segments = [tag];
        keys.forEach(key => {
            if (meta[key] === undefined || meta[key] === null) {
                return;
            }
            segments.push(`${key}=${String(meta[key]).trim() || '-'}`);
        });
        return segments.join('|');
    },

    extractPurchaseOrderNoFromText(text = '') {
        const source = String(text || '');
        const match = source.match(/采购单号[:=]\s*([^\s，,;；|]+)/);
        if (!match) {
            return '';
        }
        return String(match[1] || '').trim();
    },

    normalizePurchaseApprovalStatus(value = '') {
        const text = String(value || '').trim().toLowerCase();
        if (text === 'pending') return 'pending';
        if (text === 'rejected') return 'rejected';
        return 'approved';
    },

    sanitizePurchaseApprovalLogText(value = '') {
        return String(value || '')
            .replace(/[@#|]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    },

    parsePurchaseApprovalHistory(raw = '') {
        const text = String(raw || '').trim();
        if (!text) {
            return [];
        }
        return text
            .split('##')
            .map(chunk => String(chunk || '').trim())
            .filter(Boolean)
            .map(chunk => {
                const [time = '', status = '', operator = '', note = ''] = chunk.split('@');
                return {
                    time: String(time || '').trim(),
                    status: this.normalizePurchaseApprovalStatus(status),
                    operator: String(operator || '').trim(),
                    note: String(note || '').trim()
                };
            })
            .filter(item => item.time);
    },

    stringifyPurchaseApprovalHistory(entries = []) {
        const safeEntries = (Array.isArray(entries) ? entries : [])
            .filter(item => item && item.time)
            .map(item => {
                const time = this.sanitizePurchaseApprovalLogText(item.time);
                const status = this.normalizePurchaseApprovalStatus(item.status);
                const operator = this.sanitizePurchaseApprovalLogText(item.operator || '');
                const note = this.sanitizePurchaseApprovalLogText(item.note || '');
                return `${time}@${status}@${operator}@${note}`;
            });
        return safeEntries.join('##');
    },

    async rollbackPurchaseFinanceByOrderNo(purchaseOrderNo = '', productId = null, reasonText = '') {
        let query = supabaseClient
            .from('erp_finances')
            .select('id, user_id, type, category, amount, description, reference_id')
            .eq('user_id', userData.user.id)
            .order('transaction_date', { ascending: false })
            .limit(300);

        const safeOrderNo = String(purchaseOrderNo || '').trim();
        if (safeOrderNo) {
            query = query.ilike('description', `%${safeOrderNo}%`);
        } else if (productId !== null && productId !== undefined && productId !== '') {
            query = query.eq('reference_id', productId);
        }

        const { data, error } = await query;
        if (error) {
            throw error;
        }

        const rows = Array.isArray(data) ? data : [];
        const targets = rows.filter(row => {
            const category = String(row?.category || '');
            return category.includes('采购入库') || category.includes('应付账款') || category.includes('采购付款');
        });

        let changedCount = 0;
        for (const row of targets) {
            const currentAmount = Math.abs(Number(row?.amount || 0));
            if (!Number.isFinite(currentAmount) || currentAmount <= 0) {
                continue;
            }

            const description = String(row?.description || '');
            const suffix = reasonText ? `（已驳回冲销：${reasonText}）` : '（已驳回冲销）';
            const nextDescription = description.includes('已驳回冲销') ? description : `${description}${suffix}`;

            const { error: updateError } = await supabaseClient
                .from('erp_finances')
                .update({
                    amount: 0,
                    description: nextDescription
                })
                .eq('id', row.id)
                .eq('user_id', userData.user.id);

            if (!updateError) {
                changedCount += 1;
            }
        }

        return changedCount;
    },

    async getPurchaseApprovalMetaByOrderNo(purchaseOrderNo = '') {
        const safeOrderNo = String(purchaseOrderNo || '').trim();
        if (!safeOrderNo) {
            return null;
        }

        const { data, error } = await supabaseClient
            .from('erp_inventory_logs')
            .select('id, user_id, type, notes, created_at')
            .eq('user_id', userData.user.id)
            .eq('type', 'purchase')
            .ilike('notes', `%采购单号=${safeOrderNo}%`)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            throw error;
        }

        const rows = Array.isArray(data) ? data : [];
        if (!rows.length) {
            return null;
        }

        const pickTs = (row) => {
            const meta = this.parsePurchaseMetaFromNotes(row?.notes || '');
            const text = String(meta['审批时间'] || row?.created_at || '').trim();
            const date = new Date(text);
            return Number.isNaN(date.getTime()) ? 0 : date.getTime();
        };

        rows.sort((left, right) => pickTs(right) - pickTs(left));
        const target = rows[0];
        const meta = this.parsePurchaseMetaFromNotes(target?.notes || '');
        return {
            logId: target?.id || null,
            approvalStatus: this.normalizePurchaseApprovalStatus(meta['审批'] || 'approved'),
            approvalOperator: String(meta['审批人'] || '').trim(),
            approvalTime: String(meta['审批时间'] || '').trim(),
            approvalNote: String(meta['审批备注'] || '').trim(),
            rollbackStatus: String(meta['冲销状态'] || '').trim(),
            rollbackTime: String(meta['冲销时间'] || '').trim(),
            rollbackNote: String(meta['冲销备注'] || '').trim()
        };
    },

    async releaseOrderLockedInventory(orderId, items = [], reason = '订单状态回补库存', releaseType = 'order_release') {
        const resolvedItems = await this.resolveOrderItemsForInventory(orderId, items);
        const expectedMap = this.buildOrderItemQuantityMap(resolvedItems);
        if (expectedMap.size === 0) {
            return { changed: false, releasedQuantity: 0, releasedItems: [] };
        }

        const summaryMap = await this.getOrderInventoryLogSummary(orderId);
        let changed = false;
        let releasedQuantity = 0;
        const releasedItems = [];

        for (const [productId, expectedQuantity] of expectedMap.entries()) {
            const summary = summaryMap.get(productId) || { locked: 0, released: 0 };
            const remainingLocked = Math.max(0, Number(summary.locked || 0) - Number(summary.released || 0));
            const quantityToRelease = Math.min(expectedQuantity, remainingLocked);

            if (!Number.isFinite(quantityToRelease) || quantityToRelease <= 0) {
                continue;
            }

            const released = await this.updateStock(
                productId,
                quantityToRelease,
                releaseType,
                orderId,
                reason
            );

            if (!released) {
                throw new Error('订单库存回补失败，请稍后重试');
            }

            changed = true;
            releasedQuantity += quantityToRelease;
            releasedItems.push({ product_id: productId, quantity: quantityToRelease });
        }

        return { changed, releasedQuantity, releasedItems };
    },

    async postProcessOrder(order, items, summary, context = {}) {
        const { orderNumber, totalAmount, totalCost, netProfit } = summary;
        const { incomeDescription, costDescription, profitDescription } = this.buildOrderFinanceDescriptions(
            orderNumber,
            order.customer_id,
            items,
            totalAmount,
            totalCost,
            netProfit,
            context
        );

        let stockChanged = false;
        let financeChanged = false;

        // 更新库存（并行执行）
        const stockResults = await Promise.all((items || []).map(item => {
            if (!item.product_id) {
                return Promise.resolve();
            }
            return this.updateStock(
                item.product_id,
                -item.quantity,
                'order_lock',
                order.id,
                `订单${orderNumber}创建锁定库存`
            );
        }));
        stockChanged = stockResults.some(Boolean);

        // 创建财务记录（并行）
        const financeTasks = [
            this.addFinanceRecord({
                type: 'income',
                category: '销售订单',
                amount: totalAmount,
                description: incomeDescription,
                reference_id: order.id,
                order_id: order.id
            }),
            this.addOrderProfitFinance(order.id, orderNumber, netProfit, profitDescription)
        ];

        if (totalCost > 0) {
            financeTasks.push(this.addFinanceRecord({
                type: 'expense',
                category: '销售成本',
                amount: totalCost,
                description: costDescription,
                reference_id: order.id,
                order_id: order.id
            }));
        }

        const financeResults = await Promise.all(financeTasks);
        const hasFailed = financeResults.some(result => !result);
        financeChanged = financeResults.some(Boolean);

        if (hasFailed) {
            console.warn('[ERP] 订单财务记录部分写入失败，触发自动补录');
            await this.ensureOrderFinanceRecords(order, orderNumber, totalAmount, totalCost, netProfit, items);
            financeChanged = true;
        }

        if (stockChanged) {
            this.emitEvent('erpInventoryChanged', { orderId: order.id });
        }

        if (financeChanged) {
            this.state.loaded.finances = false;
            this.emitEvent('erpFinanceChanged', { orderId: order.id });
        }

        this.emitEvent('erpOrderPostProcessed', {
            orderId: order.id,
            orderNumber,
            financeChanged,
            stockChanged
        });
    },

    async updateOrder(orderId, orderData) {
        try {
            const localOrder = this.state.orders.find(o => this.isSameId(o.id, orderId)) || {};
            const beforeStatus = this.normalizeOrderStatus(localOrder?.status || 'pending');
            const before = this.sanitizeAuditData(localOrder);
            const orderNumber = localOrder.order_number || `订单#${orderId}`;
            const nextStatus = this.ensureOrderStatusTransition(localOrder?.status || 'pending', orderData.status || 'pending');
            const totalCost = parseFloat(localOrder.total_cost || 0);
            const manualTotalAmount = parseFloat(orderData.total_amount);
            const currentAmount = parseFloat(localOrder.total_amount || 0);
            const totalAmount = Number.isFinite(manualTotalAmount) && manualTotalAmount > 0
                ? manualTotalAmount
                : currentAmount;
            const netProfit = totalAmount - totalCost;

            const { data, error } = await supabaseClient
                .from('erp_orders')
                .update({
                    customer_id: orderData.customer_id || null,
                    status: nextStatus,
                    payment_status: orderData.payment_status || 'unpaid',
                    total_amount: totalAmount,
                    total_cost: totalCost,
                    net_profit: netProfit,
                    notes: orderData.notes || '',
                    shipping_company: orderData.shipping_company || null,
                    tracking_number: orderData.tracking_number || null,
                    shipping_status: orderData.shipping_status || 'not_shipped'
                })
                .eq('id', orderId)
                .eq('user_id', userData.user.id)
                .select()
                .single();

            if (error) {
                throw error;
            }

            // 更新本地状态
            const index = this.state.orders.findIndex(o => this.isSameId(o.id, orderId));
            if (index !== -1) {
                this.state.orders[index] = { ...this.state.orders[index], ...data };
            }

            const afterStatus = this.normalizeOrderStatus(data?.status || nextStatus);
            if ((afterStatus === 'cancelled' || afterStatus === 'refunded')
                && !['cancelled', 'refunded'].includes(beforeStatus)) {
                try {
                    await this.releaseOrderLockedInventory(
                        orderId,
                        orderData.items || [],
                        afterStatus === 'cancelled' ? '订单取消回补库存' : '订单退款回补库存',
                        'order_release'
                    );
                } catch (inventoryReleaseError) {
                    console.error('[ERP] 订单更新后库存回补失败:', inventoryReleaseError);
                    if (typeof showToast === 'function') {
                        showToast('订单状态已更新，但库存回补失败，请稍后重试', 'warning');
                    }
                }
            }

            const orderIndex = this.state.orders.findIndex(o => this.isSameId(o.id, orderId));
            if (orderIndex !== -1 && Array.isArray(orderData.items) && orderData.items.length > 0) {
                this.state.orders[orderIndex].items = orderData.items.map(item => ({ ...item }));
            }

            await this.syncOrderFinanceRecords(orderId, orderNumber, totalAmount, totalCost, netProfit, {
                customer_id: orderData.customer_id || data?.customer_id || localOrder?.customer_id || null,
                customer_name: orderData.customer_name || '',
                items: Array.isArray(orderData.items) ? orderData.items : []
            });
            this.logAudit({
                module: 'orders',
                action: 'update',
                entityType: 'order',
                entityId: orderId,
                entityName: data?.order_number || orderNumber,
                details: {
                    before,
                    after: {
                        id: data?.id || orderId,
                        order_number: data?.order_number || orderNumber,
                        customer_id: data?.customer_id,
                        total_amount: data?.total_amount,
                        total_cost: data?.total_cost,
                        net_profit: data?.net_profit,
                        status: data?.status,
                        payment_status: data?.payment_status,
                        notes: data?.notes || ''
                    }
                }
            });

            if (typeof showToast === 'function') {
                showToast('订单更新成功', 'success');
            }

            this.state.loaded.finances = false;

            return data;

        } catch (error) {
            console.error('[ERP] 更新订单失败:', error);
            if (typeof showToast === 'function') {
                showToast('更新订单失败: ' + error.message, 'error');
            }
            return null;
        }
    },

    async deleteOrder(orderId) {
        let releaseResult = { releasedItems: [] };
        const rollbackReleasedStocks = async () => {
            const releasedItems = Array.isArray(releaseResult?.releasedItems) ? releaseResult.releasedItems : [];
            for (const item of releasedItems) {
                try {
                    const productId = item?.product_id;
                    const quantity = Number(item?.quantity);
                    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
                        continue;
                    }
                    await this.updateStock(
                        productId,
                        -quantity,
                        'order_lock',
                        orderId,
                        '删除订单失败，回滚库存回补'
                    );
                } catch (rollbackError) {
                    console.error('[ERP] 回滚库存回补失败:', rollbackError);
                }
            }
        };

        try {
            let orderDetail = this.state.orders.find(order => this.isSameId(order.id, orderId)) || null;
            if (!orderDetail || !Array.isArray(orderDetail.items)) {
                orderDetail = await this.loadOrderDetail(orderId);
            }

            let orderItems = Array.isArray(orderDetail?.items) ? orderDetail.items : [];
            if (orderItems.length === 0) {
                const { data: detailItems, error: detailItemsError } = await supabaseClient
                    .from('erp_order_items')
                    .select('product_id, quantity')
                    .eq('order_id', orderId);

                if (detailItemsError) {
                    throw detailItemsError;
                }
                orderItems = detailItems || [];
            }

            releaseResult = await this.releaseOrderLockedInventory(
                orderId,
                orderItems,
                '删除订单回补库存',
                'sale_reversal'
            );

            const { error: financeRefError } = await supabaseClient
                .from('erp_finances')
                .delete()
                .eq('user_id', userData.user.id)
                .eq('reference_id', orderId);

            if (financeRefError) {
                await rollbackReleasedStocks();
                throw financeRefError;
            }

            const { error: financeOrderError } = await supabaseClient
                .from('erp_finances')
                .delete()
                .eq('user_id', userData.user.id)
                .eq('order_id', orderId);

            if (financeOrderError && financeOrderError.code !== '42703') {
                await rollbackReleasedStocks();
                throw financeOrderError;
            }

            let { error: orderDeleteError } = await supabaseClient
                .from('erp_orders')
                .delete()
                .eq('id', orderId)
                .eq('user_id', userData.user.id);

            if (orderDeleteError && (orderDeleteError.code === '23503' || String(orderDeleteError.message || '').toLowerCase().includes('foreign key'))) {
                const { error: itemDeleteError } = await supabaseClient
                    .from('erp_order_items')
                    .delete()
                    .eq('order_id', orderId);

                if (itemDeleteError) {
                    await rollbackReleasedStocks();
                    throw itemDeleteError;
                }

                const retryResult = await supabaseClient
                    .from('erp_orders')
                    .delete()
                    .eq('id', orderId)
                    .eq('user_id', userData.user.id);
                orderDeleteError = retryResult.error;
            }

            if (orderDeleteError) {
                await rollbackReleasedStocks();
                throw orderDeleteError;
            }

            this.state.orders = this.state.orders.filter(o => !this.isSameId(o.id, orderId));
            this.state.loaded.orders = false;
            this.state.loaded.finances = false;
            this.state.loaded.products = false;
            this.logAudit({
                module: 'orders',
                action: 'delete',
                entityType: 'order',
                entityId: orderId,
                entityName: orderDetail?.order_number || '',
                details: {
                    before: {
                        id: orderDetail?.id || orderId,
                        order_number: orderDetail?.order_number || '',
                        customer_id: orderDetail?.customer_id || null,
                        total_amount: orderDetail?.total_amount || 0,
                        total_cost: orderDetail?.total_cost || 0,
                        net_profit: orderDetail?.net_profit || 0,
                        items_count: Array.isArray(orderItems) ? orderItems.length : 0,
                        inventory_released_quantity: releaseResult?.releasedQuantity || 0
                    }
                }
            });

            this.emitEvent('erpOrderChanged', { orderId, action: 'deleted' });
            this.emitEvent('erpFinanceChanged', { orderId, action: 'deleted' });
            this.emitEvent('erpInventoryChanged', { orderId, action: 'order-deleted' });

            if (typeof showToast === 'function') {
                showToast('订单删除成功', 'success');
            }

            return true;

        } catch (error) {
            console.error('[ERP] 删除订单失败:', error);
            if (typeof showToast === 'function') {
                showToast('删除订单失败: ' + error.message, 'error');
            }
            return false;
        }
    },

    // ==================== 库存管理 ====================
    async updateStock(productId, quantityChange, type, referenceId = null, notes = '') {
        try {
            // 获取当前库存
            const { data: product, error: productError } = await supabaseClient
                .from('erp_products')
                .select('id, name, stock_quantity')
                .eq('id', productId)
                .eq('user_id', userData.user.id)
                .single();

            if (productError) {
                throw productError;
            }

            const currentQuantity = Number(product.stock_quantity);
            const safeCurrentQuantity = Number.isFinite(currentQuantity) ? currentQuantity : 0;
            const parsedChange = Number(quantityChange);
            const safeQuantityChange = Number.isFinite(parsedChange) ? parsedChange : 0;
            const newQuantity = safeCurrentQuantity + safeQuantityChange;
            const normalizedType = String(type || '').trim();
            const isLockOperation = ['order_lock', 'sale'].includes(normalizedType);

            if (isLockOperation && newQuantity < 0) {
                throw new Error(`库存不足：商品「${product.name || productId}」当前库存 ${safeCurrentQuantity}，锁定需求 ${Math.abs(safeQuantityChange)}`);
            }

            // 更新产品库存
            const { error: updateError } = await supabaseClient
                .from('erp_products')
                .update({ stock_quantity: newQuantity })
                .eq('id', productId)
                .eq('user_id', userData.user.id);

            if (updateError) {
                throw updateError;
            }

            // 记录库存变动
            const { error: logError } = await supabaseClient
                .from('erp_inventory_logs')
                .insert([{
                    user_id: userData.user.id,
                    product_id: productId,
                    quantity_change: safeQuantityChange,
                    current_quantity: newQuantity,
                    type: type,
                    reference_id: referenceId,
                    notes: notes
                }]);

            if (logError) {
                throw logError;
            }

            // 更新本地状态
            const productIndex = this.state.products.findIndex(p => this.isSameId(p.id, productId));
            if (productIndex !== -1) {
                this.state.products[productIndex].stock_quantity = newQuantity;
            }

            this.emitEvent('erpInventoryChanged', {
                productId,
                quantityChange,
                currentQuantity: newQuantity,
                type,
                referenceId
            });
            this.logAudit({
                module: 'inventory',
                action: 'adjust',
                entityType: 'product',
                entityId: productId,
                entityName: this.state.products.find(p => this.isSameId(p.id, productId))?.name || product?.name || '',
                details: {
                    type,
                    quantity_change: safeQuantityChange,
                    previous_quantity: safeCurrentQuantity,
                    current_quantity: newQuantity,
                    reference_id: referenceId,
                    notes: notes || ''
                }
            });

            return true;

        } catch (error) {
            console.error('[ERP] 更新库存失败:', error);
            if (typeof showToast === 'function') {
                showToast('更新库存失败: ' + error.message, 'error');
            }
            return false;
        }
    },

    async adjustInventory(productId, quantityChange, type, notes, options = {}) {
        try {
            const normalizedType = String(type || '').trim();
            const parsedQuantity = Number(quantityChange);
            const safeQuantity = Number.isFinite(parsedQuantity) ? parsedQuantity : 0;
            if (safeQuantity === 0) {
                throw new Error('调整数量必须大于 0');
            }

            const product = this.state.products.find(item => this.isSameId(item.id, productId)) || null;
            const productName = product?.name || String(productId);
            const safeUnitCost = Number.isFinite(Number(options?.unitCost)) ? Number(options.unitCost) : 0;
            const safePurchaseDate = options?.purchaseDate || new Date().toISOString();
            const safeSupplier = String(options?.supplier || '').trim();
            const safePurchaseOrderNo = String(options?.purchaseOrderNo || '').trim() || this.buildPurchaseOrderNumber(safePurchaseDate);
            const safePaymentStatus = String(options?.paymentStatus || 'paid').toLowerCase();
            const safeApprovalStatus = String(options?.approvalStatus || 'approved').toLowerCase();
            const userNote = String(notes || '').trim();
            const purchaseAmount = Math.abs(safeQuantity) * Math.max(safeUnitCost, 0);
            const rawPaidAmount = Number(options?.paidAmount);

            let paidAmount = 0;
            if (safePaymentStatus === 'paid') {
                paidAmount = purchaseAmount;
            } else if (safePaymentStatus === 'partial') {
                const safePaidAmount = Number.isFinite(rawPaidAmount) ? rawPaidAmount : 0;
                paidAmount = Math.min(Math.max(safePaidAmount, 0), purchaseAmount);
            }
            const payableAmount = Math.max(purchaseAmount - paidAmount, 0);

            let effectiveNotes = userNote;
            if (normalizedType === 'purchase') {
                const purchaseMeta = [
                    '采购入库',
                    `采购单号=${safePurchaseOrderNo}`,
                    `商品=${productName}`,
                    `数量=${Math.abs(safeQuantity)}`,
                    `单价=${Math.max(safeUnitCost, 0)}`,
                    `总额=${purchaseAmount}`,
                    `供应商=${safeSupplier || '-'}`,
                    `付款=${safePaymentStatus}`,
                    `已付=${paidAmount}`,
                    `待付=${payableAmount}`,
                    `审批=${safeApprovalStatus}`,
                    `审批时间=${safePurchaseDate}`,
                    `审批备注=${safeApprovalStatus === 'pending' ? '待审批' : '自动通过'}`,
                    `时间=${safePurchaseDate}`,
                    `备注=${userNote || '-'}`
                ];
                effectiveNotes = purchaseMeta.join('|');
            }

            const result = await this.updateStock(productId, safeQuantity, normalizedType, null, effectiveNotes);

            if (result) {
                // 创建财务记录
                if (normalizedType === 'purchase') {
                    const baseDescription = `采购单号:${safePurchaseOrderNo}，采购入库 ${productName} x${Math.abs(safeQuantity)}，供应商：${safeSupplier || '未填写'}${userNote ? `，备注：${userNote}` : ''}`;

                    if (paidAmount > 0) {
                        await this.addFinanceRecord({
                            type: 'expense',
                            category: '采购入库',
                            amount: paidAmount,
                            description: `${baseDescription}（已付款）`,
                            reference_id: productId,
                            transaction_date: safePurchaseDate
                        });
                    }

                    if (payableAmount > 0) {
                        await this.addFinanceRecord({
                            type: 'system',
                            category: '应付账款',
                            amount: payableAmount,
                            description: `${baseDescription}（待付款）`,
                            reference_id: productId,
                            transaction_date: safePurchaseDate
                        });
                    }
                }

                if (typeof showToast === 'function') {
                    showToast('库存调整成功', 'success');
                }
            }

            return result;

        } catch (error) {
            console.error('[ERP] 调整库存失败:', error);
            if (typeof showToast === 'function') {
                showToast('调整库存失败: ' + error.message, 'error');
            }
            return false;
        }
    },

    async updatePurchaseApproval(logId, approvalStatus = 'approved', approvalNote = '') {
        try {
            if (!this.isCurrentUserAdmin()) {
                throw new Error('仅管理员可以执行采购审批');
            }

            const safeStatus = this.normalizePurchaseApprovalStatus(approvalStatus);
            if (!['pending', 'approved', 'rejected'].includes(safeStatus)) {
                throw new Error('审批状态无效');
            }

            const { data: record, error: loadError } = await supabaseClient
                .from('erp_inventory_logs')
                .select('id, user_id, type, notes, product_id, quantity_change')
                .eq('id', logId)
                .eq('user_id', userData.user.id)
                .single();

            if (loadError) {
                throw loadError;
            }
            if (String(record?.type || '') !== 'purchase') {
                throw new Error('仅采购记录支持审批');
            }

            const meta = this.parsePurchaseMetaFromNotes(record?.notes || '');
            const previousStatus = this.normalizePurchaseApprovalStatus(meta['审批'] || 'approved');
            const approvalAt = new Date().toISOString();
            const operator = String(userData?.user?.email || userData?.user?.id || '未知审批人').trim();
            const safeApprovalNote = String(approvalNote || '').trim();

            meta['审批'] = safeStatus;
            meta['审批人'] = operator;
            meta['审批时间'] = approvalAt;
            meta['审批备注'] = safeApprovalNote || (safeStatus === 'approved' ? '手动通过' : (safeStatus === 'rejected' ? '手动驳回' : '待审批'));

            const history = this.parsePurchaseApprovalHistory(meta['审批日志']);
            history.push({
                time: approvalAt,
                status: safeStatus,
                operator,
                note: meta['审批备注']
            });
            meta['审批日志'] = this.stringifyPurchaseApprovalHistory(history.slice(-30));

            let stockRollbackDone = false;
            let financeRollbackCount = 0;
            if (safeStatus === 'rejected' && String(meta['冲销状态'] || '') !== '已冲销') {
                const quantity = Math.abs(Number(record?.quantity_change || meta['数量'] || 0));
                if (Number.isFinite(quantity) && quantity > 0 && record?.product_id) {
                    const stockResult = await this.updateStock(
                        record.product_id,
                        -quantity,
                        'purchase_reversal',
                        record.id,
                        `采购驳回自动冲销${meta['采购单号'] ? `(${meta['采购单号']})` : ''}`
                    );
                    if (!stockResult) {
                        throw new Error('采购驳回库存冲销失败');
                    }
                    stockRollbackDone = true;
                }

                financeRollbackCount = await this.rollbackPurchaseFinanceByOrderNo(
                    meta['采购单号'] || '',
                    record?.product_id || null,
                    meta['审批备注']
                );
                meta['冲销状态'] = '已冲销';
                meta['冲销时间'] = approvalAt;
                meta['冲销备注'] = meta['审批备注'] || '采购驳回自动冲销';
            } else if (safeStatus !== 'rejected') {
                meta['冲销备注'] = meta['冲销备注'] || '-';
            }

            const nextNotes = this.stringifyPurchaseMeta(meta);

            const { data, error } = await supabaseClient
                .from('erp_inventory_logs')
                .update({ notes: nextNotes })
                .eq('id', logId)
                .eq('user_id', userData.user.id)
                .select()
                .single();

            if (error) {
                throw error;
            }

            this.emitEvent('erpInventoryChanged', {
                type: 'purchase_approval_updated',
                logId: data?.id || logId,
                approvalStatus: safeStatus
            });

            if (financeRollbackCount > 0) {
                this.state.loaded.finances = false;
                this.emitEvent('erpFinanceChanged', {
                    action: 'purchase_rejection_rollback',
                    logId: data?.id || logId,
                    rollbackCount: financeRollbackCount
                });
            }

            this.logAudit({
                module: 'inventory',
                action: 'purchase_approval_update',
                entityType: 'inventory_log',
                entityId: data?.id || logId,
                entityName: meta['采购单号'] || `采购记录#${data?.id || logId}`,
                description: `采购审批 ${previousStatus} -> ${safeStatus}${operator ? `，审批人：${operator}` : ''}`,
                details: {
                    before_status: previousStatus,
                    after_status: safeStatus,
                    approval_note: meta['审批备注'],
                    approval_operator: operator,
                    stock_rollback_done: stockRollbackDone,
                    finance_rollback_count: financeRollbackCount
                }
            });
            return data;
        } catch (error) {
            console.error('[ERP] 更新采购审批失败:', error);
            if (typeof showToast === 'function') {
                showToast('更新采购审批失败: ' + (error?.message || '未知错误'), 'error');
            }
            return null;
        }
    },

    async loadPurchaseLogs(limit = 80) {
        try {
            const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 80, 1), 500);
            const { data, error } = await supabaseClient
                .from('erp_inventory_logs')
                .select('id, user_id, product_id, quantity_change, current_quantity, type, notes, created_at')
                .eq('user_id', userData.user.id)
                .eq('type', 'purchase')
                .order('created_at', { ascending: false })
                .limit(safeLimit);

            if (error) {
                throw error;
            }

            return data || [];
        } catch (error) {
            console.error('[ERP] 加载采购记录失败:', error);
            return [];
        }
    },

    // ==================== 财务管理 ====================
    async loadFinancesLegacy() {
        try {
            const { data, error } = await supabaseClient
                .from('erp_finances')
                .select('*')
                .eq('user_id', userData.user.id)
                .order('transaction_date', { ascending: false });

            if (error) {
                throw error;
            }

            return data || [];

        } catch (error) {
            console.error('[ERP] 加载财务数据失败:', error);
            return [];
        }
    },

    async addFinanceRecord(financeData) {
        try {
            const parseOptionalInt = (value) => {
                const parsed = parseInt(value, 10);
                return Number.isFinite(parsed) ? parsed : null;
            };
            const parseOptionalNumber = (value) => {
                if (value === '' || value === null || value === undefined) {
                    return null;
                }
                const parsed = Number(value);
                return Number.isFinite(parsed) ? parsed : null;
            };

            const insertPayload = {
                user_id: userData.user.id,
                type: financeData.type, // income, expense
                category: financeData.category || '',
                amount: parseFloat(financeData.amount),
                description: financeData.description || '',
                reference_id: financeData.reference_id || null,
                order_id: financeData.order_id || null,
                transaction_date: financeData.transaction_date || new Date().toISOString(),
                business_type: financeData.business_type || null,
                card_bank: financeData.card_bank || null,
                card_bill_day: parseOptionalInt(financeData.card_bill_day),
                card_repayment_day: parseOptionalInt(financeData.card_repayment_day),
                card_repayment_amount: parseOptionalNumber(financeData.card_repayment_amount),
                card_swipe_amount: parseOptionalNumber(financeData.card_swipe_amount),
                card_actual_amount: parseOptionalNumber(financeData.card_actual_amount),
                card_fee_amount: parseOptionalNumber(financeData.card_fee_amount),
                card_fee_rate: parseOptionalNumber(financeData.card_fee_rate),
                swipe_card_bank: financeData.swipe_card_bank || null,
                settlement_bank: financeData.settlement_bank || null,
                settlement_card_tail: financeData.settlement_card_tail || null,
                reminder_enabled: typeof financeData.reminder_enabled === 'boolean' ? financeData.reminder_enabled : null,
                reminder_days_before: parseOptionalInt(financeData.reminder_days_before),
                reminder_date: financeData.reminder_date || null
            };

            const fallbackDescriptionParts = [];
            if (insertPayload.business_type) {
                fallbackDescriptionParts.push(`业务类型:${insertPayload.business_type}`);
            }
            if (insertPayload.card_bank) {
                fallbackDescriptionParts.push(`银行:${insertPayload.card_bank}`);
            }
            if (insertPayload.card_bill_day) {
                fallbackDescriptionParts.push(`账单日:${insertPayload.card_bill_day}`);
            }
            if (insertPayload.card_repayment_day) {
                fallbackDescriptionParts.push(`还款日:${insertPayload.card_repayment_day}`);
            }
            if (insertPayload.card_repayment_amount !== null) {
                fallbackDescriptionParts.push(`应还:${Number(insertPayload.card_repayment_amount).toFixed(2)}`);
            }
            if (insertPayload.card_swipe_amount !== null) {
                fallbackDescriptionParts.push(`刷卡:${Number(insertPayload.card_swipe_amount).toFixed(2)}`);
            }
            if (insertPayload.card_actual_amount !== null) {
                fallbackDescriptionParts.push(`到账:${Number(insertPayload.card_actual_amount).toFixed(2)}`);
            }
            if (insertPayload.card_fee_amount !== null) {
                fallbackDescriptionParts.push(`手续费:${Number(insertPayload.card_fee_amount).toFixed(2)}`);
            }
            if (insertPayload.card_fee_rate !== null) {
                fallbackDescriptionParts.push(`费率:${Number(insertPayload.card_fee_rate).toFixed(2)}%`);
            }
            if (insertPayload.swipe_card_bank) {
                fallbackDescriptionParts.push(`刷卡卡:${insertPayload.swipe_card_bank}`);
            }
            if (insertPayload.settlement_bank) {
                fallbackDescriptionParts.push(`到账卡:${insertPayload.settlement_bank}${insertPayload.settlement_card_tail ? `(尾号${insertPayload.settlement_card_tail})` : ''}`);
            }
            if (insertPayload.reminder_enabled !== null) {
                fallbackDescriptionParts.push(`提醒:${insertPayload.reminder_enabled ? '开启' : '关闭'}`);
            }
            if (insertPayload.reminder_days_before !== null) {
                fallbackDescriptionParts.push(`提前天数:${insertPayload.reminder_days_before}`);
            }
            if (insertPayload.reminder_date) {
                fallbackDescriptionParts.push(`提醒日期:${insertPayload.reminder_date}`);
            }
            const fallbackExtraText = fallbackDescriptionParts.join('；');

            let payload = { ...insertPayload };
            let data = null;
            let error = null;
            const removedColumns = [];

            while (true) {
                const response = await supabaseClient
                    .from('erp_finances')
                    .insert([payload])
                    .select()
                    .single();

                data = response.data;
                error = response.error;

                if (!error) {
                    break;
                }

                if (error.code !== '42703') {
                    break;
                }

                const messageText = String(error.message || '');
                const columnMatch = messageText.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+of/i) || messageText.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i);
                const missingColumn = columnMatch?.[1] || null;
                if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
                    delete payload[missingColumn];
                    removedColumns.push(missingColumn);
                    continue;
                }
                if (Object.prototype.hasOwnProperty.call(payload, 'order_id')) {
                    delete payload.order_id;
                    removedColumns.push('order_id');
                    continue;
                }
                break;
            }

            if (!error && removedColumns.length > 0 && fallbackExtraText) {
                const mergedDescription = [String(payload.description || '').trim(), `[扩展信息] ${fallbackExtraText}`]
                    .filter(Boolean)
                    .join('；');
                const patchResult = await supabaseClient
                    .from('erp_finances')
                    .update({ description: mergedDescription })
                    .eq('id', data.id)
                    .eq('user_id', userData.user.id)
                    .select()
                    .single();
                if (!patchResult.error && patchResult.data) {
                    data = patchResult.data;
                }
            }

            if (error) {
                throw error;
            }

            this.state.finances.unshift(data);
            this.emitEvent('erpFinanceChanged', { record: data, action: 'created' });
            this.logAudit({
                module: 'finance',
                action: 'create',
                entityType: 'finance',
                entityId: data?.id || null,
                entityName: data?.category || '',
                details: {
                    after: {
                        id: data?.id || null,
                        type: data?.type || financeData?.type || '',
                        category: data?.category || financeData?.category || '',
                        amount: data?.amount || financeData?.amount || 0,
                        reference_id: data?.reference_id || financeData?.reference_id || null,
                        order_id: data?.order_id || financeData?.order_id || null,
                        description: data?.description || financeData?.description || ''
                    }
                }
            });

            return data;

        } catch (error) {
            console.error('[ERP] 添加财务记录失败:', error);
            return null;
        }
    },

    async addOrderProfitFinance(orderId, orderNumber, netProfit, profitDescription = '') {
        const profitAmount = parseFloat(netProfit || 0);
        const description = profitDescription || `订单 ${orderNumber} - 系统利润`;

        const systemResult = await this.addFinanceRecord({
            type: 'system',
            category: '利润',
            amount: profitAmount,
            description,
            reference_id: orderId,
            order_id: orderId
        });

        if (systemResult) {
            return systemResult;
        }

        const compatibleType = profitAmount >= 0 ? 'income' : 'expense';
        return this.addFinanceRecord({
            type: compatibleType,
            category: '利润(系统)',
            amount: Math.abs(profitAmount),
            description: `${description}（兼容模式）`,
            reference_id: orderId,
            order_id: orderId
        });
    },

    async ensureOrderFinanceRecords(order, orderNumber, totalAmount, totalCost, netProfit, items = []) {
        const { incomeDescription, costDescription, profitDescription } = this.buildOrderFinanceDescriptions(
            orderNumber,
            order.customer_id,
            items,
            totalAmount,
            totalCost,
            netProfit,
            {
                customerName: String(order?.customer_name || '').trim()
            }
        );

        const { data: existingRows, error } = await supabaseClient
            .from('erp_finances')
            .select('id, type, category')
            .eq('user_id', userData.user.id)
            .eq('reference_id', order.id);

        if (error) {
            console.error('[ERP] 补录财务记录前查询失败:', error);
            return;
        }

        const rows = existingRows || [];
        const hasIncome = rows.some(row => row.type === 'income' && row.category === '销售订单');
        const hasCost = rows.some(row => row.type === 'expense' && row.category === '销售成本');
        const hasProfit = rows.some(row => row.type === 'system' || row.category === '利润' || row.category === '利润(系统)');

        if (!hasIncome) {
            await this.addFinanceRecord({
                type: 'income',
                category: '销售订单',
                amount: totalAmount,
                description: incomeDescription,
                reference_id: order.id,
                order_id: order.id
            });
        }

        if (totalCost > 0 && !hasCost) {
            await this.addFinanceRecord({
                type: 'expense',
                category: '销售成本',
                amount: totalCost,
                description: costDescription,
                reference_id: order.id,
                order_id: order.id
            });
        }

        if (!hasProfit) {
            await this.addOrderProfitFinance(order.id, orderNumber, netProfit, profitDescription);
        }
    },

    async syncOrderFinanceRecords(orderId, orderNumber, totalAmount, totalCost, netProfit, context = {}) {
        const localOrder = this.state.orders.find(order => this.isSameId(order.id, orderId)) || {};
        let customerId = context?.customer_id || localOrder.customer_id || null;
        let items = Array.isArray(context?.items) && context.items.length > 0
            ? context.items
            : (Array.isArray(localOrder.items) ? localOrder.items : []);

        if (items.length === 0 || !customerId) {
            const detail = await this.loadOrderDetail(orderId);
            if (detail) {
                customerId = customerId || detail.customer_id || null;
                items = items.length > 0 ? items : (Array.isArray(detail.items) ? detail.items : []);
            }
        }

        const { incomeDescription, costDescription, profitDescription } = this.buildOrderFinanceDescriptions(
            orderNumber,
            customerId,
            items,
            totalAmount,
            totalCost,
            netProfit,
            {
                customerName: String(context?.customer_name || '').trim()
            }
        );

        const { data: rows, error } = await supabaseClient
            .from('erp_finances')
            .select('id, type, category')
            .eq('user_id', userData.user.id)
            .eq('reference_id', orderId);

        if (error) {
            console.error('[ERP] 同步订单财务记录失败:', error);
            return;
        }

        const records = rows || [];
        const incomeRow = records.find(row => row.type === 'income' && row.category === '销售订单');
        const costRow = records.find(row => row.type === 'expense' && row.category === '销售成本');
        const profitRow = records.find(row => row.type === 'system' || row.category === '利润' || row.category === '利润(系统)');

        if (incomeRow) {
            await supabaseClient
                .from('erp_finances')
                .update({ amount: totalAmount, description: incomeDescription })
                .eq('id', incomeRow.id)
                .eq('user_id', userData.user.id);
        }

        if (costRow) {
            await supabaseClient
                .from('erp_finances')
                .update({ amount: totalCost, description: costDescription })
                .eq('id', costRow.id)
                .eq('user_id', userData.user.id);
        }

        if (profitRow) {
            await supabaseClient
                .from('erp_finances')
                .update({
                    amount: profitRow.type === 'system' ? netProfit : Math.abs(netProfit),
                    description: profitDescription
                })
                .eq('id', profitRow.id)
                .eq('user_id', userData.user.id);
        }

        await this.ensureOrderFinanceRecords(
            { id: orderId, customer_id: customerId, customer_name: context?.customer_name || '' },
            orderNumber,
            totalAmount,
            totalCost,
            netProfit,
            items
        );
    },

    async addFinance(financeData) {
        try {
            const result = await this.addFinanceRecord(financeData);

            if (result) {
                if (typeof showToast === 'function') {
                    showToast('财务记录添加成功', 'success');
                }
            }

            return result;

        } catch (error) {
            console.error('[ERP] 添加财务失败:', error);
            if (typeof showToast === 'function') {
                showToast('添加财务失败: ' + error.message, 'error');
            }
            return null;
        }
    },

    async settlePayableFinance(financeId, options = {}) {
        try {
            const before = this.state.finances.find(item => this.isSameId(item.id, financeId)) || null;
            if (!before) {
                throw new Error('未找到应付账款记录');
            }

            const categoryText = String(before.category || '');
            if (!categoryText.includes('应付账款')) {
                throw new Error('该记录不是应付账款，无法结清');
            }

            const beforeDescription = String(before.description || '').trim();
            if (beforeDescription.includes('已驳回冲销')) {
                throw new Error('该应付记录对应采购已驳回冲销，禁止结清');
            }
            const purchaseOrderNo = this.extractPurchaseOrderNoFromText(beforeDescription);
            if (purchaseOrderNo) {
                const approvalMeta = await this.getPurchaseApprovalMetaByOrderNo(purchaseOrderNo);
                if (approvalMeta && String(approvalMeta.approvalStatus || '').toLowerCase() === 'rejected') {
                    throw new Error(`采购单 ${purchaseOrderNo} 已驳回，禁止结清应付`);
                }
            }

            const settleDate = options?.settleDate || new Date().toISOString();
            const settleNote = String(options?.note || '').trim();
            const payableAmount = Math.abs(parseFloat(before.amount) || 0);
            const requestedPaidAmount = Number(options?.paidAmount);
            const settleAmount = Number.isFinite(requestedPaidAmount) && requestedPaidAmount > 0
                ? Math.min(requestedPaidAmount, payableAmount)
                : payableAmount;
            const remainingAmount = Math.max(payableAmount - settleAmount, 0);
            if (settleAmount <= 0) {
                throw new Error('本次付款金额必须大于 0');
            }

            let data = null;
            let error = null;
            let paymentRecord = null;

            if (remainingAmount <= 0.000001) {
                const settleDescription = [
                    beforeDescription || '采购应付账款结清',
                    settleNote ? `结清备注：${settleNote}` : '',
                    `结清时间：${settleDate}`
                ].filter(Boolean).join('；');

                const response = await supabaseClient
                    .from('erp_finances')
                    .update({
                        type: 'expense',
                        category: '采购付款',
                        amount: payableAmount,
                        description: settleDescription,
                        transaction_date: settleDate
                    })
                    .eq('id', financeId)
                    .eq('user_id', userData.user.id)
                    .select()
                    .single();
                data = response.data;
                error = response.error;
            } else {
                const payableDescription = [
                    beforeDescription || '采购应付账款',
                    `已付：${settleAmount.toFixed(2)}`,
                    `剩余：${remainingAmount.toFixed(2)}`,
                    settleNote ? `备注：${settleNote}` : ''
                ].filter(Boolean).join('；');

                const updateResponse = await supabaseClient
                    .from('erp_finances')
                    .update({
                        type: 'system',
                        category: '应付账款',
                        amount: remainingAmount,
                        description: payableDescription
                    })
                    .eq('id', financeId)
                    .eq('user_id', userData.user.id)
                    .select()
                    .single();
                data = updateResponse.data;
                error = updateResponse.error;

                if (!error) {
                    paymentRecord = await this.addFinanceRecord({
                        type: 'expense',
                        category: '采购付款',
                        amount: settleAmount,
                        description: `${beforeDescription || '应付账款付款'}（本次付款）${settleNote ? `，备注：${settleNote}` : ''}`,
                        reference_id: before.reference_id || null,
                        order_id: before.order_id || null,
                        transaction_date: settleDate
                    });
                }
            }

            if (error) {
                throw error;
            }

            const index = this.state.finances.findIndex(item => this.isSameId(item.id, financeId));
            if (index >= 0) {
                this.state.finances[index] = data;
            }

            this.emitEvent('erpFinanceChanged', {
                financeId,
                action: remainingAmount > 0 ? 'payable-partial-settled' : 'payable-settled',
                record: data
            });
            this.logAudit({
                module: 'finance',
                action: 'settle_payable',
                entityType: 'finance',
                entityId: financeId,
                entityName: '采购付款',
                details: {
                    before,
                    after: data,
                    settle_amount: settleAmount,
                    remaining_amount: remainingAmount,
                    payment_record_id: paymentRecord?.id || null
                }
            });

            if (typeof showToast === 'function') {
                showToast(
                    remainingAmount > 0
                        ? `应付已付款 ${settleAmount.toFixed(2)}，剩余 ${remainingAmount.toFixed(2)}`
                        : '应付账款已结清',
                    'success'
                );
            }

            return data;
        } catch (error) {
            console.error('[ERP] 结清应付账款失败:', error);
            if (typeof showToast === 'function') {
                showToast('结清失败: ' + (error?.message || '未知错误'), 'error');
            }
            return null;
        }
    },

    async settleOrderReceivable(orderId, options = {}) {
        try {
            let before = this.state.orders.find(item => this.isSameId(item.id, orderId)) || null;
            if (!before) {
                before = await this.loadOrderDetail(orderId);
            }
            if (!before) {
                throw new Error('未找到订单记录');
            }

            if (String(before.payment_status || '').toLowerCase() === 'paid') {
                return before;
            }

            const settleDate = options?.settleDate || new Date().toISOString();
            const settleNote = String(options?.note || '').trim();
            const { data, error } = await supabaseClient
                .from('erp_orders')
                .update({
                    payment_status: 'paid'
                })
                .eq('id', orderId)
                .eq('user_id', userData.user.id)
                .select()
                .single();

            if (error) {
                throw error;
            }

            const index = this.state.orders.findIndex(item => this.isSameId(item.id, orderId));
            if (index >= 0) {
                this.state.orders[index] = { ...this.state.orders[index], ...data };
            }

            const { data: incomeRows, error: incomeQueryError } = await supabaseClient
                .from('erp_finances')
                .select('id, description')
                .eq('user_id', userData.user.id)
                .eq('reference_id', orderId)
                .eq('type', 'income')
                .eq('category', '销售订单');

            if (!incomeQueryError && Array.isArray(incomeRows) && incomeRows.length > 0) {
                const settleTag = `【已回款 ${String(settleDate).slice(0, 10)}】`;
                for (const row of incomeRows) {
                    const currentDesc = String(row?.description || '').trim();
                    if (currentDesc.includes('已回款')) {
                        continue;
                    }
                    const nextDesc = `${currentDesc || '销售订单回款'} ${settleTag}${settleNote ? ` 备注：${settleNote}` : ''}`.trim();
                    await supabaseClient
                        .from('erp_finances')
                        .update({ description: nextDesc })
                        .eq('id', row.id)
                        .eq('user_id', userData.user.id);
                }
            }

            this.emitEvent('erpOrderChanged', { orderId, action: 'payment-settled', payment_status: 'paid' });
            this.emitEvent('erpFinanceChanged', { orderId, action: 'receivable-settled' });
            this.logAudit({
                module: 'finance',
                action: 'settle_receivable',
                entityType: 'order',
                entityId: orderId,
                entityName: data?.order_number || before?.order_number || `订单#${orderId}`,
                details: {
                    before: {
                        payment_status: before?.payment_status
                    },
                    after: {
                        payment_status: data?.payment_status || 'paid'
                    },
                    settled_at: settleDate,
                    note: settleNote
                }
            });

            if (typeof showToast === 'function') {
                showToast('应收账款已确认回款', 'success');
            }
            return data;
        } catch (error) {
            console.error('[ERP] 结清应收账款失败:', error);
            if (typeof showToast === 'function') {
                showToast('回款确认失败: ' + (error?.message || '未知错误'), 'error');
            }
            return null;
        }
    },

    async deleteFinance(financeId) {
        try {
            const removedFinance = this.state.finances.find(f => this.isSameId(f.id, financeId)) || null;
            const { error } = await supabaseClient
                .from('erp_finances')
                .delete()
                .eq('id', financeId)
                .eq('user_id', userData.user.id);

            if (error) {
                throw error;
            }

            // 更新本地状态
            this.state.finances = this.state.finances.filter(f => !this.isSameId(f.id, financeId));
            this.logAudit({
                module: 'finance',
                action: 'delete',
                entityType: 'finance',
                entityId: financeId,
                entityName: removedFinance?.category || '',
                details: {
                    before: removedFinance
                }
            });

            if (typeof showToast === 'function') {
                showToast('财务记录删除成功', 'success');
            }

            return true;

        } catch (error) {
            console.error('[ERP] 删除财务记录失败:', error);
            if (typeof showToast === 'function') {
                showToast('删除财务记录失败: ' + error.message, 'error');
            }
            return false;
        }
    },

    // ==================== 统计数据 ====================
    getStatistics() {
        const calculateInventoryRisk = (products = []) => {
            return (products || []).filter(product => {
                const parsedStock = Number(product?.stock_quantity);
                const parsedMinStock = Number(product?.min_stock);
                const stock = Number.isFinite(parsedStock) ? parsedStock : 0;
                const minStock = Number.isFinite(parsedMinStock) ? parsedMinStock : 0;
                return minStock > 0 ? stock <= minStock : stock <= 3;
            }).length;
        };

        const orderStatusCounter = this.state.orders.reduce((counter, order) => {
            const status = this.normalizeOrderStatus(order?.status || 'pending');
            if (!Object.prototype.hasOwnProperty.call(counter, status)) {
                counter[status] = 0;
            }
            counter[status] += 1;
            return counter;
        }, {
            pending: 0,
            confirmed: 0,
            shipped: 0,
            signed: 0,
            completed: 0,
            refunded: 0,
            cancelled: 0
        });

        const stats = {
                customers: {
                    total: this.state.customers.length,
                    active: this.state.customers.filter(c => c.status === 'active').length,
                    inactive: this.state.customers.filter(c => c.status === 'inactive').length
            },
            products: {
                total: this.state.products.length,
                active: this.state.products.filter(p => p.status === 'active').length,
                lowStock: calculateInventoryRisk(this.state.products),
                totalValue: this.state.products.reduce((sum, p) => sum + (p.price * p.stock_quantity), 0)
            },
                orders: {
                    total: this.state.orders.length,
                    pending: this.state.orders.filter(o => {
                        const status = this.normalizeOrderStatus(o.status);
                        return !['completed', 'refunded', 'cancelled'].includes(status);
                    }).length,
                    processing: this.state.orders.filter(o => {
                        const status = this.normalizeOrderStatus(o.status);
                        return ['confirmed', 'shipped', 'signed'].includes(status);
                    }).length,
                    completed: this.state.orders.filter(o => o.status === 'completed').length,
                    statuses: orderStatusCounter,
                    totalRevenue: this.state.orders
                    .filter(o => o.status === 'completed')
                    .reduce((sum, o) => sum + parseFloat(o.total_amount), 0)
            },
            finances: {
                totalIncome: this.state.finances
                    .filter(f => f.type === 'income')
                    .reduce((sum, f) => sum + parseFloat(f.amount), 0),
                totalExpense: this.state.finances
                    .filter(f => f.type === 'expense')
                    .reduce((sum, f) => sum + parseFloat(f.amount), 0),
                netProfit: 0 // 将在下面计算
            }
        };

        stats.finances.netProfit = stats.finances.totalIncome - stats.finances.totalExpense;

        return stats;
    },

    // ==================== 搜索功能 ====================
    searchCustomers(keyword) {
        if (!keyword) return this.state.customers;

        const lowerKeyword = keyword.toLowerCase();
        return this.state.customers.filter(customer =>
            customer.name.toLowerCase().includes(lowerKeyword) ||
            customer.contact_person?.toLowerCase().includes(lowerKeyword) ||
            customer.phone?.includes(keyword) ||
            customer.email?.toLowerCase().includes(lowerKeyword)
        );
    },

    searchProducts(keyword) {
        if (!keyword) return this.state.products;

        const lowerKeyword = keyword.toLowerCase();
        return this.state.products.filter(product =>
            product.name.toLowerCase().includes(lowerKeyword) ||
            product.sku?.toLowerCase().includes(lowerKeyword) ||
            product.category?.toLowerCase().includes(lowerKeyword)
        );
    },

    searchOrders(keyword) {
        if (!keyword) return this.state.orders;

        const lowerKeyword = keyword.toLowerCase();
        return this.state.orders.filter(order =>
            order.order_number?.toLowerCase().includes(lowerKeyword) ||
            order.customer?.name?.toLowerCase().includes(lowerKeyword)
        );
    }
};

if (typeof window !== 'undefined') {
    window.ERP = ERP;
}

// ==================== 页面加载时初始化 ====================

// 立即设置事件监听器（在 DOMContentLoaded 之前）
window.addEventListener('userDataLoaded', function() {
    console.log('[ERP] userDataLoaded 事件触发');
    if (userData.isLoggedIn) {
        console.log('[ERP] 用户已登录，开始初始化 ERP');
        ERP.init();
    }
});

// 页面加载完成后，检查用户是否已经登录
document.addEventListener('DOMContentLoaded', function() {
    console.log('[ERP] DOMContentLoaded 触发');
    console.log('[ERP] userData.isLoggedIn:', userData.isLoggedIn);
    // 如果用户数据已经加载（userDataLoaded 事件可能在 DOMContentLoaded 之前触发）
    if (userData.isLoggedIn) {
        console.log('[ERP] 用户已登录，开始初始化 ERP（DOMContentLoaded）');
        ERP.init();
    }
});
