/** 
 * 代聊插件
 * @Author: yao
 * @Date:   2017-07-18 10:57:44
 * @version:   2.0
 * @Last Modified by:   Marte
 * @Last Modified time: 2017-09-13 10:22:15
 */

(function (global) {
    "use strict"

    // 调试配置信息
    var CONFIG = {
        "debug": true,      // 是否控制台打印信息
        // 本地储存 通话信息
        "storageConfig": {
            "debug": true,  // 是否本地储存
            "total": 5    // 储存数目
        }
    };
    /**
     * 网站信息
     * 本地测试，更改网址即可
     */
    var webSiteInfo = {
        // 平台信息，如：OA、CRM
        "name": "",
        "protocol": location.protocol,   //location.protocol     https:
        "host": location.host     //location.host                crm.txooo.com
    };
    // 
    // 获取用户信息URL
    var requestURL = {
        "OA": {
            url: "//" + webSiteInfo.host + "/RBAC/Page/EmployeePage.ashx/GetPhoneInfo"
        },
        "CRM": {
            url: webSiteInfo.protocol + "//" + webSiteInfo.host + "/Tx-S-CRM/Customer.ashx/GetPhoneInfo"
        }
    }

    // 呼叫连接类型
    var ProtocolType = webSiteInfo.protocol == "http:" ? "ws" : "wss";
    // 服务类型
    var ServiceType = "";     // local   socket    http
    // 服务地址
    var ServiceUrl = "";
    // 查找号码归属地
    var callerlocUrl = "https://tcc.taobao.com/cc/json/mobile_tel_segment.htm";

    // 共用电话信息
    var calleeInfo = {
        "calleeName": "",       // 被叫昵称
        "calleePhone": "",      // 被叫加密 
        "calleeShow": "",       // 显示号码
        "calleeCallerloc": "",  // 号码归属地
        "userParam": null
    };
    //是否登录
    var isUserLogin = false;        //是否登录
    var isConnectServer = false;    //服务器连接状态
    //是否可通话
    var isVerifyPass = false;             //验证是否通过
    var isCallState = false;    // 通话状态

    // 提示信息
    var promptInfo = {
        "101": "未设置电话，电话服务不可用!",
        "102": "电话不可用!",
        "103": "电话可用!",
        "104": ""
    };

    // 用户所有电话信息
    var userPhoneInfo = [];
    // 品牌显示的id
    var userAllBrandsId = ["10234"];
    // 当前电话信息   //验证后电话
    var currentPhoneInfo = {
        "info": [],
        "state": ""
    };
    // 呼叫流程状态显示
    var callStateShow = {};

    // 用户个人信息
    var userInfo = {
        "user": "",     // G.EmployeeId   1369  1131   1336
        "name": "",     // G.Name || G_username || "客服"
        "phone": "0",   // 主叫号码
        "brandId": ""
    };

    // 验证号码是否可用
    var verifyUserInfo = {
        "action": "state",
        "user": "",
        "data": {}
    };
    var isInitVerify = true;    //默认是第一次验证

    // 通讯方法
    var localMethodName = "txCallJSEvent.instance";
    // local回调名称
    var localCallBackName = "callStateMessage";
    // 通话完成后，切换到拨号界面的时间
    var callFinishToDialTime = 2000;


    /**
     * 
     *   工具类 tools
     *   
     */
    var Tools = new function () {
        this.jsonp = function (options) {
            if (!options.url) {
                throw new Error("参数url不合法");
            }
            var callback = options.callback || "callback";  //回调参数，如： ?callback=jquery123456
            var callbackName = options.callbackName;        //回调参数，如： ?callback=jquery123456
            var data = options.data || {};                  //参数
            var time = options.timeout || 10000;            //超时时间
            var success = options.success;                  //成功函数
            var fail = options.fail;                        //失败函数

            //格式化参数
            function formatParams(obj) {
                if (typeof obj === "string") return obj;
                var arr = [];
                for (var name in obj) {
                    arr.push(encodeURIComponent(name) + '=' + encodeURIComponent(obj[name]));
                }
                return arr.join('&');
            }

            //创建 script 标签
            var oHead = document.getElementsByTagName('head')[0] || document.head;
            callbackName = callbackName || ('jsonp_' + Math.random()).replace("\.", "");
            data[callback] = callbackName;
            var params = formatParams(data);

            var oScript = document.createElement('script');//发送请求
            oScript.type = 'text/javascript';
            oScript.async = true;
            oScript.src = options.url + (options.url.indexOf("?") == -1 ? '?' : "&") + params;
            log.info(oScript.src);
            //创建jsonp回调函数
            window[callbackName] = function (json) {
                oHead.removeChild(oScript);
                clearTimeout(oScript.timer);
                window[callbackName] = null;
                success && success(json);
            };

            // 发送
            oHead.appendChild(oScript);

            //超时处理
            if (time) {
                oScript.timer = setTimeout(function () {
                    window[callbackName] = function () { };
                    oHead.removeChild(oScript);
                    fail && fail({ errCode: 1, errMsg: "请求超时!" });
                }, time);
            }
        };
        // cookie 
        this.cookie = function (name, value, options) {
            if (typeof value != 'undefined') { // name and value given, set cookie
                options = options || {};
                if (value === null) {
                    value = '';
                    options.expires = -1;
                }
                var expires = '';
                if (options.expires && (typeof options.expires == 'number' || options.expires.toUTCString)) {
                    var date;
                    if (typeof options.expires == 'number') {
                        date = new Date();
                        date.setTime(date.getTime() + (options.expires * 24 * 60 * 60 * 1000));
                    } else {
                        date = options.expires;
                    }
                    expires = '; expires=' + date.toUTCString(); // use expires attribute, max-age is not supported by IE
                }
                var path = options.path ? '; path=' + options.path : '';
                var domain = options.domain ? '; domain=' + options.domain : '';
                var secure = options.secure ? '; secure' : '';
                document.cookie = [name, '=', encodeURIComponent(value), expires, path, domain, secure].join('');
            } else { // only name given, get cookie
                var cookieValue = null;
                if (document.cookie && document.cookie != '') {
                    var cookies = document.cookie.split(';');
                    for (var i = 0; i < cookies.length; i++) {
                        var cookie = Tools.trimStr(cookies[i]);
                        // Does this cookie string begin with the name we want?
                        if (cookie.substring(0, name.length + 1) == (name + '=')) {
                            cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                            break;
                        }
                    }
                }
                return cookieValue;
            }
        };
        // 储存服务器信息 localStorage
        this.setLocalStorage = new function () {
            this.set = function (msg) {
                var config = CONFIG.storageConfig;
                if (window.localStorage) {
                    var logArr = (localStorage["call_log"] && localStorage["call_log"].split('&&&')) || [];
                    // storage是否大于100
                    if (logArr.length < config.total) {
                        logArr.push(JSON.stringify(msg));
                    } else {
                        logArr.shift();
                        logArr.push(JSON.stringify(msg));
                    }
                    localStorage.setItem('call_log', logArr.join('&&&'));
                } else {
                    alert("浏览器不支持localStorage");
                }
            };
            this.get = function () {
                return (localStorage["call_log"] && localStorage["call_log"].split('&&&')) || [];
            };
            this.clear = function () {
                window.localStorage && localStorage.removeItem('call_log');
            };
        };
        // 通话计时   t: 毫秒差
        this.callTime = function (t) {
            var leave1 = t % (24 * 3600 * 1000);         //计算天数后剩余的毫秒数  
            var h = Math.floor(leave1 / (3600 * 1000));
            //计算相差分钟数  
            var leave2 = leave1 % (3600 * 1000);     //计算小时数后剩余的毫秒数  
            var m = Math.floor(leave2 / (60 * 1000));
            //计算相差秒数  
            var leave3 = leave2 % (60 * 1000);       //计算分钟数后剩余的毫秒数  
            var s = Math.round(leave3 / 1000);

            h = s >= 60 ? h + 1 : h < 10 ? '0' + h : h;
            m = s >= 60 ? m + 1 : m < 10 ? '0' + m : m;
            s = s < 10 ? '0' + s : s;

            return h + ":" + m + ":" + s;
        };
        // 去掉首尾空白符
        this.trimStr = function (str) {
            if (!str) return "";
            str = str.toString();
            return str.replace(/^\s*(.*?)\s*$/, "$1");
        };
        // 事件监听
        this.addEvent = function (el, type, fn) {
            window.addEventListener ? el.addEventListener(type, fn, false) : el.attachEvent("on" + type, fn);
        };
        // 阻止冒泡
        this.cancelBubble = function (ev) {
            ev = ev || event;
            ev.stopPropagation ? ev.stopPropagation() : ev.cancelBubble = true;
        };
        //
        this.createDiv = function (id, name, text) {
            var div = document.createElement("div");
            div.id = id || "";
            div.className = name || "";
            div.innerHTML = text || "";
            document.body.appendChild(div);
        };
    };
    // 循环
    var $forEach = function (arr, cb) {
        for (var i = 0; i < arr.length; i++) {
            cb && cb(arr[i], i, arr);
        }
    }
    // 关闭执行
    window.onbeforeunload = function () {
        try {
            socket.close();
        } catch (ex) { }
    };
    // 查询id
    function $(id) { return document.getElementById(id); }
    function $all(id) { return document.querySelectorAll(id); }
    // 格式化时间
    Date.prototype.Format = function (fmt) {
        var o = {
            "M+": this.getMonth() + 1, //月份 
            "d+": this.getDate(), //日 
            "h+": this.getHours(), //小时 
            "m+": this.getMinutes(), //分 
            "s+": this.getSeconds(), //秒 
            "q+": Math.floor((this.getMonth() + 3) / 3), //季度 
            "S": this.getMilliseconds() //毫秒 
        };
        if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
        for (var k in o)
            if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
        return fmt;
    }
    //日志对象
    var log = new function () {
        var on = CONFIG.debug;
        this.setOn = function (onFlag) { on = onFlag; };
        this.getOn = function () { return on; };
        this.error = function (logStr) {
            try { on && console.error(logStr); } catch (e) { }
        };
        this.warn = function (logStr) {
            try { on && console.warn(logStr); } catch (e) { }
        };
        this.info = function (logStr) {
            try { on && console.info(logStr); } catch (e) { }
        };
        this.debug = function (logStr) {
            try { on && console.debug(logStr); } catch (e) { }
        };
    };

    /**
     * 
     * 页面模板
     * 
     */
    var callCssTemplate = `
        /* 公用样式 */
        .l-wrap { position: fixed; right: 5px; bottom: 30px; width: 270px; background-color: rgba(255,255,255,1); font-size: 14px; box-shadow: 0 0 1px 1px rgba(0,0,0,.2); border-radius: 8px; font-family: "Microsoft YaHei"; -webkit-user-select: none; box-sizing: border-box; overflow:hidden; z-index: 999;}
        .l-tools { position: absolute; top: 10px; right: 10px; z-index: 10; font-size: 0;}
        .l-tools span { display: inline-block; width: 12px; height: 12px; position: relative; box-sizing: border-box; cursor: pointer;}
        .l-tools span:nth-of-type(1) { width: 50px; height: 12px; line-height: 12px; font-size: 12px; color: #fff; vertical-align: top;}
        /*.l-tools span:nth-of-type(1) { border-top: 2px solid #fff; font-size: 12px;}
        .l-tools span:nth-of-type(1)::after { content:""; position: absolute; left:0; top: 4px; border: 6px solid transparent; border-top-color: #fff; }*/
        .l-tools span:last-of-type { margin-left: 10px; }
        .l-tools span:nth-of-type(2)::after { content:""; position: absolute; left:0; top: 5px; width: 100%; height: 2px; background: #fff; }
        .l-close { display: block; position: absolute; right:16px; top: 10px; width: 12px; height: 12px; cursor: pointer; text-align: center;color:#fff; font-size: 14px; z-index: 10; overflow: hidden;}
        .l-close::before { content:""; position: absolute; left:0; top: 5px; width: 100%; height: 1px; background: #fff; transform: rotate(45deg) scale(2); }
        .l-close::after { content:""; position: absolute; left:0; top: 5px; width: 100%; height: 1px; background: #fff; transform: rotate(-45deg) scale(2);}
        .l-head { position: absolute; top:0; left:0; width: 100%; height: 32px; line-height:32px; padding: 0 10px; font-size:14px; color: #fff; text-overflow: ellipsis; white-space: nowrap; color:#fff; background: #4b89ff; box-sizing: border-box;}
        .l-body { position: relative; height: 236px; margin:32px 0 0; border-bottom: 1px solid #dedede; box-sizing: border-box; overflow:hidden;}
        .l-body .b-span { display: inline-block; width: 24%; text-align: right; margin-right: 8px; white-space: nowrap; }
        .l-footer { width: 100%; height: 32px; padding: 0 10px; background: #f0f0f0; box-sizing: border-box; font-size: 0;}
        .l-footer span { float: left; margin-top: 6px; font-size: 14px; color: #333; cursor: pointer; }
        .l-footer span:nth-of-type(2) { margin-left: 20px; color: #4b89ff; }
        .l-footer span:nth-of-type(3) { float: right; }
        .l-footer span:nth-of-type(3):hover { text-decoration: underline; }
        .c-title-phone { font-size: 62.5%; margin-left: 3px;}
        
        /* 按钮 */
        .call-btn { position: fixed; right: 20px; bottom: 60px; width: 60px; height: 60px; border-radius: 50%; background: #999; text-align: center; cursor: default; border: 3px solid white; line-height:55px; box-sizing: border-box; z-index: 999;}
        .call-btn .call-img { display: block; width: 100%; height: 100%; background: url("//crm.txooo.com/TxExt/Img/phone.png") no-repeat center center; }

        /* 拨号 */
        .dial-container { display: none; }
        .dial-content { display: none; }
        .dial-content>div:nth-of-type(1) { height: 53px; }
        .dial-content>div:nth-of-type(2) { height: 52px; text-align: center;}
        .dial-content>div:nth-of-type(3) { text-align: center;}
        .dial-content .dial-face { width: 200px; font-size: 0; position: relative; margin: 0 auto;}
        .dial-content .dial-face .input-phone-text { display: inline-block; width: 200px; height: 32px; padding: 0 42px 0 6px; border: 1px solid #bbb; cursor: text; box-sizing: border-box; font-size: 14px; font-family: "Microsoft YaHei", Arial; color: #333; transition: box-shadow .5s ease-in-out;}
        .dial-content .dial-face .input-phone-text:focus { border: 1px solid rgba(45,140,240,1); }
        /*.dial-content .dial-face .input-phone-text:hover { box-shadow: 0 0 2px 0 rgba(45,140,240,1); }*/
        .dial-content .dial-face .phone-btn, 
        .set-phone-interface .phone-btn { display: inline-block; position: absolute; width: 32px; height: 32px; background: #569aea; border:1px solid #2967bc; box-sizing: border-box; vertical-align: top; right: 0; top:0;}
        .dial-content .phone-btn img, 
        .set-phone-interface .phone-btn img { display: block; width: 60%; position: absolute; left:50%; top:50%; transform: translate(-50%, -50%) rotate(180deg); transition: all .3s ease-in-out; }
        .dial-content .dial-tips { display: block; height: 20px; color: red; font-size: 12px; text-align: left;}
        
        .dial-content .dial-face .l-phone-list { display: none; position: absolute; left: 0; top: 31px; width: 200px; height: auto; font-size: 14px; list-style: none; padding:0; margin:0; text-align: left; background: #fff; border: 1px solid #dddee1; box-sizing: border-box; }
        .dial-content .dial-face li { height: 25px; line-height: 25px; padding: 0 6px;}
        .dial-content .dial-face li:hover { background: #eee;}
        .dial-content .dial-face .cls-history-log { float: right; margin-top: 7px; line-height: 1; color: #4b89ff; cursor: pointer; vertical-align: bottom;}
        .dial-content .l-call { display: inline-block; margin-top: 50px; width: 80px; height: 28px; line-height: 25px; border-radius: 8px; background: #569aea; border:1px solid #2967bc; box-sizing: border-box; color: #fff; cursor: pointer;}

        /* 通话 */
        .call-container { display: none; padding: 14px 20px 0; text-align: center; }
        .call-container .c-add-client { display: none; position: absolute; width:105px; right: 16px; top: 14px; margin-bottom: 10px; height: 14px; line-height: 14px; color: red; text-align: right; }
        .c-add-client span { display: block; margin-bottom: 10px; font-size: 14px; cursor: pointer;}
        .c-add-client span:hover { text-decoration: underline; }
        .call-container .c-phone { text-align: left; color: #333; font-size: 14px;}
        .call-container .c-phone span:first-child { height: 14px; line-height: 14px;}
        /*.call-container .c-phone span:last-child { float: right; text-align: left; color: #4b89ff; cursor: pointer; line-height:14px;}*/
        .call-container .c-phone-ownership { margin-top:10px; height: 12px; line-height:12px; text-align: left; font-size: 12px; }
        .call-container .c-state-img { margin-top: 40px; width: 60px; height: 60px; border: none;}
        .call-container .c-state { margin-top: 10px; color: #333; font-size: 14px; line-height:14px;}
        .call-container .c-state-over { color: #e94444; }
        .call-container .c-time { margin-top: 10px; color: #666; font-size: 14px; line-height:14px;}

        /* 错误提示 */
        .l-error-container { display: none; padding: 0; text-align: center; }
        .l-error-container .c-error-img { display: block; margin: 54px auto 30px; width: 60px; height: 60px; }
        .l-error-container .c-error-state { font-szie: 14px; }

        /* 设置 */
        .set-phone-interface { display: none; height: 300px; transition: all .3s ease-in-out .5s; font-size: 12px;}
        .set-phone-interface .l-body { height: 268px; padding: 0 22px; overflow: hidden; }
        .set-phone-interface .l-body > div { margin-top: 33px; }
        .set-phone-interface .call-type-1 { display: inline-block; padding: 3px 16px; border:1px solid #bbb; cursor: pointer; border-radius: 10px; }
        .set-phone-interface .call-type-1:nth-of-type(2) { margin-right: 16px;}
        .set-phone-interface .l-body span.action { border:1px solid #2967bc; background: #569aea; color: #fff; } 
        
        .set-phone-interface .s-phone-body { display: inline-block; position: relative; width: 150px; height: 32px; vertical-align: middle;}
        .set-phone-interface .s-phone-name { display: inline-block; position: relative; width: 150px; height: 32px; line-height: 31px; padding: 0 6px; box-sizing: border-box; border: 1px solid #bbb; vertical-align: middle; cursor: default;}
        .set-phone-interface .s-phone-list { display: none; position: absolute; left: 0; top: 31px; width: 100%; border: 1px solid #bbb; box-sizing: border-box; background: #fff; z-index: 99;}
        .set-phone-interface .s-phone-list li { height: 20px; line-height: 20px; padding: 0 6px; cursor: default; }
        .set-phone-interface .s-phone-list li.action { background: rgba(75, 137, 255, 0.6); }
        .set-phone-interface .s-phone-list li:hover { background: #eee; }
        .set-phone-interface .s-phone-tips { color: #0cb141; font-size: 12px;}
        .set-phone-interface .s-phone-tips.error { color: red;}
        /*.set-phone-interface .phone-btn { margin-left: -35px;}*/
        .set-phone-interface .s-show-phone { display: inline-block; height: 14px; font-size: 14px; color:red; -webkit-user-select: all;}
        .set-phone-interface .s-user { font-size: 0; text-align: center;}
        .set-phone-interface .s-user span { display: inline-block; width: 80px; height: 28px; line-height: 25px; border-radius: 8px; box-sizing: border-box; cursor: pointer; text-align: center; font-size: 14px;}
        .set-phone-interface .s-cancel { background: #fff; color: #000; border:1px solid #bbb; margin-right: 20px;}
        .set-phone-interface .s-confirm { background: #569aea; color: #fff; border:1px solid #2967bc; }
        .set-phone-interface .s-update { margin:0; padding:0; position: absolute; right: 25px; top: 158px; cursor: pointer; color: #0cb141; }

        /* 提示消息 */
        @keyframes showLog {
            0% { transform: translateX(100%); }
            100% { transform: translateX(0); }
        }
        #show-log { display:block; right: 5px; bottom:350px; width: 200px; transition: all 1s; animation: showLog 1s forwards; background-color: rgba(255,255,255,.8); z-index: 100; -webkit-user-select: text;}
        #show-log .l-body { height: auto; padding: 10px 16px; font-size: 12px; }
        #show-log .msg-time { }
        #show-log .msg-text { margin-top: 4px; }`;

    var callBtnTemplate = `<span class="call-img"></span>`;
    var callDialTemplate = `<div class="l-tools">
                <span id="l-open-interface" class="l-open-interface">切换电话</span>
                <span id="l-minimize" class="l-minimize"></span>
            </div>
            <div id="c-title" class="l-head">电话昵称</div>
            <div class="l-body">
                <div id="dial-content" class="dial-content">
                    <div></div>
                    <div class="dial-face">
                        <input type="text" id="input-phone-text" class="input-phone-text" name="dialphone" placeholder="请输入电话号码" />
                        <span id="dial-phone-btn" class="phone-btn" ><img src="//crm.txooo.com/TxExt/Img/up.png" /></span>
                        <div id="dial-tips" class="dial-tips"></div>
                        <ul id="l-phone-list" class="l-phone-list" data-state="false">
                            <!--<li>187 1234 5678</li>
                            <li>187 1234 5678</li>
                            <li>187 1234 5678</li>
                            <li><span id="cls-history-log" class="cls-history-log">清除历史记录</span></li>-->
                        </ul>
                    </div>
                    <div>
                        <span id="start-call" class="l-call">呼叫</span>
                    </div>
                </div>
                <div id="call-container" class="call-container">
                    <div class="c-phone">
                        <span id="c-phone">187 1234 45678</span>
                        <div id="c-phone-ownership" class="c-phone-ownership">北京 移动</div>
                    </div>
                    <div id="c-add-client" class="c-add-client">
                        <!--<span>已经有人负责啦啦！！</span>-->
                    </div>
                    <img id="c-state-img" class="c-state-img" src="//crm.txooo.com/TxExt/Img/s-from-x60.png"/>
                    <div id="c-state" class="c-state">正在呼叫...</div>
                    <div id="c-time" class="c-time">00:00:00</div>
                    <button id="call-stop" style="display: none;">挂断</button>
                </div>
                <div id="l-error-container" class="l-error-container">
                    <img id="c-error-img" class="c-error-img" src="//crm.txooo.com/TxExt/Img/s-dis-x60.png"/>
                    <div id="c-error-state" class="c-error-state"></div>
                </div>
            </div>
            <div class="l-footer">
                <span id="show-login-state"></span>
                <span id="anew-login"></span>
                <span id="call-log"></span>
            </div>`;
    var callSetTemplate = `<span id="set-interface-close" class="l-close"></span>
            <div id="s-title" class="l-head">电话昵称</div>
            <div class="l-body">
                <div>
                    <span class="b-span">呼叫方式：</span>
                    <span class="call-type call-type-1" data-type="call">直拨</span>
                    <span class="call-type call-type-1" data-type="callback">回拨</span>
                </div>
                <div>
                    <span class="b-span">接听方式：</span>
                    <!-- <select id="s-phone-name" class="s-phone-name"></select> -->
                    <div class="s-phone-body">
                        <span id="s-phone-name" class="s-phone-name"></span>
                        <span id="set-phone-btn" class="phone-btn">
                            <img id="set-phone-img" src="//crm.txooo.com/TxExt/Img/up.png" />
                        </span>
                        <ul id="s-phone-list" class="s-phone-list"></ul>
                        <div id="s-phone-tips" class="s-phone-tips"></div>
                    </div>
                </div>
                <div>
                    <span class="b-span">接听电话：</span>
                    <div id="s-show-phone" class="s-show-phone"></div>
                </div>
                <div class="s-user">
                    <span id="s-cancel" class="s-cancel">取消</span>
                    <span id="s-confirm" class="s-confirm">确定</span>
                </div>
                <span id="s-update" class="s-update">刷新</span>
            </div>`;

    var callHtmlTemplate = `
        <!-- 按钮界面 -->
        <div id="call-btn" class="call-btn"><span class="call-img"></span></div>
        <!-- 拨号 -->
        <div id="dial-container" class="l-wrap dial-container">
            <div class="l-tools">
                <span id="l-open-interface" class="l-open-interface">切换电话</span>
                <span id="l-minimize" class="l-minimize"></span>
            </div>
            <div id="c-title" class="l-head">电话昵称</div>
            <div class="l-body">
                <div id="dial-content" class="dial-content">
                    <div></div>
                    <div class="dial-face">
                        <input type="text" id="input-phone-text" class="input-phone-text" name="dialphone" placeholder="请输入电话号码" />
                        <span id="dial-phone-btn" class="phone-btn" ><img src="//crm.txooo.com/TxExt/Img/up.png" /></span>
                        <div id="dial-tips" class="dial-tips"></div>
                        <ul id="l-phone-list" class="l-phone-list" data-state="false">
                            <!--<li>187 1234 5678</li>
                            <li>187 1234 5678</li>
                            <li>187 1234 5678</li>
                            <li><span id="cls-history-log" class="cls-history-log">清除历史记录</span></li>-->
                        </ul>
                    </div>
                    <div>
                        <span id="start-call" class="l-call">呼叫</span>
                    </div>
                </div>
                <div id="call-container" class="call-container">
                    <div class="c-phone">
                        <span id="c-phone">187 1234 45678</span>
                        <div id="c-phone-ownership" class="c-phone-ownership">北京 移动</div>
                    </div>
                    <div id="c-add-client" class="c-add-client">
                        <!--<span>&lt;添加客户&gt;</span>
                        <span>&lt;添加线索&gt;</span>-->
                    </div>
                    <img id="c-state-img" class="c-state-img" src="//crm.txooo.com/TxExt/Img/s-from-x60.png"/>
                    <div id="c-state" class="c-state">正在呼叫...</div>
                    <div id="c-time" class="c-time">00:00:00</div>
                    <button id="call-stop" style="display: none;">挂断</button>
                </div>
                <div id="l-error-container" class="l-error-container">
                    <img id="c-error-img" class="c-error-img" src="//crm.txooo.com/TxExt/Img/s-dis-x60.png"/>
                    <div id="c-error-state" class="c-error-state"></div>
                </div>
            </div>
            <div class="l-footer">
                <span id="show-login-state"></span>
                <span id="anew-login"></span>
                <span id="call-log"></span>
            </div>
        </div>

        <!-- 设置 -->
        <div id="set-phone-interface" class="l-wrap set-phone-interface">
            <span id="set-interface-close" class="l-close"></span>
            <div id="s-title" class="l-head">当前电话不可用</div>
            <div class="l-body">
                <div>
                    <span class="b-span">呼叫方式：</span>
                    <span class="call-type call-type-1" data-type="call">直拨</span>
                    <span class="call-type call-type-1" data-type="callback">回拨</span>
                </div>
                <div>
                    <span class="b-span">接听方式：</span>
                    <!-- <select id="s-phone-name" class="s-phone-name"></select> -->
                    <div class="s-phone-body">
                        <span id="s-phone-name" class="s-phone-name"></span>
                        <span id="set-phone-btn" class="phone-btn">
                            <img id="set-phone-img" src="//crm.txooo.com/TxExt/Img/up.png" />
                        </span>
                        <ul id="s-phone-list" class="s-phone-list"></ul>
                        <div id="s-phone-tips" class="s-phone-tips"></div>
                    </div>
                </div>
                <div>
                    <span class="b-span">接听电话：</span>
                    <div id="s-show-phone" class="s-show-phone"></div>
                </div>
                <div class="s-user">
                    <span id="s-cancel" class="s-cancel">取消</span>
                    <span id="s-confirm" class="s-confirm">确定</span>
                </div>
                <span id="s-update" class="s-update">刷新</span>
            </div>
        </div>`;

    function createCallInterface() {
        Tools.createDiv("call-btn", "call-btn", callBtnTemplate);
        Tools.createDiv("dial-container", "l-wrap dial-container", callDialTemplate);
        Tools.createDiv("set-phone-interface", "l-wrap set-phone-interface", callSetTemplate);

        // html插入body
        // document.body.innerHTML += callHtmlTemplate;

        // 样式插入head
        var style = document.createElement("style");
        style.innerHTML = callCssTemplate;
        (document.getElementsByTagName('head')[0] || document.head).appendChild(style);
    }

    // 创建消息弹窗
    function createMsgPopup(msg, time) {
        removeMsgPopup();

        var logHTML = document.createElement('div');
        logHTML.id = "show-log";
        logHTML.className = "l-wrap";
        logHTML.innerHTML = `<span id="msg-close" class="l-close"></span>
            <div class="l-head">提示消息</div>
            <div class="l-body">
                <div id="msg-time" class="msg-time">${new Date().Format("yyyy/MM/dd hh:mm:ss")}</div>
                <div id="msg-text" class="msg-text">${msg}</div>
            </div>`;

        var showLog = document.body.appendChild(logHTML);

        // 关闭弹窗
        Tools.addEvent($("msg-close"), "click", function () {
            removeMsgPopup();
        });
    }
    function removeMsgPopup() {
        try {
            document.body.removeChild($("show-log"));
        } catch (e) { }
    }
    // end

    //
    // 业务操作
    window.addEventListener("load", function () {
        // 是否登录，未登录不进行任何操作
        try {
            if (G.EmployeeId !== "{$EmployeeId}") {
                isUserLogin = true;
            } else { return; };
        } catch (e) {
            try {
                if (G_employeeid !== "0") {
                    isUserLogin = true;
                } else { return; };
            } catch (e) { }
        }

        // crm品牌 过滤
        try {
            if (userAllBrandsId.indexOf(G_brandId) < 0) return;
        } catch (e) { }

        // 初始化环境信息
        // 获取用户信息 和 平台昵称
        (function () {
            if (webSiteInfo.host.indexOf("txooo.cc") != -1) {
                userInfo.user = G.EmployeeId;   // G.EmployeeId   1369  1131   1336
                userInfo.name = G.Name;         // G.Name || G_username || 客服
                webSiteInfo.name = "OA";
            }
            else if (webSiteInfo.host.indexOf("crm.txooo.com") != -1) {
                userInfo.user = G_employeeid;           // G.EmployeeId   1369  1131   1336
                userInfo.name = G_username || "客服";   // G.Name || G_username || 客服
                userInfo.brandId = G_brandId || "0";    // 
                webSiteInfo.name = "CRM";
            }
            verifyUserInfo.user = userInfo.user;
        })();

        // 插入body
        createCallInterface();
        // 初始化数据
        userInit();

        // 业务操作
        // 打开拨号界面
        $("call-btn").onclick = function () {
            $("dial-container").style.display = "block";

            if (!isConnectServer) {  // 失败页面
                DOMStyle.callErrorPage(promptInfo[101]);
                return;
            }
            $("dial-content").style.display = "block";
            $("call-container").style.display = "none";
            $("input-phone-text").focus();
            $("input-phone-text").value = "";
        };
        // 拨号 最小化
        $("l-minimize").onclick = function () {
            $("dial-container").style.display = "none";
        };
        // 输入号码时，回车键拨打号码
        $("input-phone-text").onkeyup = function (e) {
            if (e.keyCode === 13) $("start-call").click();
        };
        // 清除拨号界面提示信息
        $("input-phone-text").onfocus = function () {
            $("dial-tips").innerHTML = "";
        };

        $("call-stop").onclick = function () {
            socket.stop();
        };
        // 手动拨号
        // 呼叫
        $("start-call").onclick = function () {
            var phone = $all("input[name=dialphone]")[0].value.replace(/\s/g, "");

            if (!currentPhoneInfo.state) {
                $("dial-tips").innerHTML = currentPhoneInfo.info.name + ": " + promptInfo[102];
                //socket.log(currentPhoneInfo.info.name + ": " + promptInfo[102]);
                return;
            }
            if (phone.length < 1) return DOMStyle.dialTipsMsg("号码不能为空");
            if (/[^0-9]/.test(phone) || phone.length > 11) return DOMStyle.dialTipsMsg("手机号码必须为11位纯数字");

            // 手机号归属地查询
            Tools.jsonp({
                url: callerlocUrl,
                data: { "tel": phone },
                success: function (resData) {
                    if (typeof resData == "object") calleeInfo.calleeCallerloc = resData.carrier;
                }
            });

            calleeInfo.calleePhone = phone;
            calleeInfo.calleeName = "";
            calleeInfo.calleeShow = phone.replace(/(\d{3})(\d{4})(\d{4})/, "$1 $2 $3");
            // 拨打
            getCallAllParam();
        };

        // 拨号历史记录
        function fialHistoryLogState(ev, state) {
            Tools.cancelBubble(ev);     // 阻止冒泡
            var phoneBox = $("l-phone-list");
            var btnImg = $("dial-phone-btn").getElementsByTagName("img")[0];
            if (state == "false") {
                phoneBox.style.display = "block";
                phoneBox.setAttribute("data-state", "true");
                btnImg.style.transform = "translate(-50%, -50%) rotate(0deg)";
                return true;
            } else {
                phoneBox.style.display = "none";
                phoneBox.setAttribute("data-state", "false");
                btnImg.style.transform = "translate(-50%, -50%) rotate(180deg)";
                return false;
            }
        }
        // 隐藏设置下拉电话列表
        Tools.addEvent($("dial-container"), "click", function (ev) {
            fialHistoryLogState(ev, "true");  ///拨号历史记录
        });
        // 通话历史纪录
        $("dial-phone-btn").onclick = function (ev) {
            var html = "";
            // 储存服务器返回信息
            var callLog = Tools.setLocalStorage.get();
            var phoneBox = $("l-phone-list");
            if (callLog.length < 1) return DOMStyle.dialTipsMsg("没有通话记录");
            callLog.forEach(function (item, i) {
                item = JSON.parse(item);
                html += "<li>" + item.calleeShow + "</li>";
            });
            html += "<li><span id='cls-history-log' class='cls-history-log'>清除历史记录</span></li>";
            phoneBox.innerHTML = html;
            phoneBox.style.display = "block";

            var state = fialHistoryLogState(ev, phoneBox.getAttribute("data-state"));  ///拨号历史记录
            // 隐藏时不用任何操作
            if (!state) return;
            // 选中当前列表内容添加到input
            var aPhoneList = $("l-phone-list").getElementsByTagName("li");
            $forEach(aPhoneList, function (el, i, arr) {
                el.onclick = function (ev) {
                    if (el != arr[arr.length - 1]) {
                        $("input-phone-text").value = el.innerHTML;
                    } else {
                        $("input-phone-text").value = "";
                        Tools.cancelBubble(ev);     // 阻止冒泡
                    }
                };
            });

            // 清除历史记录
            Tools.addEvent($("cls-history-log"), "click", function (ev) {
                Tools.setLocalStorage.clear();
                fialHistoryLogState(ev, "true");  ///拨号历史记录
            });
        };

        // 
        // 打开设置界面
        $("l-open-interface").onclick = function () {
            $("set-phone-interface").style.display = "block";

            // 设置当前样式
            // DOMStyle.setCurrentBtnStyle(currentPhoneInfo.info.action);
            // callMethod.getCallPhoneList(currentPhoneInfo.info.action, currentPhoneInfo.info.type, currentPhoneInfo.info.index);

            DOMStyle.setTipsMsg();   // 设置提示消息
        };
        // 隐藏设置电话列表
        function setPhoneListState(ev, target) {
            Tools.cancelBubble(ev);     // 阻止冒泡
            //if(target) return;
            $("s-phone-list").style.display = "none";
            $("set-phone-img").style.transform = "translate(-50%, -50%) rotate(180deg)";
            $("s-phone-list").setAttribute("show-state", false);
            DOMStyle.setTipsMsg();   // 设置提示消息
        }
        // 关闭设置界面
        $("set-interface-close").onclick = $("s-cancel").onclick = function (ev) {
            setPhoneListState(ev);
            $("set-phone-interface").style.display = "none";
        };
        // 确定设置
        $("s-confirm").onclick = function (ev) {
            setPhoneListState(ev);
            if (!isConnectServer) return;
            if (!isVerifyPass) {
                $("s-phone-tips").innerHTML = verifyUserInfo.data.name + ": " + promptInfo[102];
                //socket.log(verifyUserInfo.data.name + ": " + promptInfo[102]);
                return;
            }
            $("set-phone-interface").style.display = "none";
            callMethod.localStorage();
        };
        // 切换呼叫类型按钮
        var callActionType = $all(".call-type");
        $forEach(callActionType, function (el, i, arr) {
            el.onclick = function (ev) {
                setPhoneListState(ev);
                if (this.className == "call-type call-type-1 action") return;
                // 设置当前样式
                DOMStyle.setCurrentBtnStyle(this.getAttribute("data-type"));
                // 获取当前的电话列表
                callMethod.getCallPhoneList(this.getAttribute("data-type"));
            };
        });

        // 隐藏设置下拉电话列表
        Tools.addEvent($("set-phone-interface"), "click", function (ev) {
            setPhoneListState(ev);
        });

        // 更改电话类型
        $("s-phone-name").onclick = $("set-phone-btn").onclick = function (ev) {
            var optList = $("s-phone-list").getElementsByTagName("li");

            if ($("s-phone-list").getAttribute("show-state") == "false") {
                $("s-phone-list").style.display = "block";
                $("set-phone-img").style.transform = "translate(-50%, -50%) rotate(0deg)";
                $("s-phone-list").setAttribute("show-state", true);

                $forEach(optList, function (el, i) {
                    if ($("s-phone-name").getAttribute("current-index") == i) {
                        optList[i].className = "action";
                    } else {
                        optList[i].className = "";
                    }
                });
            } else {
                $("s-phone-list").style.display = "none";
                $("set-phone-img").style.transform = "translate(-50%, -50%) rotate(180deg)";
                $("s-phone-list").setAttribute("show-state", false);
            }
            ev = ev || event;
            ev.stopPropagation ? ev.stopPropagation() : ev.cancelBubble = true;
        };

        // 更新数据
        $("s-update").onclick = function (ev) {
            setPhoneListState(ev);
            if (ServiceType === "socket") {  //webSiteInfo.name === "OA" && 
                return socket.update();
            }
            // 初始化数据
            userInit();
        };

        // 拨号时 
        // 通话状态显示
        callStateShow = {
            callInit: function (params) {
                $("dial-container").style.display = "block";
                $("dial-content").style.display = "none";
                $("call-container").style.display = "block";
                $("l-error-container").style.display = "none";
                $("c-title").innerHTML = currentPhoneInfo.info.action === "callback" ? "回拨" : "直拨";

                $("c-phone").innerHTML = params.phone;
                $("c-phone-ownership").innerHTML = params.callerloc || "";
                $("c-state-img").src = "//crm.txooo.com/TxExt/Img/s-from-x60.png";
                $("c-state").innerHTML = params.msg;
                $("c-state").className = "c-state";
                $("c-time").innerHTML = '';
            },
            // 呼叫主叫...
            caller: function (msg) {
                callStateShow.callInit({
                    "phone": userInfo.phone,
                    "msg": msg
                });
            },
            // 呼叫主叫 成功
            callerOK: function (msg) {
                $("c-state").innerHTML = msg;
            },
            ring: function (msg) {
                callStateShow.callInit({
                    "phone": calleeInfo.calleeShow,
                    "msg": msg
                });
            },
            // 呼叫被叫...
            callee: function (msg) {
                callStateShow.callInit({
                    "phone": calleeInfo.calleeShow,
                    "msg": msg,
                    "callerloc": calleeInfo.calleeCallerloc
                });
            },
            // 呼叫被叫 成功
            calleeOK: function (msg) {
                $("c-state-img").src = "//crm.txooo.com/TxExt/Img/s-to-x60.png";
                $("c-state").innerHTML = msg;
            },
            // 通话中
            success: function (msg) {
                if (ServiceType === "socket") {
                    socket.callOk = true;
                }
                $("c-state").innerHTML = msg || "通话中";
                $("c-time").innerHTML = Tools.callTime(0);
                // 如果有提示框
                removeMsgPopup();
                // 通话计时
                var date = new Date();
                socket.timer = setInterval(function () {
                    var t = new Date() - date;
                    $("c-time").innerHTML = Tools.callTime(t);
                }, 1000);
            },
            // 挂机
            callHUP: function (msg) {
                callStateShow.callOver(msg);
            },
            // 通话结束
            callOver: function (msg) {
                clearInterval(socket.timer);

                $("c-state-img").src = "//crm.txooo.com/TxExt/Img/s-calling-x60.png";
                $("c-state").innerHTML = msg;
                $("c-state").className = "c-state c-state-over";

                isCallState = false;
                callStateShow.stopInit();
            },
            stopInit: function () {
                setTimeout(function () {
                    $("dial-content").style.display = "block";
                    $("call-container").style.display = "none";
                    calleeInfo.calleeName = "";
                    calleeInfo.calleePhone = "";
                    calleeInfo.calleeShow = "";
                    calleeInfo.calleeCallerloc = "";

                    $("c-title").innerHTML = currentPhoneInfo.info.name + "<span class='c-title-phone'>（" + currentPhoneInfo.info.num + "）</span>";

                    $("c-phone").innerHTML = "000 0000 0000";
                    $("c-phone-ownership").innerHTML = "";
                    $("c-state-img").src = "";
                    $("c-state").innerHTML = "";
                    $("c-state").className = "c-state";
                    $("c-time").innerHTML = "";
                }, callFinishToDialTime)
            }
        };
    }, false);

    // 获取参数并拨打电话
    function getCallAllParam() {
        if (isCallState) return socket.log("上一次通话尚未结束。");

        // 呼叫参数
        var callParams = {
            "action": currentPhoneInfo.info.action,
            "user": userInfo.user,
            "caller": currentPhoneInfo.info,
            "callee": {
                "number": calleeInfo.calleePhone,
                "data": calleeInfo.userParam || { "type": "test", "id": "0" }
            }
        };
        // 当前主叫电话
        userInfo.phone = currentPhoneInfo.info.num; ///.replace(/(\d{3}).{4}(\d{4})/, "$1****$2");

        // 储存服务器返回信息
        Tools.setLocalStorage.set(calleeInfo);

        // 发送数据
        switch (ServiceType) {
            case "local":
                localService.call(callParams);
                break;
            case "socket":
                socket.send(callParams);
                break;
            case "http": break;
        }
    }
    //
    // 样式操作  
    var DOMStyle = {
        // 呼叫类型按钮 选中样式
        "setCurrentBtnStyle": function setCurrentBtnStyle(type) {
            var callTypes = $all(".call-type");
            for (var k = 0; k < callTypes.length; k++) {
                if (callTypes[k].getAttribute("data-type") === type) {
                    callTypes[k].className = 'call-type call-type-1 action';
                } else {
                    callTypes[k].className = 'call-type call-type-1';
                }
            }
        },
        // 通话按钮颜色状态
        "callBtnColorState": function callBtnColorState(state) {
            $("call-btn").style.background = state ? "#2490ff" : "#999";
            $("show-login-state").innerHTML = state ? "登录成功" : "登录失败";
            //$("anew-login").innerHTML = state ? "" : "重新登录";
        },
        "dialTipsMsg": function (msg) {
            $("dial-tips").innerHTML = msg || "";
        },
        // 设置界面提示消息样式
        "setTipsMsg": function setTipsMsg(msg, bool) {
            if (bool) {
                $("s-phone-tips").className = "s-phone-tips";
                $("s-phone-tips").innerHTML = msg || "";
            } else {
                $("s-phone-tips").className = "s-phone-tips error";
                $("s-phone-tips").innerHTML = msg || "";
            }
        },
        // 失败页面 显示
        "callErrorPage": function callErrorPage(msg) {
            DOMStyle.callBtnColorState(false);    //按钮显示颜色
            $("l-error-container").style.display = "block";
            $("call-container").style.display = "none";
            $("dial-content").style.display = "none";
            $("c-error-state").innerHTML = msg || "";
        }
    };

    /**
     * CRM平台
     */
    // 根据电话状态显示对应的类型
    var CRM_AddClient = {
        // 判断类型
        "init": function (params) {
            if (!params || webSiteInfo.name === "CRM") return;

            var addContainer = $("c-add-client");
            addContainer.innerHTML = "";
            var html = "";
            params && (addContainer.style.display = "block");
            params.callBack = false;
            log.info(params);

            switch (params.callState) {
                case "addClueOrCustomers":  //添加客户、添加线索
                    params.callBack = true;
                    html = `<span data-method="addClueWin">&lt;添加客户&gt;</span>
                    <span data-method="addCustomer">&lt;添加线索&gt;</span>`;
                    break;
                case "getCustomers":  //公共客户，显示领取按钮,点击后的方法
                    params.callBack = true;
                    html = `<span data-method="getCustomers">&lt;领取&gt;</span>`;
                    break;
                case "othersCustomers":  //不是我的线索或客户
                    html = `<span></span>`;
                    break;
                case "deleteCustomers":  //已经删除的客户,提示信息msg
                    html = `<span></span>`;
                    break;
            }
            addContainer.innerHTML = html;
            CRM_AddClient.callMethod(params);
        },
        // 绑定事件，并调用crm方法
        "callMethod": function (params) {
            var addContainer = $("c-add-client");
            var aSpan = addContainer.getElementsByTagName("span");

            $forEach(aSpan, function (el, i) {
                if (params.callBack) {
                    Tools.addEvent(el, "click", function (ev) {
                        switch (el.getAttribute("data-method")) {
                            case "addClueWin": //添加线索
                                log.info("添加线索");
                                addClueWin(calleeInfo.calleePhone, socket.sn);
                                break;
                            case "addCustomer": //添加客户
                                log.info("添加客户");
                                addCustomer(calleeInfo.calleePhone, socket.sn);
                                break;
                            case "getCustomers": //公共客户，显示领取按钮,点击后的方法
                                log.info("公共客户");
                                getCustomers(params.customersId, socket.sn);
                                break;
                        }
                    });
                } else {
                    switch (params.callState) {
                        case "deleteCustomers": //已经删除的客户,提示信息msg
                            log.info("已经删除的客户：" + params.msg);
                            //socket.log("已经删除的客户：" + params.msg);
                            el.innerHTML = params.msg;
                            break;
                        case "addCustomer": //别人的客户，显示已经有人认领
                            if (CRM_G_ISSubmitMobile === "true") {
                                var options = { callState: "addClueOrCustomers" };
                                CRM_AddClient.init(options);
                                log.info("重新添加客户");
                                return;
                            }
                            log.info("别人的客户: " + params.msg);
                            //socket.log("别人的客户: " + params.msg);
                            el.innerHTML = params.msg;
                            break;
                    }
                }
            });
        }
    };
    // CRM平台 end

    // 获取数据信息
    // 数据处理
    // 电话类型/电话号码 
    var callMethod = {
        // 初始化电话列表
        initPhoneList: function () {
            // 设置当前样式
            DOMStyle.setCurrentBtnStyle(currentPhoneInfo.info.action);
            callMethod.getCallPhoneList(currentPhoneInfo.info.action, currentPhoneInfo.info.type, currentPhoneInfo.info.index);
        },
        // 获取当前电话列表
        getCallPhoneList: function (action, type, index) {
            // 当前电话列表
            var phoneArr = callMethod.getCurrentCallList(action);
            // 显示电话列表
            if (phoneArr.length < 1) {
                $("s-phone-name").innerHTML = "";
                $("s-phone-list").innerHTML = "";
                $("s-show-phone").innerHTML = "";
                return "void";
            }

            var phoneList = $("s-phone-list");
            phoneList.innerHTML = "";

            for (var i = 0; i < phoneArr.length; i++) {
                phoneList.appendChild(this.createOption(phoneArr[i], i));
            }
            $("s-phone-list").setAttribute("show-state", false);

            // 根据呼叫type设置option
            callMethod.showCurrentCallPhone(type, index);

        },
        // 根据呼叫类型获取电话列表
        getCurrentCallList: function (action) {
            return userPhoneInfo.map(function (el, i) {
                return el[action] === "true" ? {
                    "action": action,
                    "type": el.type,
                    "name": el.name,
                    "phone": el.num.replace(/(\d{3})(\d{4})(\d{4})/, "$1 $2 $3"),
                    "index": i
                } : "";
            }).filter(function (el) { return el; });
        },
        createOption: function (prop, i) {
            var opt = document.createElement('li');
            opt.setAttribute("data-action", prop.action);
            opt.setAttribute("data-type", prop.type);
            opt.innerHTML = prop.name;
            opt.setAttribute("data-phone", prop.phone);
            opt.setAttribute("data-index", prop.index);
            opt.setAttribute("index", i);

            // 选择电话
            var optListSelect = function () {
                $("s-phone-name").setAttribute("current-index", i);
                $("s-phone-list").setAttribute("show-state", false);
                $("s-phone-list").style.display = "none";
                $("set-phone-img").style.transform = "translate(-50%, -50%) rotate(180deg)";

                if (opt.getAttribute("selected") == "true") return;

                callMethod.showCurrentCallPhone(this.getAttribute("data-type"), this.getAttribute("data-index"));
            }
            // 选中当前电话
            Tools.addEvent(opt, "click", optListSelect);

            return opt;
        },
        // 根据当前呼叫类型显示电话号码
        showCurrentCallPhone: function (type, index) {
            var optList = $("s-phone-list").getElementsByTagName("li");

            function template(i) {
                optList[i].setAttribute("selected", true);
                verifyUserInfo.data = userPhoneInfo[optList[i].getAttribute("data-index")];
                $("s-show-phone").innerHTML = optList[i].getAttribute("data-phone");
                $("s-phone-name").innerHTML = optList[i].innerHTML;
                $("s-phone-name").setAttribute("current-index", optList[i].getAttribute("index"));
                verifyUserInfo.data.action = optList[i].getAttribute("data-action");
                verifyUserInfo.data.index = optList[i].getAttribute("data-index");
            }

            // 切换呼叫方式 没有默认选项    
            if (!index) {
                //console.log(type, index);
                // 号码为空时
                if (optList.length < 1) return;
                template(0);
            } else {
                $forEach(optList, function (el, i, arr) {
                    if (el.getAttribute("data-type") === type && el.getAttribute("data-index") == index) {
                        template(i);
                    } else {
                        optList[i].removeAttribute("selected");
                    }
                });
            }
            // 发起验证
            serviceTypeHandler.setServiceConnect();
        },

        // 验证完成处理
        verifyFinishHandler: function (info) {
            if (info.state == "1") {
                isVerifyPass = true;
                // 初始化验证时（第一次），自动储存，之后手动储存
                if (isInitVerify) {
                    callMethod.localStorage();
                    isInitVerify = false;
                    //return;
                }
                callMethod.logUserCallType();
            } else {
                isVerifyPass = false;
                isInitVerify = false;

                // 设置提示消息
                DOMStyle.setTipsMsg(info.msg);

                localService.log(verifyUserInfo.data.name + ": " + verifyUserInfo.data.num + "<br/>" + info.msg);
            }
        },
        // 提示用户设置的呼叫类型
        logUserCallType: function () {
            // 用作显示呼叫类型/呼叫方式
            var zhAction = verifyUserInfo.data.action == "callback" ? "回拨" : "直拨";
            var phoneType = verifyUserInfo.data.name;
            var zhPhone = verifyUserInfo.data.num;

            // 设置提示消息
            DOMStyle.setTipsMsg(promptInfo[103], true);

            socket.log("呼叫类型：" + zhAction + "<br/>呼叫方式：" + phoneType + "<br/>电话号码：" + zhPhone);
        },
        localStorage: function () {
            currentPhoneInfo.info = verifyUserInfo.data;
            currentPhoneInfo.state = true;
            $("c-title").innerHTML = currentPhoneInfo.info.name + "<span class='c-title-phone'>（" + currentPhoneInfo.info.num + "）</span>";
            $("s-title").innerHTML = currentPhoneInfo.info.name + "<span class='c-title-phone'>（" + currentPhoneInfo.info.num + "）</span>";

            // 本地储存
            Tools.cookie("MyCallAction", JSON.stringify(currentPhoneInfo.info), { expires: 7 });

            log.info("储存: " + currentPhoneInfo.info.action + ' => ' + currentPhoneInfo.info.type + ' => ' + currentPhoneInfo.info.num);
        }
    };


    /**
     * socket 服务
     */
    var socket = new function () {
        this.state = false;  // 连接服务器状态
        this._socket = null; // socket对象
        this.timer = null;   // 通话计时
        this.callOk = false; // 挂机时，是否通话
        this.snFN = null;      // 通话sn
        this.sn = null;      // 通话sn
        this.verifyFN = null; // 电话验证

        this.init = function () {
            if (!isUserLogin) return;
            log.info("socket服务连接中...");
            try {
                log.info('new WebSocket("' + ProtocolType + '://' + ServiceUrl + '")');
                socket._socket = new WebSocket(ProtocolType + "://" + ServiceUrl);
            } catch (e) {
                DOMStyle.callErrorPage("请检查服务器地址!");
                //socket.log("请检查服务器地址!");
            }
            try {
                //链接成功
                socket._socket.onopen = function (msg) {
                    socket.state = true;
                    log.info("连接成功");
                    DOMStyle.callBtnColorState(true);    //按钮显示颜色
                    socket.verifyPhone();
                };
                //接受消息
                socket._socket.onmessage = function (msg) {
                    socket.message(msg);
                };
                //链接关闭
                socket._socket.onclose = function (msg) {
                    log.warn("呼叫中心断开!");
                    // socket.log("呼叫中心断开!");
                    socket.state = false;
                    socket.reg = false;
                    socket._socket = null;
                    //callBtnColorState(false);
                };
                //链接关闭
                socket._socket.onerror = function (msg) {
                    log.debug(msg);
                };
            }
            catch (ex) {
                log.info(ex);
            }
        };
        // 处理服务器返回的数据
        this.message = function (msg) {
            if (typeof msg.data == "string") {
                var _src = msg.data.replace("\0", "");
                var _json = JSON.parse(_src);

                log.info(_src);

                // 呼叫状态
                if (_json.action === "callback") {
                    //log.info("callback => " + _json.msg);  // 打印日志
                    switch (_json.state) {
                        case "CALL_CALLER":  // 已经呼叫主叫！
                            if (isCallState) return console.warn("已拦截第2次返回数据信息！");
                            // 自动拨打 // 手动拨打 getWebCallId 
                            if (socket.snFN) {
                                socket.snFN(_json.sn, calleeInfo.calleePhone);
                            } else {
                                try {
                                    // 查询数据库，获取添加信息状态
                                    CRM_AddClient.init(getCallMobileState(calleeInfo.calleePhone, _json.sn));
                                } catch (e) { log.warn(e); }
                                try {
                                    getCallMobile(calleeInfo.calleePhone, _json.sn);
                                } catch (e) { log.warn(e); }
                            }

                            socket.snFN = null;
                            socket.sn = _json.sn;
                            isCallState = true;
                            socket.caller(_json.msg);
                            break;
                        case "CALL_CALLER_OK":  // 呼叫主叫成功！
                            socket.callerOK(_json.msg);
                            break;
                        case "CALL_CALLEE":     // 已经呼叫被叫！
                            socket.callee(_json.msg);
                            break;
                        case "CALL_CALLEE_OK":   // 呼叫被叫成功！
                            socket.calleeOK(_json.msg);
                            break;
                        case "CALL_LINE":        // 通话中。。。
                            socket.success(_json.msg);
                            break;
                        case "CALLEE_HUP":       // 被叫挂机！
                            socket.callHUP(_json.msg);
                            break;
                        case "CALLER_HUP":        // 主叫挂机！
                            socket.callHUP(_json.msg);
                            break;
                        case "CALL_OVER":        // 呼叫结束！
                            socket.callOver(_json.msg);
                            break;
                        case "CALL_ERROR":        // 呼叫错误！
                            socket.log(_json.msg);
                            socket.callOver(_json.msg);
                            break;
                        default:
                            log.debug(_json.msg);
                            break;
                    }
                    return;
                }
                //消息
                if (_json.action === "msg") {
                    //log.info(_json.msg);
                    socket.log(_json.msg);
                    return;
                }
                //验证信息
                if (_json.action === "state") {
                    socket.verifyFN && socket.verifyFN(_json);
                    return;
                }
                // 更新数据
                if (_json.action === "update") {
                    if (_json.state === "1") {
                        socket.close();
                        userInit();
                        return;
                    }
                }
                // 未识别类型  返回数据
                if (_json.action == "reg") {
                    log.error(_json.msg);
                    return;
                }
            } else {
                log.warn("非文本消息");
            }
        };
        this.verifyPhone = function () {
            socket.send(verifyUserInfo, function (verifyResData) {
                callMethod.verifyFinishHandler(verifyResData);
            });
        };
        // 更新数据信息
        this.update = function (userId) {
            var options = {
                "action": "update"
            };
            userId && (options.user = userId);
            socket.send(options);
        };
        this.stop = function () {
            var options = {
                "action": "stop",
                "sn": socket.sn
            };
            socket.send(options);
        };
        // 发送消息
        this.send = function (params, fn) {
            // 与服务器是否连接
            if (socket.state) {
                // 验证用户信息
                if (params.action === "state") {
                    socket.verifyFN = fn;
                }

                log.info(JSON.stringify(params));
                socket._socket.send(JSON.stringify(params) + "\0");

            } else {
                log.warn("服务器未连接，请F5刷新页面!");
                //socket.log("服务器未连接，请F5刷新页面!!!");
                DOMStyle.callErrorPage("服务器未连接，请F5刷新页面!");
            }
        };
        // 呼叫主叫...
        this.caller = function (msg) {
            callStateShow.caller(msg);
        };
        // 呼叫主叫 成功
        this.callerOK = function (msg) {
            callStateShow.callerOK(msg);
        };
        // 呼叫被叫...
        this.callee = function (msg) {
            callStateShow.callee(msg);
        };
        // 呼叫被叫 成功
        this.calleeOK = function (msg) {
            callStateShow.calleeOK(msg);
        };
        // 通话中
        this.success = function (msg) {
            callStateShow.success();
        };
        // 挂机
        this.callHUP = function (msg) {
            callStateShow.callOver("通话结束");
        };
        // 通话结束
        this.callOver = function (msg) {
            callStateShow.callOver("通话结束");
        };
        // 弹窗
        this.log = function (msg, time) {
            createMsgPopup(msg, time);
        };
        // 关闭
        this.close = function () {
            socket._socket.close();
        };
    };

    /**
     * 本地服务
     */
    var localService = new function () {
        this.callbackName = "";
        this.state = false;

        this.init = function () {
            if (ServiceUrl !== localMethodName) return;
            localService.log("local服务初始化1");
            localService.state = true;
            DOMStyle.callBtnColorState(true);    //按钮显示颜色
            localService.verifyPhone();
        };
        // 验证电话
        this.verifyPhone = function () {
            localService.log(JSON.stringify(verifyUserInfo));
            log.info(JSON.stringify(verifyUserInfo));
            try {
                var verifyResData = txCallJSEvent.instance(JSON.stringify(verifyUserInfo));     // 验证电话
                localService.log("验证电话结果:" + verifyResData);
                verifyResData = JSON.parse(verifyResData);

                callMethod.verifyFinishHandler(verifyResData);
            } catch (e) {
                localService.log("没有txCallJSEvent对象");
                isVerifyPass = false;
                isInitVerify = false;
                // 设置提示消息
                DOMStyle.setTipsMsg(promptInfo[102]);
                //socket.log(verifyUserInfo.data.name + "：" + promptInfo[102]);
            }
        };
        // 呼叫回调函数
        window[localCallBackName] = function (data) {
            // 回调函数处理数据
            localService.callHandler(data);
        };
        // 呼叫 直拨
        this.call = function (option) {
            option.callBackName = localCallBackName;
            console.log(JSON.stringify(option));
            // 呼叫
            try {
                localService.log(JSON.stringify(option));
                var callState = txCallJSEvent.instance(JSON.stringify(option));
                if (!callState.state) {
                    localService.log(JSON.stringify(callState.msg));
                    log.info(JSON.stringify(callState.msg));
                }
            } catch (e) {
                localService.log("没有txCallJSEvent对象");
            }
        };
        // 呼叫回调处理
        this.callHandler = function (data) {
            // 呼叫状态
            switch (data.state) {
                case 106:  // 发起呼叫
                    localService.begin(data);
                    break;
                case 21:  //等待接听 响铃中
                    localService.ring(data);
                    break;
                case 16:  //对方已摘机
                    localService.success(data);
                    break;
                case 2:   //电话挂机
                    localService.over(data);
                    break;
                case 17:  //对方已经挂机
                    localService.over(data);
                    break;
                case 18:  //忙音
                    localService.over(data);
                    break;
                case 20:  //拨号
                    localService.dial(data);
                    break;
                default:
                    localService.log("未知呼叫状态：" + JSON.stringify(data));
                    break;
            }
        };
        //开始软件 拨号
        this.begin = function (data) {
            localService.log(JSON.stringify(data));
            callStateShow.callee("拨号中");
        };
        //等待接听 响铃中
        this.ring = function (data) {
            localService.log(JSON.stringify(data));
            callStateShow.ring("响铃中");
        };
        //通话中  对方已摘机
        this.success = function (data) {
            localService.log(JSON.stringify(data));
            callStateShow.success("通话中...");
        };
        //忙音
        this.over = function (data) {
            localService.log(JSON.stringify(data));
            callStateShow.callOver("通话结束");
        };
        //接收电话号码
        this.dial = function (data) {
            localService.log(JSON.stringify(data));
            //保存号码
            calleeInfo.calleePhone += data.keyNumber;
        };
        // 打印通话状态信息
        this.log = function (msg) {
            try {
                if (txCallJSEvent) {
                    if (!CONFIG.debug) return;
                    $("logDiv").innerHTML += new Date().Format("yyyy/MM/dd hh:mm:ss") + " " + msg + "<br/>";
                    $("logDiv").scrollTop = $("logDiv").scrollHeight;
                }
            } catch (e) { }
        };
        // 
        this.creatLogDiv = function () {
            try {
                if (txCallJSEvent) {
                    if (!CONFIG.debug) return;
                    var logDiv = document.createElement("div");
                    logDiv.id = "logDiv";
                    logDiv.setAttribute("style", "position: fixed; top: 0; right: 10px; width: 400px; height: 300px; padding: 10px; background: #fff; border: 1px solid #333; overflow: auto;");
                    document.body.appendChild(logDiv);
                }
            } catch (e) { }
        };
    };

    /**
     * http服务
     */
    var httpService = new function () {
        this.init = function () {
            console.log("http服务：初始化！！！");
            // 设置提示消息
            DOMStyle.setTipsMsg(promptInfo[102]);
        };
    }

    // 请求用户电话信息
    // 根据服务类型，选择服务连接
    var serviceTypeHandler = {
        init: function () {
            // 用于判断是否有默认电话
            var action = Tools.cookie("MyCallAction") && JSON.parse(Tools.cookie("MyCallAction")).action,
                phoneType = Tools.cookie("MyCallAction") && JSON.parse(Tools.cookie("MyCallAction")).type,
                phone = Tools.cookie("MyCallAction") && JSON.parse(Tools.cookie("MyCallAction")).num;
            log.info("本地设置: " + action + " => " + phoneType);

            // 没有本地设置
            if (!action && !phoneType) {
                log.info("没有本地储存电话");
                var isDefault = false;
                var isFirst = false;
                $forEach(userPhoneInfo, function (el, i, arr) {
                    if (!isFirst && el.default === "true" && el[el.defaultType] === "true") {
                        isFirst = true;
                        isDefault = true;
                        currentPhoneInfo.info = el;
                        currentPhoneInfo.info.action = el.defaultType;
                        currentPhoneInfo.info.index = i;
                    }
                });
                // 没有默认值
                if (!isDefault) {
                    log.info("并没有默认电话");
                    currentPhoneInfo.info = userPhoneInfo[0];
                    currentPhoneInfo.info.action = userPhoneInfo[0].callback == "true" ? "callback" : "call";
                    currentPhoneInfo.info.index = 0;
                }
            } else {
                log.info("有本地储存电话");
                var isState = false;
                $forEach(userPhoneInfo, function (el, i, arr) {
                    if (el[action] === "true" && el.type === phoneType && phone === el.num) {
                        currentPhoneInfo.info = el;
                        currentPhoneInfo.info.action = action;
                        currentPhoneInfo.info.index = i;
                        isState = true;
                    }
                });
                // 没有默认值
                if (!isState) {
                    log.info("但本地储存电话失效");
                    currentPhoneInfo.info = userPhoneInfo[0];
                    currentPhoneInfo.info.action = userPhoneInfo[0].callback == "true" ? "callback" : "call";
                    currentPhoneInfo.info.index = 0;
                    Tools.cookie("MyCallAction", "");
                    Tools.cookie("PhoneType", "");
                }
            }
            // 初始化
            serviceTypeHandler.serverType(currentPhoneInfo.info.serverType, currentPhoneInfo.info.serverAddress);
        },
        //
        serverType: function (type, address) {
            // 测试信息
            localService.creatLogDiv();
            switch (type) {
                case "local": serviceTypeHandler.local(address); break;
                case "socket": serviceTypeHandler.socket(address); break;
                case "http": serviceTypeHandler.http(address); break;
            }
            callMethod.initPhoneList();
        },
        //本地服务
        local: function (address) {
            log.info("服务类型：local");

            ServiceType = "local";
            ServiceUrl = address;
        },
        //socket服务
        socket: function (address) {
            log.info("服务类型：socket");

            //socket url
            ServiceType = "socket";
            ServiceUrl = address;
        },
        //http服务
        http: function (address) {
            ServiceType = "http";
            log.info("服务类型：http");
        },
        // 根据服务类型连接
        setServiceConnect: function () {
            ServiceType = verifyUserInfo.data.serverType;
            ServiceUrl = verifyUserInfo.data.serverAddress;
            DOMStyle.setTipsMsg();   // 设置提示消息

            switch (ServiceType) {
                case "local":
                    log.info("local服务: 验证");
                    localService.init();
                    break;
                case "socket":
                    log.info("socket服务: 验证");
                    socket.init();
                    break;
                case "http":
                    log.info("http服务: 验证");
                    isVerifyPass = false;
                    isInitVerify = false;
                    httpService.init();
                    break;
            }
        }
    };


    // 请求用户电话信息 JSONP
    var userInit = function () {
        Tools.jsonp({
            url: requestURL[webSiteInfo.name].url,
            success: function (reqUserInfo) {
                log.info(reqUserInfo);
                if (Array.isArray(reqUserInfo) && reqUserInfo.length >= 1) {
                    userPhoneInfo = reqUserInfo;
                    //电话初始化
                    serviceTypeHandler.init();
                    isConnectServer = true;
                }
            }
        });
    };

    // API impl
    // 对外接口
    var call_service = {
        //初始化
        init: function (params) {
            if (typeof params !== "object") return;
            CONFIG.debug = params.debug || false;
            CONFIG.socketUrl = params.url;
        },
        //打开服务器连接
        open: function () {
            socket.init();
        },
        //呼叫电话
        call: function (callee, params) {
            if (!currentPhoneInfo.state) {
                socket.log(currentPhoneInfo.info.name + ": " + promptInfo[102]);
                return;
            }
            calleeInfo.calleePhone = callee.to;
            calleeInfo.calleeName = callee.name;
            calleeInfo.calleeShow = callee.phone || callee.to;
            calleeInfo.userParam = params;
            // 获取参数并拨打电话
            getCallAllParam();
        },
        //更新用户电话信息
        update: function (userId) {
            socket.update(userId);
        },
        //获取通话sn
        getSN: function (cb) {
            cb && (socket.snFN = cb);
        },
        //关闭服务器连接
        close: function () {
            socket.close();
        }
    };

    // 对外接口
    global.webcall = call_service;

})(window || this);