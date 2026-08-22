// Lazy loader + controller for the GitBook Docs Assistant embed.
//
// Gated three ways: the docs site origin comes from `VITE_DOCS_URL`
// (build-time — empty means the whole feature is absent); the nav entry
// points only render on the canonical deployment (`configs.originalSite`),
// since the assistant answers from IPCheck.ing's own docs site; and the
// assistant itself is a sign-in benefit — entry points are visible to
// everyone, but a signed-out interaction only prompts to sign in.
//
// Nothing loads until the visitor actually asks for docs: the embed script
// (served by the docs site) is injected on demand, then the assistant panel
// opens — with the visitor's query posted as their first message when one was
// typed. From then on the embed's own floating launcher (moved to the
// bottom-left in style.css, clear of our FAB stack) toggles the panel.
//
// `isOpen` is observed, not owned: the launcher can open and close the panel
// without telling us, so DocsAssistant.vue watches the panel element and
// reports back through `setOpen`. It drives the touch-only chrome there — a
// tap-outside backdrop and a body scroll lock.
//
// Two tools are registered. `get_my_test_results`: the assistant can read the
// visitor's finished on-page diagnostics — the report collector's snapshots,
// annotated with each test's localized product name so the assistant refers
// to tests as the visitor knows them, not by raw schema ids. It asks for
// confirmation first, since those results carry their IP. `run_my_tests`:
// the assistant can (re)run the four core tests through the app command bus
// (navigating home first, since the owners only live there) and gets the
// fresh snapshots back once they finish.
//
// The welcome screen's greeting, suggestions and the sidebar action are
// localized, and re-sent on every open so a language switch takes effect. The
// embed has no language option of its own, so its remaining chrome — input
// placeholder, buttons — stays English; answers follow the language of the
// question. Theming follows the page's CSS `color-scheme` (style.css).
//
// If the script cannot load (blocked / offline), we fall back to opening the
// docs site in a new tab so the action never dead-ends.
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useMainStore } from '@/store';
import { useCollectedReport } from '@/composables/use-report-collector.js';
import { REPORT_SECTION_IDS } from '@/utils/report-schema.js';
import { SECTION_TITLE_KEYS } from '@/utils/report-export.js';
import { dispatchAppCommand, waitForAppCommand } from '@/utils/app-commands.js';
import { RUNNABLE_SECTION_COMMANDS, RUNNABLE_SECTION_IDS, normalizeRunSections } from '@/utils/docs-run-tests.js';

export const DOCS_URL = (import.meta.env?.VITE_DOCS_URL || '').replace(/\/+$/, '');
export const isDocsConfigured = !!DOCS_URL;

const EMBED_SRC = `${DOCS_URL}/~gitbook/embed/script.js`;
const ASSISTANT_NAME = 'IPilot'; // embed caps this at 32 chars

let loadPromise = null;

// Shared across every caller so the nav trigger and the chrome component
// observe the same panel.
const isOpen = ref(false);
const isLoaded = ref(false);

// Opening and closing are animated, so for a moment after we act the panel
// still measures as its previous state. DocsAssistant.vue's watcher consults
// this before overwriting `isOpen` — otherwise a close reads as "still open"
// on the next tick and the toggle icon flickers back and forth.
const SETTLE_MS = 700;
let lastIntentAt = 0;
const markIntent = () => { lastIntentAt = Date.now(); };
export const isSettling = () => Date.now() - lastIntentAt < SETTLE_MS;

const loadEmbedScript = () => {
    if (loadPromise) return loadPromise;
    loadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = EMBED_SRC;
        script.async = true;
        script.onload = () => {
            isLoaded.value = true;
            resolve();
        };
        script.onerror = () => {
            loadPromise = null; // allow a retry on the next attempt
            script.remove();
            reject(new Error('GitBook embed script failed to load'));
        };
        document.head.appendChild(script);
    });
    return loadPromise;
};

// The command owners only exist while the home route is mounted; if a run
// never reports (or the owner never appears), the per-command timeout hands
// the tool call back instead of hanging the assistant.
const RUN_TEST_TIMEOUT = 60 * 1000;

export function useDocsAssistant() {
    const { t, tm, rt } = useI18n();
    const store = useMainStore();
    const route = useRoute();
    const router = useRouter();
    const isOpening = ref(false);
    const { sections } = useCollectedReport();

    // Schema-shaped snapshots annotated with localized product names — the
    // payload both tools return (read as-is, run after the tests finish).
    const buildResultsSnapshot = () => {
        const available = Object.keys(sections);
        const sectionName = (id) => t(SECTION_TITLE_KEYS[id]);
        return {
            results: Object.fromEntries(available.map((id) => [id, {
                name: sectionName(id),
                ...JSON.parse(JSON.stringify(sections[id])),
            }])),
            missingSections: REPORT_SECTION_IDS.filter((id) => !available.includes(id))
                .map((id) => ({ id, name: sectionName(id) })),
        };
    };

    // Localized suggestion questions (shared with the nav placeholder rotation).
    const docsQuestions = () => tm('nav.DocsQuestions').map((message) => rt(message));

    // Tool the assistant can call to read what the visitor is actually looking
    // at — the same schema-shaped snapshots the share-report dialog uses, so
    // no new data pipeline and the same whitelist (lookup tools like whois are
    // excluded by design). Gated behind a confirmation button: the results
    // include the visitor's IP and location, and answering "is this normal?"
    // means handing them to the assistant.
    const readResultsTool = {
        name: 'get_my_test_results',
        description: [
            "Read the diagnostic results currently on the visitor's own MyIP page:",
            'IP addresses and their geolocation/ASN, connectivity checks, WebRTC,',
            'DNS leak, speed test, and any other test they have run.',
            'Use it whenever the question is about their own situation — "what is my IP",',
            '"is this result normal", "why is my location wrong", "am I leaking" —',
            'so the answer reflects their actual data instead of generic documentation.',
            'Returns only tests that have finished; `missingSections` lists the ones',
            'they have not run yet, which you may suggest running.',
            'Every test carries both a stable `id` and a localized `name` — when',
            'talking to the visitor, always call tests by `name` (their product name',
            "in the visitor's UI language), never by the raw id.",
        ].join(' '),
        inputSchema: { type: 'object', properties: {}, required: [] },
        confirmation: { icon: 'eye', label: t('nav.DocsToolConfirm') },
        execute: async () => ({
            output: buildResultsSnapshot(),
            summary: { icon: 'eye', text: t('nav.DocsToolSummary') },
        }),
    };

    // Tool the assistant can call to actually (re)run the four core tests,
    // PersonaCheck-style: navigate home if needed (the command owners only
    // live there), wait for each owner, dispatch, and report the refreshed
    // snapshots plus what ran, failed, or wasn't recognized. Partial failure
    // is fine — allSettled keeps the healthy tests' results.
    const runTestsTool = {
        name: 'run_my_tests',
        description: [
            "Run (or re-run) the visitor's core network tests on their MyIP page",
            'and return the fresh results when they finish.',
            'Use it when the visitor asks to run, re-run, or refresh their tests,',
            'or when the results a question needs are missing or stale.',
            'It covers ONLY the four core tests: IP address lookup (`ipinfo`),',
            'website connectivity (`connectivity`), WebRTC leak (`webrtc`), and',
            'DNS leak (`dnsleak`) — no other tool or test can be started this way;',
            'ask the visitor to run those themselves.',
            'Takes roughly 10-60 seconds. The output lists what `ran`, what',
            '`failed`, and the same results snapshot `get_my_test_results` returns.',
        ].join(' '),
        inputSchema: {
            type: 'object',
            properties: {
                sections: {
                    type: 'array',
                    items: { type: 'string', enum: RUNNABLE_SECTION_IDS },
                    description: [
                        'Which tests to run: ipinfo (IP address lookup),',
                        'connectivity (website connectivity), webrtc (WebRTC leak),',
                        'dnsleak (DNS leak).',
                        'Omit or pass an empty array to run all four.',
                    ].join(' '),
                },
            },
            required: [],
        },
        confirmation: { icon: 'play', label: t('nav.DocsToolRunConfirm') },
        execute: async (args) => {
            const { requested, unknown } = normalizeRunSections(args);
            if (route.name !== 'home') await router.push('/');
            const settled = await Promise.allSettled(requested.map(async (id) => {
                const { command, payload } = RUNNABLE_SECTION_COMMANDS[id];
                await waitForAppCommand(command, { timeoutMs: RUN_TEST_TIMEOUT });
                await dispatchAppCommand(command, payload, { timeoutMs: RUN_TEST_TIMEOUT });
            }));
            const ran = [];
            const failed = [];
            settled.forEach((result, i) => {
                if (result.status === 'fulfilled') {
                    ran.push(requested[i]);
                } else {
                    const code = result.reason?.code;
                    const reason = code === 'timeout' || code === 'unavailable' ? code : 'error';
                    failed.push({ id: requested[i], reason });
                }
            });
            const output = { ...buildResultsSnapshot(), ran, failed };
            if (unknown.length) output.unknownSections = unknown;
            return {
                output,
                summary: { icon: 'play', text: t('nav.DocsToolRunSummary') },
            };
        },
    };

    const openDocsSite = () => window.open(DOCS_URL, '_blank', 'noopener');

    // Reported by DocsAssistant.vue from the live panel — the embed fires no
    // open/close callbacks, and its launcher can toggle the panel on its own.
    const setOpen = (value) => {
        isOpen.value = value;
    };

    const closeDocs = () => {
        markIntent();
        isOpen.value = false;
        if (typeof window.GitBook === 'function') window.GitBook('close');
    };

    const askDocs = async (query) => {
        if (!isDocsConfigured) return;
        // Every entry point funnels through here, so this is the one place
        // the sign-in benefit is enforced.
        if (store.isSignedIn !== true) {
            store.setAlert(true, 'text-warning', t('nav.DocsSignInMessage'), t('nav.DocsSignInTitle'));
            return;
        }
        const question = (query || '').trim();
        if (isOpening.value) return;
        isOpening.value = true;
        try {
            await loadEmbedScript();
            window.GitBook('configure', {
                assistantName: ASSISTANT_NAME,
                tabs: ['assistant'], // chat only — no in-panel docs browser or search
                trademark: false,
                greeting: {
                    title: t('nav.DocsGreetingTitle'),
                    subtitle: t('nav.DocsGreetingSubtitle'),
                },
                suggestions: docsQuestions(),
                actions: [
                    { icon: 'book', label: t('nav.OpenDocs'), onClick: openDocsSite },
                ],
                tools: [readResultsTool, runTestsTool],
            });
            window.GitBook('open');
            markIntent();
            isOpen.value = true;
            if (question) {
                window.GitBook('navigateToAssistant');
                window.GitBook('postUserMessage', question);
            }
        } catch (error) {
            console.warn('Docs assistant unavailable, opening docs site instead:', error);
            openDocsSite();
        } finally {
            isOpening.value = false;
        }
    };

    return { askDocs, closeDocs, setOpen, isOpen, isLoaded, isOpening, docsQuestions };
}
