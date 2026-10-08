function pureScheduleProvider() {
    // 直接使用全局 document，不依赖外部传参
    var dom = (typeof document !== "undefined") ? document : null;
    if (!dom) {
        return "";
    }

    // 1. 当前文档本身就是课表页
    if (typeof dom.querySelector === "function" && dom.querySelector("table[border='1']")) {
        return dom.body.outerHTML;
    }

    // 2. 优先找 bxq.asp 的 iframe
    if (typeof dom.querySelector === "function") {
        var scheduleFrame = dom.querySelector('iframe[src*="bxq.asp"]');
        if (scheduleFrame) {
            try {
                var doc = scheduleFrame.contentDocument || scheduleFrame.contentWindow.document;
                if (doc) return doc.body.outerHTML;
            } catch (e) {}
        }
    }

    // 3. 兜底：遍历所有 iframe 找课表页
    var iframes = dom.querySelectorAll ? dom.querySelectorAll("iframe") : [];
    for (var i = 0; i < iframes.length; i++) {
        try {
            var d = iframes[i].contentDocument || iframes[i].contentWindow.document;
            if (!d) continue;
            if (d.querySelector("table[border='1']") ||
                d.body.innerHTML.indexOf("课程表") !== -1) {
                return d.body.outerHTML;
            }
        } catch (e) { continue; }
    }

    alert("没有获取到课表哦！请确认你已经登录，并进入了课表查询页面。");
    return "";
}
