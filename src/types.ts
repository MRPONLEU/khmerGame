/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WordPuzzle {
  id: number;
  word: string;
  clue: string;
  blocks: string[];
  prefilled: boolean[];
  category?: string;
}
