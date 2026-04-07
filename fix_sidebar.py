import re

path = r'T:\jagan\Python\Project\Distributed Job Queue System\frontend\src\App.jsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

start_marker = '{/* SIDEBAR */}'
end_marker = '{/* MAIN CONTENT */}'
start_idx = text.find(start_marker)
end_idx = text.find(end_marker)

if start_idx != -1 and end_idx != -1:
    new_sidebar = """{/* SIDEBAR */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="command-rail"
            style={{ overflow: 'hidden' }}
          >
            <div style={{ width: 'min-content' }}>
              <div className="signal-card">
                <p className="eyebrow">Live Signal</p>
                <strong>{queueMood}</strong>
                <p>{jobs.length} tracked, {statusCounts.find((i) => i.name === "completed")?.value || 0} completed.</p>
              </div>
              <div className="sidebar-stats">
                {statusCounts.map((s) => (
                  <div key={s.name} className="sidebar-stat">
                    <span className={`sidebar-stat__dot status-${s.name}`} />
                    <span className="sidebar-stat__label">{s.name}</span>
                    <span className="sidebar-stat__value">{s.value}</span>
                  </div>
                ))}
              </div>
              {jobs.length > 0 && (
                <div className="signal-card signal-card--dense">
                  <p className="eyebrow">Export</p>
                  <div className="flex gap-2 mt-1">
                    <button className="button button--ghost text-xs py-1 flex-1"
                      onClick={() => downloadJson(jobs, `pulsequeue_jobs_${Date.now()}.json`)}>
                      <Download size={11} /> JSON
                    </button>
                    <button className="button button--ghost text-xs py-1 flex-1"
                      onClick={() => downloadCsv(jobs, `pulsequeue_jobs_${Date.now()}.csv`)}>
                      <Download size={11} /> CSV
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      """
    
    text = text[:start_idx] + new_sidebar + text[end_idx:]
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    print('Fixed App.jsx sidebar structure')
else:
    print('error')
