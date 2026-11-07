"""Build a single, offline HTML file. No package installs or network calls."""
from pathlib import Path
import base64, json
ROOT=Path(__file__).resolve().parent
assets={p.stem:'data:image/svg+xml;base64,'+base64.b64encode(p.read_bytes()).decode() for p in (ROOT/'assets').glob('*.svg')}
s=(ROOT/'src/index.html').read_text(encoding='utf-8')
for token,path in [('CSS','src/style.css'),('ENGINE','src/engine.js'),('BOTS','src/bots.js'),('INPUT','src/input.js'),('SOUND','src/sound.js'),('RENDER','src/render.js'),('APP','src/app.js')]:
    s=s.replace('/*__'+token+'__*/',(ROOT/path).read_text(encoding='utf-8'))
s=s.replace('/*__ASSETS__*/','const ASSETS='+json.dumps(assets,ensure_ascii=False)+';')
# Preserve attribution inside the standalone artifact as well as the source package.
notice=(ROOT/'assets/LOBE-ICONS-LICENSE.txt').read_text(encoding='utf-8')
s=s.replace('</head>','<!--\nBrand icon assets: LobeHub lobe-icons.\n'+notice+'\n-->\n</head>')
(ROOT/'球球竞技场.html').write_text(s,encoding='utf-8')
(ROOT/'index.html').write_text(s,encoding='utf-8')
print('Built',ROOT/'球球竞技场.html',f'{len(s.encode())/1024:.1f} KiB')
