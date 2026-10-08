function pureScheduleParser(html) {
    // 用临时容器装载 provider 传来的 HTML 字符串
    var temp = document.createElement("div");
    temp.innerHTML = html;

    // ==========================================
    // 工具函数
    // ==========================================
    function isWeekCell(td) {
        var w = td.getAttribute("width");
        return w && w.indexOf("13.5") !== -1;
    }

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

    function findMainTable(doc) {
        if (!doc) return null;
        var tables = doc.querySelectorAll("table");
        for (var t = 0; t < tables.length; t++) {
            if (isScheduleTable(tables[t])) return tables[t];
        }
        return null;
    }

    // ==========================================
    // 找课表主表格（从传入的 HTML 里找）
    // ==========================================
    var mainTable = findMainTable(temp);
    if (!mainTable) {
        console.log("[parser] 未找到课表主表格");
        return [];
    }

    // ==========================================
    // 解析工具函数
    // ==========================================
    function parseStartFromRow(row) {
        var tds = row.querySelectorAll("td");
        for (var i = 0; i < tds.length; i++) {
            var txt = (tds[i].textContent || "").replace(/[\s\u3000]/g, "");
            var m = txt.match(/(\d+)节/);
            if (m) {
                var num = m[1];
                if (num.length === 2) return parseInt(num.charAt(0), 10);
                if (num.length === 3) return parseInt(num.charAt(0), 10);
                if (num.length === 4) return parseInt(num.substring(0, 2), 10);
                return parseInt(num, 10);
            }
        }
        return null;
    }

    function parseDuration(weekInfoStr) {
        if (weekInfoStr.indexOf("连堂4学时") !== -1) return 4;
        var m = weekInfoStr.match(/\((\d+)学时\)/);
        if (m) return parseInt(m[1], 10);
        return 2;
    }

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
    // 遍历主表格，提取数据
    // ==========================================
    var courses = [];
    var MAX_SECTION = 11;

    var rows = mainTable.querySelectorAll("tr");

    for (var r = 0; r < rows.length; r++) {
        var row = rows[r];
        var start = parseStartFromRow(row);
        if (start === null) continue;

        var tds = [];
        var allTds = row.querySelectorAll("td");
        for (var ti = 0; ti < allTds.length; ti++) {
            if (isWeekCell(allTds[ti])) tds.push(allTds[ti]);
        }

        for (var c = 0; c < tds.length; c++) {
            var cell = tds[c];
            if (cell.innerHTML.indexOf("：") === -1) continue;

            var text = cell.innerHTML.replace(/<br\s*\/?>/gi, "\n");
            text = text.replace(/<[^>]+>/g, "");
            text = text.replace(/\u00a0/g, " ").replace(/&nbsp;/g, " ");

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

                var nameTeacher = lines[0].split("：");
                var courseName = nameTeacher[0] ? nameTeacher[0].trim() : "";
                var teacherName = nameTeacher[1] ? nameTeacher[1].trim() : null;
                if (!courseName) continue;

                var location = lines[1] || "";
                var weekInfoStr = lines[2] || "";

                var duration = parseDuration(weekInfoStr);
                var weekNumArray = parseWeeks(weekInfoStr);
                if (weekNumArray.length === 0) continue;

                var maxDuration = MAX_SECTION - start + 1;
                if (duration > maxDuration) duration = maxDuration;

                var timeObj = {
                    "weekNum": weekNumArray,
                    "weekDay": c + 1,
                    "start": start,
                    "duration": duration,
                    "location": location
                };

                var existingCourse = null;
                for (var m = 0; m < courses.length; m++) {
                    if (courses[m].name === courseName &&
                        courses[m].teacher === teacherName) {
                        existingCourse = courses[m];
                        break;
                    }
                }

                if (existingCourse) {
                    if (!hasOverlap(existingCourse.times, timeObj)) {
                        existingCourse.times.push(timeObj);
                    }
                } else {
                    courses.push({
                        "name": courseName,
                        "teacher": teacherName,
                        "times": [timeObj]
                    });
                }
            }
        }
    }

    // ==========================================
    // 转换成 Pure 课程表要求的扁平数组格式
    // ==========================================
    var result = [];
    for (var ci = 0; ci < courses.length; ci++) {
        var course = courses[ci];
        for (var ti = 0; ti < course.times.length; ti++) {
            var time = course.times[ti];
            var sections = [];
            for (var s = 0; s < time.duration; s++) {
                sections.push(time.start + s);
            }
            result.push({
                name: course.name,
                position: time.location,
                teacher: course.teacher,
                weeks: time.weekNum,
                day: time.weekDay,
                sections: sections
            });
        }
    }

    return result;
}
