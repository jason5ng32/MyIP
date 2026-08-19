// Turns collected section snapshots into the share outputs: the versioned
// report envelope (POSTed for the /r/:id link and offered as JSON download)
// and the self-describing Markdown handed to AI assistants. Pure functions —
// the share dialog owns all interaction state. Markdown prose is localized
// via the caller's t(); data tables keep the schema's English field names on
// purpose (stable identifiers for AI consumption).

import { REPORT_VERSION, REPORT_SECTION_IDS, maskReportIps } from './report-schema.js';

// Section id → the site's existing i18n title key (dialog checklist and
// Markdown headings reuse the same titles the homepage sections show).
export const SECTION_TITLE_KEYS = {
    ipinfo: 'ipInfos.Title',
    connectivity: 'connectivity.Title',
    webrtc: 'webrtc.Title',
    dnsleak: 'dnsleaktest.Title',
    speedtest: 'speedtest.Title',
    pingtest: 'pingtest.Title',
    mtrtest: 'mtrtest.Title',
    ruletest: 'ruletest.Title',
    browserinfo: 'browserinfo.Title',
    invisibility: 'invisibilitytest.Title',
    enhanceddnsleak: 'enhanceddnsleaktest.Title',
    persona: 'personacheck.Title',
};

// Assemble the envelope from collected snapshots. Sections keep homepage
// order regardless of selection order; snapshots are deep-copied (they're
// JSON-safe by construction) so later test re-runs can't mutate an already
// exported report; masking applies at this boundary so all outputs share
// the exact same data.
export const buildShareReport = ({ sections, selectedIds, maskTail, locale, origin }) => {
    const picked = {};
    for (const id of REPORT_SECTION_IDS) {
        if (selectedIds.includes(id) && sections[id]) {
            picked[id] = JSON.parse(JSON.stringify(sections[id]));
        }
    }
    const report = {
        v: REPORT_VERSION,
        generatedAt: new Date().toISOString(),
        origin,
        locale,
        sections: picked,
    };
    return maskTail ? maskReportIps(report) : report;
};

// --- Markdown rendering -------------------------------------------------------

const cell = (value) => {
    if (value === undefined || value === null || value === '') return '—';
    if (value === true) return 'yes';
    if (value === false) return 'no';
    return String(value).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ');
};

const mdTable = (headers, rows) => [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
].join('\n');

const kvLines = (pairs) => pairs
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `- ${key}: ${cell(value)}`)
    .join('\n');

// MTR hop columns vary by mtr build — render the union of stats the probe
// actually carries, in a stable order.
const MTR_HOP_STATS = ['lossPct', 'sntCount', 'drop', 'rcv', 'lastMs', 'avgMs', 'bestMs', 'worstMs', 'stdevMs', 'javgMs'];

// ipinfo's IPCheck.ing enrichment columns only render when some card
// carries them (other sources / signed-out runs never do).
const IPINFO_EXTRA_COLS = ['isProxy', 'ipType', 'nativeIP', 'qualityScore', 'proxyProtocol', 'proxyProvider'];

const SECTION_RENDERERS = {
    ipinfo: (section) => {
        const extras = IPINFO_EXTRA_COLS.filter((key) => section.cards.some((c) => c[key] !== undefined));
        return mdTable(
            ['source', 'ip', 'countryCode', 'region', 'city', 'timezone', 'asn', 'isp', ...extras],
            section.cards.map((c) => [
                c.source, c.ip, c.countryCode, c.region, c.city, c.timezone, c.asn, c.isp,
                ...extras.map((key) => c[key]),
            ]),
        );
    },
    connectivity: (section) => mdTable(
        ['id', 'name', 'status', 'timeMs', 'minTimeMs', 'custom'],
        section.targets.map((t) => [t.id, t.name, t.status, t.timeMs, t.minTimeMs, t.custom]),
    ),
    webrtc: (section) => mdTable(
        ['id', 'url', 'ip', 'natType', 'countryCode', 'org'],
        section.servers.map((s) => [s.id, s.url, s.ip, s.natType, s.countryCode, s.org]),
    ),
    dnsleak: (section) => mdTable(
        ['id', 'ip', 'countryCode', 'org'],
        section.providers.map((p) => [p.id, p.ip, p.countryCode, p.org]),
    ),
    speedtest: (section) => {
        const parts = [kvLines([
            ['downloadMbps', section.downloadMbps],
            ['uploadMbps', section.uploadMbps],
            ['latencyMs', section.latencyMs],
            ['jitterMs', section.jitterMs],
            ['loadedLatencyDownMs', section.loadedLatencyDownMs],
            ['loadedLatencyUpMs', section.loadedLatencyUpMs],
        ])];
        if (section.scores) {
            parts.push(kvLines(Object.entries(section.scores).map(
                ([key, score]) => [`score.${key}`, `${score} (${section.qualities?.[key] ?? '—'})`],
            )));
        }
        if (section.connection) {
            parts.push(kvLines(Object.entries(section.connection).map(
                ([key, value]) => [`connection.${key}`, value],
            )));
        }
        return parts.filter(Boolean).join('\n');
    },
    pingtest: (section) => [
        `target: ${cell(section.target)}`,
        mdTable(
            ['countryCode', 'min', 'avg', 'max', 'loss%', 'total', 'rcv', 'drop'],
            section.probes.map((p) => [p.countryCode, p.stats.min, p.stats.avg, p.stats.max, p.stats.loss, p.stats.total, p.stats.rcv, p.stats.drop]),
        ),
    ].join('\n'),
    mtrtest: (section) => {
        const blocks = [`target: ${cell(section.target)}`];
        for (const probe of section.probes) {
            const stats = MTR_HOP_STATS.filter((key) => probe.hops.some((hop) => hop[key] !== undefined));
            // "DE Falkenstein — Hetzner (AS24940)", absent parts omitted.
            const place = [probe.countryCode, probe.city].filter(Boolean).join(' ');
            const network = [probe.network, probe.asn !== undefined ? `(AS${probe.asn})` : undefined]
                .filter(Boolean).join(' ');
            blocks.push(`### probe: ${[place, network].filter(Boolean).join(' — ')}`);
            blocks.push(mdTable(
                ['n', 'host', 'ip', 'asn', ...stats],
                probe.hops.map((hop) => [hop.n, hop.host, hop.ip, hop.asn, ...stats.map((key) => hop[key])]),
            ));
        }
        return blocks.join('\n');
    },
    ruletest: (section) => [
        `uniqueIPCount: ${section.uniqueIPCount}`,
        mdTable(
            ['id', 'ip', 'countryCode', 'org'],
            section.workers.map((w) => [w.id, w.ip, w.countryCode, w.org]),
        ),
    ].join('\n'),
    browserinfo: (section) => kvLines([
        ['browser', section.browser && `${section.browser.name ?? ''} ${section.browser.version ?? ''}`.trim()],
        ['os', section.os && `${section.os.name ?? ''} ${section.os.version ?? ''}`.trim()],
        ['engine', section.engine && `${section.engine.name ?? ''} ${section.engine.version ?? ''}`.trim()],
        ['timezone', section.timezone],
        ['languages', section.languages?.join(', ')],
        ['display', section.display && `${section.display.width}x${section.display.height} @${section.display.pixelRatio}x`],
        ['connection', section.connection && `${section.connection.effectiveType ?? ''} downlink=${section.connection.downlink ?? '—'}Mbps rtt=${section.connection.rtt ?? '—'}ms`.trim()],
    ]),
    invisibility: (section) => [
        kvLines([
            ['ip', section.ip],
            ['score.proxy', section.scores.proxy],
            ['score.vpn', section.scores.vpn],
        ]),
        mdTable(['signal', 'flagged'], section.flags.map((f) => [f.key, f.flagged])),
    ].join('\n'),
    persona: (section) => [
        kvLines([
            ['targetCountry', section.country],
            ['grade', section.grade],
            ['score', section.score === null ? '—' : `${section.score}/100`],
            ['scored', `${section.counts.scored}/${section.counts.total}`],
            ['match', section.counts.match],
            ['mismatch', section.counts.mismatch],
            ['unnatural', section.counts.unnatural],
            ['leak', section.counts.leak],
        ]),
        mdTable(['check', 'axis', 'verdict'],
            section.results.map((r) => [r.id, r.axis, r.verdict])),
    ].join('\n'),
    enhanceddnsleak: (section) => [
        kvLines([
            ['rawCount', section.rawCount],
            ['resolverCount', section.resolverCount],
            ['dnssec', section.dnssec],
        ]),
        mdTable(
            ['ip', 'countryCode', 'asn', 'org', 'transport', 'ecs', 'do', 'cd'],
            section.queries.map((q) => [q.ip, q.countryCode, q.asn, q.org, q.transport, q.ecs, q.do, q.cd]),
        ),
    ].join('\n'),
};

// Render the whole report as a self-describing Markdown prompt: localized
// prose explains each test and how to read it, the closing line asks the AI
// for a diagnosis. `masked` adds the privacy note about masked IP tails.
export const reportToMarkdown = (report, t, { masked = false } = {}) => {
    const lines = [
        `# ${t('report.ai.Heading')}`,
        '',
        // generatedAt stays a raw ISO instant even inside localized prose:
        // the reader is an AI, and ISO is unambiguous and timezone-explicit
        // where a localized date+time would drop the zone.
        t('report.ai.Intro', { origin: report.origin, time: report.generatedAt }),
    ];
    if (masked) lines.push('', t('report.ai.Masked'));
    for (const id of REPORT_SECTION_IDS) {
        const section = report.sections[id];
        if (!section) continue;
        lines.push(
            '',
            `## ${t(SECTION_TITLE_KEYS[id])}`,
            '',
            t(`report.ai.Sections.${id}`),
            `testedAt: ${section.testedAt}`,
            '',
            SECTION_RENDERERS[id](section),
        );
    }
    lines.push('', '---', '', t('report.ai.Instruction'), '');
    return lines.join('\n');
};

// --- JSON download --------------------------------------------------------------

export const reportFileName = (generatedAt) =>
    `myip-report-${String(generatedAt).slice(0, 10)}.json`;

export const downloadReportJson = (report) => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = reportFileName(report.generatedAt);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
};
