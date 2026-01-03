
// Utilss.js
var Utilss = {

  getUUID: function () {
    return 'xxxxxx'.replace(/[x]/g, function () {
      return Math.floor(Math.random() * 16).toString(16);
    });
  },

  // ⚠️ 关键在这里
  getWsURL: function () {
    var ip = Plaintext.ipStr();

    // ⚠️ 端口和路径下一步抓
    return "ws://" + ip + ":端口/路径";
  },

  getSendData: function (uid) {
    return JSON.stringify({
      type: "ping",
      time: Date.now()
    });
  }

};
