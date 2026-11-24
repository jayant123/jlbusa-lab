// Editing a PLINTHA layout. The sofa is one sequence: the main run, then the corner, then the return run.
// Every edit rewrites that sequence and checks the rules. A refused edit returns a short reason instead.
import { WIDTH, MAX_MODULES, dimensions } from './layout.js';

export const KINDS = ['armless', 'arm_left', 'arm_right', 'corner', 'chaise', 'ottoman'];
const seqOf = (l) => [...l.main, ...l.ret];
function split(seq, ottomans) {
  const ci = seq.indexOf('corner');
  return ci < 0 ? { main: seq, ret: [], ottomans } : { main: seq.slice(0, ci + 1), ret: seq.slice(ci + 1), ottomans };
}

// Why a layout breaks the rules, or null when it is fine.
export function check(l) {
  const seq = seqOf(l);
  const n = (k) => seq.filter((m) => m === k).length;
  if (seq.length + l.ottomans > MAX_MODULES) return 'Eight modules is the most one layout can hold.';
  if (n('corner') > 1) return 'A layout takes one corner.';
  if (n('chaise') > 1) return 'A layout takes one chaise.';
  if (seq.includes('ottoman')) return 'Ottomans stand free in front of the sofa.';
  const { main, ret } = split(seq, 0);
  const corner = main.at(-1) === 'corner';
  const last = main.length - 1;
  for (let i = 0; i < main.length; i++) {
    const m = main[i];
    if (m === 'arm_left' && i !== 0) return 'A left arm only fits the left end.';
    if (m === 'arm_right' && (i !== last || corner)) return corner ? 'A right arm closes the end of the return.' : 'A right arm only fits the right end.';
    if (m === 'chaise' && !(i === 0 || (i === last && !corner))) return 'A chaise only sits at the end of a run.';
  }
  for (let i = 0; i < ret.length; i++) {
    const m = ret[i];
    if ((m === 'arm_left' || m === 'arm_right') && i !== ret.length - 1) return 'An arm only closes the end of a run.';
    if (m === 'chaise' && i !== ret.length - 1) return 'A chaise only sits at the end of a run.';
  }
  return null;
}

export const indexOfId = (l, id) => {
  const [where, i] = id.split(':');
  return where === 'main' ? Number(i) : where === 'ret' ? l.main.length + Number(i) : -1;
};
export const idAt = (l, pos) => (pos < l.main.length ? `main:${pos}` : `ret:${pos - l.main.length}`);
const isOttoman = (id) => id.startsWith('ottoman');

function result(seq, ottomans, selPos) {
  const layout = split(seq, ottomans);
  const error = check(layout);
  if (error) return { error };
  return { layout, sel: selPos == null ? null : selPos === 'ottoman' ? `ottoman:${ottomans - 1}` : idAt(layout, selPos) };
}

export function insertAt(l, pos, kind) {
  if (!(kind in WIDTH)) return { error: 'Unknown module.' };
  if (kind === 'ottoman' || pos === 'ottoman') {
    if (kind !== 'ottoman') return { error: 'Only ottomans stand free.' };
    return result(seqOf(l), l.ottomans + 1, 'ottoman');
  }
  const seq = seqOf(l);
  seq.splice(pos, 0, kind);
  return result(seq, l.ottomans, pos);
}

export function removeId(l, id) {
  if (isOttoman(id)) return { layout: { ...l, ottomans: Math.max(0, l.ottomans - 1) }, sel: null };
  const seq = seqOf(l);
  seq.splice(indexOfId(l, id), 1);
  return result(seq, l.ottomans, null);
}

export function moveTo(l, id, pos) {
  if (isOttoman(id)) return { error: 'Ottomans stay centered in front of the sofa.' };
  const seq = seqOf(l);
  const i = indexOfId(l, id);
  if (pos < 0 || pos >= seq.length) return { error: 'It is already at the end.' };
  if (pos === i) return { layout: l, sel: id };
  const [m] = seq.splice(i, 1);
  seq.splice(pos, 0, m);
  return result(seq, l.ottomans, pos);
}

// Step a piece one place along the sofa. A seat beside the corner steps over it into the other run.
export function move(l, id, dir) {
  if (isOttoman(id)) return moveTo(l, id, 0);
  return moveTo(l, id, indexOfId(l, id) + dir);
}

export function swap(l, id, kind) {
  if (isOttoman(id) || kind === 'ottoman') return { error: 'Ottomans stand free. Add one from the menu.' };
  const seq = seqOf(l);
  const i = indexOfId(l, id);
  seq[i] = kind;
  return result(seq, l.ottomans, i);
}

export function duplicate(l, id) {
  if (isOttoman(id)) return insertAt(l, 'ottoman', 'ottoman');
  const i = indexOfId(l, id);
  return insertAt(l, i + 1, seqOf(l)[i]);
}

// Open places where a new piece can go, with the kinds that fit each one.
export function handles(l) {
  const seq = seqOf(l);
  const fits = (pos) => KINDS.filter((k) => k !== 'ottoman' && !insertAt(l, pos, k).error);
  const out = [];
  if (!seq.length) {
    const kinds = fits(0);
    return kinds.length ? [{ side: 'first', pos: 0, kinds: [...kinds, ...(l.ottomans < MAX_MODULES ? ['ottoman'] : [])] }] : [];
  }
  const start = fits(0);
  if (start.length) out.push({ side: 'start', pos: 0, kinds: start });
  const endKinds = fits(seq.length);
  if (endKinds.length) out.push({ side: l.main.at(-1) === 'corner' ? 'return' : 'end', pos: seq.length, kinds: endKinds });
  if (!insertAt(l, 'ottoman', 'ottoman').error) out.push({ side: 'ottoman', pos: 'ottoman', kinds: ['ottoman'] });
  return out;
}

export function roomFit(l, wallCm) {
  const { widthCm } = dimensions(l);
  if (!wallCm || wallCm <= 0 || !widthCm) return null;
  const spareCm = wallCm - widthCm;
  return { wallCm, widthCm, spareCm, sideCm: spareCm / 2, fits: spareCm >= 60 };
}

export function createHistory(initial, limit = 80) {
  let past = [], future = [], now = initial;
  return {
    get now() { return now; },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
    push(next) {
      if (next === now || JSON.stringify(next) === JSON.stringify(now)) return now;
      past.push(now);
      if (past.length > limit) past.shift();
      future = [];
      now = next;
      return now;
    },
    undo() { if (past.length) { future.push(now); now = past.pop(); } return now; },
    redo() { if (future.length) { past.push(now); now = future.pop(); } return now; },
  };
}

const P = (main, ret = [], ottomans = 0) => Object.freeze({ main, ret, ottomans });
export const PRESETS = [
  { id: 'straight', name: 'Straight three-seat', layout: P(['arm_left', 'armless', 'arm_right']) },
  { id: 'corner', name: 'Corner sofa', layout: P(['arm_left', 'armless', 'armless', 'corner'], ['armless', 'arm_right']) },
  { id: 'u', name: 'U shape', layout: P(['chaise', 'armless', 'armless', 'corner'], ['armless', 'arm_right']) },
  { id: 'chaise', name: 'Chaise sofa', layout: P(['arm_left', 'armless', 'armless', 'chaise']) },
  { id: 'island', name: 'Lounge island', layout: P(['armless', 'armless', 'armless'], [], 2) },
];
