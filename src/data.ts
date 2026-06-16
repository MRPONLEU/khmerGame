/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WordPuzzle } from "./types";

// The 10 main spelling words from the prompt image
export const PRESET_CHALLENGES: WordPuzzle[] = [
  {
    id: 1,
    word: "ច្រណែន",
    clue: "ការទាស់ចិត្តនឹងអ្នកដទៃ ដែលបានល្អជាងខ្លួន ឬមានចិត្តចង់បានរបស់គេ។",
    blocks: ["ច", "្រ", "ណ", "ែ", "ន"],
    prefilled: [false, true, false, false, true], // Child enters: ច, ណ, ែ
  },
  {
    id: 2,
    word: "សម្រេចចិត្ត",
    clue: "ការតាំងចិត្តយ៉ាងម៉ឺងម៉ាត់ថានឹងធ្វើអ្វីមួយ ដោយមិនរារែក។",
    blocks: ["ស", "្ម", "រ", "េ", "ច", "ច", "ិ", "្ត", "ត"],
    prefilled: [true, false, false, true, true, false, true, false, true], // Child enters: ្ម, រ, ច, ្ត
  },
  {
    id: 3,
    word: "ផ្ចិតផ្ចង់",
    clue: "ធ្វើអ្វីមួយដោយយកចិត្តទុកដាក់បំផុត ផ្ចង់អារម្មណ៍មិនឱ្យមានចន្លោះប្រហោង។",
    blocks: ["ផ", "្ច", "ិ", "ត", "ផ", "្ច", "់", "ង"],
    prefilled: [true, false, false, true, true, false, false, true], // Child enters: ្ច, ិ, ្ច, ់
  },
  {
    id: 4,
    word: "មធ្យោបាយ",
    clue: "វិធី ឬផ្លូវសម្រាប់ដោះស្រាយ ឬធ្វើកិច្ចការអ្វីមួយឱ្យសម្រេចបាន។",
    blocks: ["ម", "ធ", "្យ", "ោ", "ប", "ា", "យ"],
    prefilled: [true, false, false, true, false, true, true], // Child enters: ធ, ្យ, ប
  },
  {
    id: 5,
    word: "ម៉ត់ចត់",
    clue: "ដែលធ្វើយ៉ាងផ្ចិតផ្ចង់ ហ្មត់ហ្មង មិនបណ្តោយឱ្យមានខ្វះខាត ឬភាន់ច្រឡំ។",
    blocks: ["ម", "៉", "់", "ត", "ច", "ត"],
    prefilled: [true, false, false, true, true, true], // Child enters: ៉, ់
  },
  {
    id: 6,
    word: "ទូលំទូលាយ",
    clue: "ដែលមានទីធ្លាធំទូលាយ ស្រឡះ ឬមានចិត្តទូលំទូលាយ យោគយល់ខ្ពស់។",
    blocks: ["ទ", "ូ", "ំ", "ទ", "ូ", "ល", "ា", "យ"],
    prefilled: [true, false, true, true, false, true, false, true], // Child enters: ូ, ូ, ា
  },
  {
    id: 7,
    word: "រំលេច",
    clue: "ធ្វើឱ្យលេចធ្លោឡើង ឱ្យឃើញច្បាស់ក្រឡែត ឬលាយពណ៌ឱ្យស្អាត។",
    blocks: ["រ", "ំ", "ល", "េ", "ច"],
    prefilled: [true, false, false, false, true], // Child enters: ំ, ល, េ
  },
  {
    id: 8,
    word: "សប្តាហ៍",
    clue: "រយៈពេល ៧ ថ្ងៃ ចាប់ពីថ្ងៃចន្ទ ដល់ថ្ងៃអាទិត្យ។",
    blocks: ["ស", "ប", "្ដ", "ា", "ហ", "៍"],
    prefilled: [true, false, false, true, true, false], // Child enters: ប, ្ដ, ៍
  },
  {
    id: 9,
    word: "ណែនាំ",
    clue: "បង្ហាញផ្លូវ ឬប្រាប់ប្រដៅឱ្យស្គាល់ការខុសត្រូវ ល្អអាក្រក់។",
    blocks: ["ណ", "ែ", "ន", "ាំ"],
    prefilled: [true, false, true, false], // Child enters: ែ, ាំ
  },
  {
    id: 10,
    word: "មាតាបិតា",
    clue: "ឪពុក និងម្ដាយ ដែលជាអ្នកបង្កើត ចិញ្ចឹម និងបីបាច់ថែរក្សាកូនៗ។",
    blocks: ["ម", "ា", "ត", "ា", "ប", "ិ", "ត", "ា"],
    prefilled: [true, false, true, false, true, false, true, false], // Child enters: ា, ា, ិ, ា
  }
];

// Offline fallback categories when Gemini isn't accessible
export const FALLBACK_CATEGORIES: { [key: string]: WordPuzzle[] } = {
  "សត្វស្អាតៗ (Animals)": [
    {
      id: 101,
      word: "សត្វខ្លា",
      clue: "សត្វព្រៃធំមួយប្រភេទ ស៊ីសាច់ជាអាហារ ខ្លាំងពូកែ និងមានសង្វារត្រង់ខ្លួន។",
      blocks: ["ស", "ត", "្វ", "ខ", "្ល", "ា"],
      prefilled: [true, false, true, true, false, true],
    },
    {
      id: 102,
      word: "ដំរីធំ",
      clue: "សត្វជើងបួនមាឌធំជាងគេ មានច្រមុះវែងហៅថាប្រមោយ និងមានភ្លុកពីរ។",
      blocks: ["ដ", "ំ", "រ", "ី", "ធ", "ំ"],
      prefilled: [true, false, true, false, true, false],
    },
    {
      id: 103,
      word: "សត្វក្ងោក",
      clue: "បក្សីដែលមានរោមស្អាតគួរឱ្យស្រឡាញ់ ពេលវាពង្រីកកន្ទុយវាមានរូបរាងដូចកង្ហារ។",
      blocks: ["ស", "ត", "្វ", "ក", "្ង", "ោ", "ក"],
      prefilled: [true, true, false, true, false, true, true],
    },
    {
      id: 104,
      word: "ឆ្កែស្មោះត្រង់",
      clue: "សត្វចិញ្ចឹមដែលចូលចិត្តព្រុសយាមផ្ទះ និងស្មោះត្រង់នឹងម្ចាស់បំផុត។",
      blocks: ["ឆ", "្ក", "ែ", "ស", "្ម", "ោ", "ះ", "ត", "្រ", "ង", "់"],
      prefilled: [true, false, true, true, false, true, false, true, false, true, true],
    },
    {
      id: 105,
      word: "សត្វស្វា",
      clue: "សត្វចតុប្បាទចូលចិត្តឡើងដើមឈើ រហ័សរហួន និងចូលចិត្តញ៉ាំផ្លែចេក។",
      blocks: ["ស", "ត", "្វ", "ស", "្វ", "ា"],
      prefilled: [true, false, true, false, true, false],
    }
  ],
  "ផ្លែឈើផ្អែមល្ហែម (Fruits)": [
    {
      id: 201,
      word: "ផ្លែចេក",
      clue: "ផ្លែឈើពណ៌លឿងផ្អែមឆ្ងាញ់ ងាយស្រួលបកសំបក និងសម្បូរវីតាមីន។",
      blocks: ["ផ", "្ល", "ែ", "ច", "េ", "ក"],
      prefilled: [true, false, true, true, false, true],
    },
    {
      id: 202,
      word: "ផ្លែស្វាយ",
      clue: "ផ្លែឈើមានជាតិជូរពេលខ្ចី និងផ្អែមមានក្លិនក្រអូបឈ្ងុយពេលវាទុំ។",
      blocks: ["ផ", "្ល", "ែ", "ស", "្វ", "ា", "យ"],
      prefilled: [true, false, true, true, false, true, true],
    },
    {
      id: 203,
      word: "ផ្លែក្រូច",
      clue: "ផ្លែឈើមានរាងមូល សំបកពណ៌ខៀវឬលឿង មានទឹកច្រើនផ្អែមជូរអែម។",
      blocks: ["ផ", "្ល", "ែ", "ក", "្រ", "ូ", "ច"],
      prefilled: [true, false, true, true, false, true, true],
    },
    {
      id: 204,
      word: "ផ្លែម្នាស់",
      clue: "ផ្លែឈើមានភ្នែកច្រើន សាច់ពណ៌លឿង មានរសជាតិផ្អែមជូរ និងមានស្លឹកស្រួចៗលើក្បាល។",
      blocks: ["ផ", "្ល", "ែ", "ម", "្ន", "ា", "ស", "់"],
      prefilled: [true, false, true, true, false, true, false, true],
    },
    {
      id: 205,
      word: "ផ្លែដូង",
      clue: "ផ្លែឈើមានទឹកផ្អែមត្រជាក់ សាច់ពណ៌សឆ្ងាញ់ មានសំបករឹង និងដុះនៅដើមខ្ពស់ៗ។",
      blocks: ["ផ", "្ល", "ែ", "ដ", "ូ", "ង"],
      prefilled: [true, false, true, true, false, true],
    }
  ],
  "សាលារួសរាយ (School Life)": [
    {
      id: 301,
      word: "សៀវភៅ",
      clue: "វត្ថុសម្រាប់អានឬសរសេរមេរៀន ដែលផ្ទុកនូវចំណេះដឹងគ្រប់បែបយ៉ាង។",
      blocks: ["ស", "ៀ", "វ", "ភ", "ៅ"],
      prefilled: [true, false, true, true, false],
    },
    {
      id: 302,
      word: "ខ្មៅដៃ",
      clue: "ឧបករណ៍សម្រាប់គូសសរសេរមេរៀន ដែលអាចលុបវិញបានយ៉ាងងាយ។",
      blocks: ["ខ", "្ម", "ៅ", "ដ", "ៃ"],
      prefilled: [true, false, true, true, false],
    },
    {
      id: 303,
      word: "គ្រូបង្រៀន",
      clue: "បុគ្គលដែលផ្តល់ចំណេះដឹង ប្រដៅប្រដៅសិស្សានុសិស្សឱ្យក្លាយជាមនុស្សល្អ។",
      blocks: ["គ", "្រ", "ូ", "ប", "ង", "្រ", "ៀ", "ន"],
      prefilled: [true, false, true, true, true, false, true, true],
    },
    {
      id: 304,
      word: "មិត្តភក្តិ",
      clue: "អ្នកដែលរួមរៀន រួមលេងសើច និងស្រឡាញ់រាប់អានគ្នានៅសាលារៀន។",
      blocks: ["ម", "ិ", "ត", "្ដ", "ភ", "ក", "្ដ", "ិ"],
      prefilled: [true, false, true, false, true, true, false, true],
    },
    {
      id: 305,
      word: "សាលារៀន",
      clue: "កន្លែងដែលសិស្សានុសិស្សមករួមគ្នាដើម្បីក្រេបជញ្ជក់ចំណេះវិជ្ជា និងសីលធម៌។",
      blocks: ["ស", "ា", "ល", "ា", "រ", "ៀ", "ន"],
      prefilled: [true, false, true, true, true, false, true],
    }
  ]
};

// Help helper to extract all letters required to formulate selection pool
export function generateLetterPool(challenge: WordPuzzle, poolSize = 10): string[] {
  // Collect target missing letters
  const missing = challenge.blocks.filter((_, i) => !challenge.prefilled[i]);
  
  // Useful typical Khmer letters to mix in
  const alphabetMix = [
    "ក", "ខ", "គ", "ឃ", "ង", "ច", "ឆ", "ជ", "ឈ", "ញ",
    "ដ", "ឋ", "ឌ", "ឍ", "ណ", "ត", "ថ", "ទ", "ធ", "ន",
    "ប", "ផ", "ព", "ភ", "ម", "យ", "រ", "ល", "វ", "ស", "ហ", "ឡ", "អ",
    "ា", "ិ", "ី", "ឹ", "ឺ", "ុ", "ូ", "ួ", "ើ", "ឿ", "ៀ", "េ", "ែ", "ៃ", "ោ", "ៅ", "ុំ", "ំ", "ះ",
    "្ម", "្រ", "្យ", "្វ", "្ល", "្ដ", "្ត", "្ច", "្ញ", "្ធ"
  ];
  
  const poolSet = new Set<string>(missing);
  
  // Fill the bank with matching alphabet
  let safetyCount = 0;
  while (poolSet.size < poolSize && safetyCount < 100) {
    const randomChar = alphabetMix[Math.floor(Math.random() * alphabetMix.length)];
    if (!challenge.blocks.includes(randomChar)) {
      poolSet.add(randomChar);
    }
    safetyCount++;
  }
  
  // Convert to array and shuffle
  return Array.from(poolSet).sort(() => Math.random() - 0.5);
}
