// Lazy loader + controller for the GitBook Docs Assistant embed.
//
// Gated twice: the docs site origin comes from `VITE_DOCS_URL` (build-time —
// empty means the whole feature is absent), and the nav entry points only
// render on the canonical deployment (`configs.originalSite`), since the
// assistant answers from IPCheck.ing's own docs site.
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
// One tool is registered (`get_my_test_results`): the assistant can read the
// visitor's finished on-page diagnostics — the report collector's snapshots,
// reused as-is — so "is this normal?" is answered against their actual data.
// It asks for confirmation first, since those results carry their IP.
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
import { useCollectedReport } from '@/composables/use-report-collector.js';
import { REPORT_SECTION_IDS } from '@/utils/report-schema.js';

export const DOCS_URL = (import.meta.env?.VITE_DOCS_URL || '').replace(/\/+$/, '');
export const isDocsConfigured = !!DOCS_URL;

const EMBED_SRC = `${DOCS_URL}/~gitbook/embed/script.js`;
const ASSISTANT_NAME = 'IPChecking Copilot'; // embed caps this at 32 chars

let loadPromise = null;

// Shared across every caller so the nav trigger and the chrome component
// observe the same panel.
const isOpen = ref(false);
const isLoaded = ref(false);

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

export function useDocsAssistant() {
    const { t, tm, rt } = useI18n();
    const isOpening = ref(false);
    const { sections } = useCollectedReport();

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
        ].join(' '),
        inputSchema: { type: 'object', properties: {}, required: [] },
        confirmation: { icon: 'eye', label: t('nav.DocsToolConfirm') },
        execute: async () => {
            const available = Object.keys(sections);
            return {
                output: {
                    results: JSON.parse(JSON.stringify(sections)),
                    missingSections: REPORT_SECTION_IDS.filter((id) => !available.includes(id)),
                },
                summary: { icon: 'eye', text: t('nav.DocsToolSummary') },
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
        isOpen.value = false;
        if (typeof window.GitBook === 'function') window.GitBook('close');
    };

    const askDocs = async (query) => {
        if (!isDocsConfigured) return;
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
                tools: [readResultsTool],
            });
            window.GitBook('open');
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
