import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { importCharacterFromUrl } from './urlImporter.ts';
import {
  buildChatbotResearchNote,
  buildWikiAndWebSearchTargets,
  classifyResearchUrl,
  type BrowserStepLog,
  type CompetitorBotNote,
  type WebResearchDossier,
  type WikiExcerpt,
} from '../src/utils/aiMakerUtils.ts';
import { getCharacters } from '../src/db/characters.ts';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export function findChromiumExecutablePath(): string | undefined {
  const envPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
  if (envPath && fs.existsSync(envPath)) return envPath;

  const baseDirs = ['/ms-playwright', path.join(process.env.HOME || '', '.cache/ms-playwright')];
  for (const base of baseDirs) {
    if (!base || !fs.existsSync(base)) continue;
    try {
      const entries = fs.readdirSync(base).sort().reverse();
      for (const dir of entries) {
        const candidates = [
          path.join(base, dir, 'chrome-headless-shell-linux64', 'chrome-headless-shell'),
          path.join(base, dir, 'chrome-linux64', 'chrome'),
          path.join(base, dir, 'chrome-linux', 'chrome'),
        ];
        for (const c of candidates) {
          if (fs.existsSync(c)) return c;
        }
      }
    } catch {
      // ignore unreadable cache dir
    }
  }
  return undefined;
}

function cleanText(raw: string): string {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isBotChallengeText(text: string): boolean {
  return /just a moment|attention required!\s*\|\s*cloudflare|enable javascript and cookies|checking your browser/i.test(
    String(text || '')
  );
}

async function discoverWikiPagesViaApi(
  query: string,
  explicitUrls: string[],
  chatbotUrls: string[]
): Promise<{
  plan: ReturnType<typeof buildWikiAndWebSearchTargets>;
  discoveredUrls: Array<{ url: string; title: string; label: string }>;
}> {
  const plan = buildWikiAndWebSearchTargets(query, explicitUrls, chatbotUrls);
  const discoveredUrls: Array<{ url: string; title: string; label: string }> = [];
  const seen = new Set<string>([...plan.wikiUrls, ...plan.webUrls]);

  const searches = plan.mediaWikiApiSearches.slice(0, 3);
  const results = await Promise.allSettled(
    searches.map(async (s) => {
      const resp = await fetch(s.apiUrl, {
        headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(3000),
      });
      if (!resp.ok) return null;
      const json: any = await resp.json().catch(() => null);
      if (!Array.isArray(json) || !Array.isArray(json[3])) return null;
      const titles: string[] = Array.isArray(json[1]) ? json[1] : [];
      const urls: string[] = json[3];
      return urls.slice(0, 2).map((u, idx) => ({
        url: String(u || ''),
        title: String(titles[idx] || s.label),
        label: s.label,
      }));
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      for (const item of r.value) {
        if (item.url && /^https?:\/\//i.test(item.url) && !seen.has(item.url)) {
          seen.add(item.url);
          discoveredUrls.push(item);
        }
      }
    }
  }

  // Sort non-Fandom URLs (independent wikis & Wikipedia) ahead of Fandom so Chromium gets clean screenshots first
  discoveredUrls.sort((a, b) => {
    const aFandom = a.url.includes('fandom.com') ? 1 : 0;
    const bFandom = b.url.includes('fandom.com') ? 1 : 0;
    return aFandom - bFandom;
  });

  return { plan, discoveredUrls };
}

async function discoverMentionedChatbots(
  characterTerm: string,
  explicitChatbotUrls: string[]
): Promise<{ notes: CompetitorBotNote[]; warnings: string[]; avatars: string[] }> {
  const notes: CompetitorBotNote[] = [];
  const warnings: string[] = [];
  const avatars: string[] = [];
  const processedUrls = new Set<string>();

  for (const rawUrl of explicitChatbotUrls.slice(0, 5)) {
    if (processedUrls.has(rawUrl)) continue;
    processedUrls.add(rawUrl);
    try {
      const kind = classifyResearchUrl(rawUrl);
      if (kind === 'janitor' || kind === 'chub' || kind === 'spicychat') {
        const imported = await importCharacterFromUrl(rawUrl);
        if (imported.character.avatar) avatars.push(imported.character.avatar);
        notes.push(
          buildChatbotResearchNote({
            source: kind,
            url: rawUrl,
            name: imported.character.name,
            creatorName: imported.character.creatorName,
            rating: imported.character.rating,
            tagline: imported.character.tagline,
            description: imported.character.description,
            personality: imported.character.personality,
            scenario: imported.character.scenario,
            greeting: imported.character.greeting,
            exampleDialogues: imported.character.exampleDialogues,
            tags: Array.isArray(imported.character.tags) ? imported.character.tags : [],
          })
        );
      } else {
        const resp = await fetch(rawUrl, {
          headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,application/xhtml+xml' },
          signal: AbortSignal.timeout(4000),
        });
        if (resp.ok) {
          const html = await resp.text();
          const title = cleanText(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || 'Chatbot Reference');
          const textBody = cleanText(
            html
              .replace(/<script[\s\S]*?<\/script>/gi, ' ')
              .replace(/<style[\s\S]*?<\/style>/gi, ' ')
              .replace(/<[^>]+>/g, ' ')
          ).slice(0, 1200);
          notes.push(
            buildChatbotResearchNote({
              source: 'web',
              url: rawUrl,
              name: title,
              description: textBody,
            })
          );
        }
      }
    } catch (err: any) {
      warnings.push(`Chatbot URL (${rawUrl}): ${err?.message || 'Could not scrape bot details directly.'}`);
    }
  }

  const cleanTerm = characterTerm.trim();
  if (cleanTerm.length >= 2) {
    const chubSearchUrls = [
      `https://api.chub.ai/search?search=${encodeURIComponent(cleanTerm)}&first=2&nsfw=true`,
      `https://gateway.chub.ai/search?search=${encodeURIComponent(cleanTerm)}&first=2&nsfw=true`,
    ];
    for (const sUrl of chubSearchUrls) {
      try {
        const resp = await fetch(sUrl, {
          headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
          signal: AbortSignal.timeout(3000),
        });
        if (!resp.ok) continue;
        const ct = (resp.headers.get('content-type') || '').toLowerCase();
        if (!ct.includes('json')) continue;
        const json: any = await resp.json();
        const nodes: any[] = json?.data?.nodes || json?.nodes || json?.results || [];
        for (const node of nodes.slice(0, 2)) {
          const fullPath = String(node.fullPath || node.full_path || '').trim();
          const botUrl = fullPath ? `https://chub.ai/characters/${fullPath}` : `https://chub.ai`;
          if (processedUrls.has(botUrl)) continue;
          processedUrls.add(botUrl);
          if (node.avatar_url) avatars.push(String(node.avatar_url));
          notes.push(
            buildChatbotResearchNote({
              source: 'chub',
              url: botUrl,
              name: String(node.name || cleanTerm),
              creatorName: fullPath.split('/')[0] || 'ChubCreator',
              rating: node.nsfw_image || node.is_nsfw ? 'NSFW' : 'SFW',
              tagline: String(node.tagline || node.description || ''),
              description: String(node.description || ''),
              tags: Array.isArray(node.topics) ? node.topics.map(String) : ['Chub Reference'],
            })
          );
        }
        if (notes.length > 0) break;
      } catch {
        // fallback cleanly
      }
    }

    try {
      const localMatches = await getCharacters({ search: cleanTerm, limit: 2, offset: 0, sort: 'popular' });
      for (const ch of localMatches) {
        const localUrl = `palace://character/${ch.uuid}`;
        if (processedUrls.has(localUrl)) continue;
        processedUrls.add(localUrl);
        let parsedTags: string[] = [];
        try {
          parsedTags = JSON.parse(ch.tags || '[]');
        } catch {
          parsedTags = [];
        }
        notes.push(
          buildChatbotResearchNote({
            source: 'web',
            url: localUrl,
            name: `${ch.name} (Palace Reference)`,
            creatorName: ch.creatorName,
            rating: ch.rating,
            tagline: ch.tagline,
            description: ch.description,
            personality: ch.personality || '',
            scenario: ch.scenario || '',
            greeting: ch.greeting,
            exampleDialogues: ch.exampleDialogues || '',
            tags: parsedTags,
          })
        );
      }
    } catch {
      // ignore if DB unavailable
    }
  }

  return { notes, warnings, avatars };
}

/**
 * Fetches structured article text via MediaWiki API or Jina Reader when direct Chromium
 * hits Cloudflare challenges or cookie walls.
 */
async function fetchReaderOrWikiFallback(url: string): Promise<{
  title: string;
  summary: string;
  facts: string[];
  images: string[];
} | null> {
  // 1. Try Jina Reader markdown mirror (cleanly bypasses JS/Cloudflare HTML gates on wikis)
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const resp = await fetch(jinaUrl, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/plain,*/*' },
      signal: AbortSignal.timeout(4500),
    });
    if (resp.ok) {
      const md = await resp.text();
      if (md && !isBotChallengeText(md.slice(0, 600))) {
        const title = cleanText(md.match(/^Title:\s*(.+)$/m)?.[1] || url);
        const bodyIdx = md.indexOf('Markdown Content:');
        const body = bodyIdx !== -1 ? md.slice(bodyIdx + 'Markdown Content:'.length).trim() : md;
        const cleanLines = body
          .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .split(/\n\s*\n/)
          .map((l) => cleanText(l))
          .filter((l) => l.length >= 45 && !/^https?:\/\//i.test(l) && !isBotChallengeText(l));
        const imgMatches = [...body.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)]
          .map((m) => m[1])
          .filter((src) => !/favicon|logo|pixel|spacer|1x1/i.test(src));

        if (cleanLines.length > 0) {
          return {
            title,
            summary: cleanLines.slice(0, 2).join(' ').slice(0, 800),
            facts: cleanLines.slice(2, 7).map((l) => l.slice(0, 280)),
            images: Array.from(new Set(imgMatches)).slice(0, 5),
          };
        }
      }
    }
  } catch {
    // fall through to direct HTML fetch
  }

  // 2. Direct lightweight HTML fetch
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(4000),
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    if (isBotChallengeText(html)) return null;

    const title = cleanText(
      html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1] ||
        html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
        url
    );
    const pMatches = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => cleanText(m[1].replace(/<[^>]+>/g, ' ')))
      .filter((t) => t.length >= 45 && !/cookie|javascript|enable/i.test(t));
    const imgMatches = [...html.matchAll(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi)]
      .map((m) => m[1])
      .filter((src) => !/favicon|logo|pixel|spacer|1x1/i.test(src));

    if (pMatches.length === 0) return null;
    return {
      title,
      summary: pMatches.slice(0, 2).join(' '),
      facts: pMatches.slice(2, 7),
      images: Array.from(new Set(imgMatches)).slice(0, 5),
    };
  } catch {
    return null;
  }
}

async function capturePageStepScreenshot(
  page: Page,
  step: number,
  action: BrowserStepLog['action'],
  detail: string,
  url: string,
  title: string,
  mouseX: number,
  mouseY: number,
  scrollY: number,
  extra?: Partial<BrowserStepLog>
): Promise<BrowserStepLog> {
  let screenshotDataUrl: string | undefined;
  try {
    const buf = await page.screenshot({ type: 'jpeg', quality: 55, timeout: 3500 });
    screenshotDataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {
    screenshotDataUrl = undefined;
  }
  return {
    step,
    action,
    detail,
    url,
    title,
    mouseX,
    mouseY,
    scrollY,
    screenshotDataUrl,
    timestampMs: Date.now(),
    ...extra,
  };
}

export interface RunWebResearchOptions {
  query: string;
  explicitUrls?: string[];
  chatbotUrls?: string[];
  maxPages?: number;
  enableVirtualInteraction?: boolean;
}

/**
 * Autonomous Virtual Browser Research Agent using Playwright Chromium.
 * Executes real virtual mouse moves/clicks, virtual keyboard typing/PageDown/ArrowDown,
 * viewport scrolling, DOM extraction, JPEG viewport screenshots, and competitor bot scraping.
 */
export async function runWebResearchAgent(
  options: RunWebResearchOptions
): Promise<WebResearchDossier> {
  const query = String(options.query || '').trim();
  const explicitUrls = Array.isArray(options.explicitUrls) ? options.explicitUrls : [];
  const explicitChatbotUrls = Array.isArray(options.chatbotUrls) ? options.chatbotUrls : [];
  const maxPages = Math.max(1, Math.min(3, Number(options.maxPages) || 2));

  const dossier: WebResearchDossier = {
    query,
    usedPlaywright: false,
    visitedUrls: [],
    steps: [],
    screenshots: [],
    excerpts: [],
    chatbotNotes: [],
    discoveredImages: [],
    warnings: [],
  };

  const { plan, discoveredUrls } = await discoverWikiPagesViaApi(
    query,
    explicitUrls,
    explicitChatbotUrls
  );
  const searchTerm = plan.searchTerms[0] || query;

  const botPromise = discoverMentionedChatbots(searchTerm, plan.chatbotUrls);

  const queue: Array<{ url: string; sourceType: 'wiki' | 'web' }> = [
    ...plan.wikiUrls.map((url) => ({ url, sourceType: 'wiki' as const })),
    ...discoveredUrls.map((d) => ({
      url: d.url,
      sourceType: classifyResearchUrl(d.url) === 'wiki' ? ('wiki' as const) : ('web' as const),
    })),
    ...plan.webUrls.map((url) => ({ url, sourceType: 'web' as const })),
  ];

  // Prioritize explicit user URLs first, then non-Fandom wikis before Fandom
  const dedupedQueue: Array<{ url: string; sourceType: 'wiki' | 'web' }> = [];
  const seenQueue = new Set<string>();
  for (const item of queue) {
    if (!seenQueue.has(item.url)) {
      seenQueue.add(item.url);
      dedupedQueue.push(item);
    }
  }

  if (dedupedQueue.length === 0 && query) {
    dedupedQueue.push({
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(searchTerm.replace(/\s+/g, '_'))}`,
      sourceType: 'wiki',
    });
  }

  const targetQueue = dedupedQueue.slice(0, maxPages);

  let browser: Browser | null = null;
  let stepCounter = 1;
  const executablePath = findChromiumExecutablePath();

  try {
    browser = await chromium.launch({
      executablePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
    dossier.usedPlaywright = true;

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: BROWSER_UA,
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();

    for (const target of targetQueue) {
      try {
        await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 5500 });
        await page.waitForTimeout(180);

        const pageTitle = cleanText(await page.title().catch(() => target.url));
        dossier.visitedUrls.push(page.url());

        // If Cloudflare/JS gate triggered inside Chromium, enrich excerpt immediately via Jina/HTML mirror!
        if (isBotChallengeText(pageTitle)) {
          const mirror = await fetchReaderOrWikiFallback(target.url);
          if (mirror) {
            dossier.excerpts.push({
              title: mirror.title,
              url: target.url,
              sourceType: target.sourceType,
              summary: mirror.summary,
              facts: mirror.facts,
              discoveredImageUrls: mirror.images,
            });
            for (const im of mirror.images) {
              if (!dossier.discoveredImages.includes(im)) dossier.discoveredImages.push(im);
            }
            dossier.steps.push({
              step: stepCounter++,
              action: 'extract',
              detail: `Retrieved clean reader mirror of "${mirror.title.slice(0, 50)}" past Cloudflare gate.`,
              url: target.url,
              title: mirror.title,
              timestampMs: Date.now(),
            });
            continue;
          }
        }

        const navLog = await capturePageStepScreenshot(
          page,
          stepCounter++,
          'navigate',
          `Opened ${page.url()} (${pageTitle.slice(0, 60)})`,
          page.url(),
          pageTitle,
          640,
          120,
          0
        );
        dossier.steps.push(navLog);
        if (navLog.screenshotDataUrl) {
          dossier.screenshots.push({
            step: navLog.step,
            url: page.url(),
            title: pageTitle,
            scrollY: 0,
            mouseX: 640,
            mouseY: 120,
            actionSummary: navLog.detail,
            dataUrl: navLog.screenshotDataUrl,
          });
        }

        if (options.enableVirtualInteraction !== false) {
          await page.mouse.move(640, 260, { steps: 5 });
          await page.mouse.click(640, 260).catch(() => {});
          dossier.steps.push({
            step: stepCounter++,
            action: 'mousemove',
            detail: 'Moved virtual cursor to article viewport (640, 260) and focused page.',
            url: page.url(),
            title: pageTitle,
            mouseX: 640,
            mouseY: 260,
            scrollY: 0,
            timestampMs: Date.now(),
          });

          await page.keyboard.press('Escape').catch(() => {});
          dossier.steps.push({
            step: stepCounter++,
            action: 'key',
            detail: 'Pressed virtual Escape key to clear overlays.',
            url: page.url(),
            title: pageTitle,
            keyboardKey: 'Escape',
            mouseX: 640,
            mouseY: 260,
            scrollY: 0,
            timestampMs: Date.now(),
          });
        }

        const scrollTargets = [
          { wheelY: 560, key: 'PageDown', mouseX: 720, mouseY: 420 },
          { wheelY: 620, key: 'ArrowDown', mouseX: 540, mouseY: 510 },
        ];

        for (const sc of scrollTargets) {
          await page.mouse.move(sc.mouseX, sc.mouseY, { steps: 4 });
          await page.keyboard.press(sc.key).catch(() => {});
          await page.mouse.wheel(0, sc.wheelY).catch(() => {});
          await page.waitForTimeout(150);

          const scrollY = await page.evaluate(() => Math.round(window.scrollY)).catch(() => 0);
          const scrollLog = await capturePageStepScreenshot(
            page,
            stepCounter++,
            'scroll',
            `Virtual keyboard (${sc.key}) + mouse wheel scroll to Y=${scrollY}px`,
            page.url(),
            pageTitle,
            sc.mouseX,
            sc.mouseY,
            scrollY,
            { keyboardKey: sc.key }
          );
          dossier.steps.push(scrollLog);
          if (scrollLog.screenshotDataUrl) {
            dossier.screenshots.push({
              step: scrollLog.step,
              url: page.url(),
              title: pageTitle,
              scrollY,
              mouseX: sc.mouseX,
              mouseY: sc.mouseY,
              actionSummary: scrollLog.detail,
              dataUrl: scrollLog.screenshotDataUrl,
            });
          }
        }

        const extracted = await page.evaluate(() => {
          const headingEl = document.querySelector('h1');
          const heading = (headingEl?.textContent || document.title || '').replace(/\s+/g, ' ').trim();
          const paragraphs = Array.from(
            document.querySelectorAll('article p, main p, .mw-parser-output > p, p')
          )
            .map((p) => (p.textContent || '').replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim())
            .filter((t) => t.length >= 40 && !/cookie|privacy policy|sign in|javascript/i.test(t));

          const listFacts = Array.from(
            document.querySelectorAll('.portable-infobox .pi-data, .infobox tr, .mw-parser-output li')
          )
            .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
            .filter((t) => t.length >= 16 && t.length <= 260);

          const imgs = Array.from(document.querySelectorAll('img'))
            .map((img) => img.src || img.getAttribute('data-src') || '')
            .filter(
              (src) =>
                /^https?:\/\//i.test(src) &&
                !/logo|icon|sprite|spacer|pixel|button|badge/i.test(src)
            );

          return {
            heading,
            paragraphs: Array.from(new Set(paragraphs)).slice(0, 8),
            facts: Array.from(new Set(listFacts)).slice(0, 8),
            imgs: Array.from(new Set(imgs)).slice(0, 6),
          };
        });

        dossier.steps.push({
          step: stepCounter++,
          action: 'extract',
          detail: `Extracted ${extracted.paragraphs.length} lore paragraphs & ${extracted.facts.length} infobox facts from "${extracted.heading.slice(0, 50)}"`,
          url: page.url(),
          title: extracted.heading || pageTitle,
          scrollY: await page.evaluate(() => Math.round(window.scrollY)).catch(() => 0),
          timestampMs: Date.now(),
        });

        if (extracted.paragraphs.length > 0 || extracted.facts.length > 0) {
          dossier.excerpts.push({
            title: extracted.heading || pageTitle,
            url: page.url(),
            sourceType: target.sourceType,
            summary: extracted.paragraphs.slice(0, 2).join(' '),
            facts: [...extracted.facts.slice(0, 5), ...extracted.paragraphs.slice(2, 5)],
            discoveredImageUrls: extracted.imgs,
          });
        }
        for (const im of extracted.imgs) {
          if (!dossier.discoveredImages.includes(im)) {
            dossier.discoveredImages.push(im);
          }
        }
      } catch (pageErr: any) {
        const httpFallback = await fetchReaderOrWikiFallback(target.url);
        if (httpFallback) {
          dossier.visitedUrls.push(target.url);
          dossier.excerpts.push({
            title: httpFallback.title,
            url: target.url,
            sourceType: target.sourceType,
            summary: httpFallback.summary,
            facts: httpFallback.facts,
            discoveredImageUrls: httpFallback.images,
          });
          for (const im of httpFallback.images) {
            if (!dossier.discoveredImages.includes(im)) dossier.discoveredImages.push(im);
          }
          dossier.steps.push({
            step: stepCounter++,
            action: 'extract',
            detail: `Retrieved fallback text from ${target.url}`,
            url: target.url,
            title: httpFallback.title,
            timestampMs: Date.now(),
          });
        } else {
          dossier.warnings.push(`Skipped "${target.url}": ${pageErr?.message || 'Timeout or blocked'}`);
        }
      }
    }
  } catch (browserErr: any) {
    dossier.warnings.push(`Headless Chromium unavailable (${browserErr?.message || 'launch error'}); used HTTP fallback.`);
    for (const target of targetQueue) {
      const fb = await fetchReaderOrWikiFallback(target.url);
      if (fb) {
        dossier.visitedUrls.push(target.url);
        dossier.excerpts.push({
          title: fb.title,
          url: target.url,
          sourceType: target.sourceType,
          summary: fb.summary,
          facts: fb.facts,
          discoveredImageUrls: fb.images,
        });
      }
    }
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }

  const botResults = await botPromise;
  dossier.chatbotNotes.push(...botResults.notes);
  dossier.warnings.push(...botResults.warnings);
  for (const av of botResults.avatars) {
    if (av && !dossier.discoveredImages.includes(av)) {
      dossier.discoveredImages.push(av);
    }
  }

  dossier.discoveredImages = dossier.discoveredImages.slice(0, 12);
  dossier.screenshots = dossier.screenshots.slice(0, 8);
  return dossier;
}
