import concurrent.futures
import datetime
import html
import json
from pathlib import Path
import re
import urllib.request

ROOT = Path(__file__).parent
SOURCES = [
 ('react', 'https://react.dev/learn/creating-a-react-app'),
 ('vite', 'https://vite.dev/guide/'),
 ('nest', 'https://docs.nestjs.com/modules'),
 ('pg-locks', 'https://www.postgresql.org/docs/current/explicit-locking.html'),
 ('pg-isolation', 'https://www.postgresql.org/docs/current/transaction-iso.html'),
 ('supabase-changelog', 'https://supabase.com/changelog.md'),
 ('supabase-api', 'https://supabase.com/docs/guides/api/securing-your-api.md'),
 ('supabase-jwt', 'https://supabase.com/docs/guides/auth/jwts.md'),
 ('supabase-rls', 'https://supabase.com/docs/guides/database/postgres/row-level-security.md'),
 ('owasp-authz', 'https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html'),
 ('tanstack', 'https://tanstack.com/query/latest/docs/framework/react/overview'),
 ('wcag', 'https://www.w3.org/TR/WCAG22/'),
]

def fetch(source):
    key, url = source
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'FairShareArchitectureResearch/1.0'})
        with urllib.request.urlopen(request, timeout=35) as response:
            data = response.read().decode('utf-8', errors='replace')
            status = response.status
            final_url = response.url
        if '<html' in data[:2000].lower() or '<!doctype' in data[:100].lower():
            data = re.sub(r'<(script|style)\b[^>]*>.*?</\1>', '', data, flags=re.S|re.I)
            data = re.sub(r'<[^>]+>', ' ', data)
            data = html.unescape(data)
            data = re.sub(r'\s+', ' ', data)
        (ROOT / f'{key}.txt').write_text(data, encoding='utf-8')
        return {'id':key, 'url':url, 'final_url':final_url, 'status':status, 'characters':len(data), 'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
    except Exception as exc:
        return {'id':key, 'url':url, 'error':str(exc)}

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(fetch, SOURCES))
    (ROOT / 'sources.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    for result in results:
        print(json.dumps(result, ensure_ascii=False))
