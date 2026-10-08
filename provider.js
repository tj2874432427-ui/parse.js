function pureScheduleProvider(iframeContent = "", frameContent = "", dom = document) {
    // 1. 如果当前文档本身就是课表页（比如以后直接从 bxq.asp 进入）
    if (dom.querySelector("table[border='1'] td[width*='13.5']")) {
        return dom.body.outerHTML;
    }

    // 2. 找 src 里含 bxq.asp 的 iframe（这是你教务系统里课表页面的固定名字）
    var scheduleFrame = dom.querySelector('iframe[src*="bxq.asp"]');
    
    if (scheduleFrame) {
        try {
            var doc = scheduleFrame.contentDocument || scheduleFrame.contentWindow.document;
            if (doc) {
                return doc.body.outerHTML;
            }
        } catch (e) {
            // 跨域时忽略，走下面的兜底
        }
    }

    // 3. 兜底：遍历所有 iframe，找内部含课表特征的那个
    var iframes = dom.querySelectorAll("iframe");
    for (var i = 0; i < iframes.length; i++) {
        try {
            var doc2 = iframes[i].contentDocument || iframes[i].contentWindow.document;
            if (!doc2) continue;
            // 用课表页面的稳定特征：包含"课程表"标题或 13.5% 宽的 td
            if (doc2.querySelector("table[border='1']") ||
                doc2.body.innerHTML.indexOf("课程表") !== -1) {
                return doc2.body.outerHTML;
            }
        } catch (e) {
            continue;
        }
    }

    alert("没有获取到课表哦！请确认你已经登录，并进入了课表查询页面。");
    return "";
}
