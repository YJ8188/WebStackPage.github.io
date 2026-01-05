var lockReconnect = false;  //避免ws重复连接
var isConn = false;
var ws = null;          // 判断当前浏览器是否支持WebSocket
var uidStr = Utilss.getUUID()
var wsUrl = Utilss.getWsURL()+uidStr;
var connCount = 0;

createWebSocket(wsUrl);   //连接ws
function createWebSocket(url) {

    try {
        if ('WebSocket' in window) {
            ws = new WebSocket(url);
        }
        initEventHandle();
    } catch (e) {
        reconnect(url);
        console.log(e);
    }
}

function reconnect(url) {
    if (lockReconnect) return;
    lockReconnect = true;
    getFormula();
    setTimeout(function () {     //没连接上会一直重连，设置延迟避免请求过多
        createWebSocket(url);
        lockReconnect = false;
    }, 2000);
}

function initEventHandle() {
    ws.onclose = function () {
        isConn = false;
        if (connCount>5) {
            connCount = 0;
            window.location.href = "/";
        }
        connCount = connCount+1;
        reconnect(wsUrl);
        console.log("llws连接关闭!" + new Date().toLocaleString());
    };
    ws.onerror = function () {
        isConn = false;
        reconnect(wsUrl);
        console.log("llws连接错误!");
    };
    ws.onopen = function () {
        isConn = true;

        heartCheck.reset().start();      //心跳检测重置
        console.log("llws连接成功!" + new Date().toLocaleString());
    };
    ws.onmessage = function (event) {    //如果获取到消息，心跳检测重置
        heartCheck.reset().start();      //拿到任何消息都说明当前连接是正常的

        var data = JSON.parse(event.data);
        parserData(data);

    };
}


// 监听窗口关闭事件，当窗口关闭时，主动去关闭websocket连接，防止连接还没断开就关闭窗口，server端会抛异常。
window.onbeforeunload = function () {
    console.log("窗口关闭断开"+ new Date().toLocaleString());
    ws.close();
}


//心跳检测
var heartCheck = {
    timeout: 3000,        //1分钟发一次心跳
    timeoutObj: null,
    serverTimeoutObj: null,
    reset: function () {
        clearTimeout(this.timeoutObj);
        clearTimeout(this.serverTimeoutObj);
        return this;
    },
    start: function () {
        var self = this;
        this.timeoutObj = setTimeout(function () {
            //这里发送一个心跳，后端收到后，返回一个心跳消息，
            //onmessage拿到返回的心跳就说明连接正常
            ws.send(Utilss.getSendData(uidStr));
            // console.log("ping!")
            self.serverTimeoutObj = setTimeout(function () {//如果超过一定时间还没重置，说明后端主动断开了
                console.log("服务器主动断开"+ new Date().toLocaleString());
                ws.close();     //如果onclose会执行reconnect，我们执行ws.close()就行了.如果直接执行reconnect 会触发onclose导致重连两次

            }, self.timeout)
        }, this.timeout)
    }
}

$(document).on('visibilitychange', function (e) {
    if (e.target.visibilityState === "visible") {
        if (isConn == false) {
            createWebSocket(wsUrl);
        }

        getFormula();
    } else if (e.target.visibilityState === "hidden") {
        //ws.close();
        console.log('Tab is now hidden!');
    }
});
