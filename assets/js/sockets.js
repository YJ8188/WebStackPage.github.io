// assets/js/sockets.js

var ws = null;

function startWS() {
  var url = Utilss.getWsURL();
  console.log("行情 WS 连接：", url);

  ws = new WebSocket(url);

  ws.onopen = function () {
    console.log("✅ 行情 WebSocket 已连接");
  };

  ws.onmessage = function (e) {
    try {
      var data = JSON.parse(e.data);
      console.log("📈 收到行情数据：", data);
      renderData(data);
    } catch (err) {
      // 非 JSON 数据忽略
    }
  };

  ws.onclose = function () {
    console.log("❌ WS 断开，3 秒后重连");
    setTimeout(startWS, 3000);
  };

  ws.onerror = function () {
    ws.close();
  };
}

// 简单渲染（后续我会帮你对齐原站字段）
function renderData(data) {
  if (!data || !data.code) return;

  var buyEl = document.getElementById(data.code + "_B");
  var sellEl = document.getElementById(data.code + "_A");

  if (buyEl && data.buy) buyEl.innerText = data.buy;
  if (sellEl && data.sell) sellEl.innerText = data.sell;
}

// 页面加载完成后自动启动行情
document.addEventListener("DOMContentLoaded", function () {
  startWS();
});
