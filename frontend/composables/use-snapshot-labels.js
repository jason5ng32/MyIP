// Snapshots tool page: the viewer-locale text of recorded values — country
// names (Intl), dates, snapshot labels ("country · IP" unless named),
// diff-view field labels and values — shared by the page, its dialogs, its
// diff blocks. Codes and keys live in
// utils/features/snapshot-view.js and snapshot-diff-format.js; this only
// binds vue-i18n.

import { useI18n } from 'vue-i18n';
import { useMainStore } from '@/store';
import getCountryName from '@/data/country-name.js';
import { isoToDateTime } from '@/utils/time-utils.js';
import { SECTION_TITLE_KEYS } from '@/utils/report/report-export.js';
import { autoLabel, formatAutoLabel, snapshotLabel } from '@/utils/features/snapshots.js';
import { seenSpanText } from '@/utils/features/snapshot-view.js';
import { formatFieldValue, fieldLabelKey } from '@/utils/features/snapshot-diff-format.js';

export const useSnapshotLabels = () => {
    const { t, locale } = useI18n();
    const store = useMainStore();

    const country = (code) => (code ? (getCountryName(code, store.lang) || code) : '');
    const sectionTitle = (id) => (SECTION_TITLE_KEYS[id] ? t(SECTION_TITLE_KEYS[id]) : id);
    const dateTime = (iso) => isoToDateTime(iso, locale.value);

    const labelFormatters = { countryName: country };
    const label = (snapshot) => snapshotLabel(snapshot, labelFormatters);
    const auto = (snapshot) => formatAutoLabel(autoLabel(snapshot), labelFormatters);

    // "Nov 8, 2026, 3:04 PM", or first – last (both in full) when updated
    // after creation and the two differ as text.
    const when = (snapshot) => {
        const { first, last } = seenSpanText(snapshot, dateTime);
        return last ? t('snapshots.TimeRange', { first, last }) : first;
    };

    // Diff view: a field's label and one recorded value as text.
    const fieldLabel = (field) => t(fieldLabelKey(field));
    const fieldValue = (field, value) => formatFieldValue(field, value, { t, countryName: country, locale: locale.value });

    return {
        country, sectionTitle, dateTime, label, auto, when, fieldLabel, fieldValue,
    };
};
