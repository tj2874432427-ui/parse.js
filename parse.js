function parser() {
    // ==========================================
    // 1. 最终返回的数据结构
    // ==========================================
    var importData = {
        "version": 1,
        // 四川农业大学作息时间
        "times": [
            {"start": "08:10", "end": "08:55"}, // 第1节
            {"start": "09:05", "end": "09:50"}, // 第2节
            {"start": "10:10", "end": "10:55"}, // 第3节
            {"start": "11:05", "end": "11:50"}, // 第4节
            {"start": "14:20", "end": "15:05"}, // 第5节
            {"start": "15:15", "end": "16:00"}, // 第6节
            {"start": "16:20", "end": "17:05"}, // 第7节
            {"start": "17:15", "end": "18:00"}, // 第8节
            {"start": "19:30", "end": "20:15"}, // 第9节
            {"start": "20:25", "end": "21:10"}, // 第10节
            {"start": "21:20", "end": "22:05"}  // 第11节（应对"3学时"情况）
        ],
        "courses": []
    };

    // ==========================================
    // 2. 工具函数：判断某个 td 是否是星期列
    // ==========================================
    function isWeekCell(td) {
        var w = td.getAttribute("width");
        return w && w.indexOf("13.5") !== -1;
    }

    // 判断某个 table 是否是课表主表格
    // 关键：只看直接子元素，不穿透嵌套表格
    function isScheduleTable(table) {
        if (!table) return false;
        var tbody = table.querySelector("tbody") || table;
        var rows = tbody.children;
        for (var i = 0; i < rows.length; i++) {
            if (rows[i].tagName !== "TR") continue;
            var cells = rows[i].children;
            for (var j = 0; j < cells.length; j++) {
                if (cells[j].tagName !== "TD") continue;
                if (isWeekCell(cells[j])) return true;
            }
        }
        return false;
    }

    // 在某个 document 里找到课表主表格
    function findMainTable(doc) {
        if (!doc) return null;
        var tables = doc.querySelectorAll("table");
        for (var t = 0; t < tables.length; t++) {
            if (isScheduleTable(tables[t])) return tables[t];
        }
        return null;
    }

    // ==========================================
    // 3. 获取目标 document（当前文档 或 任意 iframe）
    // ==========================================
    function getTargetDoc() {
        // 3.1 当前文档本身就是课表
        if (findMainTable(document)) return document;

        // 3.2 遍历所有 iframe
        var iframes = document.querySelectorAll("iframe");
        for (var i = 0; i < iframes.length; i++) {
            try {
                var doc = iframes[i].contentDocument || iframes[i].contentWindow.document;
                if (doc && findMainTable(doc)) return doc;
            } catch (e) {
                continue; // 忽略跨域错误
            }
        }
        return null;
    }

    var innerDoc = getTargetDoc();
    if (!innerDoc) {
        console.log("[parser] 未找到课表所在文档");
        return importData;
    }

    var mainTable = findMainTable(innerDoc);
    if (!mainTable) {
        console.log("[parser] 未找到课表主表格");
        return importData;
    }

    // ==========================================
    // 4. 解析工具函数
    // ==========================================

    // 从行里解析开始节次：12节 -> 1，34节 -> 3，910节 -> 9
    function parseStartFromRow(row) {
        var tds = row.querySelectorAll("td");
        for (var i = 0; i < tds.length; i++) {
            var txt = (tds[i].textContent || "").replace(/[\s\u3000]/g, "");
            var m = txt.match(/(\d+)节/);
            if (m) {
                var num = m[1];
                if (num.length === 2) return parseInt(num.charAt(0), 10);
                if (num.length === 3) return parseInt(num.charAt(0), 10); // 910 -> 9
                if (num.length === 4) return parseInt(num.substring(0, 2), 10); // 1112 -> 11
                return parseInt(num, 10);
            }
        }
        return null;
    }

    // 解析学时数
    function parseDuration(weekInfoStr) {
        if (weekInfoStr.indexOf("连堂4学时") !== -1) return 4;
        var m = weekInfoStr.match(/\((\d+)学时\)/);
        if (m) return parseInt(m[1], 10);
        return 2;
    }

    // 解析周次
    function parseWeeks(weekInfoStr) {
        var isOdd = weekInfoStr.indexOf("单周") !== -1;
        var isEven = weekInfoStr.indexOf("双周") !== -1;
        var arr = [];

        var weekMatch = weekInfoStr.match(/(\d+)\s*-\s*(\d+)周/);
        if (weekMatch) {
            var startW = parseInt(weekMatch[1], 10);
            var endW = parseInt(weekMatch[2], 10);
            for (var w = startW; w <= endW; w++) {
                if (isOdd && w % 2 === 0) continue;
                if (isEven && w % 2 !== 0) continue;
                arr.push(w);
            }
        } else {
            var singleMatch = weekInfoStr.match(/(\d+)周/);
            if (singleMatch) arr.push(parseInt(singleMatch[1], 10));
        }
        return arr;
    }

    // 防止连堂课在相邻格子重复添加
    function hasOverlap(existingTimes, newTime) {
        for (var i = 0; i < existingTimes.length; i++) {
            var old = existingTimes[i];
            if (old.weekDay !== newTime.weekDay) continue;

            var weekOverlap = false;
            for (var j = 0; j < old.weekNum.length; j++) {
                if (newTime.weekNum.indexOf(old.weekNum[j]) !== -1) {
                    weekOverlap = true;
                    break;
                }
            }
            if (!weekOverlap) continue;

            var oldEnd = old.start + old.duration - 1;
            var newEnd = newTime.start + newTime.duration - 1;
            if (newTime.start <= oldEnd && newEnd >= old.start) return true;
        }
        return false;
    }

    // ==========================================
    // 5. 遍历主表格，提取数据
    // ==========================================
    var rows = mainTable.querySelectorAll("tr");

    for (var r = 0; r < rows.length; r++) {
        var row = rows[r];

        // 根据行解析开始节次
        var start = parseStartFromRow(row);
        if (start === null) continue;

        // 只取星期列（宽度含 13.5）
        var tds = [];
        var allTds = row.querySelectorAll("td");
        for (var ti = 0; ti < allTds.length; ti++) {
            if (isWeekCell(allTds[ti])) tds.push(allTds[ti]);
        }

        for (var c = 0; c < tds.length; c++) {
            var cell = tds[c];

            // 没课的格子跳过
            if (cell.innerHTML.indexOf("：") === -1) continue;

            // HTML -> 纯文本
            var text = cell.innerHTML.replace(/<br\s*\/?>/gi, "\n");
            text = text.replace(/<[^>]+>/g, "");
            text = text.replace(/\u00a0/g, " ").replace(/&nbsp;/g, " ");

            // 同一格可能有多个课程，用横线分隔
            var courseBlocks = text.split(/-{3,}/);

            for (var b = 0; b < courseBlocks.length; b++) {
                var block = courseBlocks[b].trim();
                if (!block) continue;

                var lines = block.split("\n").map(function(l) {
                    return l.trim();
                }).filter(function(l) {
                    return l !== "";
                });

                if (lines.length < 3) continue;

                // 第1行：课程名：老师
                var nameTeacher = lines[0].split("：");
                var courseName = nameTeacher[0] ? nameTeacher[0].trim() : "";
                var teacherName = nameTeacher[1] ? nameTeacher[1].trim() : null;
                if (!courseName) continue;

                // 第2行：地点
                var location = lines[1] || "";

                // 第3行：周次/学时信息
                var weekInfoStr = lines[2] || "";

                var duration = parseDuration(weekInfoStr);
                var weekNumArray = parseWeeks(weekInfoStr);
                if (weekNumArray.length === 0) continue;

                // ✅ 关键：duration 上限裁剪，防止超出 times 长度
                var maxDuration = importData.times.length - start + 1;
                if (duration > maxDuration) duration = maxDuration;

                var timeObj = {
                    "weekNum": weekNumArray,
                    "weekDay": c + 1,
                    "start": start,
                    "duration": duration,
                    "location": location
                };

                // 查找已存在的同名同老师课程
                var existingCourse = null;
                for (var m = 0; m < importData.courses.length; m++) {
                    if (importData.courses[m].name === courseName &&
                        importData.courses[m].teacher === teacherName) {
                        existingCourse = importData.courses[m];
                        break;
                    }
                }

                if (existingCourse) {
                    if (!hasOverlap(existingCourse.times, timeObj)) {
                        existingCourse.times.push(timeObj);
                    }
                } else {
                    importData.courses.push({
                        "name": courseName,
                        "teacher": teacherName,
                        "times": [timeObj]
                    });
                }
            }
        }
    }

    return importData;
}

// 执行并打印
console.log(JSON.stringify(parser(), null, 2));
