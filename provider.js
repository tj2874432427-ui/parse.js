function pureScheduleProvider() {
    var dom = (typeof document !== "undefined") ? document : null;
    if (!dom) return "";

    // 判断某个 doc 里是否有课表
    function hasSchedule(doc) {
        if (!doc) return false;
        // 用 getAttribute 判断，避免 td[width='13.5%'] 选择器在部分环境失效
        var tds = doc.querySelectorAll("td");
        for (var i = 0; i < tds.length; i++) {
            var w = tds[i].getAttribute("width");
            if (w && w.indexOf("13.5") !== -1) return true;
        }
        return false;
    }

    // 1. 当前文档就是课表页
    if (hasSchedule(dom)) {
        console.log("[provider] 在当前文档找到课表");
        return dom.body.outerHTML;
    }

    // 2. 优先找 bxq.asp iframe
    var scheduleFrame = dom.querySelector('iframe[src*="bxq.asp"]');
    if (scheduleFrame) {
        try {
            var doc = scheduleFrame.contentDocument || scheduleFrame.contentWindow.document;
            if (hasSchedule(doc)) {
                console.log("[provider] 在 bxq.asp iframe 找到课表");
                return doc.body.outerHTML;
            }
        } catch (e) {
            console.warn("[provider] bxq.asp iframe 访问失败:", e.message);
        }
    }

    // 3. 兜底：遍历所有 iframe
    var iframes = dom.querySelectorAll("iframe");
    for (var i = 0; i < iframes.length; i++) {
        try {
            var d = iframes[i].contentDocument || iframes[i].contentWindow.document;
            if (hasSchedule(d)) {
                console.log("[provider] 在第 " + i + " 个 iframe 找到课表");
                return d.body.outerHTML;
            }
        } catch (e) { continue; }
    }

    alert("没有获取到课表哦！请确认你已经登录，并进入了课表查询页面。");
    return "";
}
