// Shared Globalping measurement orchestration.
//
// Three advanced tools (MtrTest / GlobalLatencyTest / CensorshipCheck) all
// talk to https://api.globalping.io with the same shape: POST to create a
// measurement, then poll GET /{id} every pollInterval until status stops
// being 'in-progress' or maxRetries is hit.
//
// Responsibilities:
//   - wrap POST + polling via fetchWithTimeout (prevents indefinite hang)
//   - track the pending setTimeout / AbortController so onScopeDispose can
//     cancel in-flight work when the drawer / route unmounts — this fixes
//     the previous bug where timers continued firing and mutating refs on
//     unmounted components
//
// Callbacks (all optional):
//   - onResults(data): called on every successful poll (including
//       intermediate in-progress payloads). Return truthy to indicate this
//       payload captured at least one usable row — drives whether the final
//       status is 'finished' vs 'error'.
//   - onFinish(): called exactly once when status transitions to 'finished'.
//       Use this for post-processing (e.g. drawMap, calResult).
//   - onError(reason): called when status transitions to 'error'. Reason is
//       'create' (POST failed), 'poll' (GET failed), or 'empty' (measurement
//       completed but produced no usable rows).

import { ref, onScopeDispose } from 'vue';
import { fetchWithTimeout } from '../../common/fetch-with-timeout.js';

const API_BASE = 'https://api.globalping.io/v1/measurements';
// Globalping probes can be slow on first create + under load; allow more
// headroom than the 5s front-end default.
const REQUEST_TIMEOUT_MS = 10000;

export function useGlobalpingMeasurement({ pollInterval = 1000, maxRetries = 4 } = {}) {
    const status = ref('idle');  // 'idle' | 'running' | 'finished' | 'error'

    let currentTimer = null;
    let currentController = null;
    let disposed = false;

    const cancel = () => {
        if (currentTimer !== null) {
            clearTimeout(currentTimer);
            currentTimer = null;
        }
        if (currentController) {
            currentController.abort();
            currentController = null;
        }
    };

    const start = (body, { onResults, onFinish, onError } = {}) => {
        cancel();
        status.value = 'running';
        let tryCount = 0;
        let anyResults = false;

        const schedule = (fn, delay) => {
            currentTimer = setTimeout(() => {
                currentTimer = null;
                fn();
            }, delay);
        };

        const finishError = (reason) => {
            status.value = 'error';
            onError?.(reason);
        };

        const poll = async (id) => {
            if (disposed) return;
            currentController = new AbortController();
            let data;
            try {
                const response = await fetchWithTimeout(`${API_BASE}/${id}`, {
                    timeoutMs: REQUEST_TIMEOUT_MS,
                    signal: currentController.signal,
                });
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                data = await response.json();
            } catch (err) {
                if (disposed) return;
                console.error('Error fetching globalping results:', err);
                finishError('poll');
                return;
            }
            if (disposed) return;

            if (onResults?.(data)) anyResults = true;

            if (data.status === 'in-progress' && tryCount < maxRetries) {
                tryCount++;
                schedule(() => poll(id), pollInterval);
            } else if (anyResults) {
                status.value = 'finished';
                onFinish?.();
            } else {
                finishError('empty');
            }
        };

        (async () => {
            currentController = new AbortController();
            let createData;
            try {
                const response = await fetchWithTimeout(API_BASE, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    timeoutMs: REQUEST_TIMEOUT_MS,
                    signal: currentController.signal,
                });
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                createData = await response.json();
            } catch (err) {
                if (disposed) return;
                console.error('Error sending globalping request:', err);
                finishError('create');
                return;
            }
            if (disposed) return;
            if (!createData?.id) {
                finishError('create');
                return;
            }
            schedule(() => poll(createData.id), pollInterval);
        })();
    };

    onScopeDispose(() => {
        disposed = true;
        cancel();
    });

    return { status, start, cancel };
}
