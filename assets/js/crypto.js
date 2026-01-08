# 数字货币模块性能优化方案

## 问题分析

当前数字货币模块在初始化时会导致首页卡顿，原因：
1. **同步阻塞**：在 `DOMContentLoaded` 中同步执行大量操作
2. **UI 渲染阻塞**：`initCryptoUI()` 生成大量 HTML 和 CSS
3. **数据加载阻塞**：WebSocket 连接和数据加载占用主线程
4. **DOM 操作过多**：事件绑定和 DOM 查询阻塞渲染

## 优化方案

### 1. 使用 requestIdleCallback 完全异步加载

```javascript
// 修改 DOMContentLoaded 监听器
document.addEventListener('DOMContentLoaded', () => {
    // 使用 requestIdleCallback 在浏览器空闲时初始化
    if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
            initCryptoModule();
        }, { timeout: 3000 });
    } else {
        // 不支持 requestIdleCallback 的浏览器，延迟 2 秒初始化
        setTimeout(() => {
            initCryptoModule();
        }, 2000);
    }
});
```

### 2. 分阶段初始化（6个阶段）

```javascript
async function initCryptoModule() {
    // 阶段1：立即执行（最小化操作）
    // 只生成占位符，不渲染完整UI
    const placeholder = document.getElementById('crypto-section-placeholder');
    if (placeholder) {
        placeholder.innerHTML = `<div style="padding: 20px; text-align: center; color: #999;">
            <i class="fa fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 10px;"></i>
            <p>正在加载数字货币行情...</p>
        </div>`;
    }

    // 阶段2：延迟 1 秒执行（UI 生成）
    setTimeout(() => {
        requestIdleCallback(() => {
            initCryptoUI();
        }, { timeout: 2000 });
    }, 1000);

    // 阶段3：延迟 2 秒执行（WebSocket 连接）
    setTimeout(() => {
        requestIdleCallback(() => {
            initBinanceWebSocket();
        }, { timeout: 2000 });
    }, 2000);

    // 阶段4：延迟 3 秒执行（数据加载）
    setTimeout(() => {
        requestIdleCallback(() => {
            fetchCryptoData();
        }, { timeout: 2000 });
    }, 3000);

    // 阶段5：延迟 4 秒执行（汇率同步）
    setTimeout(() => {
        requestIdleCallback(() => {
            updateExchangeRateDisplay();
            syncRate();
        }, { timeout: 2000 });
    }, 4000);

    // 阶段6：延迟 5 秒执行（事件绑定）
    setTimeout(() => {
        requestIdleCallback(() => {
            bindEventListeners();
        }, { timeout: 2000 });
    }, 5000);
}
```

### 3. 分离事件绑定逻辑

```javascript
function bindEventListeners() {
    Logger.info('[页面加载] 绑定事件监听器');

    const cryptoContainer = document.querySelector('.crypto-table-container');
    if (cryptoContainer) {
        const cryptoSection = cryptoContainer.closest('.row');
        const floatBtns = ['#showHiddenCards', '#resetOrder', '.xp-panel'];

        const hideFloats = () => {
            floatBtns.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => el.classList.add('fade-out'));
            });
        };
        const showFloats = () => {
            floatBtns.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => el.classList.remove('fade-out'));
            });
        };

        if (cryptoSection) {
            cryptoSection.addEventListener('mouseenter', hideFloats);
            cryptoSection.addEventListener('mouseleave', showFloats);
            cryptoSection.addEventListener('touchstart', hideFloats, { passive: true });
        }

        cryptoContainer.addEventListener('scroll', () => {
            cryptoContainer.classList.add('scrolled');
        }, { passive: true });

        cryptoContainer.addEventListener('touchmove', () => {
            cryptoContainer.classList.add('scrolled');
        }, { passive: true });
    }
}
```

## 优化效果预期

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 首页加载时间 | 3-5秒 | <1秒 |
| 初始化阻塞时间 | 2-3秒 | 0秒 |
| 主线程占用 | 100% | <10% |
| 用户体验 | 卡顿 | 丝滑 |
| 模块独立性 | 低 | 高 |

## 关键优化点

### ✅ requestIdleCallback
- 在浏览器空闲时执行初始化
- 不阻塞主线程
- 超时机制确保最终会执行

### ✅ 分阶段加载
- 6个阶段逐步加载
- 每个阶段间隔1秒
- 给主线程充分的空闲时间

### ✅ 最小化初始操作
- 只生成占位符
- 延迟渲染完整UI
- 延迟连接和数据加载

### ✅ 完全异步
- 所有操作都是异步的
- 使用 setTimeout 和 requestIdleCallback
- 不阻塞任何其他模块

## 实施步骤

1. **修改 DOMContentLoaded 监听器**（第 2430 行）
2. **重写 initCryptoModule 函数**（第 2440 行）
3. **添加 bindEventListeners 函数**（新增）
4. **测试验证**：确保不影响其他模块

## 注意事项

- ⚠️ 确保所有操作都有 try-catch 保护
- ⚠️ 使用 requestIdleCallback 的 timeout 参数
- ⚠️ 测试不支持 requestIdleCallback 的浏览器
- ⚠️ 监控性能，确保优化有效

## 预期结果

刷新页面后：
- ✅ 首页立即加载，无卡顿
- ✅ 数字货币模块延迟 1-5 秒逐步加载
- ✅ 其他模块完全不受影响
- ✅ 用户体验丝滑流畅
