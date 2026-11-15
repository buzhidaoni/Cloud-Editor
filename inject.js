(async function () {
    const currentScript = document.currentScript
    if (!currentScript) return

    const workId = Number(currentScript.dataset.workId)
    if (!workId) return

    const statusEl = document.getElementById("kcf-status")
    const bodyEl = document.getElementById("kcf-body")
    if (!statusEl || !bodyEl) return

    let libs = {}
    try { libs = JSON.parse(currentScript.dataset.libs || "{}") } catch (e) {}

    function setStatus(text, cls = "") {
        statusEl.textContent = text
        statusEl.className = "kcf-status"
        if (cls) statusEl.classList.add(cls)
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            if (!src) return reject(new Error("无效的脚本路径"))
            if ([...document.scripts].some(s => s.src === src)) return resolve()
            const s = document.createElement("script")
            s.src = src
            s.onload = resolve
            s.onerror = () => reject(new Error("加载失败: " + src))
            document.head.appendChild(s)
        })
    }

    try {
        setStatus("加载依赖…")
        await loadScript(libs.axios)
        await loadScript(libs.diff)
        await loadScript(libs.stringify)
        await loadScript(libs.kcf)

        if (window.Diff && !window.diff) window.diff = window.Diff
        if (window.stringify && !window.Stringify) window.Stringify = window.stringify
    } catch (e) {
        setStatus("依赖加载失败", "err")
        bodyEl.innerHTML = `<div class="kcf-empty">${e.message}</div>`
        return
    }

    const KCF = window.KittenCloudFunction?.KittenCloudFunction
    if (!KCF) {
        setStatus("挂载失败", "err")
        return
    }

    setStatus("连接云端…")
    let connection
    try {
        connection = new KCF(workId)
        await connection.opened
        setStatus("已连接", "ok")
    } catch (e) {
        setStatus("连接失败", "err")
        bodyEl.innerHTML = `<div class="kcf-empty">${e?.message || "请检查网络或确认已登录"}</div>`
        return
    }

    function formatValue(v) {
        if (v === null || v === undefined) return "null"
        if (typeof v === "object") {
            try { return JSON.stringify(v) } catch (e) { return String(v) }
        }
        return String(v)
    }

    function escapeHTML(str) {
        return String(str).replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag))
    }

    async function readValue(target) {
        try {
            let val = target.get()
            if (val && typeof val.then === "function") val = await val
            return { ok: true, val }
        } catch (e) {
            return { ok: false, err: e.message || String(e) }
        }
    }

    function copyText(rawVal, element, prefix = "") {
        const text = typeof rawVal === "string" ? rawVal : formatValue(rawVal)
        const onSuccess = () => {
            const old = element.textContent, oldColor = element.style.color
            element.textContent = "已复制!"
            element.style.color = "#6cc070"
            setTimeout(() => {
                element.textContent = prefix + (text.length > 80 ? text.slice(0, 80) + "…" : text)
                element.style.color = oldColor
            }, 800)
        }
        const onError = () => {
            const oldColor = element.style.color
            element.style.color = "#f06060"
            setTimeout(() => element.style.color = oldColor, 800)
        }
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(onSuccess).catch(onError)
        } else {
            const textArea = document.createElement("textarea")
            textArea.value = text
            textArea.style.position = "fixed"
            document.body.appendChild(textArea)
            textArea.select()
            try { document.execCommand('copy'); onSuccess() } catch (err) { onError() }
            document.body.removeChild(textArea)
        }
    }

    let currentType = "publicVariable"
    let scriptCodeCache = ""
    let syncTimer = null
    
    let hasLoadedOnce = false
    let renderToken = 0

    const varNodes = new Map()
    const inputCache = { vars: {}, listEdit: {}, listAdd: {}, selectedList: {} }

    document.querySelectorAll(".kcf-tab").forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll(".kcf-tab").forEach(b => b.classList.remove("active"))
            btn.classList.add("active")
            currentType = btn.dataset.type
            routeRender(currentType, false)
        }
    })

    function startSync() {
        if (syncTimer) clearInterval(syncTimer)
        syncTimer = setInterval(() => {
            if (document.activeElement && ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return
            if (currentType === "publicVariable" || currentType === "privateVariable" || currentType === "list") {
                routeRender(currentType, true)
            }
        }, 2500)
    }

    async function routeRender(type, isSilent = false) {
        const currentToken = ++renderToken
        try {
            if (type === "publicVariable" || type === "privateVariable") {
                if (!isSilent) {
                    if (!hasLoadedOnce) bodyEl.innerHTML = '<div class="kcf-empty">加载中…</div>'
                    else bodyEl.innerHTML = ""
                    varNodes.clear()
                }
                await renderVariables(type, isSilent, currentToken)
            } else if (type === "list") {
                if (!isSilent) {
                    if (!hasLoadedOnce) bodyEl.innerHTML = '<div class="kcf-empty">加载中…</div>'
                    else bodyEl.innerHTML = ""
                }
                await renderLists(isSilent, currentToken)
            } else if (type === "script") {
                renderScriptConsole()
            }
            hasLoadedOnce = true
        } catch (e) {
            console.error(e)
        }
    }

    async function renderVariables(type, isSilent, currentToken) {
        let vars = []
        try {
            const raw = await connection[type].getAll()
            if (Array.isArray(raw)) vars = raw
            else if (raw instanceof Map) vars = Array.from(raw.values())
            else if (raw && typeof raw === "object") vars = Object.values(raw)
        } catch (e) {
            if (!isSilent && currentToken === renderToken) bodyEl.innerHTML = `<div class="kcf-empty">获取失败：${e.message}</div>`
            return
        }

        if (currentToken !== renderToken) return

        if (vars.length === 0) {
            if (!isSilent) bodyEl.innerHTML = '<div class="kcf-empty">没有数据</div>'
            return
        }

        let scrollArea = bodyEl.querySelector(".kcf-scroll-area")
        if (!scrollArea) {
            bodyEl.innerHTML = '<div class="kcf-scroll-area"></div>'
            scrollArea = bodyEl.querySelector(".kcf-scroll-area")
        }

        const activeKeys = new Set()
        for (const v of vars) {
            const name = v.name || v.id || v.cvid || "(未命名)"
            const cacheKey = `${type}_${name}`
            activeKeys.add(cacheKey)
            
            let row = varNodes.get(cacheKey)
            if (!row) {
                row = document.createElement("div")
                row.className = "kcf-row"
                row.dataset.name = name
                row.innerHTML = `
                    <div class="kcf-name">${escapeHTML(name)}</div>
                    <div class="kcf-now">读取中…</div>
                    <div class="kcf-controls">
                        <input class="kcf-input" placeholder="输入新值">
                        <button class="kcf-btn">写入</button>
                    </div>
                `
                const input = row.querySelector(".kcf-input")
                const nowEl = row.querySelector(".kcf-now")

                input.value = inputCache.vars[cacheKey] || ""
                input.addEventListener("input", () => { inputCache.vars[cacheKey] = input.value })

                const btn = row.querySelector(".kcf-btn")
                const vRef = { current: v }
                row._vRef = vRef

                btn.onclick = () => {
                    let valToWrite = input.value;
                    try { valToWrite = JSON.parse(input.value); } catch (e) {}
                    nowEl.textContent = "当前值：" + formatValue(valToWrite)
                    vRef.current.set(valToWrite).catch(() => {})
                }
                varNodes.set(cacheKey, row)
            } else {
                if (row._vRef) row._vRef.current = v
            }
            
            if (!scrollArea.contains(row)) {
                scrollArea.appendChild(row)
            }

            const nowEl = row.querySelector(".kcf-now")
            readValue(v).then(res => {
                if (currentToken !== renderToken) return
                const text = "当前值：" + (res.ok ? formatValue(res.val) : "读取失败")
                if (nowEl.textContent !== text) {
                    nowEl.textContent = text
                    if (res.ok) {
                        nowEl.title = "点击复制"
                        nowEl.onclick = () => copyText(res.val, nowEl, "当前值：")
                    }
                }
            })
        }

        for (const [key, row] of varNodes.entries()) {
            if (!activeKeys.has(key)) {
                row.remove()
                varNodes.delete(key)
            }
        }
    }

    async function renderLists(isSilent, currentToken) {
        let lists = []
        try {
            const raw = await connection.list.getAll()
            if (Array.isArray(raw)) lists = raw
            else if (raw instanceof Map) lists = Array.from(raw.values())
            else if (raw && typeof raw === "object") lists = Object.values(raw)
        } catch (e) {
            if (!isSilent && currentToken === renderToken) bodyEl.innerHTML = `<div class="kcf-empty">获取失败：${e.message}</div>`
            return
        }

        if (currentToken !== renderToken) return

        if (lists.length === 0) {
            if (!isSilent) bodyEl.innerHTML = '<div class="kcf-empty">没有云列表</div>'
            return
        }

        let selectEl = bodyEl.querySelector("#kcf-list-select")
        const listKey = "selectedList"
        
        if (!selectEl) {
            bodyEl.innerHTML = `
                <div style="margin-bottom: 8px; flex-shrink: 0;">
                    <select class="kcf-select" id="kcf-list-select">
                        ${lists.map((l, i) => `<option value="${i}">${escapeHTML(l.name || l.id || "未命名列表")}</option>`).join('')}
                    </select>
                </div>
                <div class="kcf-row kcf-add-row" style="background:transparent; border:1px dashed rgba(255,255,255,0.2); margin-bottom:8px; flex-shrink: 0; padding: 8px;">
                    <div class="kcf-name" style="color:#6cc070">添加新项</div>
                    <div class="kcf-controls">
                        <input class="kcf-input kcf-add-idx" type="number" placeholder="索引(空为末尾)" style="width:80px;">
                        <input class="kcf-input kcf-add-val" placeholder="要添加的值">
                        <button class="kcf-btn kcf-add-btn" style="background:rgba(108, 192, 112, 0.2); border-color:rgba(108,192,112,0.4)">添加</button>
                    </div>
                </div>
                <div class="kcf-list-items kcf-scroll-area"></div>
            `
            selectEl = bodyEl.querySelector("#kcf-list-select")
            
            if (inputCache.selectedList[listKey]) {
                selectEl.value = inputCache.selectedList[listKey]
            }

            selectEl.onchange = () => {
                inputCache.selectedList[listKey] = selectEl.value
                bodyEl.querySelector(".kcf-list-items").innerHTML = ""
                renderListItems(lists[Number(selectEl.value)], false, renderToken)
            }

            const addRow = bodyEl.querySelector(".kcf-add-row")
            const addIdx = addRow.querySelector(".kcf-add-idx")
            const addVal = addRow.querySelector(".kcf-add-val")
            const addBtn = addRow.querySelector(".kcf-add-btn")

            addIdx.value = inputCache.listAdd["idx"] || ""
            addVal.value = inputCache.listAdd["val"] || ""

            addIdx.addEventListener("input", () => inputCache.listAdd["idx"] = addIdx.value)
            addVal.addEventListener("input", () => inputCache.listAdd["val"] = addVal.value)

            addBtn.onclick = () => {
                const list = lists[Number(selectEl.value)]
                const listName = list.name || list.id || "未命名"
                let val = addVal.value
                try { val = JSON.parse(val) } catch(e){}
                const index = addIdx.value ? Number(addIdx.value) : undefined
                
                if (index !== undefined) {
                    list.add(index, val).catch(() => {})
                } else {
                    if (typeof list.push === "function") list.push(val).catch(() => {})
                }
                
                for (const k in inputCache.listEdit) {
                    if (k.startsWith(`${listName}_`)) delete inputCache.listEdit[k]
                }
                
                setTimeout(() => renderListItems(list, true, renderToken), 300)
            }
        }

        await renderListItems(lists[Number(selectEl.value)], isSilent, currentToken)
    }

    async function renderListItems(list, isSilent, currentToken) {
        const container = bodyEl.querySelector(".kcf-list-items")
        if (!container) return

        const listName = list.name || list.id || "未命名"
        let items = []
        let idx = 0
        while (idx < 500) {
            const res = await readValue({ get: () => list.get(idx) })
            if (!res.ok || res.val === undefined || res.val === null) break
            items.push({ idx, val: res.val })
            idx++
        }

        if (currentToken !== renderToken) return

        if (items.length === 0 && !isSilent) {
            container.innerHTML = '<div class="kcf-empty">空列表</div>'
            return
        } else if (items.length > 0 && container.querySelector(".kcf-empty")) {
            container.innerHTML = ""
        }

        let currentInputs = {}
        container.querySelectorAll(".kcf-row[data-item-idx]").forEach(row => {
            const itemIdx = Number(row.dataset.itemIdx)
            const input = row.querySelector(".kcf-item-val")
            if (input && input.value) {
                currentInputs[itemIdx] = input.value
            }
        })

        container.innerHTML = ""
        
        for (const item of items) {
            const row = document.createElement("div")
            row.className = "kcf-row"
            row.dataset.itemIdx = item.idx
            row.innerHTML = `
                <div style="display:flex; justify-content:space-between;">
                    <span class="kcf-name" style="font-weight:normal; margin:0;">项 [${item.idx}]</span>
                </div>
                <div class="kcf-now kcf-copy-btn" style="cursor:pointer;" title="点击复制">${escapeHTML(formatValue(item.val))}</div>
                <div class="kcf-controls" style="margin-top:4px;">
                    <input class="kcf-input kcf-item-val" placeholder="替换值">
                    <button class="kcf-btn kcf-item-replace">替换</button>
                    <button class="kcf-btn danger kcf-item-remove">删除</button>
                </div>
            `
            const input = row.querySelector(".kcf-item-val")
            const replaceBtn = row.querySelector(".kcf-item-replace")
            const removeBtn = row.querySelector(".kcf-item-remove")
            const copyEl = row.querySelector(".kcf-copy-btn")

            const cacheKey = `${listName}_${item.idx}`
            input.value = inputCache.listEdit[cacheKey] || currentInputs[item.idx] || ""
            input.addEventListener("input", () => { inputCache.listEdit[cacheKey] = input.value })

            copyEl.onclick = () => copyText(item.val, copyEl, "")

            replaceBtn.onclick = () => {
                let val = input.value
                try { val = JSON.parse(val) } catch(e){}
                list.replace(item.idx, val).catch(() => {})
                setTimeout(() => renderListItems(list, true, renderToken), 300)
            }

            removeBtn.onclick = () => {
                list.remove(item.idx).catch(() => {})
                for (const k in inputCache.listEdit) {
                    if (k.startsWith(`${listName}_`)) delete inputCache.listEdit[k]
                }
                setTimeout(() => renderListItems(list, true, renderToken), 300)
            }
            
            container.appendChild(row)
        }
    }

    function renderScriptConsole() {
        if (bodyEl.querySelector("textarea")) return
        
        bodyEl.innerHTML = `
            <div style="height: 100%; display: flex; flex-direction: column; width: 100%;">
                <textarea class="kcf-input" style="width:100%; height:120px; font-family:monospace; resize:none; padding:8px; flex-shrink:0; margin-bottom:8px;">${escapeHTML(scriptCodeCache)}</textarea>
                <button class="kcf-btn" style="width:100%; padding:6px; flex-shrink:0; margin-bottom:8px;">执行代码</button>
                <pre class="kcf-scroll-area" style="background:rgba(0,0,0,0.3); padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.1); font-size:11px; white-space:pre-wrap; display:none; font-family:monospace; color:#8ab4f8; flex:1; margin:0; overflow-y:auto;"></pre>
            </div>
        `
        const codeEl = bodyEl.querySelector("textarea")
        const runBtn = bodyEl.querySelector("button")
        const resEl = bodyEl.querySelector("pre")

        codeEl.addEventListener("input", () => {
            scriptCodeCache = codeEl.value
        })

        runBtn.onclick = async () => {
            resEl.style.display = "block"
            resEl.textContent = "执行中...\n"
            let logs = []
            const fakeConsole = {
                log: (...args) => { logs.push(args.map(a => formatValue(a)).join(' ')); resEl.textContent = logs.join('\n') },
                error: (...args) => { logs.push("[ERR] " + args.map(a => formatValue(a)).join(' ')); resEl.textContent = logs.join('\n') },
                warn: (...args) => { logs.push("[WRN] " + args.map(a => formatValue(a)).join(' ')); resEl.textContent = logs.join('\n') }
            }

            try {
                const fn = new Function("connection", "workId", "console", `return (async () => { \n${codeEl.value}\n })();`)
                const result = await fn(connection, workId, fakeConsole)
                if (result !== undefined) logs.push("=> " + formatValue(result))
                if (logs.length === 0) logs.push("执行成功 (无输出)")
                resEl.textContent = logs.join('\n')
            } catch (e) {
                logs.push("[Exception] " + e.stack)
                resEl.textContent = logs.join('\n')
            }
        }
    }

    await routeRender(currentType, false)
    startSync()
})()