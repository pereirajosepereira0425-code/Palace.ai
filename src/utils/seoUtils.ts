export const SITE_NAME = 'Palace.ai';
export const SITE_TITLE = 'Palace.ai – Free Character AI & Tavern Roleplay'; // 47 chars (SEO 30-60)
export const SITE_DESCRIPTION =
  'Create, import from JanitorAI and SpicyChat, and chat free with AI characters featuring custom voices, lorebooks, and battle RPGs on Palace.ai.'; // 146 chars (SEO 120-160)

export const DEFAULT_FIREBASE_PROJECT_ID = 'eighth-veld-fdtd0';

export interface SitemapCharacterEntry {
  uuid: string;
  updatedAt?: Date | string | null;
}

export interface FreeComPortOption {
  id: string;
  provider: string;
  url: string;
  badge: string;
  cost: string;
  notes: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function sanitizeOrigin(rawOrigin: string): string {
  const trimmed = (rawOrigin || '').trim().replace(/\/+$/, '');
  if (!trimmed) return 'https://eighth-veld-fdtd0.firebaseapp.com';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function sanitizeDomainSlug(raw: string): string {
  const cleaned = (raw || '')
    .toLowerCase()
    .replace(/\.com$/i, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return cleaned || 'palaceai';
}

export function buildRobotsTxt(rawOrigin: string): string {
  const origin = sanitizeOrigin(rawOrigin);
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

export function buildSitemapXml(
  rawOrigin: string,
  characters: SitemapCharacterEntry[] = []
): string {
  const origin = sanitizeOrigin(rawOrigin);
  const todayIso = new Date().toISOString().split('T')[0];

  const staticRoutes: Array<{ path: string; priority: string; changefreq: string }> = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/create', priority: '0.8', changefreq: 'weekly' },
    { path: '/lorebooks', priority: '0.8', changefreq: 'weekly' },
    { path: '/stages', priority: '0.7', changefreq: 'weekly' },
    { path: '/personas', priority: '0.7', changefreq: 'weekly' },
    { path: '/imagine', priority: '0.7', changefreq: 'weekly' },
  ];

  const urlNodes: string[] = [];

  for (const route of staticRoutes) {
    urlNodes.push(
      [
        '  <url>',
        `    <loc>${escapeXml(`${origin}${route.path}`)}</loc>`,
        `    <lastmod>${todayIso}</lastmod>`,
        `    <changefreq>${route.changefreq}</changefreq>`,
        `    <priority>${route.priority}</priority>`,
        '  </url>',
      ].join('\n')
    );
  }

  const seenUuids = new Set<string>();
  for (const ch of characters) {
    const uuid = String(ch?.uuid || '').trim();
    if (!uuid || seenUuids.has(uuid)) continue;
    seenUuids.add(uuid);

    let lastmod = todayIso;
    if (ch.updatedAt) {
      const d = new Date(ch.updatedAt);
      if (!Number.isNaN(d.getTime())) {
        lastmod = d.toISOString().split('T')[0];
      }
    }

    urlNodes.push(
      [
        '  <url>',
        `    <loc>${escapeXml(`${origin}/character/${encodeURIComponent(uuid)}`)}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        '    <changefreq>weekly</changefreq>',
        '    <priority>0.8</priority>',
        '  </url>',
      ].join('\n')
    );
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urlNodes,
    '</urlset>',
    '',
  ].join('\n');
}

export function buildSeoJsonLd(rawOrigin: string) {
  const origin = sanitizeOrigin(rawOrigin);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: SITE_NAME,
        url: origin,
        applicationCategory: 'EntertainmentApplication',
        operatingSystem: 'All',
        description: SITE_DESCRIPTION,
        image: `${origin}/pwa-512x512.png`,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
      },
      {
        '@type': 'WebSite',
        name: SITE_NAME,
        url: origin,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${origin}/?search={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };
}

export function buildFreeComPortOptions(
  rawSlug: string,
  rawOrigin: string,
  firebaseProjectId: string = DEFAULT_FIREBASE_PROJECT_ID
): FreeComPortOption[] {
  const slug = sanitizeDomainSlug(rawSlug);
  const project = sanitizeDomainSlug(firebaseProjectId || DEFAULT_FIREBASE_PROJECT_ID);
  const cleanOrigin = sanitizeOrigin(rawOrigin);

  return [
    {
      id: 'firebase-project-com',
      provider: 'Firebase Hosting (Project .com Alias)',
      url: `https://${project}.firebaseapp.com`,
      badge: '.COM • $0 Unlimited',
      cost: '$0 / month forever (Spark Tier)',
      notes: 'Uses your attached Firebase project ID. Run `firebase deploy --only hosting` from the downloaded kit to publish at this .com URL.',
    },
    {
      id: 'firebase-custom-com',
      provider: 'Firebase Hosting (Branded .com Subdomain)',
      url: `https://${slug}.firebaseapp.com`,
      badge: '.COM • Custom Brand',
      cost: '$0 / month forever (Spark Tier)',
      notes: 'Reserve a branded *.firebaseapp.com site inside Firebase Hosting and deploy the kit with zero domain fees.',
    },
    {
      id: 'render-com',
      provider: 'Render Free Web Service (.onrender.com)',
      url: `https://${slug}.onrender.com`,
      badge: '.COM • Full-Stack',
      cost: '$0 / month (Free Web Tier)',
      notes: 'Runs both the Express server and React app cleanly at a public .com subdomain using render.yaml from the kit.',
    },
    {
      id: 'current-public-url',
      provider: 'Live Instant Public Link',
      url: cleanOrigin,
      badge: 'Live Right Now',
      cost: '$0 Active Host',
      notes: 'Immediately live and ready to share or submit in Google Search Console.',
    },
  ];
}

export function buildComDomainHostingFiles(options: {
  origin: string;
  slug: string;
  firebaseProjectId?: string;
  characters?: SitemapCharacterEntry[];
}): Array<{ name: string; content: string }> {
  const origin = sanitizeOrigin(options.origin);
  const slug = sanitizeDomainSlug(options.slug || 'palaceai');
  const projectId = options.firebaseProjectId?.trim() || DEFAULT_FIREBASE_PROJECT_ID;
  const targetHostUrl = `https://${projectId}.firebaseapp.com`;
  const renderHostUrl = `https://${slug}.onrender.com`;

  const firebaseJson = JSON.stringify(
    {
      hosting: {
        site: slug,
        public: 'dist',
        ignore: ['firebase.json', '**/.*', '**/node_modules/**'],
        headers: [
          {
            source: '/sitemap.xml',
            headers: [{ key: 'Content-Type', value: 'application/xml; charset=utf-8' }],
          },
          {
            source: '/robots.txt',
            headers: [{ key: 'Content-Type', value: 'text/plain; charset=utf-8' }],
          },
        ],
        rewrites: [
          {
            source: '**',
            destination: '/index.html',
          },
        ],
      },
    },
    null,
    2
  );

  const firebaserc = JSON.stringify(
    {
      projects: {
        default: projectId,
      },
    },
    null,
    2
  );

  const renderYaml = [
    'services:',
    '  - type: web',
    `    name: ${slug}`,
    '    runtime: node',
    '    plan: free',
    '    buildCommand: npm install && npm run build',
    '    startCommand: npm run start',
    '    envVars:',
    '      - key: NODE_ENV',
    '        value: production',
    '',
  ].join('\n');

  const guideMd = `# Palace.ai Free .com Hosting & Google Search Setup

## 1. Free Unlimited .com Domain Porting (Zero Registrar Cost)
Standalone root domains like \`PalaceAi.com\` cost ~$10-$15/year at ICANN domain registrars.
To host **Palace.ai** on a genuine **\`.com\`** URL for **$0 forever**, use one of these two included configs:

### Option A: Firebase Hosting (\`${targetHostUrl}\` or \`https://${slug}.firebaseapp.com\`)
1. Build the production bundle:
   \`\`\`bash
   npm install
   npm run build
   \`\`\`
2. Copy \`firebase.json\`, \`.firebaserc\`, \`robots.txt\`, and \`sitemap.xml\` into \`dist/\`.
3. Install Firebase CLI and deploy for free:
   \`\`\`bash
   npx firebase-tools login
   npx firebase-tools deploy --only hosting
   \`\`\`
   Your site goes live on **\`https://${projectId}.firebaseapp.com\`** (or your custom site **\`https://${slug}.firebaseapp.com\`**) with free SSL & CDN!

### Option B: Render Free Full-Stack Web Service (\`${renderHostUrl}\`)
1. Push your repo to GitHub with the included \`render.yaml\`.
2. In Render Dashboard -> **New Blueprint** -> select the repo.
3. Your full Express + PostgreSQL Palace.ai server launches at **\`${renderHostUrl}\`**.

---

## 2. Appear in Google Search Results (SEO)
Palace.ai already includes:
- Optimal SEO \`<title>\`, \`<meta name="description">\`, OpenGraph, and Twitter cards
- Schema.org JSON-LD (\`WebApplication\` + \`WebSite\` \`SearchAction\`)
- Live \`/robots.txt\` and \`/sitemap.xml\` covering all character pages

To index your domain on Google:
1. Open **Google Search Console**: https://search.google.com/search-console/welcome
2. Add your live URL (or \`.firebaseapp.com\` / \`.onrender.com\` URL) as a **URL prefix** property.
3. Verify ownership via HTML meta tag or Google Analytics.
4. Open **Sitemaps** -> submit: \`sitemap.xml\` (e.g. \`${origin}/sitemap.xml\` or \`${targetHostUrl}/sitemap.xml\`).
5. Click **Request Indexing** in URL Inspection for your homepage!
`;

  return [
    { name: 'palace-ai-free-com-kit/firebase.json', content: firebaseJson },
    { name: 'palace-ai-free-com-kit/.firebaserc', content: firebaserc },
    { name: 'palace-ai-free-com-kit/render.yaml', content: renderYaml },
    { name: 'palace-ai-free-com-kit/robots.txt', content: buildRobotsTxt(targetHostUrl) },
    {
      name: 'palace-ai-free-com-kit/sitemap.xml',
      content: buildSitemapXml(targetHostUrl, options.characters || []),
    },
    { name: 'palace-ai-free-com-kit/GOOGLE_SEARCH_AND_FREE_COM_GUIDE.md', content: guideMd },
  ];
}
