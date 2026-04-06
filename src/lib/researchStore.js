/**
 * Global singleton research store.
 * State persists across navigation because it lives outside React.
 * Components subscribe to get re-renders when state changes.
 */

const state = {
  regions: [],
  niches: [],
  period: '1month',
  loading: false,
  researchProgress: 0,
  result: null,
  error: null,
  // bulk
  enrichedMap: {},
  selected: new Set(),
  bulkEnriching: false,
  bulkEnrichProgress: { current: 0, total: 0 },
  bulkImporting: false,
  bulkImportProgress: { current: 0, total: 0 },
  bulkImportResult: null,
  savedJobId: null,
  jobSaved: false,
};

const listeners = new Set();

function notify() {
  listeners.forEach(fn => fn({ ...state, selected: new Set(state.selected), enrichedMap: { ...state.enrichedMap } }));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState() {
  return { ...state, selected: new Set(state.selected), enrichedMap: { ...state.enrichedMap } };
}

export function setState(patch) {
  Object.assign(state, patch);
  notify();
}

export function setEnrichedForIndex(i, data) {
  state.enrichedMap = { ...state.enrichedMap, [i]: data };
  notify();
}

export function toggleSelected(i) {
  const next = new Set(state.selected);
  next.has(i) ? next.delete(i) : next.add(i);
  state.selected = next;
  notify();
}

export function selectAll(count) {
  state.selected = new Set(Array.from({ length: count }, (_, i) => i));
  notify();
}

export function clearSelected() {
  state.selected = new Set();
  notify();
}