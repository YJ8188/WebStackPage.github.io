/**
 * 金银行情数据解析器
 * 功能：解析 WebSocket 返回的数据并更新到页面
 */

console.log('[parserData] 数据解析器已加载');

/**
 * 解析 WebSocket 数据并更新页面
 * @param {Object} data - WebSocket 返回的数据
 */
function parserData(data) {
    console.log('[parserData] 收到数据:', data);
    
    try {
        // 遍历数据，更新对应的 DOM 元素
        for (var key in data) {
            var element = document.getElementById(key);
            if (element) {
                element.textContent = data[key];
                console.log('[parserData] 更新元素 ' + key + ' = ' + data[key]);
            }
        }
    } catch (e) {
        console.error('[parserData] 数据解析失败:', e);
    }
}