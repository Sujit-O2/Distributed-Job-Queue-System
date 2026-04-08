"""Update App.jsx for Dynamic App Name and Footer formatting."""

path = r"T:\jagan\Python\Project\Distributed Job Queue System\frontend\src\App.jsx"

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add APP_NAME definition if not present
if "const APP_NAME =" not in content:
    content = content.replace(
        "const APP_VERSION = \"2.1.0\";",
        "const APP_VERSION = \"2.1.0\";\nconst APP_NAME = \"O2-PulseQueue\";"
    )

content = content.replace(
    '''<h1>PulseQueue</h1>''',
    '''<h1>{APP_NAME}</h1>'''
)

content = content.replace(
    '''<p className="text-[#9fb0d8]">v{APP_VERSION} \u2013 PulseQueue Enterprise</p>''',
    '''<p className="text-[#9fb0d8]">v{APP_VERSION} \u2013 {APP_NAME} Enterprise</p>'''
)

content = content.replace(
    '''<span>\u00a9 2026 PulseQueue</span>''',
    '''<span>\u00a9 2026 {APP_NAME}</span>'''
)

content = content.replace(
    '''<h2>PulseQueue</h2>''',
    '''<h2>{APP_NAME}</h2>'''
)

content = content.replace(
    '''PulseQueue v2.1.0 \u00b7 Enterprise Job Orchestration''',
    '''{APP_NAME} v2.1.0 \u00b7 Enterprise Job Orchestration'''
)

footer_old = '''      {/* FOOTER */}
      <footer className="app-footer">
        <div className="app-footer__left">
          <span>\u00a9 2026 {APP_NAME}</span>
          <span className="footer-sep">\u2022</span>
          <span>Distributed Job Queue System</span>
        </div>
        <div className="app-footer__right">
          <a href="/docs" target="_blank" rel="noreferrer">API Docs</a>
          <span className="footer-sep">\u2022</span>
          <a href="http://127.0.0.1:8000/health" target="_blank" rel="noreferrer">Health</a>
          <span className="footer-sep">\u2022</span>
          <span>v{APP_VERSION}</span>
        </div>
      </footer>'''

footer_new = '''      {/* FOOTER */}
      <footer className="app-footer">
        <div className="app-footer__left">
          <div className="brand-mark__glyph mr-2" style={{transform: "scale(0.8)"}}><Sparkles size={12} /></div>
          <span>\u00a9 2026 {APP_NAME}</span>
          <span className="footer-sep">\u2022</span>
          <span>Sujit's Enterprise Hub</span>
          <span className="footer-sep">\u2022</span>
          <a href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>
        </div>
        <div className="app-footer__right">
          <span className="flex items-center gap-1.5"><Activity size={12} className="text-[#4ad7a3]" /> System Nomimal</span>
          <span className="footer-sep">\u2022</span>
          <a href="/docs" target="_blank" rel="noreferrer">OpenAPI Specs</a>
          <span className="footer-sep">\u2022</span>
          <a href="http://127.0.0.1:8000/health" target="_blank" rel="noreferrer">Diagnostic Ping</a>
          <span className="footer-sep">\u2022</span>
          <span className="font-mono text-[10px]">Build {APP_VERSION}</span>
        </div>
      </footer>'''

content = content.replace(footer_old, footer_new)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
