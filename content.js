(function () {
    const ORB_ID = "kcf-orb"
    const PANEL_ID = "kcf-panel"
    const STYLE_ID = "kcf-style"
    let injectedWorkId = null

    function extractWorkId(url = location.href) {
        const m = url.match(/(?:\/(?:now|new|works?|player)\/|work\/)(\d+)/i)
        return m ? Number(m[1]) : null
    }

    function injectStyle() {
        if (document.getElementById(STYLE_ID)) return
        const style = document.createElement("style")
        style.id = STYLE_ID
        style.textContent = `
#kcf-orb {
    position: fixed; right: 20px; bottom: 20px; width: 56px; height: 56px; border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(10px) saturate(150%); -webkit-backdrop-filter: blur(10px) saturate(150%);
    border: 1px solid rgba(255, 255, 255, 0.4);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    color: #fff; font-size: 22px; display: flex; align-items: center; justify-content: center;
    cursor: pointer; z-index: 2147483647; user-select: none; touch-action: none;
    transition: transform 0.2s, background 0.2s;
}
#kcf-orb:hover { background: rgba(255, 255, 255, 0.3); transform: scale(1.05); }
#kcf-orb.open { transform: rotate(90deg); background: rgba(0, 0, 0, 0.4); }

#kcf-panel {
    position: fixed; right: 20px; bottom: 88px; width: 360px; height: 55vh;
    background: rgba(25, 25, 35, 0.65);
    backdrop-filter: blur(20px) saturate(180%); -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.45);
    border-radius: 12px; color: #fff; display: flex; flex-direction: column;
    overflow: hidden; z-index: 2147483647; font-family: system-ui, -apple-system, sans-serif; font-size: 12px;
    box-sizing: border-box;
}
#kcf-panel * { box-sizing: border-box; }
#kcf-panel[hidden] { display: none !important; }

.kcf-head {
    padding: 10px 12px; display: flex; justify-content: space-between; align-items: center;
    font-weight: 600; font-size: 13px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
}
.kcf-status-bar {
    padding: 6px 12px; display: flex; justify-content: flex-start; align-items: center;
    flex-shrink: 0;
}
.kcf-status { 
    font-size: 11px; color: #f0c040; 
    padding: 2px 8px; background: rgba(240,192,64,0.1); 
    border-radius: 10px; border: 1px solid rgba(240,192,64,0.4);
    display: flex; align-items: center;
}
.kcf-status.ok { color: #6cc070; border-color: rgba(108, 192, 112, 0.4); background: rgba(108,192,112,0.1); }
.kcf-status.err { color: #f06060; border-color: rgba(240, 96, 96, 0.4); background: rgba(240,96,96,0.1); }

.kcf-tabs { display: flex; padding: 6px 10px 0; gap: 2px; flex-shrink: 0; }
.kcf-tab {
    flex: 1; padding: 6px 0; background: transparent; border: none; color: rgba(255, 255, 255, 0.6);
    cursor: pointer; font-size: 11px; border-radius: 6px 6px 0 0; transition: background 0.2s, color 0.2s;
}
.kcf-tab:hover { color: #fff; background: rgba(255, 255, 255, 0.1); }
.kcf-tab.active {
    color: #fff; background: rgba(255, 255, 255, 0.15); font-weight: 600;
    box-shadow: inset 0 -2px 0 #3a6ea5;
}

.kcf-body { 
    flex: 1; display: flex; flex-direction: column;
    overflow: hidden; padding: 8px 12px 12px;
}
.kcf-input[type="number"]::-webkit-inner-spin-button,
.kcf-input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.kcf-input[type="number"] { -moz-appearance: textfield; }

.kcf-scroll-area {
    flex: 1; overflow-y: auto; overflow-x: hidden;
    padding-right: 4px; 
}
.kcf-scroll-area::-webkit-scrollbar { width: 8px; }
.kcf-scroll-area::-webkit-scrollbar-track { background: transparent; }
.kcf-scroll-area::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15); border-radius: 10px;
    border: 2px solid transparent; background-clip: padding-box;
}
.kcf-scroll-area::-webkit-scrollbar-thumb:hover { background-color: rgba(255, 255, 255, 0.3); }

.kcf-body textarea::-webkit-scrollbar { width: 8px; height: 8px; }
.kcf-body textarea::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 8px; }
.kcf-body pre::-webkit-scrollbar { width: 8px; height: 8px; }
.kcf-body pre::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 8px; }

.kcf-row {
    padding: 10px; margin-bottom: 8px; border-radius: 8px;
    background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08);
    transition: background 0.2s; width: 100%;
}
.kcf-row:hover { background: rgba(255, 255, 255, 0.08); }

.kcf-name { color: #8ab4f8; font-size: 12px; margin-bottom: 4px; font-weight: 600; word-break: break-all; }
.kcf-now { color: rgba(255,255,255,0.8); font-size: 11px; margin-bottom: 6px; word-break: break-all; cursor: pointer; transition: color 0.2s; }
.kcf-now:hover { color: #fff; text-decoration: underline; }

.kcf-controls { display: flex; gap: 6px; width: 100%; }
.kcf-input {
    flex: 1; min-width: 0; background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.15);
    color: #fff; border-radius: 4px; padding: 4px 8px; font-size: 11px; font-family: monospace;
    transition: border 0.2s;
}
.kcf-input:focus { outline: none; border-color: rgba(255, 255, 255, 0.5); }
.kcf-input::placeholder { color: rgba(255, 255, 255, 0.3); }

.kcf-btn {
    background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.2);
    color: #fff; border-radius: 4px; padding: 4px 10px; cursor: pointer; font-size: 11px;
    white-space: nowrap; transition: all 0.2s; flex-shrink: 0;
}
.kcf-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.25); }
.kcf-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.kcf-btn.danger { background: rgba(240, 96, 96, 0.2); border-color: rgba(240, 96, 96, 0.4); }
.kcf-btn.danger:hover { background: rgba(240, 96, 96, 0.4); }

.kcf-select {
    background-color: rgba(0, 0, 0, 0.3); 
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #fff; border-radius: 6px; padding: 6px 28px 6px 10px; 
    font-size: 12px; width: 100%; outline: none; cursor: pointer;
    appearance: none; -webkit-appearance: none; -moz-appearance: none;
    background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
    background-repeat: no-repeat; background-position: right 10px center; background-size: 10px;
    transition: all 0.2s; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;
}
.kcf-select:hover { background-color: rgba(0, 0, 0, 0.4); border-color: rgba(255, 255, 255, 0.3); }
.kcf-select:focus { border-color: rgba(255, 255, 255, 0.5); }
.kcf-select option { background-color: #2a2a3d; color: #fff; padding: 8px; font-size: 12px; }

.kcf-empty { color: rgba(255, 255, 255, 0.5); padding: 16px 0; text-align: center; }
        `
        document.head.appendChild(style)
    }

    function ensureUI() {
        if (document.getElementById(ORB_ID)) return
        injectStyle()

        const orb = document.createElement("div")
        orb.id = ORB_ID
        orb.textContent = "✦"
        orb.title = "Cloud Editor"
        document.documentElement.appendChild(orb)

        const panel = document.createElement("div")
        panel.id = PANEL_ID
        panel.hidden = true
        
        const tabs = [
            { type: "publicVariable", label: "公有变量" },
            { type: "privateVariable", label: "私有变量" },
            { type: "list", label: "云列表" },
            { type: "script", label: "执行脚本" }
        ]
        const tabsHtml = tabs.map((t, i) => 
            `<button class="kcf-tab ${i === 0 ? 'active' : ''}" data-type="${t.type}">${t.label}</button>`
        ).join("")

        panel.innerHTML = `
            <div class="kcf-head">
                <span>Cloud Editor</span>
                <span id="kcf-work-id" style="font-weight:400;color:rgba(255,255,255,0.5);font-size:11px;"></span>
            </div>
            <div class="kcf-status-bar">
                <div class="kcf-status" id="kcf-status">初始化中…</div>
            </div>
            <div class="kcf-tabs">${tabsHtml}</div>
            <div class="kcf-body" id="kcf-body"></div>
        `
        document.documentElement.appendChild(panel)

        let isDragging = false, hasMoved = false, startX, startY, startRight, startBottom
        orb.onmousedown = (e) => {
            isDragging = true; hasMoved = false; startX = e.clientX; startY = e.clientY
            const rect = orb.getBoundingClientRect()
            startRight = window.innerWidth - rect.right
            startBottom = window.innerHeight - rect.bottom
            orb.style.cursor = "grabbing"; e.preventDefault()
        }

        document.addEventListener("mousemove", (e) => {
            if (!isDragging) return
            const dx = e.clientX - startX, dy = e.clientY - startY
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true
            let newRight = Math.max(0, Math.min(startRight - dx, window.innerWidth - 56))
            let newBottom = Math.max(0, Math.min(startBottom - dy, window.innerHeight - 56))
            orb.style.right = newRight + "px"; orb.style.bottom = newBottom + "px"
            if (!panel.hidden) {
                panel.style.right = newRight + "px"; panel.style.bottom = (newBottom + 68) + "px"
            }
        })

        document.addEventListener("mouseup", () => {
            if (!isDragging) return
            isDragging = false; orb.style.cursor = "pointer"
            if (!hasMoved) {
                const willOpen = panel.hidden
                panel.hidden = !willOpen
                orb.classList.toggle("open", willOpen)
                if (willOpen) {
                    const r = orb.style.right || "20px", b = parseInt(orb.style.bottom || "20") + 68
                    panel.style.right = r; panel.style.bottom = b + "px"
                    loadPanel()
                }
            }
        })
    }

    function loadPanel() {
        const workId = extractWorkId()
        const workIdEl = document.getElementById("kcf-work-id")
        const statusEl = document.getElementById("kcf-status")
        const bodyEl = document.getElementById("kcf-body")

        if (!workId) {
            workIdEl.textContent = ""
            statusEl.textContent = "未识别到作品 ID"
            statusEl.className = "kcf-status err"
            bodyEl.innerHTML = '<div class="kcf-empty">请确认页面 URL 中包含作品 ID</div>'
            return
        }
        workIdEl.textContent = "作品 " + workId

        if (injectedWorkId === workId) return

        const old = document.getElementById("kcf-inject-script")
        if (old) old.remove()
        
        injectedWorkId = workId

        const script = document.createElement("script")
        script.id = "kcf-inject-script"
        script.src = chrome.runtime.getURL("inject.js")
        script.dataset.workId = String(workId)
        
        script.dataset.libs = JSON.stringify({
            axios: chrome.runtime.getURL("libs/axios.min.js"),
            diff: chrome.runtime.getURL("libs/diff.min.js"),
            stringify: chrome.runtime.getURL("libs/stringify.min.js"),
            kcf: chrome.runtime.getURL("libs/kitten-cloud-function.min.js")
        })
        
        script.onload = () => script.remove()
        document.documentElement.appendChild(script)
    }

    ensureUI()
})()