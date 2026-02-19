// ==UserScript==
// @name         Export URLs from XML sitemap
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  Экспорт <loc> ссылок из XML-сайтов в буфер или файл
// @author       you
// @match        *://*/*.xml*
// Дополнительно зацепим типичные sitemap-URL без .xml
// (фильтрация по реальному XML всё равно делается дальше)
// @include      *://*/*sitemap*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(async function () {
    'use strict';

    // Рекурсивно грузим XML sitemap или sitemapindex по URL
    // и возвращаем финальный список URL <loc>.
    // Поддерживаются и обычные urlset, и sitemapindex (идём вглубь).
    async function loadLocLinksFromXml(url, visited = new Set()) {
        if (visited.has(url)) {
            return [];
        }
        visited.add(url);

        try {
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) return [];

            const text = await res.text();
            if (!text || !text.includes('<loc')) return [];

            const parser = new DOMParser();
            const xml = parser.parseFromString(text, 'application/xml');
            const root = xml.documentElement;

            // Собираем все <loc> (с учётом namespace: по localName)
            const all = xml.getElementsByTagName('*');
            const locNodes = Array.from(all).filter(el => el.localName === 'loc');

            const locValues = locNodes
                .map(n => (n.textContent || '').trim())
                .filter(Boolean);

            if (!root) {
                return locValues;
            }

            const rootName = (root.localName || '').toLowerCase();

            // Обычный sitemap с <urlset> — возвращаем найденные URL как есть.
            if (rootName === 'urlset') {
                return locValues;
            }

            // sitemapindex — <loc> внутри, как правило, ссылки на другие sitemap'ы.
            // Идём рекурсивно по каждому.
            if (rootName === 'sitemapindex') {
                const allLinks = [];
                for (const childUrl of locValues) {
                    try {
                        const childLinks = await loadLocLinksFromXml(childUrl, visited);
                        if (childLinks && childLinks.length) {
                            allLinks.push(...childLinks);
                        }
                    } catch (e) {
                        // Игнорируем отдельные сбои, продолжаем остальные.
                    }
                }
                return allLinks;
            }

            // На всякий случай: неизвестный корень, но <loc> есть — просто вернём их.
            return locValues;
        } catch (e) {
            return [];
        }
    }
    
    const links = await loadLocLinksFromXml(location.href);
    if (!links || !links.length) return;

    // Создаём плавающую кнопку на странице.
    // Важно: когда документ реально XML (application/xml), элементы не являются HTMLElement,
    // и у них может не быть свойства .style. Поэтому держим fallback через атрибут style.
    function setInlineStyle(el, cssText) {
        if (el && el.style && typeof el.style.cssText === 'string') {
            el.style.cssText = cssText;
        } else if (el && el.setAttribute) {
            el.setAttribute('style', cssText);
        }
    }

    function setOpacity(el, value) {
        if (el && el.style && typeof el.style.opacity !== 'undefined') {
            el.style.opacity = value;
        } else if (el && el.getAttribute && el.setAttribute) {
            const prev = el.getAttribute('style') || '';
            const cleaned = prev.replace(/(^|;)\s*opacity\s*:\s*[^;]+/gi, '');
            el.setAttribute('style', (cleaned ? cleaned.replace(/\s*;?\s*$/, '; ') : '') + 'opacity: ' + value + ';');
        }
    }

    const isXmlDoc = !!(document && document.contentType && document.contentType.toLowerCase().includes('xml'));
    const btn = isXmlDoc && document.createElementNS
        ? document.createElementNS('http://www.w3.org/1999/xhtml', 'button')
        : document.createElement('button');

    btn.textContent = 'Экспорт ссылок';
    setInlineStyle(
        btn,
        [
            'position: fixed',
            'bottom: 20px',
            'right: 20px',
            'z-index: 999999',
            'padding: 10px 16px',
            'background: #1976d2',
            'color: #fff',
            'border: none',
            'border-radius: 4px',
            'cursor: pointer',
            'font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            'font-size: 13px',
            'box-shadow: 0 2px 6px rgba(0,0,0,0.25)',
            'opacity: 0.9'
        ].join('; ')
    );

    btn.addEventListener('mouseenter', () => setOpacity(btn, '1'));
    btn.addEventListener('mouseleave', () => setOpacity(btn, '0.9'));
    btn.addEventListener('click', () => openExportTab(links));

    const mount = document.body || document.documentElement;
    if (mount && mount.appendChild) {
        mount.appendChild(btn);
    }

    // Открытие новой вкладки с панелью управления
    function openExportTab(links) {
        const win = window.open('about:blank', '_blank');
        if (!win) {
            alert('Браузер заблокировал всплывающее окно. Разреши всплывающие для этого сайта.');
            return;
        }

        const domain = location.hostname || 'export';
        const textContent = links.join('\n');

        const html = createPanelHtml({
            domain,
            textContent,
            count: links.length
        });

        win.document.open();
        win.document.write(html);
        win.document.close();
    }

    function createPanelHtml({ domain, textContent, count }) {
        const escapedText = textContent
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Вставляем скрипт как строку, без внешних зависимостей
        return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Экспорт ссылок — ${domain}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
html, body {
    margin: 0;
    padding: 0;
    height: 100%;
    width: 100%;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #0f172a;
    color: #e5e7eb;
}
.app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    box-sizing: border-box;
}
.header {
    padding: 16px 20px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.3);
    background: linear-gradient(to right, #020617, #111827);
}
.title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 4px;
}
.subtitle {
    font-size: 13px;
    color: #9ca3af;
}
.badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border-radius: 999px;
    background: rgba(15, 118, 110, 0.15);
    color: #a7f3d0;
    font-size: 11px;
    margin-top: 6px;
}
.badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: #22c55e;
}
.main {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 12px 16px 16px;
    gap: 10px;
    box-sizing: border-box;
    min-height: 0; /* важно, чтобы flex-элементы могли сжиматься по высоте */
}
.controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
}
.btn {
    border: none;
    border-radius: 6px;
    font-size: 13px;
    padding: 7px 12px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: transform 0.06s ease, box-shadow 0.06s ease, background-color 0.1s ease, color 0.1s ease, border-color 0.1s ease;
    user-select: none;
}
.btn-primary {
    background: linear-gradient(to right, #2563eb, #7c3aed);
    color: white;
    box-shadow: 0 8px 20px rgba(37, 99, 235, 0.35);
}
.btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 24px rgba(37, 99, 235, 0.45);
}
.btn-outline {
    background: transparent;
    color: #e5e7eb;
    border: 1px solid rgba(148, 163, 184, 0.7);
}
.btn-outline:hover {
    background: rgba(15, 23, 42, 0.9);
}
.badge-count {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.9);
    border: 1px solid rgba(148, 163, 184, 0.4);
    color: #e5e7eb;
}
.textarea-wrap {
    flex: 1;
    margin-top: 6px;
    border-radius: 10px;
    background: radial-gradient(circle at top left, rgba(37, 99, 235, 0.18), transparent 55%),
                radial-gradient(circle at top right, rgba(236, 72, 153, 0.12), transparent 60%),
                #020617;
    padding: 1px;
    overflow: hidden;
    min-height: 0; /* позволяем блоку занимать всё доступное пространство по высоте */
}
.textarea-inner {
    height: 100%;
    border-radius: 10px;
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(31, 41, 55, 0.9);
    box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.9);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
}
textarea {
    flex: 1;
    width: 100%;
    border: none;
    padding: 10px 12px;
    resize: none;
    background: transparent;
    color: #e5e7eb;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 12px;
    line-height: 1.45;
    outline: none;
    overflow-y: auto;
    box-sizing: border-box;
}
.textarea-footer {
    padding: 8px 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(15, 23, 42, 0.98);
    border-top: 1px solid rgba(31, 41, 55, 0.9);
    font-size: 11px;
    color: #9ca3af;
}
.footer {
    padding: 6px 14px 10px;
    font-size: 11px;
    color: #6b7280;
    display: flex;
    justify-content: space-between;
    border-top: 1px solid rgba(30, 64, 175, 0.45);
    background: radial-gradient(circle at top, rgba(29, 78, 216, 0.3), rgba(15, 23, 42, 0.98));
}
.footer strong {
    color: #e5e7eb;
}
@media (max-width: 640px) {
    .header {
        padding: 12px 14px;
    }
    .main {
        padding: 10px 10px 12px;
    }
    .controls {
        flex-direction: column;
        align-items: stretch;
    }
    .btn {
        justify-content: center;
        width: 100%;
    }
}
</style>
</head>
<body>
<div class="app">
    <div class="header">
        <div class="title">Экспорт ссылок</div>
        <div class="subtitle">${domain}</div>
        <div class="badge">
            <span class="badge-dot"></span>
            <span>Найдено ссылок: ${count}</span>
        </div>
    </div>
    <div class="main">
        <div class="controls">
            <button id="copyBtn" class="btn btn-primary">
                <span>Копировать ссылки</span>
            </button>
            <button id="downloadBtn" class="btn btn-outline">
                <span>Экспорт в текстовый файл</span>
            </button>
            <span class="badge-count">${count} шт.</span>
        </div>
        <div class="textarea-wrap">
            <div class="textarea-inner">
                <textarea id="linksArea">${escapedText}</textarea>
                <div class="textarea-footer">
                    <span>Редактируй список перед экспортом, если нужно</span>
                </div>
            </div>
        </div>
    </div>
    <div class="footer">
        <span><strong>Tampermonkey</strong> XML sitemap helper</span>
        <span>Файл будет назван: <strong>${domain}.txt</strong></span>
    </div>
</div>

<script>
(function () {
    var textarea = document.getElementById('linksArea');
    var copyBtn = document.getElementById('copyBtn');
    var downloadBtn = document.getElementById('downloadBtn');
    // Домен исходной страницы, проброшенный из userscript'а,
    // чтобы не зависеть от location.hostname в about:blank.
    var sourceDomain = ${JSON.stringify(domain)};

    function getText() {
        return textarea.value || '';
    }

    copyBtn.addEventListener('click', function () {
        var txt = getText();
        if (!txt.trim()) {
            alert('Нет данных для копирования.');
            return;
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(txt).then(function () {
                copyBtn.textContent = 'Скопировано!';
                setTimeout(function () {
                    copyBtn.textContent = 'Копировать ссылки';
                }, 1500);
            }).catch(function () {
                fallbackCopy(txt);
            });
        } else {
            fallbackCopy(txt);
        }
    });

    function fallbackCopy(text) {
        textarea.select();
        try {
            var ok = document.execCommand('copy');
            if (ok) {
                copyBtn.textContent = 'Скопировано!';
                setTimeout(function () {
                    copyBtn.textContent = 'Копировать ссылки';
                }, 1500);
            } else {
                alert('Не удалось скопировать в буфер обмена.');
            }
        } catch (e) {
            alert('Ошибка копирования: ' + e);
        } finally {
            window.getSelection().removeAllRanges();
        }
    }

    downloadBtn.addEventListener('click', function () {
        var txt = getText();
        if (!txt.trim()) {
            alert('Нет данных для экспорта.');
            return;
        }
        var blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = sourceDomain + '.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
})();
</script>
</body>
</html>`;
    }
})();