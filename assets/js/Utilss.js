// assets/js/Utilss.js
var Utilss = {

  // 生成一个简单唯一ID（给 WS 用）
  getUUID: function () {
    return Date.now() + Math.random().toString(36).substr(2, 10);
  },

  // ✅ 行情 WebSocket 地址（已写死，不需要你填 IP）
  getWsURL: function () {
    var uid = Utilss.getUUID();

    return "ws://120.25.236.183:8189/push?cname=ysxnew&uid=" + uid;
  },

  // 这个行情 WS 不需要你发送任何订阅数据
  getSendData: function () {
    return null;
  }

};
