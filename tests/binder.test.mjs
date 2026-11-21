// Scanner « Grille », step 3: binders — page and pocket of each copy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slotLabel, slotsLabel, nextBinderPage, pageCount, placePatch, binderPages, binderSlotOf } from '../src/lib/binder.js';
import { gridSlots } from '../src/lib/gridScan.js';

const copy = (o) => ({ id: Math.random().toString(36).slice(2), cardId: 'ogn-001-298', boxId: 'b1', deleted: false, ...o });

test('labels: one pocket, several, several pages', () => {
  assert.equal(slotLabel(4, 7), 'p. 4, case 7');
  assert.equal(slotsLabel([[4, 7]]), 'p. 4, case 7');
  assert.equal(slotsLabel([[4, 7], [4, 2]]), 'p. 4, cases 2 et 7');
  assert.equal(slotsLabel([[6, 1], [4, 7]]), 'p. 4, case 7 · p. 6, case 1');
  assert.equal(slotsLabel([[1, 1], [2, 1], [3, 1], [4, 1], [5, 1]]), 'p. 1, case 1 · p. 2, case 1 · p. 3, case 1 + 2');
  assert.equal(slotsLabel([]), '');
  assert.equal(binderSlotOf(copy({ binderPage: 3, binderSlot: 5 })).page, 3);
  assert.equal(binderSlotOf(copy({ boxId: null, binderPage: 3 })), null, 'no box: no page');
});

test('next page of a binder and a page already recorded', () => {
  const list = [copy({ binderPage: 1, binderSlot: 1 }), copy({ binderPage: 4, binderSlot: 2 }), copy({ binderPage: 4, binderSlot: 3 }),
    copy({ boxId: 'b2', binderPage: 9, binderSlot: 1 }), copy({ binderPage: 7, binderSlot: 1, deleted: true })];
  assert.equal(nextBinderPage(list, 'b1'), 5);
  assert.equal(nextBinderPage(list, 'b3'), 1, 'empty binder: page 1');
  assert.equal(pageCount(list, 'b1', 4), 2);
  assert.equal(pageCount(list, 'b1', 7), 0, 'deleted copies do not count');
});

test('a copy moved elsewhere loses its page and pocket, not when it stays', () => {
  const c = copy({ binderPage: 4, binderSlot: 7, binderCols: 3 });
  assert.equal(placePatch(c, { boxId: 'b1' }).binderPage, 4, 'same box');
  assert.equal(placePatch(c, { condition: 'NM' }).binderSlot, 7, 'not a move');
  const moved = placePatch(c, { boxId: 'b2', deckId: null, loanId: null });
  assert.deepEqual([moved.boxId, moved.binderPage, moved.binderSlot, moved.binderCols], ['b2', null, null, null]);
  assert.equal(placePatch(c, { boxId: null }).binderPage, null, 'box deleted');
  assert.equal(placePatch(c, { deckId: 'd1', boxId: null }).binderPage, null, 'put in a deck');
  assert.equal(placePatch(c, { loanId: 'l1' }).binderPage, null, 'lent');
});

test('the binder screen: every pocket of each page, empty ones too, loose copies apart', () => {
  const { pages, loose } = binderPages([
    copy({ binderPage: 2, binderSlot: 9, binderCols: 3 }), copy({ binderPage: 2, binderSlot: 1, binderCols: 3 }),
    copy({ binderPage: 1, binderSlot: 5, binderCols: 4 }), copy({ binderPage: 1, binderSlot: 5, binderCols: 4 }),
    copy({}),
  ]);
  assert.deepEqual(pages.map(p => [p.page, p.cols, p.cells.length]), [[1, 4, 12], [2, 3, 9]]);
  assert.equal(pages[0].cells[4].copies.length, 2, 'two copies in the same pocket');
  assert.equal(pages[1].cells[1].copies.length, 0, 'empty pocket shown');
  assert.equal(loose.length, 1);
});

test('pockets from the photo: a full 3×3 page, a page with empty pockets, a 4-column page', () => {
  const page = (cols, rows, skip = []) => {
    const out = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (!skip.includes(r * cols + c + 1)) out.push({ cx: 120 + c * 210 + r * 6, cy: 160 + r * 290 + c * 9, w: 190, h: 270 });
    }
    return out;
  };
  assert.deepEqual(gridSlots(page(3, 3)).slots, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(gridSlots(page(3, 3, [2, 6])).slots, [1, 3, 4, 5, 7, 8, 9], 'empty pockets keep the numbering');
  const four = gridSlots(page(4, 3));
  assert.equal(four.cols, 4);
  assert.deepEqual(four.slots, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(gridSlots([]).slots, []);
});
