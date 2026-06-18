/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { flushSync } from "react-dom";
import * as XLSX from "xlsx";
import { 
  PRESET_CHALLENGES, 
  FALLBACK_CATEGORIES, 
  generateLetterPool 
} from "./data";
import { WordPuzzle } from "./types";
import { 
  playClickSound, 
  playSuccessSound, 
  playErrorSound, 
  playCompleteSound,
  playTickSound
} from "./audio";
import { 
  Download, 
  Upload,
  RotateCcw, 
  Check, 
  HelpCircle, 
  Music, 
  Music2, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Printer, 
  Settings,
  Dice5,
  UserPlus,
  UserMinus,
  Trash2,
  Trophy,
  Award, 
  BookOpen, 
  BookOpenCheck,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  List,
  PlusCircle,
  Maximize2,
  Minimize2,
  Play,
  Home,
  ArrowLeft,
  Plus,
  Shuffle,
  Search,
  X,
  CheckSquare,
  Eye,
  ArrowRight,
  Clock,
  Scissors,
  Timer,
  Pause,
  Users,
  Maximize,
  Minimize,
  MonitorSmartphone,
  ArrowUpDown
} from "lucide-react";

// Helper function to split a Khmer word into linguistic graphemes (syllables/letters)
function splitKhmerWord(word: string): string[] {
  const blocks: string[] = [];
  const trimmed = word.trim();
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    // If it's a Khmer subscript sign character, combine with the next consonant
    if (char === "្" && i + 1 < trimmed.length) {
      blocks.push(char + trimmed[i + 1]);
      i++;
    } else if (char === "ា" && i + 1 < trimmed.length && trimmed[i + 1] === "ំ") {
      blocks.push("ាំ");
      i++;
    } else if (char === "ំ" && i + 1 < trimmed.length && trimmed[i + 1] === "ា") {
      blocks.push("ាំ");
      i++;
    } else {
      blocks.push(char);
    }
  }
  return blocks;
}

// Helper to retrieve a Khmer number representing an index/number
function getKhmerNumber(num: number): string {
  const khmerDigits = ["០", "១", "២", "៣", "៤", "៥", "៦", "៧", "៨", "៩"];
  return num.toString().split('').map(digit => khmerDigits[parseInt(digit)] || digit).join('');
}

// Shuffle helper array
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Prefilled rules:
// - Easy: Show 50% of the letters (at least 1 for length 1-2, 2 for length 3-4, 3 for length 5+, etc.)
// - Hard: Show exactly 1 prefilled character if word blocks size >= 4, placed randomly
// - Expert/Extreme: No prefilled letters at all (0 letters shown)
function applyPrefilledRule(c: WordPuzzle, difficulty: "easy" | "hard" | "expert" = "easy"): WordPuzzle {
  const blocks = c.blocks;
  let prefilled: boolean[];
  if (difficulty === "easy") {
    const revealCount = Math.max(1, Math.floor(blocks.length / 2));
    const prefilledIndices = new Set<number>();
    while (prefilledIndices.size < revealCount) {
      prefilledIndices.add(Math.floor(Math.random() * blocks.length));
    }
    prefilled = blocks.map((_, idx) => prefilledIndices.has(idx));
  } else if (difficulty === "hard") {
    if (blocks.length < 4) {
      prefilled = blocks.map(() => false);
    } else {
      const prefilledIndex = Math.floor(Math.random() * blocks.length);
      prefilled = blocks.map((_, idx) => idx === prefilledIndex);
    }
  } else {
    prefilled = blocks.map(() => false);
  }
  return {
    ...c,
    prefilled,
    category: c.category || "ពាក្យអក្ខរាវិរុទ្ធខ្មែរ"
  };
}

// Deterministic Pool Generator for each puzzle in print layout
function getDeterministicPool(challenge: WordPuzzle, poolSize = 12): string[] {
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
  
  // Fill the bank with matching alphabet, deterministically seeded with challenge ID
  let index = challenge.id;
  while (poolSet.size < poolSize) {
    const charIndex = (index * 17 + poolSet.size * 31) % alphabetMix.length;
    const randomChar = alphabetMix[charIndex];
    if (!challenge.blocks.includes(randomChar)) {
      poolSet.add(randomChar);
    }
    index++;
  }
  
  // Shuffle deterministically based on challenge ID
  const poolArray = Array.from(poolSet);
  const shuffled: string[] = [];
  const temp = [...poolArray];
  let shuffleIndex = challenge.id * 13;
  while (temp.length > 0) {
    const pick = shuffleIndex % temp.length;
    shuffled.push(temp.splice(pick, 1)[0]);
    shuffleIndex += 7;
  }
  return shuffled;
}

// Word Search generator helper for Khmer language blocks
function generateWordSearch(wordList: string[], gridSize = 12) {
  const grid: string[][] = Array(gridSize).fill(null).map(() => Array(gridSize).fill(""));
  const placements: { [word: string]: { r: number, c: number }[] } = {};

  // Sort words by length descending to place larger words first
  const sortedWords = [...wordList]
    .map(w => w.trim())
    .filter(w => w.length > 0)
    .sort((a, b) => {
      const splitA = splitKhmerWord(a);
      const splitB = splitKhmerWord(b);
      return splitB.length - splitA.length;
    });

  // Directions: Horizontal (0, 1), Vertical (1, 0), Diagonal Down-Right (1, 1), Diagonal Up-Right (-1, 1)
  const directions = [
    { dr: 0, dc: 1 },  // Right
    { dr: 1, dc: 0 },  // Down
    { dr: 1, dc: 1 },  // Down-Right
    { dr: -1, dc: 1 }  // Up-Right
  ];

  const placedWordsList: string[] = [];

  for (const word of sortedWords) {
    const blocks = splitKhmerWord(word);
    const len = blocks.length;
    if (len > gridSize) continue; // Skip if too long for the board

    let placed = false;
    for (let attempts = 0; attempts < 150; attempts++) {
      const dirIndex = Math.floor(Math.random() * directions.length);
      const { dr, dc } = directions[dirIndex];

      let startR = 0;
      let startC = 0;

      if (dr === 0) {
        startR = Math.floor(Math.random() * gridSize);
        startC = Math.floor(Math.random() * (gridSize - len + 1));
      } else if (dr === 1) {
        if (dc === 0) {
          startR = Math.floor(Math.random() * (gridSize - len + 1));
          startC = Math.floor(Math.random() * gridSize);
        } else { // dc === 1
          startR = Math.floor(Math.random() * (gridSize - len + 1));
          startC = Math.floor(Math.random() * (gridSize - len + 1));
        }
      } else if (dr === -1) { // dc === 1
        startR = Math.floor(Math.random() * (gridSize - len)) + len - 1;
        startC = Math.floor(Math.random() * (gridSize - len + 1));
      }

      let fits = true;
      const coords: { r: number, c: number }[] = [];
      for (let i = 0; i < len; i++) {
        const r = startR + i * dr;
        const c = startC + i * dc;
        if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) {
          fits = false;
          break;
        }
        const existing = grid[r][c];
        if (existing !== "" && existing !== blocks[i]) {
          fits = false;
          break;
        }
        coords.push({ r, c });
      }

      if (fits) {
        for (let i = 0; i < len; i++) {
          grid[coords[i].r][coords[i].c] = blocks[i];
        }
        placements[word] = coords;
        placedWordsList.push(word);
        placed = true;
        break;
      }
    }
  }

  // Khmer alphabet blocks for filling background empty cells beautifully
  const fillerPool = [
    "ក", "ខ", "គ", "ឃ", "ង", "ច", "ឆ", "ជ", "ឈ", "ញ",
    "ដ", "ឋ", "ឌ", "ឍ", "ណ", "ត", "ថ", "ទ", "ធ", "ន",
    "ប", "ផ", "ព", "ភ", "ម", "យ", "រ", "ល", "វ", "ស", "ហ", "ឡ", "អ",
    "ា", "ិ", "ី", "ឹ", "ឺ", "ុ", "ូ", "ួ", "ើ", "ឿ", "ៀ", "េ", "ែ", "ៃ", "ោ", "ៅ", "ុំ", "ំ", "ះ", "់"
  ];

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (grid[r][c] === "") {
        const useWordBlock = Math.random() < 0.25 && sortedWords.length > 0;
        if (useWordBlock) {
          const randWord = sortedWords[Math.floor(Math.random() * sortedWords.length)];
          const randBlocks = splitKhmerWord(randWord);
          grid[r][c] = randBlocks[Math.floor(Math.random() * randBlocks.length)] || "ក";
        } else {
          grid[r][c] = fillerPool[Math.floor(Math.random() * fillerPool.length)];
        }
      }
    }
  }

  return {
    grid,
    placements,
    placedWords: placedWordsList
  };
}

const PASTEL_COLORS = [
  "bg-red-100 text-red-900 border-red-200",
  "bg-orange-100 text-orange-900 border-orange-200",
  "bg-amber-100 text-amber-900 border-amber-200",
  "bg-green-100 text-green-900 border-green-200",
  "bg-emerald-100 text-emerald-900 border-emerald-200",
  "bg-cyan-100 text-cyan-900 border-cyan-200",
  "bg-blue-100 text-blue-900 border-blue-200",
  "bg-indigo-100 text-indigo-900 border-indigo-200",
  "bg-violet-100 text-violet-900 border-violet-200",
  "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200",
  "bg-pink-100 text-pink-900 border-pink-200",
  "bg-rose-100 text-rose-900 border-rose-200",
];

const toKhmerNumeral = (n: number | string): string => {
  const khmerDigits = ["០", "១", "២", "៣", "៤", "៥", "៦", "៧", "៨", "៩"];
  return n.toString().split("").map(digit => khmerDigits[parseInt(digit)] || digit).join("");
};

const formatTimeHHMMSS = (totalSeconds: number): string => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

import { BUILT_IN_FRAMES } from "./frames";

export default function App() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const promptInstall = async () => {
    playClickSound(soundEnabled);
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  // Config state
  const [challenges, setChallenges] = useState<WordPuzzle[]>(() => {
    return shuffleArray(PRESET_CHALLENGES).map(c => applyPrefilledRule(c, "easy"));
  });

  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [completedIds, setCompletedIds] = useState<number[]>([]);

  // Game difficulty state: "easy" (ងាយ), "hard" (ពិបាក), "expert" (ពិបាកខ្លាំង)
  const [gameDifficulty, setGameDifficulty] = useState<"easy" | "hard" | "expert">("easy");

  const handleDifficultyChange = (diff: "easy" | "hard" | "expert") => {
    setGameDifficulty(diff);
    setChallenges(prev => prev.map(c => applyPrefilledRule(c, diff)));
  };

  // Word category/group states
  const [selectedCategory, setSelectedCategory] = useState<string>("ពាក្យអក្ខរាវិរុទ្ធខ្មែរ");
  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState<boolean>(false);
  const [customCategoryInput, setCustomCategoryInput] = useState<string>("");
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string>("ទាំងអស់");
  
  // Navigation / screen routing states
  const [isGameStarted, setIsGameStarted] = useState<boolean>(false);
  
  // Game interaction states
  const filteredChallenges = selectedFilterCategory === "ទាំងអស់"
    ? challenges
    : challenges.filter(c => (c.category || "ពាក្យអក្ខរាវិរុទ្ធខ្មែរ") === selectedFilterCategory);

  const challenge = filteredChallenges[currentIdx] || filteredChallenges[0] || PRESET_CHALLENGES[0];

  // Reset index when category filter changes
  useEffect(() => {
    setCurrentIdx(0);
  }, [selectedFilterCategory]);
  const [userInput, setUserInput] = useState<string[]>([]);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [letterPool, setLetterPool] = useState<string[]>([]);
  
  // Audio state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  
  // Feedback states
  const [isShake, setIsShake] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [incorrectAttempts, setIncorrectAttempts] = useState<number>(0);
  
  // AI level creator states
  const [aiMenuOpen, setAiMenuOpen] = useState<boolean>(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState<boolean>(false);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (settingsMenuOpen && !target.closest("#settings-dropdown") && !target.closest("#settings-btn")) {
        setSettingsMenuOpen(false);
      }
      if (aiMenuOpen && !target.closest("#ai-menu") && !target.closest("#ai-btn")) {
        setAiMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [settingsMenuOpen, aiMenuOpen]);
  const [customCategory, setCustomCategory] = useState<string>("");
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("presets"); // "presets" | "ai"

  // Print worksheet states
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [studentName, setStudentName] = useState<string>("");
  const [printTrigger, setPrintTrigger] = useState<number>(0);
  const [wordSearchPrintPages, setWordSearchPrintPages] = useState<number>(1);
  const [wordSearchPrintGrids, setWordSearchPrintGrids] = useState<{grid: string[][], placements: Record<string, {r:number, c:number}[]>, placedWords?: string[]}[]>([]);
  
  // Certificate states
  const [certificateName, setCertificateName] = useState<string>("អាទិត្យ វីរៈ");
  const [showCertificate, setShowCertificate] = useState<boolean>(false);

  // Browser Fullscreen State
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  
  // Timer State
  const [isTimerOpen, setIsTimerOpen] = useState<boolean>(false);
  const [isTimerActive, setIsTimerActive] = useState<boolean>(false);
  const [timerCountUp, setTimerCountUp] = useState<boolean>(false);
  const [timerSeconds, setTimerSeconds] = useState<number>(300); // Default 5 mins (300s)
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [timerMaxSeconds, setTimerMaxSeconds] = useState<number>(300); // For resetting and progress bar
  const [timerInputStr, setTimerInputStr] = useState<string>("00:05:00");

  const timerSecondsRef = useRef(timerSeconds);
  useEffect(() => {
    timerSecondsRef.current = timerSeconds;
  }, [timerSeconds]);

  // Timer Effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerRunning) {
      if (timerCountUp) {
        const startTime = Date.now() - (timerSecondsRef.current * 1000);
        interval = setInterval(() => {
          const elapsed = (Date.now() - startTime) / 1000;
          setTimerSeconds(elapsed);
        }, 10);
      } else {
        const startTime = Date.now() + (timerSecondsRef.current * 1000);
        interval = setInterval(() => {
          const remaining = Math.max(0, (startTime - Date.now()) / 1000);
          setTimerSeconds(remaining);
          if (remaining <= 0) {
            setTimerRunning(false);
            playCompleteSound(soundEnabled);
          }
        }, 100);
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning, timerCountUp, soundEnabled]);
  
  // Lucky Box State
  const [isLuckyBoxOpen, setIsLuckyBoxOpen] = useState<boolean>(false);
  const [isLuckyBoxListOpen, setIsLuckyBoxListOpen] = useState<boolean>(false);
  const [isLuckyBoxSettingsOpen, setIsLuckyBoxSettingsOpen] = useState<boolean>(false);
  const [wheelFontSize, setWheelFontSize] = useState<number>(40);
  const [studentInput, setStudentInput] = useState<string>("");
  const [studentList, setStudentList] = useState<string[]>([
    "ឌិត ប៊ុនណាប", "ជឿន ចាន់ណា", "ទូច រ៉ូហ្សាល់", "ជុំ រតនា", 
    "រុណ ស្រីរ័ត្ន", "លឹម សុវណ្ណារ៉ា", "ស៊ុន ម៉ាឡា", "វី ណាវីន", 
    "តែ ឈិន", "យ៉ែម ឈុន", "លេ សុឃីម", "អាន ណារ័ត្ន", 
    "ពិសិដ្ឋ ពិសាណ", "ហាក់ វុទ្ធី", "ហាក់ ប៊ុនធី", "អ៊ិន ខេម", 
    "ហេង ធារ៉ា", "សូល ស្រីណាង", "ទូច ដានី", "ជ័យ ស្រីលក្ខណ៍"
  ]);

  const loadReadingPreset = () => {
    const readingWords = ["សាលារៀន", "គ្រូបង្គោល", "សិស្សពូកែ", "មិត្តភក្តិ", "ចំណេះដឹង", "សៀវភៅ", "ប៊ិច", "ខ្មៅដៃ", "ក្តារខៀន", "កៅអី", "តុ", "បង្អួច", "ទ្វារ", "សួនច្បារ", "វិទ្យាសាស្ត្រ", "គណិតវិទ្យា"];
    setStudentInput(readingWords.join("\n"));
  };
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [winningStudent, setWinningStudent] = useState<string | null>(null);

  // Team Generator State
  const [isTeamGenOpen, setIsTeamGenOpen] = useState<boolean>(false);
  const [isTeamGenEditOpen, setIsTeamGenEditOpen] = useState<boolean>(false);
  const [teamCount, setTeamCount] = useState<number>(2);
  const [generatedTeams, setGeneratedTeams] = useState<string[][]>([]);

  // Slot Machine State
  const [isSlotMachineOpen, setIsSlotMachineOpen] = useState<boolean>(false);
  const [slotMachineSpinning, setSlotMachineSpinning] = useState<boolean>(false);
  const [slotMachineWord, setSlotMachineWord] = useState<string>("");
  const [slotMachineWinner, setSlotMachineWinner] = useState<string | null>(null);

  const startSlotMachine = () => {
    if (studentList.length === 0) return;
    setSlotMachineWinner(null);
    setSlotMachineSpinning(true);
    let counter = 0;
    const maxTblTicks = 35 + Math.floor(Math.random() * 20); // 35 to 55 ticks
    let currentSpeed = 50;
    
    const tick = () => {
       setSlotMachineWord(studentList[Math.floor(Math.random() * studentList.length)]);
       counter++;
       
       if (counter < 20) {
           currentSpeed = 40;
       } else if (counter < 35) {
           currentSpeed += 15;
       } else if (counter < maxTblTicks) {
           currentSpeed += 30;
       }
       
       if (counter >= maxTblTicks) {
            const winner = studentList[Math.floor(Math.random() * studentList.length)];
            setSlotMachineWinner(winner);
            setSlotMachineWord(winner);
            setSlotMachineSpinning(false);
            playSuccessSound(soundEnabled);
       } else {
            if (soundEnabled && counter % 2 === 0) playTickSound(); 
            setTimeout(tick, currentSpeed);
       }
    };
    
    tick();
  };

  const applyTeamGenEdit = () => {
    const names = studentInput.split("\n").map(n => n.trim()).filter(n => n !== "");
    setStudentList(names);
    setIsTeamGenEditOpen(false);
    // currentAngleRef.current = 0; might be needed if they go back to Lucky Box
    if (names.length > 0) {
      setTimeout(() => { if (typeof drawWheel === "function") drawWheel(); }, 50);
    }
  };

  const handleStudentImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });
        
        const extractedNames: string[] = [];
        data.forEach(row => {
          if (row && row.length > 0) {
            const val = String(row[0] || "").trim();
            if (val && !val.includes("ឈ្មោះ") && !val.toLowerCase().includes("name")) {
              extractedNames.push(val);
            }
          }
        });
        
        if (extractedNames.length > 0) {
          setStudentInput(prev => {
            const existing = prev.trim() ? prev.trim() + "\n" : "";
            return existing + extractedNames.join("\n");
          });
          playSuccessSound(soundEnabled);
        }
      } catch (err) {
        console.error("Error reading file:", err);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };

  const generateTeams = () => {
    if (studentList.length === 0) return;
    playClickSound(soundEnabled);
    const shuffled = [...studentList].sort(() => Math.random() - 0.5);
    const teams: string[][] = Array.from({ length: teamCount }, () => []);
    shuffled.forEach((student, index) => {
      teams[index % teamCount].push(student);
    });
    setGeneratedTeams(teams);
    setTimeout(() => playSuccessSound(soundEnabled), 300);
  };

  // Word Card states
  const [wordCards, setWordCards] = useState<Array<{ id: number; title: string; word: string; color: string; category?: string }>>([
    { id: 1, title: "អំណាន ៖ រឿង បងប្អូនពីរនាក់", word: "ច្រណែន", color: "#f97316" },
    { id: 2, title: "អំណាន ៖ រឿង បងប្អូនពីរនាក់", word: "សប្បាយ", color: "#eab308" },
    { id: 3, title: "អំណាន ៖ រឿង បងប្អូនពីរនាក់", word: "សាមគ្គី", color: "#10b981" }
  ]);
  const [wordCardCategoryFilter, setWordCardCategoryFilter] = useState<string>("All");
  const [wordCardBorder, setWordCardBorder] = useState<"classic" | "simple" | "custom">("classic");
  const [wordCardCustomFrame, setWordCardCustomFrame] = useState<string | null>(BUILT_IN_FRAMES[0].dataUrl);
  const [wordCardBorderWidth, setWordCardBorderWidth] = useState<number>(8);
  const [wordCardBorderRadius, setWordCardBorderRadius] = useState<number>(16);
  const [wordCardThemeMode, setWordCardThemeMode] = useState<"color" | "bw" | "single">("color");
  const [wordCardSingleColor, setWordCardSingleColor] = useState<string>("#f97316");
  const [wordCardFontFamily, setWordCardFontFamily] = useState<string>("'Khmer OS Muol Light', Moul, serif");
  const [wordCardTitleAlign, setWordCardTitleAlign] = useState<"left" | "center" | "right">("left");
  const [wordCardTextSize, setWordCardTextSize] = useState<number>(72);
  const [cardCreatorNewWord, setCardCreatorNewWord] = useState<string>("");

  // Multiple Choice States
  const [mcQuestions, setMcQuestions] = useState<{ id: number, question: string, options: string[], correctOption: string, topic?: string }[]>(() => {
    const saved = localStorage.getItem("kidskhmer_mc_questions");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved MCQ", e);
      }
    }
    return [
      {
        id: 1,
        question: "តើប្រាសាទអង្គរវត្តស្ថិតនៅខេត្តណា?",
        options: ["ស្វាយរៀង", "សៀមរាប", "បាត់ដំបង", "ភ្នំពេញ"],
        correctOption: "សៀមរាប",
        topic: "ទូទៅ"
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem("kidskhmer_mc_questions", JSON.stringify(mcQuestions));
  }, [mcQuestions]);

  const [currentMcIdx, setCurrentMcIdx] = useState<number>(0);
  const [isMcModalOpen, setIsMcModalOpen] = useState<boolean>(false);
  const [isMcFormModalOpen, setIsMcFormModalOpen] = useState<boolean>(false);
  const [editingMcId, setEditingMcId] = useState<number | null>(null);
  const [mcToDelete, setMcToDelete] = useState<number | null>(null);
  const [newMcTopic, setNewMcTopic] = useState<string>("ទូទៅ");
  const [newMcQuestion, setNewMcQuestion] = useState<string>("");
  const [newMcOptions, setNewMcOptions] = useState<string[]>(["", "", "", ""]);
  const [newMcCorrectOption, setNewMcCorrectOption] = useState<number>(0);
  const [mcSelectedAnswer, setMcSelectedAnswer] = useState<string | null>(null);
  const [mcIsCorrect, setMcIsCorrect] = useState<boolean | null>(null);
  const [mcShowAnswer, setMcShowAnswer] = useState<boolean>(false);
  const [mcCountdown, setMcCountdown] = useState<number | null>(null);
  const [mcCountdownSetting, setMcCountdownSetting] = useState<number>(() => {
    const saved = localStorage.getItem("kidskhmer_mc_countdown_setting");
    return saved ? parseInt(saved, 10) : 10;
  });
  
  useEffect(() => {
    localStorage.setItem("kidskhmer_mc_countdown_setting", mcCountdownSetting.toString());
  }, [mcCountdownSetting]);

  const [mcQuestionCountdown, setMcQuestionCountdown] = useState<number>(mcCountdownSetting);
  const [mcQuestionStarted, setMcQuestionStarted] = useState<boolean>(false);
  const [selectedMcTopic, setSelectedMcTopic] = useState<string | null>(null);
  
  const uniqueMcTopics = Array.from(new Set(mcQuestions.map(q => q.topic || "ទូទៅ"))).sort();
  const filteredMcQuestions = mcQuestions.filter(q => selectedMcTopic ? (q.topic || "ទូទៅ") === selectedMcTopic : true);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const currentAngleRef = useRef<number>(0);
  const spinVelocityRef = useRef<number>(0);

  // Color Palette for the wheel
  const colorPalette = [
    "#54c8a7", "#8794db", "#9b6bcb", "#f18e56", "#6eb972", 
    "#58b8f2", "#dfdb4a", "#f56565", "#43b5a0", "#fbb6ce", 
    "#4299e1", "#ed8936", "#48bb78", "#ed64a6", "#ecc94b", "#38b2ac"
  ];

  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const center = width / 2;
    const radius = center - 10;
    
    ctx.clearRect(0, 0, width, height);
    
    if (studentList.length === 0) {
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, 2 * Math.PI);
      ctx.fillStyle = "#f1f5f9";
      ctx.fill();
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 5;
      ctx.stroke();
      return;
    }

    const sliceAngle = (2 * Math.PI) / studentList.length;

    // Draw background outer ring
    ctx.beginPath();
    ctx.arc(center, center, radius + 5, 0, 2 * Math.PI);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 10;
    ctx.stroke();

    studentList.forEach((name, i) => {
      const startAngle = currentAngleRef.current + i * sliceAngle;
      const endAngle = startAngle + sliceAngle;

      // Draw Slice
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startAngle, endAngle);
      ctx.closePath();
      
      ctx.fillStyle = colorPalette[i % colorPalette.length];
      ctx.fill();
      
      // Slice Border
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();

      // Draw Text
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(startAngle + sliceAngle / 2);
      
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      
      const fontSize = wheelFontSize;
      ctx.font = `bold ${fontSize}px 'Battambang', 'Khmer OS Battambang', sans-serif`;
      
      ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
      ctx.shadowBlur = 4;
      
      // Position text near the edge
      const displayName = name.length > 15 ? name.substring(0, 13) + ".." : name;
      ctx.fillText(displayName, radius - 35, 0);
      
      ctx.restore();
    });
  }, [studentList]);

  const animateSpin = useCallback(() => {
    if (spinVelocityRef.current > 0.001) {
      currentAngleRef.current += spinVelocityRef.current;
      // Friction
      spinVelocityRef.current *= 0.992;
      drawWheel();
      animationFrameRef.current = requestAnimationFrame(animateSpin);
    } else {
      setIsSpinning(false);
      spinVelocityRef.current = 0;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      
      // Determine winner
      let normalizedAngle = currentAngleRef.current % (2 * Math.PI);
      if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI;

      const sliceAngle = (2 * Math.PI) / studentList.length;
      let winningAngle = (Math.PI * 1.5) - normalizedAngle;
      if (winningAngle < 0) winningAngle += 2 * Math.PI;

      const winningIndex = Math.floor(winningAngle / sliceAngle);
      setWinningStudent(studentList[winningIndex]);
    }
  }, [studentList, drawWheel]);

  const startSpin = () => {
    if (isSpinning || studentList.length === 0) return;
    setIsSpinning(true);
    setWinningStudent(null);
    playClickSound(soundEnabled);
    spinVelocityRef.current = Math.random() * 0.2 + 0.45;
    animateSpin();
  };

  useEffect(() => {
    if (isLuckyBoxOpen) {
      setTimeout(drawWheel, 100);
      if (!isLuckyBoxSettingsOpen) {
        setStudentInput(studentList.join("\n"));
      }
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isLuckyBoxOpen, drawWheel, isLuckyBoxSettingsOpen, studentList]);

  // Update list from textarea
  const updateStudentList = () => {
    const names = studentInput.split("\n").map(n => n.trim()).filter(n => n !== "");
    if (names.length > 0) {
      setStudentList(names);
      currentAngleRef.current = 0;
      setIsLuckyBoxSettingsOpen(false);
      setTimeout(drawWheel, 50);
    }
  };

  const removeSlotMachineWinner = () => {
    if (slotMachineWinner) {
      const newList = studentList.filter(s => s !== slotMachineWinner);
      setStudentList(newList);
      setStudentInput(newList.join("\n"));
      setSlotMachineWinner(null);
      setSlotMachineWord("");
      playClickSound(soundEnabled);
    }
  };

  const removeWinningStudent = () => {
    if (winningStudent) {
      const newList = studentList.filter(s => s !== winningStudent);
      setStudentList(newList);
      setStudentInput(newList.join("\n"));
      setWinningStudent(null);
      playClickSound(soundEnabled);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, []);

  // Track first interaction to trigger fullscreen (Browsers require user gesture)
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (!document.fullscreenElement) {
        requestFullscreenSafely();
      }
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
    };

    window.addEventListener("click", handleFirstInteraction);
    window.addEventListener("touchstart", handleFirstInteraction);

    return () => {
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
    };
  }, []);

  // Immersive focus mode state
  const [isImmersive, setIsImmersive] = useState<boolean>(true);

  // Custom word builder states
  const [newWord, setNewWord] = useState<string>("");
  const [newClue, setNewClue] = useState<string>("");
  const [newWordBlocks, setNewWordBlocks] = useState<string[]>([]);
  const [newWordPrefilled, setNewWordPrefilled] = useState<boolean[]>([]);
  const [wordError, setWordError] = useState<string | null>(null);
  const [isAddWordModalOpen, setIsAddWordModalOpen] = useState<boolean>(false);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState<boolean>(false);
  const [isWordViewerOpen, setIsWordViewerOpen] = useState<boolean>(false);
  const [viewerSearchQuery, setViewerSearchQuery] = useState<string>("");
  const [viewerCategoryFilter, setViewerCategoryFilter] = useState<string>("ទាំងអស់");

  // Excel/CSV Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importedPuzzles, setImportedPuzzles] = useState<WordPuzzle[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMethod, setImportMethod] = useState<'append' | 'replace'>('append');

  // Word Search states
  const [activeGameMode, setActiveGameMode] = useState<"home" | "spelling" | "wordsearch" | "wordcard" | "multiplechoice">("home");
  const [wordSearchGrid, setWordSearchGrid] = useState<string[][]>([]);
  const [wordSearchPlacements, setWordSearchPlacements] = useState<{ [word: string]: { r: number, c: number }[] }>({});
  const [wordSearchList, setWordSearchList] = useState<string[]>([]);
  const [wordSearchFoundList, setWordSearchFoundList] = useState<string[]>([]);
  const [wordSearchSelectedCoords, setWordSearchSelectedCoords] = useState<{ r: number, c: number }[]>([]);
  const [isDraggingWordSearch, setIsDraggingWordSearch] = useState<boolean>(false);
  const [startCell, setStartCell] = useState<{ r: number, c: number } | null>(null);
  const [foundWordPlacements, setFoundWordPlacements] = useState<{ word: string, colorClass: string, coords: { r: number, c: number }[] }[]>([]);

  // Automatically generate/regenerate Word Search on category change or challenges load
  useEffect(() => {
    if (filteredChallenges.length > 0) {
      const words = filteredChallenges.map(c => c.word).slice(0, 10);
      const generated = generateWordSearch(words, 12);
      setWordSearchGrid(generated.grid);
      setWordSearchPlacements(generated.placements);
      setWordSearchList(generated.placedWords);
      setWordSearchFoundList([]);
      setFoundWordPlacements([]);
      setWordSearchSelectedCoords([]);
      setStartCell(null);
      setIsDraggingWordSearch(false);
    }
  }, [selectedFilterCategory, challenges]);

  // Multiple Choice setup
  useEffect(() => {
    if (activeGameMode !== "multiplechoice") return;
    setMcSelectedAnswer(null);
    setMcIsCorrect(null);
    setMcShowAnswer(false);
    setMcCountdown(null);
    setMcQuestionCountdown(mcCountdownSetting);
    setIsCorrect(false);
    setMcQuestionStarted(false);
  }, [currentMcIdx, activeGameMode, mcQuestions, mcCountdownSetting]);

  // Multiple Choice Question 10s Auto Countdown
  useEffect(() => {
    if (activeGameMode !== "multiplechoice") return;
    if (!mcQuestionStarted) return;
    if (mcQuestionCountdown <= 0 || mcSelectedAnswer !== null || mcShowAnswer || mcCountdown !== null) return;
    
    if (mcQuestionCountdown > 0) {
      playTickSound(soundEnabled);
    }
    
    const timer = setTimeout(() => {
      setMcQuestionCountdown(prev => prev - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [mcQuestionCountdown, activeGameMode, mcSelectedAnswer, mcShowAnswer, mcCountdown, soundEnabled, mcQuestionStarted]);

  useEffect(() => {
    if (mcQuestionCountdown === 0 && mcSelectedAnswer === null && !mcShowAnswer) {
      setMcShowAnswer(true);
      playErrorSound(soundEnabled);
    }
  }, [mcQuestionCountdown, mcSelectedAnswer, mcShowAnswer, soundEnabled]);

  // Multiple Choice Show Answer Countdown
  useEffect(() => {
    if (mcCountdown === null) return;
    
    if (mcCountdown >= 0) {
      if (mcCountdown === 0) {
        playCompleteSound(soundEnabled);
      } else {
        playTickSound(soundEnabled);
      }
    }
    
    if (mcCountdown < 0) {
      setMcShowAnswer(true);
      setMcCountdown(null);
      return;
    }
    
    const timer = setTimeout(() => {
      setMcCountdown(prev => prev !== null ? prev - 1 : null);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [mcCountdown, soundEnabled]);

  // Handle cell selection and connection checks (supporting both Drag-and-Select and Tap-A-then-Tap-B)
  const handleCellMouseDown = (r: number, c: number) => {
    playClickSound(soundEnabled);
    if (!startCell) {
      setStartCell({ r, c });
      setWordSearchSelectedCoords([{ r, c }]);
    } else {
      // Tap-A-then-Tap-B: if clicked cell is in a straight line with startCell, trace path
      const deltaR = r - startCell.r;
      const deltaC = c - startCell.c;
      const isLine = deltaR === 0 || deltaC === 0 || Math.abs(deltaR) === Math.abs(deltaC);
      
      if (isLine) {
        const steps = Math.max(Math.abs(deltaR), Math.abs(deltaC));
        const dr = steps === 0 ? 0 : Math.round(deltaR / steps);
        const dc = steps === 0 ? 0 : Math.round(deltaC / steps);
        
        const newCoords = [];
        for (let i = 0; i <= steps; i++) {
          newCoords.push({ r: startCell.r + i * dr, c: startCell.c + i * dc });
        }
        
        const wordAttempt = newCoords.map(coord => wordSearchGrid[coord.r][coord.c]).join("");
        const wordAttemptRev = [...newCoords].reverse().map(coord => wordSearchGrid[coord.r][coord.c]).join("");
        
        const matchedWord = wordSearchList.find(w => (w === wordAttempt || w === wordAttemptRev) && !wordSearchFoundList.includes(w));
        
        if (matchedWord) {
          const colorClass = PASTEL_COLORS[wordSearchList.indexOf(matchedWord) % PASTEL_COLORS.length];
          setFoundWordPlacements(prev => [...prev, { word: matchedWord, colorClass, coords: newCoords }]);
          const updatedFoundList = [...wordSearchFoundList, matchedWord];
          setWordSearchFoundList(updatedFoundList);
          playSuccessSound(soundEnabled);
          
          if (updatedFoundList.length === wordSearchList.length) {
            playCompleteSound(soundEnabled);
          }
        } else {
          // If not matched, reset startCell to the current cell
          setStartCell({ r, c });
          setWordSearchSelectedCoords([{ r, c }]);
          return;
        }
        
        setWordSearchSelectedCoords([]);
        setStartCell(null);
      } else {
        setStartCell({ r, c });
        setWordSearchSelectedCoords([{ r, c }]);
      }
    }
    
    setIsDraggingWordSearch(true);
  };

  const handleCellMouseEnter = (r: number, c: number) => {
    if (isDraggingWordSearch && startCell) {
      const deltaR = r - startCell.r;
      const deltaC = c - startCell.c;
      const isLine = deltaR === 0 || deltaC === 0 || Math.abs(deltaR) === Math.abs(deltaC);
      
      if (isLine) {
        const steps = Math.max(Math.abs(deltaR), Math.abs(deltaC));
        const dr = steps === 0 ? 0 : Math.round(deltaR / steps);
        const dc = steps === 0 ? 0 : Math.round(deltaC / steps);
        
        const newCoords = [];
        for (let i = 0; i <= steps; i++) {
          newCoords.push({ r: startCell.r + i * dr, c: startCell.c + i * dc });
        }
        setWordSearchSelectedCoords(newCoords);
      }
    }
  };

  const handleGlobalMouseUp = () => {
    if (isDraggingWordSearch && startCell) {
      setIsDraggingWordSearch(false);
      
      // If we dragged at least 2 cells, check word immediately
      if (wordSearchSelectedCoords.length > 1) {
        const wordAttempt = wordSearchSelectedCoords.map(coord => wordSearchGrid[coord.r][coord.c]).join("");
        const wordAttemptRev = [...wordSearchSelectedCoords].reverse().map(coord => wordSearchGrid[coord.r][coord.c]).join("");
        
        const matchedWord = wordSearchList.find(w => (w === wordAttempt || w === wordAttemptRev) && !wordSearchFoundList.includes(w));
        
        if (matchedWord) {
          const colorClass = PASTEL_COLORS[wordSearchList.indexOf(matchedWord) % PASTEL_COLORS.length];
          setFoundWordPlacements(prev => [...prev, { word: matchedWord, colorClass, coords: [...wordSearchSelectedCoords] }]);
          const updatedFoundList = [...wordSearchFoundList, matchedWord];
          setWordSearchFoundList(updatedFoundList);
          playSuccessSound(soundEnabled);
          
          if (updatedFoundList.length === wordSearchList.length) {
            playCompleteSound(soundEnabled);
          }
        } else {
          playErrorSound(soundEnabled);
        }
        
        setWordSearchSelectedCoords([]);
        setStartCell(null);
      }
    }
  };

  const resetCurrentWordSearch = () => {
    playClickSound(soundEnabled);
    setWordSearchFoundList([]);
    setFoundWordPlacements([]);
    setWordSearchSelectedCoords([]);
    setStartCell(null);
    setIsDraggingWordSearch(false);
  };

  const shuffleWordSearch = () => {
    playClickSound(soundEnabled);
    if (filteredChallenges.length > 0) {
      const shuffledSubList = [...filteredChallenges].sort(() => Math.random() - 0.5);
      const words = shuffledSubList.map(c => c.word).slice(0, 10);
      const generated = generateWordSearch(words, 12);
      setWordSearchGrid(generated.grid);
      setWordSearchPlacements(generated.placements);
      setWordSearchList(generated.placedWords);
      setWordSearchFoundList([]);
      setFoundWordPlacements([]);
      setWordSearchSelectedCoords([]);
      setStartCell(null);
      setIsDraggingWordSearch(false);
    }
  };

  const shuffleSpellingWords = () => {
    playClickSound(soundEnabled);
    if (challenges.length > 0) {
      setChallenges(prev => {
        const resetClues = prev.map(c => ({ ...c, prefilled: [] }));
        const shuffled = shuffleArray(resetClues).map(c => applyPrefilledRule(c as WordPuzzle, gameDifficulty));
        return shuffled;
      });
      setCurrentIdx(0);
      setCompletedIds([]);
    }
  };

  const revealWordSearchAnswers = () => {
    playClickSound(soundEnabled);
    if (wordSearchList.length === 0) return;
    
    const newPlacements = [...foundWordPlacements];
    const newFoundList = [...wordSearchFoundList];
    
    wordSearchList.forEach(word => {
      if (!wordSearchFoundList.includes(word)) {
        const coords = wordSearchPlacements[word];
        if (coords) {
          const colorClass = PASTEL_COLORS[wordSearchList.indexOf(word) % PASTEL_COLORS.length];
          newPlacements.push({ word, colorClass, coords });
          newFoundList.push(word);
        }
      }
    });
    
    setFoundWordPlacements(newPlacements);
    setWordSearchFoundList(newFoundList);
  };

  const handlePrintClick = () => {
    if (activeGameMode === "wordsearch") {
      setWordSearchPrintPages(5); // Default to 5 pages
      setIsPrintModalOpen(true);
    } else {
      executePrintView(1);
    }
  };

  const executePrintView = (pages: number) => {
    setIsPrintModalOpen(false);

    // Create a new window safely first to avoid popup blockers
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("សូមអនុញ្ញាត Pop-ups សម្រាប់គេហទំព័រនេះ ដើម្បីបើកផ្ទាំងបោះពុម្ព។");
      return;
    }
    
    const isWordSearch = activeGameMode === "wordsearch";
    const isWordCard = activeGameMode === "wordcard";

    if (isWordSearch) {
       if (isNaN(pages) || pages <= 0) pages = 1;
       if (pages > 20) pages = 20;
       
       const grids = [];
       for (let i = 0; i < pages; i++) {
          const generated = generateWordSearch(wordSearchList, 12);
          const shuffledWords = [...generated.placedWords].sort(() => Math.random() - 0.5);
          grids.push({ grid: generated.grid, placements: generated.placements, placedWords: shuffledWords });
       }
       
       flushSync(() => {
          setWordSearchPrintGrids(grids);
       });
    }

    // Get the HTML content of the print area AFTER flushSync completes!
    const printAreaLayout = document.getElementById('worksheet-print-area');
    if (!printAreaLayout) {
       printWindow.close();
       return;
    }

    const printContent = printAreaLayout.innerHTML;

    const title = isWordCard
      ? "បណ្ណពាក្យអក្ខរាវិរុទ្ធនិងអំណានខ្មែរ (Khmer Word Cards)"
      : isWordSearch 
        ? "🍀 សន្លឹកកិច្ចការល្បែងស្វែងរកពាក្យខ្មែរ (Word Search Worksheet)"
        : "ល្បែងផ្គុំពាក្យខ្មែរ";

    const topBarHtml = `
      <div class="top-bar no-print">
        <div class="top-bar-actions">
          <div style="display: flex; gap: 12px; width: 100%; justify-content: space-between;">
            <button class="btn-print" onclick="window.print()">📥 ទាញយក ឬបោះពុម្ព (Download/Print)</button>
            <button class="btn-close" onclick="window.close()">បិទផ្ទាំងនេះ</button>
          </div>
        </div>
      </div>
    `;

    const html = `
      <!DOCTYPE html>
      <html lang="km">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Battambang:wght@100;300;400;700;900&family=Bokor&family=Chenla&family=Kantumruy+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Moul&family=Preahvihear&family=Siemreap&family=Suwannaphum:wght@100;300;400;700;900&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
          tailwind.config = {
            theme: {
              extend: {
                fontFamily: {
                  khmer: ['"Battambang"', '"Kantumruy Pro"', '"Siemreap"', 'sans-serif'],
                  moul: ['"Moul"', 'serif'],
                }
              }
            }
          }
        </script>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Battambang:wght@100;300;400;700;900&family=Bokor&family=Chenla&family=Kantumruy+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Moul&family=Preahvihear&family=Siemreap&family=Suwannaphum:wght@100;300;400;700;900&display=swap');
          
          body { 
            font-family: "Battambang", "Kantumruy Pro", "Siemreap", sans-serif; 
            background-color: #f1f5f9; 
            margin: 0; 
            padding: 0; 
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .font-khmer {
            font-family: var(--font-khmer, "Battambang", "Kantumruy Pro", "Siemreap", sans-serif);
          }
          .font-moul {
            font-family: "Moul", serif !important;
            font-weight: normal !important;
          }
          .font-black {
            font-weight: 900 !important;
          }
          .worksheet-cell {
            font-family: "Battambang", sans-serif !important;
            font-weight: bold !important;
          }
          .print-container { max-width: 800px; margin: 40px auto; background: white; padding: 40px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border-radius: 8px; }
          .print-container-cards { max-width: 210mm; margin: 40px auto; padding: 0; }
          .top-bar { background: white; padding: 12px 16px; display: flex; justify-content: center; align-items: center; border-bottom: 1px solid #cbd5e1; position: sticky; top: 0; left: 0; right: 0; z-index: 1000; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
          .top-bar-actions { display: flex; flex-direction: column; align-items: center; width: 100%; max-width: 800px; }
          .btn-print { background: #f97316; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-family: "Kantumruy Pro", sans-serif; font-size: 16px; flex: 1; min-width: 0; box-shadow: 0 4px 6px rgba(249, 115, 22, 0.2); }
          .btn-print:hover { background: #ea580c; transform: translateY(-1px); }
          .btn-close { background: #64748b; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-family: "Kantumruy Pro", sans-serif; font-size: 16px; flex: 0.5; min-width: 0; box-shadow: 0 4px 6px rgba(100, 116, 139, 0.2); }
          .btn-close:hover { background: #475569; transform: translateY(-1px); }
          body { padding-top: 20px; }
          
          .print-page {
            background: white;
            width: 100%;
            max-width: 210mm;
            height: 297mm;
            padding: 5mm;
            box-shadow: 0 4px 15px rgba(0,0,0,0.06);
            border-radius: 12px;
            border: 1px solid #cbd5e1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            box-sizing: border-box;
            margin: 0 auto 30px auto;
          }
          .print-page-card {
            width: 100%;
            height: 90mm;
            box-sizing: border-box;
          }
          
          @media (max-width: 640px) {
            .top-bar {
              padding: 12px;
            }
            .btn-print {
              padding: 14px 16px;
              font-size: 18px;
              border-radius: 12px;
            }
            .btn-close {
              padding: 14px 16px;
              font-size: 18px;
              border-radius: 12px;
            }
            body { padding-top: 10px; padding-bottom: 20px; }
            .print-container {
              margin: 16px;
              padding: 16px;
            }
            .print-page {
              max-width: 100%;
              height: auto;
              aspect-ratio: 210/297;
              padding: 5%;
              justify-content: space-between;
              margin-bottom: 16px;
            }
            .print-page-card {
              height: 28%;
            }
          }
          
          .page-break-inside-avoid, .break-inside-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid-page !important;
            break-inside: avoid !important;
            display: block !important;
          }
          
          @media print {
            @page {
              margin: 0.5cm !important;
              size: A4;
            }
            body { background: white; padding: 0 !important; margin: 0 !important; }
            .no-print { display: none !important; }
            .print-container { box-shadow: none; margin: 0; padding: 0; max-width: none; border-radius: 0; }
            .print-container-cards { margin: 0 !important; padding: 0 !important; max-width: none !important; }
            .page-break-inside-avoid, .break-inside-avoid {
              page-break-inside: avoid !important;
              break-inside: avoid-page !important;
              break-inside: avoid !important;
              display: block !important;
            }
            .print-page {
              width: 100% !important;
              height: 265mm !important;
              min-height: 265mm !important;
              max-height: 265mm !important;
              padding: 0.5cm !important;
              box-sizing: border-box !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              border: none !important;
              page-break-after: always !important;
              page-break-inside: avoid !important;
              margin: 0 !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              aspect-ratio: auto !important;
              overflow: hidden !important;
            }
            .print-page-card {
              height: 90mm !important;
            }
          }
        </style>
        <script>
          function toggleAnswers(e) {
            const cells = document.querySelectorAll('.worksheet-cell');
            if (e.target.checked) {
              cells.forEach(cell => {
                const colors = cell.getAttribute('data-answer-colors');
                if (colors) {
                  const arr = colors.split(' ');
                  cell.classList.remove('bg-white');
                  arr.forEach(c => cell.classList.add(c));
                }
              });
              
              const keyContent = document.getElementById('answer-key-content');
              if (keyContent) keyContent.style.display = 'block';
            } else {
              cells.forEach(cell => {
                const colors = cell.getAttribute('data-answer-colors');
                if (colors) {
                  const arr = colors.split(' ');
                  arr.forEach(c => cell.classList.remove(c));
                  cell.classList.add('bg-white');
                }
              });
              
              const keyContent = document.getElementById('answer-key-content');
              if (keyContent) keyContent.style.display = 'none';
            }
          }
        </script>
      </head>
      <body>
        ${topBarHtml}
        ${isWordSearch ? `
        <div class="no-print" style="max-width: 800px; margin: 20px auto 0 auto; text-align: center;">
          <label style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-size: 16px; cursor: pointer; user-select: none; font-family: 'Kantumruy Pro', sans-serif;">
            <input type="checkbox" onchange="toggleAnswers(event)" style="width: 20px; height: 20px; accent-color: #3b82f6;">
            <b>បង្ហាញចម្លើយ (Show Answer Key)</b>
          </label>
        </div>
        ` : ''}
        <div class="print-container${isWordCard ? '-cards' : ''}" style="padding: 0.5cm; width: 100%; box-sizing: border-box;">
          ${printContent}
          ${isWordSearch ? `
            <div id="answer-key-content" style="display: none; text-align: center; margin-top: 40px; border-top: 2px dashed #cbd5e1; padding-top: 20px;">
              <h3 style="color: #dc2626; font-weight: bold; font-size: 16px; margin-bottom: 20px;">*** គន្លឹះចម្លើយសម្រាប់លោកគ្រូ-អ្នកគ្រូ (Teacher's Answer Key) ***</h3>
              <p style="font-size: 14px; font-weight: bold; color: #334155; margin-bottom: 16px;">ពាក្យត្រូវស្វែងរកទាំង ${wordSearchList.length} ៖</p>
              <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;">
                ${wordSearchList.map((word, i) => `
                  <div style="display: flex; align-items: center; gap: 6px; background: #f8fafc; padding: 4px 10px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 13px;">
                    <span style="display: inline-block; width: 18px; height: 18px; border-radius: 4px; background-color: var(--color-hint, #3b82f6); opacity: 0.2; border: 1px solid currentColor;" class="${PASTEL_COLORS[i % PASTEL_COLORS.length]}"></span>
                    <span style="font-weight: 600; color: #1e293b;">${word}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ""}
        </div>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Sync newWord to its split blocks preview
  useEffect(() => {
    if (newWord.trim()) {
      const blocks = splitKhmerWord(newWord);
      setNewWordBlocks(blocks);
      // Automatically prefill alternate blocks as hints
      setNewWordPrefilled(blocks.map((_, idx) => idx % 2 === 0));
    } else {
      setNewWordBlocks([]);
      setNewWordPrefilled([]);
    }
    setWordError(null);
  }, [newWord]);

  // Request browser fullscreen safely
  const requestFullscreenSafely = async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          await (document.documentElement as any).webkitRequestFullscreen();
        } else if ((document.documentElement as any).msRequestFullscreen) {
          await (document.documentElement as any).msRequestFullscreen();
        }
      }
    } catch (err) {
      console.warn("Fullscreen toggle failed:", err);
    }
  };

  // Toggle browser fullscreen safely with graceful fallback
  const toggleFullscreenMode = async () => {
    playClickSound(soundEnabled);
    
    // Toggle the browser fullscreen API
    try {
      if (!document.fullscreenElement) {
        await requestFullscreenSafely();
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn("Fullscreen toggle failed:", err);
    }
  };

  // Load level pool when word index or challenge set changes
  useEffect(() => {
    if (challenge) {
      // Clear inputs
      const initialInput = Array(challenge.blocks.length).fill("");
      challenge.blocks.forEach((block, idx) => {
        if (challenge.prefilled[idx]) {
          initialInput[idx] = block;
        }
      });
      setUserInput(initialInput);
      setLetterPool(generateLetterPool(challenge, 12));
      setIsCorrect(false);
      
      // Auto focus first empty/user slot
      const firstEmpty = challenge.prefilled.findIndex(p => !p);
      setActiveSlot(firstEmpty !== -1 ? firstEmpty : 0);
    }
  }, [currentIdx, challenges, selectedFilterCategory]);

  // Handle tile click
  const handleTileClick = (letter: string) => {
    if (isCorrect) return; // Locked on success
    playClickSound(soundEnabled);
    
    let targetIndex = activeSlot;
    if (targetIndex === null || challenge.prefilled[targetIndex]) {
      // Find first empty, non-prefilled slot
      targetIndex = challenge.prefilled.findIndex((pref, idx) => !pref && !userInput[idx]);
      if (targetIndex === -1) {
        // Find first empty non-prefilled slot from start
        targetIndex = challenge.prefilled.findIndex((pref) => !pref);
      }
    }

    if (targetIndex !== -1) {
      const updated = [...userInput];
      updated[targetIndex] = letter;
      setUserInput(updated);
      
      // Move focus to next empty unfilled slot
      let foundNext = false;
      for (let i = targetIndex + 1; i < challenge.blocks.length; i++) {
        if (!challenge.prefilled[i] && !updated[i]) {
          setActiveSlot(i);
          foundNext = true;
          break;
        }
      }
      
      if (!foundNext) {
        // Find empty slot from beginning
        for (let i = 0; i < targetIndex; i++) {
          if (!challenge.prefilled[i] && !updated[i]) {
            setActiveSlot(i);
            foundNext = true;
            break;
          }
        }
      }

      if (!foundNext) {
        // Keep focus on the active slot or release
        setActiveSlot(null);
      }
    }
  };

  // Click on boxes to change focus or delete
  const handleSlotClick = (idx: number) => {
    if (challenge.prefilled[idx]) return; // Locked hints do not react
    playClickSound(soundEnabled);
    setActiveSlot(idx);
    
    // If has text, clear it
    if (userInput[idx]) {
      const updated = [...userInput];
      updated[idx] = "";
      setUserInput(updated);
    }
  };

  // Reset current word inputs
  const handleResetWord = () => {
    playClickSound(soundEnabled);
    const updated = Array(challenge.blocks.length).fill("");
    challenge.blocks.forEach((block, idx) => {
      if (challenge.prefilled[idx]) {
        updated[idx] = block;
      }
    });
    setUserInput(updated);
    // Focus first empty
    const firstEmpty = challenge.prefilled.findIndex(p => !p);
    setActiveSlot(firstEmpty !== -1 ? firstEmpty : 0);
    setIsCorrect(false);
  };

  // Verify answer
  const handleVerify = () => {
    const isMatching = userInput.every((val, idx) => val === challenge.blocks[idx]);
    
    if (isMatching) {
      setIsCorrect(true);
      playSuccessSound(soundEnabled);
      if (!completedIds.includes(challenge.id)) {
        const updatedCompleted = [...completedIds, challenge.id];
        setCompletedIds(updatedCompleted);
        
        // Check game complete
        const filteredCompletedCount = filteredChallenges.filter(c => updatedCompleted.includes(c.id)).length;
        if (filteredCompletedCount >= filteredChallenges.length) {
          setTimeout(() => {
            playCompleteSound(soundEnabled);
            setShowCertificate(true);
          }, 600);
        }
      }
    } else {
      setIsShake(true);
      playErrorSound(soundEnabled);
      setIncorrectAttempts(prev => prev + 1);
      setTimeout(() => setIsShake(false), 500);
    }
  };

  const handleMcOptionSelect = (option: string) => {
    if (mcSelectedAnswer !== null || isCorrect) return; // Prevent multiple clicks
    
    setMcSelectedAnswer(option);
    const correctAns = filteredMcQuestions[currentMcIdx]?.correctOption;
    
    if (option === correctAns) {
      setMcIsCorrect(true);
      setIsCorrect(true);
      playSuccessSound(soundEnabled);
    } else {
      setMcIsCorrect(false);
      playErrorSound(soundEnabled);
      setTimeout(() => {
        setMcSelectedAnswer(null);
        setMcIsCorrect(null);
      }, 1000);
    }
  };

  const handleNextMcQuestion = () => {
    playClickSound(soundEnabled);
    if (filteredMcQuestions.length <= 1) {
      setCurrentMcIdx(0);
      return;
    }
    
    let randomIdx;
    do {
      randomIdx = Math.floor(Math.random() * filteredMcQuestions.length);
    } while (randomIdx === currentMcIdx);
    
    setCurrentMcIdx(randomIdx);
  };

  // Play next word
  const handleNextWord = () => {
    playClickSound(soundEnabled);
    if (currentIdx < filteredChallenges.length - 1) {
      setCurrentIdx(prev => prev + 1);
    } else {
      // Loop or congratulate
      setCurrentIdx(0);
    }
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Expected format: Question | Option1 | Option2 | Option3 | Option4 | CorrectOption | Topic
        const data = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });
        
        // Skip header row if it seems to be headers
        const rows = data.length > 0 && typeof data[0][0] === 'string' && (data[0][0].includes("សំណួរ") || data[0][0].toLowerCase().includes("question")) ? data.slice(1) : data;
        
        const importedQuestions = rows
          .map((row: any, idx: number) => {
            if (!row || row.length < 6) return null;
            return {
              id: Date.now() + idx,
              question: String(row[0] || ""),
              options: [String(row[1] || ""), String(row[2] || ""), String(row[3] || ""), String(row[4] || "")],
              correctOption: String(row[5] || ""),
              topic: row[6] ? String(row[6]) : "ទូទៅ"
            };
          })
          .filter((q: any) => q && q.question.trim().length > 0);
          
        if (importedQuestions.length > 0) {
          setMcQuestions(prev => [...prev, ...importedQuestions]);
          alert(`បាននាំចូលសំណួរចំនួន ${importedQuestions.length} ដោយជោគជ័យ!`);
        } else {
          alert('មិនមានទិន្នន័យត្រឹមត្រូវក្នុងឯកសារនេះទេ។ សូមពិនិត្យទម្រង់ឯកសារអ្នកម្តងទៀត។ (ជួរ: សំណួរ, ជម្រើស1, ជម្រើស2, ជម្រើស3, ជម្រើស4, ចម្លើយត្រឹមត្រូវ, ប្រធានបទ)');
        }
      } catch (err) {
        console.error("Error parsing excel file:", err);
        alert('បញ្ហាក្នុងការអានឯកសារ Excel');
      }
      
      // Reset file input
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadTemplate = () => {
    playClickSound(soundEnabled);
    const templateData = [
      ["សំណួរ", "ជម្រើស១", "ជម្រើស២", "ជម្រើស៣", "ជម្រើស៤", "ចម្លើយត្រឹមត្រូវ (ចំលងពីជម្រើសទី1-4)", "ប្រធានបទ"],
      ["តើប្រាសាទអង្គរវត្តស្ថិតនៅខេត្តណា?", "ស្វាយរៀង", "សៀមរាប", "បាត់ដំបង", "ភ្នំពេញ", "សៀមរាប", "ចំណេះដឹងទូទៅ"]
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    
    // Set column widths
    const wscols = [
      {wch: 40}, // Question
      {wch: 20}, // Option 1
      {wch: 20}, // Option 2
      {wch: 20}, // Option 3
      {wch: 20}, // Option 4
      {wch: 30}, // Correct Option
      {wch: 20}  // Topic
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ពុម្ពគំរូសំណួរ");
    XLSX.writeFile(wb, "mc_template.xlsx");
  };

  // Select a preset category offline fallback
  const handlePresetCategorySelect = (categoryName: string) => {
    playClickSound(soundEnabled);
    const list = FALLBACK_CATEGORIES[categoryName];
    if (list) {
      const mapped = shuffleArray(list).map(item => applyPrefilledRule({
        ...item,
        category: item.category || categoryName
      }, gameDifficulty));
      setChallenges(mapped);
      setSelectedFilterCategory(categoryName);
      setCurrentIdx(0);
      setCompletedIds([]);
      setAiMenuOpen(false);
    }
  };

  // Trigger Gemini API to generate custom level
  const handleGenerateCustomTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCategory.trim()) return;
    
    playClickSound(soundEnabled);
    setAiLoading(true);
    setAiError(null);

    try {
      const response = await fetch("/api/gemini/generate-words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: customCategory.trim()
        })
      });

      const data = await response.json();
      
      if (data.useFallback || data.error || !data.words || data.words.length === 0) {
        throw new Error(data.error || "Failed to generate words.");
      }

      // Convert response into challenges array, shuffled so kids don't copy the layout/sequence
      const categoryLabel = customCategory.trim() || "ការបង្កើតដោយ AI";
      const loaded: WordPuzzle[] = shuffleArray(data.words).map((w: any, index: number) => applyPrefilledRule({
        id: Date.now() + index,
        word: w.word,
        clue: w.clue,
        category: categoryLabel,
        blocks: w.blocks,
        prefilled: w.prefilled
      }, gameDifficulty));

      setChallenges(loaded);
      setSelectedFilterCategory(categoryLabel);
      setCurrentIdx(0);
      setCompletedIds([]);
      setAiMenuOpen(false);
    } catch (err: any) {
      console.warn("API Error, falling back to curated list.", err);
      // Soft fallback to a relevant category
      const keys = Object.keys(FALLBACK_CATEGORIES);
      const fallbackKey = keys.find(k => k.toLowerCase().includes(customCategory.toLowerCase())) || keys[0];
      const fallbackList = shuffleArray(FALLBACK_CATEGORIES[fallbackKey]).map(c => applyPrefilledRule(c, gameDifficulty));
      
      setChallenges(fallbackList);
      setCurrentIdx(0);
      setCompletedIds([]);
      setAiError("មិនអាចភ្ជាប់ទៅកាន់ប្រព័ន្ធ AI បានទាន់ពេល។ យើងបានដំណើរការប្រធានបទជំនួសដ៏ស្រស់ស្អាតជូនអ្នក!");
      setTimeout(() => {
        setAiMenuOpen(false);
        setAiLoading(false);
        setAiError(null);
      }, 3500);
    } finally {
      if (!aiError) {
        setAiLoading(false);
      }
    }
  };

  // Reset the whole game to presets
  const handleResetToPresets = () => {
    playClickSound(soundEnabled);
    setChallenges(shuffleArray(PRESET_CHALLENGES).map(c => applyPrefilledRule(c, gameDifficulty)));
    setCurrentIdx(0);
    setCompletedIds([]);
    setAiMenuOpen(false);
  };

  // Toggle prefilled state of custom word block preview
  const toggleNewWordPrefilledIdx = (idx: number) => {
    playClickSound(soundEnabled);
    setNewWordPrefilled(prev => {
      const copy = [...prev];
      copy[idx] = !copy[idx];
      return copy;
    });
  };

  // Delete a word from the active challenges
  const handleDeleteWord = (idToDelete: number) => {
    playClickSound(soundEnabled);
    const updated = challenges.filter(c => c.id !== idToDelete);
    setChallenges(updated);
    
    // Adjust current index if it becomes out of bounds
    if (currentIdx >= updated.length) {
      setCurrentIdx(Math.max(0, updated.length - 1));
    }
    // Remove from completed list
    setCompletedIds(prev => prev.filter(id => id !== idToDelete));
  };

  // Add custom word puzzle
  const handleAddCustomWord = (e: React.FormEvent) => {
    e.preventDefault();
    const wordClean = newWord.trim();

    if (!wordClean) {
      setWordError("សូមវាយបញ្ចូលពាក្យខ្មែរ!");
      return;
    }
    if (newWordBlocks.length === 0) {
      setWordError("ពាក្យនេះមិនអាចបំបែកបានទេ!");
      return;
    }

    const categoryName = isCustomCategoryMode
      ? (customCategoryInput.trim() || "ក្រុមពាក្យទូទៅ")
      : (selectedCategory || "ពាក្យអក្ខរាវិរុទ្ធខ្មែរ");

    playClickSound(soundEnabled);

    const newPuzzle: WordPuzzle = applyPrefilledRule({
      id: Date.now() + Math.floor(Math.random() * 1000),
      word: wordClean,
      clue: "",
      category: categoryName,
      blocks: [...newWordBlocks],
      prefilled: [...newWordPrefilled]
    }, gameDifficulty);

    setChallenges(prev => [...prev, newPuzzle]);
    setSelectedFilterCategory(categoryName);
    
    // Reset inputs & close modal
    setNewWord("");
    setNewClue("");
    setNewWordBlocks([]);
    setNewWordPrefilled([]);
    setCustomCategoryInput("");
    setIsCustomCategoryMode(false);
    setWordError(null);
    setIsAddWordModalOpen(false);
  };

  // Trigger Print Dialog
  const handlePrint = () => {
    playClickSound(soundEnabled);
    window.print();
  };

  // Helper to escape CSV fields for Excel
  const escapeCSVField = (val: string): string => {
    if (!val) return "";
    const cleaned = val.replace(/"/g, '""');
    if (cleaned.includes(",") || cleaned.includes('"') || cleaned.includes('\n') || cleaned.includes('\r') || cleaned.includes(';')) {
      return `"${cleaned}"`;
    }
    return cleaned;
  };

  // Helper to parse standard and escaped CSV tables correctly with Excel standard compatibility
  const parseCSV = (text: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let currentValue = "";

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentValue += '"';
          i++; 
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(currentValue);
        currentValue = "";
      } else if (char === ';' && !inQuotes && row.length === 0 && currentValue.indexOf(',') === -1) {
        // Support semicolon separator used by default in many Excel export formats
        row.push(currentValue);
        currentValue = "";
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        row.push(currentValue);
        if (row.length > 0 && row.some(cell => cell.trim().length > 0)) {
          lines.push(row);
        }
        row = [];
        currentValue = "";
      } else {
        currentValue += char;
      }
    }
    if (currentValue || row.length > 0) {
      row.push(currentValue);
      if (row.some(cell => cell.trim().length > 0)) {
        lines.push(row);
      }
    }
    return lines;
  };

  // Handle Export wordlist to CSV/Excel format style with unicode support
  const handleExportToCSV = () => {
    playClickSound(soundEnabled);
    
    const listToExport = filteredChallenges; // Export what the user currently sees
    if (listToExport.length === 0) {
      alert("គ្មានពាក្យក្នុងក្រុមនេះសម្រាប់នាំចេញសោះឡើយ!");
      return;
    }

    const headers = ["ពាក្យ (Word)", "ក្រុមពាក្យ (Category)"];
    const rows = listToExport.map(c => [
      c.word,
      c.category || "ពាក្យអក្ខរាវិរុទ្ធខ្មែរ"
    ]);

    const csvContent = [
      headers.map(escapeCSVField).join(","),
      ...rows.map(row => row.map(escapeCSVField).join(","))
    ].join("\n");

    // Add UTF-8 BOM so Excel opens Khmer script perfectly
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `បញ្ជីពាក្យ_ខ្មែរ_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Load sample CSV/Excel template file for manual word input
  const loadSampleCSVTemplate = () => {
    playClickSound(soundEnabled);
    const headers = ["ពាក្យ (Word)", "ក្រុមពាក្យ (Category)"];
    const rows = [
      ["សាលារៀន", "សម្ភារៈសិក្សា"],
      ["ផ្លែស្វាយ", "ផ្លែឈើ"],
      ["សត្វតោ", "សត្វព្រៃ"],
      ["សៀវភៅ", "សម្ភារៈសិក្សា"]
    ];

    const csvContent = [
      headers.map(escapeCSVField).join(","),
      ...rows.map(row => row.map(escapeCSVField).join(","))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "គំរូឯកសារ_នាំចូលពាក្យ_excel_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Process File upload changes
  const handleFileImportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    playClickSound(soundEnabled);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      try {
        const parsed = parseCSV(text);
        if (parsed.length === 0) {
          setImportError("ឯកសារដែលបានជ្រើសរើសមិនមានទិន្នន័យឡើយ!");
          setImportedPuzzles([]);
          setIsImportModalOpen(true);
          return;
        }

        // Check if row 0 is header row
        let startIdx = 0;
        const firstRow = parsed[0];
        const isHeader = firstRow.some(cell => {
          const lower = cell.toLowerCase().trim();
          return lower.includes("word") || lower.includes("ពាក្យ") || lower.includes("category") || lower.includes("ក្រុម");
        });

        if (isHeader) {
          startIdx = 1;
        }

        const parsedChallenges: WordPuzzle[] = [];
        const errors: string[] = [];

        for (let i = startIdx; i < parsed.length; i++) {
          const row = parsed[i];
          if (!row || row.length === 0 || !row[0]) continue;

          const wordRaw = row[0].trim();
          if (!wordRaw) continue;

          // Remove English letters, digits, to validate Khmer characters only
          const hasKhmer = /[\u1780-\u17FF]/.test(wordRaw);
          if (!hasKhmer) {
            errors.push(`ជួរទី ${i + 1}៖ " ${wordRaw}" មិនមែនជាពាក្យអក្សរខ្មែរឡើយ។`);
            continue;
          }

          if (wordRaw.length < 2) {
            errors.push(`ជួរទី ${i + 1}៖ ពាក្យ "${wordRaw}" ខ្លីពេក (ត្រូវមានយ៉ាងហោច២តួ)។`);
            continue;
          }

          const categoryRaw = row[1] ? row[1].trim() : "ពាក្យនាំចូល (Imported)";

          // Automatically split linguistic block graphemes
          const blocks = splitKhmerWord(wordRaw);

          parsedChallenges.push(applyPrefilledRule({
            id: Date.now() + i + Math.floor(Math.random() * 10000),
            word: wordRaw,
            clue: "",
            category: categoryRaw || "ពាក្យនាំចូល",
            blocks: [...blocks],
            prefilled: blocks.map((_, idx) => idx % 2 === 0) // Will be mapped over by applyPrefilledRule anyway
          }, gameDifficulty));
        }

        if (parsedChallenges.length === 0) {
          setImportError("រកមិនឃើញពាក្យខ្មែរមានខ្លឹមសារត្រឹមត្រូវសោះ ក្នុងឯកសារនេះ!");
          setImportedPuzzles([]);
        } else {
          setImportedPuzzles(parsedChallenges);
          if (errors.length > 0) {
            setImportError(`បានរកឃើញបញ្ហាមួយចំនួន៖\n` + errors.slice(0, 3).join("\n") + (errors.length > 3 ? `\n...និងមានកំហុសចំនួន ${errors.length - 3} ទៀត` : ""));
          } else {
            setImportError(null);
          }
        }

        setIsImportModalOpen(true);
      } catch (err) {
        console.error("Error parsing layout text:", err);
        setImportError("ការអានឯកសារបានបរាជ័យ។ សូមប្រាកដថាអ្នកបានបញ្ចូលឯកសារ Excel/CSV ត្រឹមត្រូវ។");
        setImportedPuzzles([]);
        setIsImportModalOpen(true);
      }

      // Reset value so we can load same file again if revised
      e.target.value = "";
    };

    reader.readAsText(file, "UTF-8");
  };

  // Commit saved imported variables
  const handleCommitImport = (e: React.FormEvent) => {
    e.preventDefault();
    playClickSound(soundEnabled);
    if (importedPuzzles.length === 0) return;

    if (importMethod === 'replace') {
      setChallenges(importedPuzzles);
    } else {
      setChallenges(prev => [...prev, ...importedPuzzles]);
    }

    // Reset selection filter and navigate
    setSelectedFilterCategory("ទាំងអស់");
    setImportedPuzzles([]);
    setImportError(null);
    setIsImportModalOpen(false);
  };

  // Calculate percentage progress
  const filteredCompletedCount = challenges.filter(c => completedIds.includes(c.id) && (selectedFilterCategory === "ទាំងអស់" || (c.category || "ពាក្យអក្ខរាវិរុទ្ធខ្មែរ") === selectedFilterCategory)).length;
  const progressPercent = filteredChallenges.length > 0 
    ? Math.round((filteredCompletedCount / filteredChallenges.length) * 100) 
    : 0;

  const renderSharedGameHeader = (showTitle: boolean = true, showButtons: boolean = true) => (
    <div className={`flex flex-col items-start xl:flex-row xl:items-center justify-between gap-4 w-full relative z-50 sm:pl-0 sm:pr-0 shrink-0 max-w-full`}>
      {showTitle && (
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 md:w-16 md:h-16 rounded-3xl flex items-center justify-center shadow-lg shrink-0 ${activeGameMode === "spelling" ? "bg-blue-600 shadow-blue-200" : activeGameMode === "multiplechoice" ? "bg-purple-600 shadow-purple-200" : "bg-amber-500 shadow-amber-200"}`}>
            {activeGameMode === "spelling" ? (
              <Award className="w-7 h-7 md:w-8 md:h-8 text-white" />
            ) : activeGameMode === "multiplechoice" ? (
              <CheckSquare className="w-7 h-7 md:w-8 md:h-8 text-white" />
            ) : (
              <Sparkles className="w-7 h-7 md:w-8 md:h-8 text-white" />
            )}
          </div>
          <div className="flex flex-col">
            <h2 className="text-xl md:text-2xl lg:text-3xl text-slate-800 font-black font-khmer tracking-tight leading-tight">
              {activeGameMode === "spelling" ? "ល្បែងផ្គុំពាក្យខ្មែរ" : activeGameMode === "multiplechoice" ? "សំណួរពហុជម្រើស" : "ល្បែងស្វែងរកពាក្យខ្មែរ"}
            </h2>
            <p className="text-xs md:text-sm text-slate-500 font-khmer mt-2">
              {activeGameMode === "spelling" ? "បំពេញព្យញ្ជនៈ ស្រៈ និងជើងអក្សរក្នុងប្រអប់" : activeGameMode === "multiplechoice" ? "ជ្រើសរើសចម្លើយត្រឹមត្រូវ ១ ក្នុងចំណោម ៤" : "រាវរកទីតាំងពាក្យដែលលាក់នៅក្នុងតារាងអក្សរ"}
            </p>
          </div>
        </div>
      )}
      
      {showButtons && (
        <div className={`flex flex-wrap items-center gap-2 sm:gap-3 ${!showTitle ? 'justify-end w-full' : ''}`}>
          {activeGameMode === "multiplechoice" && (
            <button
              onClick={() => {
                playClickSound(soundEnabled);
                setIsMcModalOpen(true);
              }}
              className="px-3 py-2 text-sm font-bold text-fuchsia-700 bg-fuchsia-50 hover:bg-fuchsia-100 border border-fuchsia-200 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
              title="បញ្ចូលសំណួរនិងចម្លើយ"
            >
              <Plus className="w-4 h-4 text-fuchsia-600" />
              <span className="hidden sm:inline">បញ្ចូលសំណួរនិងចម្លើយ</span>
            </button>
          )}

          <button 
            onClick={() => {
              playClickSound(soundEnabled);
              setIsGameStarted(false);
              setActiveGameMode("home");
            }}
            className="px-3 py-2 text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
            title="ត្រឡប់ទៅទំព័រដើម"
          >
            <Home className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline">ទំព័រដើម</span>
          </button>

          <button 
            onClick={() => {
              playClickSound(soundEnabled);
              setIsTimerOpen(true);
            }}
            className="px-3 py-2 text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
            title="នាឡិកាវាស់ពេល"
          >
            <Timer className={`w-4 h-4 ${timerRunning ? "text-rose-500 animate-pulse" : "text-slate-600"}`} />
            <span className="hidden sm:inline">{timerSeconds > 0 && timerRunning ? formatTimeHHMMSS(timerSeconds) : "នាឡិកា"}</span>
          </button>

          <button 
            onClick={() => {
              playClickSound(soundEnabled);
              setIsSlotMachineOpen(true);
            }}
            className="px-3 py-2 text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
            title="ម៉ាស៊ីនចាប់ពាក្យ (Slot)"
          >
            <ArrowUpDown className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline">ល្បែងអានពាក្យ</span>
          </button>

          <button 
            onClick={() => {
              playClickSound(soundEnabled);
              setIsTeamGenOpen(true);
            }}
            className="px-3 py-2 text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
            title="បែងចែកក្រុមសិស្ស"
          >
            <Users className="w-4 h-4 text-sky-600" />
            <span className="hidden sm:inline">ចាប់ក្រុម</span>
          </button>

          <button 
            onClick={toggleFullscreenMode}
            className="p-2 sm:px-3 sm:py-2 text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
            title={isFullscreen ? "បិទពេញអេក្រង់" : "ពេញអេក្រង់"}
          >
            {isFullscreen ? <Minimize className="w-4 h-4 text-slate-600" /> : <Maximize className="w-4 h-4 text-slate-600" />}
            <span className="hidden sm:inline">{isFullscreen ? "ធម្មតា" : "ពេញអេក្រង់"}</span>
          </button>

          <div className="relative">
            <button
              id="settings-btn"
              onClick={() => setSettingsMenuOpen(!settingsMenuOpen)}
              className={`p-2 rounded-xl border transition-all flex items-center gap-2 font-bold shadow-sm ${
                settingsMenuOpen 
                  ? "bg-slate-100 border-slate-300 text-slate-900 shadow-inner" 
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
              title="ការកំណត់ និងសកម្មភាព"
            >
              <Settings className="w-5 h-5" />
              <span className="hidden sm:inline text-sm">ការកំណត់</span>
            </button>

            {settingsMenuOpen && (
              <div 
                id="settings-overlay"
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={(e) => {
                  if ((e.target as HTMLElement).id === "settings-overlay") {
                    setSettingsMenuOpen(false);
                  }
                }}
              >
                <div 
                  id="settings-dropdown"
                  className="bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-200 mt-[-10vh]"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-4">
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 font-khmer">
                      <Settings className="w-5 h-5 text-indigo-500" />
                      ការកំណត់
                    </h3>
                    <button 
                      onClick={() => setSettingsMenuOpen(false)}
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    {/* Toggles Group */}
                    <div className="space-y-1">
                    <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-colors">
                      <div className="flex items-center gap-2">
                        {soundEnabled ? <Volume2 className="w-4 h-4 text-indigo-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
                        <span className="text-sm font-medium text-slate-700">សម្លេង</span>
                      </div>
                      <button 
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className={`w-10 h-5 rounded-full transition-colors relative ${soundEnabled ? "bg-indigo-500" : "bg-slate-200"}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${soundEnabled ? "right-1" : "left-1"}`} />
                      </button>
                    </div>

                    <button 
                      onClick={toggleFullscreenMode}
                      className="w-full flex items-center gap-2 p-2 hover:bg-slate-50 rounded-xl transition-colors text-left"
                    >
                      {isFullscreen ? <Minimize2 className="w-4 h-4 text-slate-600" /> : <Maximize2 className="w-4 h-4 text-slate-600" />}
                      <span className="text-sm font-medium text-slate-700">
                        {isFullscreen ? "បង្រួមអេក្រង់" : "ពង្រីកពេញអេក្រង់"}
                      </span>
                    </button>

                    {activeGameMode === "multiplechoice" && (
                      <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-colors">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-orange-500" />
                          <span className="text-sm font-medium text-slate-700 font-khmer">រយៈពេលរាប់ថយក្រោយ</span>
                        </div>
                        <select 
                          value={mcCountdownSetting}
                          onChange={(e) => setMcCountdownSetting(Number(e.target.value))}
                          className="p-1 px-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-khmer"
                        >
                          <option value={5}>៥ វិនាទី</option>
                          <option value={10}>១០ វិនាទី</option>
                          <option value={15}>១៥ វិនាទី</option>
                          <option value={20}>២០ វិនាទី</option>
                          <option value={30}>៣០ វិនាទី</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="h-px bg-slate-100 mx-1" />

                  {/* Actions Group based on mode */}
                  <div className="space-y-1">
                    {activeGameMode === "wordsearch" && (
                      <>
                        <button
                          onClick={resetCurrentWordSearch}
                          className="w-full flex items-center gap-3 p-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left"
                        >
                          <RotateCcw className="w-4 h-4 text-slate-500" />
                          <span className="text-sm font-medium text-slate-700">លេងឡើងវិញ</span>
                        </button>
                        <button
                          onClick={shuffleWordSearch}
                          className="w-full flex items-center gap-3 p-2.5 hover:bg-indigo-50 rounded-xl transition-colors text-left group"
                        >
                          <Sparkles className="w-4 h-4 text-indigo-500 group-hover:fill-indigo-300" />
                          <span className="text-sm font-bold text-indigo-700">ផ្លាស់ប្តូរតារាង</span>
                        </button>
                        <button
                          onClick={revealWordSearchAnswers}
                          className="w-full flex items-center gap-3 p-2.5 hover:bg-emerald-50 rounded-xl transition-colors text-left"
                        >
                          <Eye className="w-4 h-4 text-emerald-500" />
                          <span className="text-sm font-bold text-emerald-700">បង្ហាញចម្លើយ</span>
                        </button>
                      </>
                    )}

                    {activeGameMode === "spelling" && (
                      <>
                        <button
                          onClick={shuffleSpellingWords}
                          className="w-full flex items-center gap-3 p-2.5 hover:bg-indigo-50 rounded-xl transition-colors text-left"
                        >
                          <Shuffle className="w-4 h-4 text-indigo-500" />
                          <span className="text-sm font-bold text-indigo-700">ប្ដូរលំដាប់ពាក្យ</span>
                        </button>

                        <div className="p-2 space-y-2">
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                            <Award className="w-3 h-3" />
                            <span>កម្រិតពាក្យ</span>
                          </div>
                          <div className="grid grid-cols-1 gap-1">
                            {(["easy", "hard", "expert"] as const).map((diff) => (
                              <button
                                key={diff}
                                onClick={() => handleDifficultyChange(diff)}
                                className={`text-left text-xs font-bold px-3 py-2 rounded-lg transition-all ${
                                  gameDifficulty === diff 
                                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" 
                                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                                }`}
                              >
                                {diff === "easy" ? "ងាយ (Easy)" : diff === "hard" ? "ពិបាក (Hard)" : "ពិបាកខ្លាំង (Expert)"}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            playClickSound(soundEnabled);
                            setIsWordViewerOpen(true);
                            setSettingsMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-3 p-2.5 hover:bg-amber-50 rounded-xl transition-colors text-left"
                        >
                          <Eye className="w-4 h-4 text-amber-500" />
                          <span className="text-sm font-bold text-amber-700">មើលបញ្ជីពាក្យ</span>
                        </button>
                      </>
                    )}

                    <button 
                      onClick={() => {
                        playClickSound(soundEnabled);
                        handlePrintClick();
                        setSettingsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 p-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left"
                    >
                      <Printer className="w-4 h-4 text-slate-600" />
                      <span className="text-sm font-medium text-slate-700">ទាញយក (Print)</span>
                    </button>
                  </div>
                </div>
              </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderWordCardCreator = () => {
    const displayedCards = wordCardCategoryFilter === "All" ? wordCards : wordCards.filter(c => c.category === wordCardCategoryFilter);

    return (
      <div className="w-full flex-grow flex flex-col xl:flex-row items-start justify-center gap-8 p-4 md:p-8 no-print animate-in fade-in duration-300 max-w-7xl mx-auto">
        <style>{`
          .word-card-range-input {
            -webkit-appearance: none;
            appearance: none;
            background: #e2e8f0;
            height: 8px;
            border-radius: 9999px;
            outline: none;
          }
          .word-card-range-input::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #f97316;
            cursor: pointer;
            border: 3px solid white;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            transition: transform 0.1s ease;
          }
          .word-card-range-input::-webkit-slider-thumb:hover {
            transform: scale(1.1);
          }
          .word-card-range-input::-webkit-slider-thumb:active {
            transform: scale(0.95);
          }
          .word-card-range-input::-moz-range-thumb {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #f97316;
            cursor: pointer;
            border: 3px solid white;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            transition: transform 0.1s ease;
          }
          .word-card-range-input::-moz-range-thumb:hover {
            transform: scale(1.1);
          }
          .word-card-range-input::-moz-range-thumb:active {
            transform: scale(0.95);
          }
        `}</style>
        
        {/* LEFT COLUMN: SETTING OPTIONS PANEL */}
        <div className="bg-white rounded-[2rem] p-6 sm:p-8 border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.03)] w-full xl:w-[400px] shrink-0 flex flex-col gap-6 text-slate-800">
          
          {/* Back to Home Button */}
          <div className="flex items-center">
            <button
              onClick={() => {
                playClickSound(soundEnabled);
                setActiveGameMode("home");
                setIsGameStarted(false);
              }}
              className="flex items-center gap-1.5 px-4.5 py-2.5 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all text-xs font-bold border border-slate-200 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>ទំព័រដើម</span>
            </button>
          </div>

          {/* Titles */}
          <div className="flex flex-col">
            <h2 className="text-2xl font-black text-slate-800 font-khmer tracking-tight leading-none mb-1">សន្លឹកបណ្ណពាក្យខ្មែរ (A4)</h2>
            <p className="text-xs text-slate-400 font-bold leading-relaxed">
              រៀបចំនិងបោះពុម្ពបណ្ណពាក្យ (Flashcards) យ៉ាងប្រណីត!
            </p>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Configuration Inputs */}
          <div className="flex flex-col gap-5">
            
            {/* Border choice select box */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-extrabold text-slate-600 block pl-0.5">ទម្រង់ស៊ុម (ម៉ាស៊ីន)៖</label>
              <div className="relative">
                <select
                  value={wordCardBorder}
                  onChange={(e) => {
                    playClickSound(soundEnabled);
                    setWordCardBorder(e.target.value as "classic" | "simple" | "custom");
                  }}
                  className="w-full bg-slate-50/50 border border-slate-200/60 hover:border-slate-300 rounded-2xl px-4 py-3.5 text-sm font-extrabold text-slate-700 cursor-pointer focus:outline-none appearance-none transition-all shadow-xs"
                >
                  <option value="classic">🏛️ ស៊ុម ២ជាន់</option>
                  <option value="simple">⬜ ស៊ុមមួយជាន់</option>
                  <option value="custom">🖼️ ស៊ុមពីរូបភាពផ្ទាល់ខ្លួន</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
              
              {wordCardBorder === "custom" && (
                <div className="mt-2 text-left flex flex-col gap-3">
                  <div className="max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {BUILT_IN_FRAMES.map((frame) => (
                        <button
                          key={frame.id}
                          type="button"
                          onClick={() => { playClickSound(soundEnabled); setWordCardCustomFrame(frame.dataUrl); }}
                          className={`p-2 border rounded-xl text-xs font-khmer font-bold flex flex-col items-center gap-1 transition-all ${
                            wordCardCustomFrame === frame.dataUrl 
                              ? "bg-indigo-50 border-indigo-400 text-indigo-700 ring-2 ring-indigo-200" 
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                          }`}
                        >
                          <div 
                            className="w-full h-10 rounded bg-indigo-50/50" 
                            style={{
                              backgroundImage: `url(${frame.dataUrl})`,
                              backgroundSize: '100% 100%',
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'center'
                            }}
                          />
                          {frame.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="relative flex items-center justify-center my-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <span className="relative bg-white px-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      ឬ
                    </span>
                  </div>

                  <label className="flex items-center justify-center w-full min-h-[80px] px-4 py-3 bg-indigo-50/50 border-2 border-dashed border-indigo-200 rounded-xl hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer transition-all">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span className="text-sm font-extrabold text-indigo-600 font-khmer">
                        {wordCardCustomFrame && !BUILT_IN_FRAMES.some(f => f.dataUrl === wordCardCustomFrame) ? "ប្ដូររូបភាពស៊ុមផ្ទាល់ខ្លួន" : "បញ្ចូលរូបភាពស៊ុម"}
                      </span>
                      {wordCardCustomFrame && !BUILT_IN_FRAMES.some(f => f.dataUrl === wordCardCustomFrame) ? (
                        <span className="text-[10px] text-indigo-500 font-bold">(មានរូបភាពរួចរាល់)</span>
                      ) : (
                        <span className="text-[10px] text-indigo-400 font-bold max-w-[80%] text-center mt-1">
                          ទំហំស៊ុមល្អបំផុត 200mm x 90mm (ឬ 2:1 Aspect Ratio) រក្សាគុណភាពពេលបោះពុម្ភ។
                        </span>
                      )}
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            setWordCardCustomFrame(event.target?.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Border thick slider */}
            {wordCardBorder !== "custom" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-600 flex justify-between px-0.5">
                  <span>កម្រាស់ស៊ុម៖</span>
                  <span className="text-slate-400 font-black">{wordCardBorderWidth}px</span>
                </label>
                <input
                  type="range"
                  min="2"
                  max="20"
                  value={wordCardBorderWidth}
                  onChange={(e) => setWordCardBorderWidth(Number(e.target.value))}
                  className="word-card-range-input w-full cursor-pointer"
                />
              </div>
            )}

            {/* Border rounding slider */}
            {wordCardBorder !== "custom" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-600 flex justify-between px-0.5">
                  <span>កោងឬជ្រុង៖</span>
                  <span className="text-slate-400 font-black">{wordCardBorderRadius}px</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="48"
                  value={wordCardBorderRadius}
                  onChange={(e) => setWordCardBorderRadius(Number(e.target.value))}
                  className="word-card-range-input w-full cursor-pointer"
                />
              </div>
            )}

            {/* Title Alignment Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-extrabold text-slate-600 block px-0.5">
                ទីតាំងប្រធានបទ៖
              </label>
              <div className="flex justify-between w-full h-[42px] p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => { playClickSound(soundEnabled); setWordCardTitleAlign("left"); }}
                  className={`flex-1 flex justify-center items-center text-xs font-bold rounded-lg transition-all ${
                    wordCardTitleAlign === "left" ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50/50"
                  }`}
                >
                  ឆ្វេង
                </button>
                <button
                  type="button"
                  onClick={() => { playClickSound(soundEnabled); setWordCardTitleAlign("center"); }}
                  className={`flex-1 flex justify-center items-center text-xs font-bold rounded-lg transition-all ${
                    wordCardTitleAlign === "center" ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50/50"
                  }`}
                >
                  កណ្ដាល
                </button>
                <button
                  type="button"
                  onClick={() => { playClickSound(soundEnabled); setWordCardTitleAlign("right"); }}
                  className={`flex-1 flex justify-center items-center text-xs font-bold rounded-lg transition-all ${
                    wordCardTitleAlign === "right" ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50/50"
                  }`}
                >
                  ស្ដាំ
                </button>
              </div>
            </div>

            {/* Font Family Input */}
            <div className="flex flex-col gap-1.5 line-clamp-1">
              <label className="text-xs font-extrabold text-slate-600 block px-0.5">
                ហ្វុងអក្សរ (Font Family)៖
              </label>
              <div className="relative">
                <select
                  value={wordCardFontFamily}
                  onChange={(e) => setWordCardFontFamily(e.target.value)}
                  className="w-full appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 focus:border-indigo-400 rounded-xl px-3 py-2 pr-8 text-xs font-medium text-slate-800 focus:outline-none transition-colors"
                >
                  <option value="'Khmer OS Muol Light', Moul, serif">Khmer OS Muol Light</option>
                  <option value="Moul, serif">Moul</option>
                  <option value="Battambang, sans-serif">Battambang</option>
                  <option value="'Kantumruy Pro', sans-serif">Kantumruy Pro</option>
                  <option value="Siemreap, sans-serif">Siemreap</option>
                  <option value="'Khmer OS System', sans-serif">Khmer OS System</option>
                  <option value="'Khmer OS Content', sans-serif">Khmer OS Content</option>
                  <option value="'Khmer OS Bokor', cursive">Khmer OS Bokor</option>
                  <option value="Chenla, sans-serif">Chenla</option>
                  <option value="Preahvihear, sans-serif">Preahvihear</option>
                  <option value="Suwannaphum, sans-serif">Suwannaphum</option>
                  <option value="system-ui, sans-serif">System Default</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Font Size slider */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-extrabold text-slate-600 flex justify-between px-0.5">
                <span>ទំហំអក្សរ (Size)៖</span>
                <span className="text-slate-400 font-black">{wordCardTextSize}px</span>
              </label>
              <input
                type="range"
                min="20"
                max="120"
                value={wordCardTextSize}
                onChange={(e) => setWordCardTextSize(Number(e.target.value))}
                className="word-card-range-input w-full cursor-pointer"
              />
            </div>

            {/* Segment Controls for style */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-extrabold text-slate-600 pl-0.5">រចនាប័ទ្មពណ៌៖</label>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/50">
                <button
                  onClick={() => {
                    playClickSound(soundEnabled);
                    setWordCardThemeMode("color");
                  }}
                  className={`text-center py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                    wordCardThemeMode === "color"
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-850"
                  }`}
                >
                  🎨 ចម្រុះពណ៌
                </button>
                <button
                  onClick={() => {
                    playClickSound(soundEnabled);
                    setWordCardThemeMode("bw");
                  }}
                  className={`text-center py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                    wordCardThemeMode === "bw"
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-850"
                  }`}
                >
                  ⚫ ស-ខ្មៅ
                </button>
                
                <div 
                  className={`relative flex items-center justify-center rounded-lg transition-all cursor-pointer select-none py-2 text-xs font-black ${
                    wordCardThemeMode === "single"
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-850"
                  }`}
                  onClick={() => {
                    playClickSound(soundEnabled);
                    setWordCardThemeMode("single");
                  }}
                >
                  <div className="flex items-center gap-1.5 justify-center w-full h-full">
                    <div className="relative w-4 h-4 rounded border border-slate-300 shadow-xs shrink-0 overflow-hidden" style={{ backgroundColor: wordCardSingleColor }}>
                      <input
                        type="color"
                        value={wordCardSingleColor}
                        onChange={(e) => {
                          setWordCardSingleColor(e.target.value);
                          setWordCardThemeMode("single");
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full p-0 border-0"
                      />
                    </div>
                    <span className="text-[10px] font-black font-khmer">ពណ៌តែ១</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Word list filter select dropdown */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-extrabold text-slate-600 block pl-0.5">ប្រភេទពាក្យ៖</label>
              <div className="relative">
                <select
                  value={wordCardCategoryFilter}
                  onChange={(e) => {
                    playClickSound(soundEnabled);
                    setWordCardCategoryFilter(e.target.value);
                  }}
                  className="w-full bg-slate-50/50 border border-slate-200/60 hover:border-slate-300 rounded-2xl px-4 py-3.5 text-sm font-extrabold text-[#475569] cursor-pointer focus:outline-none appearance-none transition-all shadow-xs animate-none"
                >
                  <option value="All">ទាំងអស់ (All)</option>
                  {Array.from(new Set(wordCards.map(c => c.category).filter(Boolean))).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

          </div>

          <div className="h-px bg-slate-150/50 my-1" />

          {/* Action Trigger Button */}
          <div className="flex flex-col">
            <button
              onClick={() => {
                playClickSound(soundEnabled);
                handlePrintClick();
              }}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-[0.98] text-white py-4 px-5 rounded-[1.25rem] font-black shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 flex items-center justify-center gap-2 text-base transition-all cursor-pointer font-khmer"
            >
              <Printer className="w-5 h-5 text-white" />
              <span>ទាញយក</span>
            </button>
          </div>

        </div>

        {/* RIGHT COLUMN: INTERACTIVE LIVE CARD LIST VIEW PREVIEW */}
        <div className="flex-grow w-full flex flex-col gap-5 self-stretch min-w-0 max-h-[85vh] xl:max-h-[calc(100vh-140px)] overflow-y-auto pr-2 custom-scrollbar">

          {/* Cards Grid List View */}
          {displayedCards.length === 0 ? (
            <div className="flex-grow flex flex-col items-center justify-center p-12 text-center rounded-3xl border border-dashed border-slate-200 bg-white/40 min-h-[300px]">
              <Search className="w-12 h-12 text-slate-300 mb-3" />
              <p className="font-extrabold text-sm text-slate-600 font-khmer">គ្មានបណ្ណពាក្យនៅក្នុងក្រុមឡើយ</p>
              <p className="text-xs text-slate-400 mt-1 font-khmer">សូមជ្រើសរើសក្រុមផ្សេង ឬវាយបញ្ចូលពាក្យថ្មីខាងលើ</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 pb-4">
              {displayedCards.map((card, idx) => {
                const displayColor = wordCardThemeMode === "bw" ? "#000000" : (wordCardThemeMode === "single" ? wordCardSingleColor : card.color);
                return (
                  <div 
                    key={card.id} 
                    className="w-full h-[260px] bg-white rounded-3xl shadow-sm flex flex-col justify-between relative group/item overflow-hidden transition-all hover:shadow-md"
                    style={{
                      ...(wordCardBorder === "custom" && wordCardCustomFrame ? {
                        backgroundImage: `url(${wordCardCustomFrame})`,
                        backgroundSize: '100% 100%',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center',
                        border: 'none',
                      } : {
                         border: '1px solid #f1f5f9'
                      })
                    }}
                  >
                    <div 
                      style={{ 
                        borderColor: wordCardBorder === "custom" ? "transparent" : displayColor, 
                        borderWidth: wordCardBorder === "custom" ? "0px" : `${Math.max(2, wordCardBorderWidth * 0.8)}px`, 
                        borderRadius: wordCardBorder === "custom" ? "0px" : `${Math.max(4, wordCardBorderRadius * 0.9)}px` 
                      }} 
                      className={`border-solid ${wordCardBorder === "classic" ? "p-2" : ""} h-full w-full`}
                    >
                      <div 
                        style={{ 
                          borderColor: wordCardBorder === "classic" ? displayColor : "transparent",
                          borderWidth: wordCardBorder === "classic" ? "1px" : "0px",
                          borderRadius: wordCardBorder === "custom" ? "0px" : `${Math.max(0, (wordCardBorderRadius * 0.9) - (wordCardBorder === "classic" ? 6 : 0))}px`
                        }} 
                        className={`border-solid ${wordCardBorder === "classic" ? "p-3" : "p-4"} h-full w-full flex flex-col justify-between relative ${wordCardBorder === "custom" ? "bg-transparent" : "bg-white"}`}
                      >
                        {/* Word content in card */}
                        <div className="flex-grow flex items-center justify-center py-2 h-full">
                          <input
                            type="text"
                            value={card.word}
                            onChange={(e) => {
                              const newWord = e.target.value;
                              setWordCards(prev => prev.map(c => c.id === card.id ? { ...c, word: newWord } : c));
                            }}
                            style={{ 
                              color: displayColor,
                              textShadow: wordCardThemeMode !== "bw" ? `2px 3px 5px rgba(0,0,0,0.08)` : "none",
                              fontFamily: wordCardFontFamily,
                              fontSize: `${Math.max(16, wordCardTextSize * 0.8)}px`,
                              fontWeight: wordCardFontFamily.toLowerCase().includes("moul") ? 400 : 900
                            }} 
                            className="text-center w-full focus:bg-slate-50 focus:outline-none rounded-xl py-1 px-3 border border-transparent focus:border-slate-100 transition-all font-khmer"
                            title="ចុចទីនេះដើម្បីផ្លាស់ប្ដូរពាក្យ"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    );
  };

  return (
    <div className={`${isImmersive ? "min-h-dvh md:h-dvh p-2 md:p-4 overflow-y-auto md:overflow-hidden" : "min-h-dvh py-6 px-4 md:px-8"} bg-blue-50/50 font-khmer text-slate-800 antialiased select-none flex flex-col justify-between`}>
      
      {isTimerOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 backdrop-blur-lg animate-in fade-in duration-200 p-4">
          <div className="bg-slate-900 rounded-3xl md:rounded-[2.5rem] shadow-2xl w-full max-h-[95vh] md:max-w-4xl overflow-y-auto border border-slate-800 flex flex-col overflow-x-hidden relative">
            <div className="bg-slate-950 border-b border-slate-800/80 p-4 md:p-6 text-white flex justify-between items-center shrink-0 relative overflow-hidden">
              <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none"></div>
              <h3 className="font-extrabold flex items-center gap-3 text-xl md:text-2xl relative z-10 text-slate-100">
                <Timer className="w-6 h-6 md:w-8 md:h-8 text-sky-400 animate-pulse" />
                នាឡិកាវាស់ពេល
              </h3>
              <button 
                onClick={() => {
                  playClickSound(soundEnabled);
                  setIsTimerOpen(false);
                }}
                className="text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-2xl transition-colors relative z-10"
              >
                <X className="w-7 h-7 md:w-8 md:h-8" />
              </button>
            </div>
            
            <div className="flex-grow p-6 md:p-10 flex flex-col items-center justify-center bg-slate-950">
              {isTimerActive ? (
                <div className="flex flex-col items-center justify-center w-full">
                  {/* Huge Immersive Stopwatch Face */}
                  <div className="relative w-[280px] h-[280px] sm:w-[350px] sm:h-[350px] md:w-[450px] md:h-[450px] flex items-center justify-center mb-8 md:mb-12 mx-auto shrink-0 shadow-[0_0_60px_rgba(14,165,233,0.15)] rounded-full border border-slate-805 bg-slate-950/40">
                    <svg viewBox="0 0 400 400" className="w-full h-full drop-shadow-2xl">
                      {/* Dark Outer Dial Base */}
                      <circle cx="200" cy="200" r="185" className="fill-slate-950 stroke-slate-800" strokeWidth="3" />
                      <circle cx="200" cy="200" r="178" className="fill-slate-950 stroke-slate-900" strokeWidth="1" />
                      
                      {/* Active Countdown/Countup Radial Progress Ring */}
                      <circle 
                        cx="200" cy="200" r="178" 
                        fill="none" 
                        strokeWidth="5" 
                        strokeLinecap="round" 
                        strokeDasharray="1118" 
                        strokeDashoffset={timerCountUp || timerMaxSeconds === 0 ? 0 : (1118 - (1118 * timerSeconds) / timerMaxSeconds || 0)} 
                        className={`transition-all duration-1000 linear ${timerSeconds <= 10 && !timerCountUp ? 'stroke-rose-500' : 'stroke-sky-500'}`}
                        transform="rotate(-90 200 200)"
                        style={{ filter: "drop-shadow(0 0 5px rgba(14,165,233,0.5))" }}
                      />

                      {/* Render Clock Face Dial Ticks and Labels dynamically */}
                      {timerCountUp && Array.from({ length: 60 }).map((_, i) => {
                        const angleDeg = i * 6;
                        const angleRad = ((angleDeg - 90) * Math.PI) / 180;
                        const isMajor = i % 5 === 0;
                        
                        const rOuter = 172;
                        const rInner = isMajor ? 158 : 166;
                        
                        const x1 = 200 + rOuter * Math.cos(angleRad);
                        const y1 = 200 + rOuter * Math.sin(angleRad);
                        const x2 = 200 + rInner * Math.cos(angleRad);
                        const y2 = 200 + rInner * Math.sin(angleRad);
                        
                        const rText = 140;
                        const tx = 200 + rText * Math.cos(angleRad);
                        const ty = 200 + rText * Math.sin(angleRad);
                        const label = i === 0 ? "60" : i.toString();

                        return (
                          <g key={`timer-tick-${i}`}>
                            <line
                              x1={x1}
                              y1={y1}
                              x2={x2}
                              y2={y2}
                              stroke={isMajor ? "#f8fafc" : "rgba(148, 163, 184, 0.3)"}
                              strokeWidth={isMajor ? "2.5" : "1"}
                            />
                            {isMajor && (
                              <text
                                x={tx}
                                y={ty + 4}
                                textAnchor="middle"
                                className="text-[12px] font-sans font-black fill-slate-400 select-none pointer-events-none"
                              >
                                {label}
                              </text>
                            )}
                          </g>
                        );
                      })}

                      {/* Small Beautiful Sub-dial at 200, 275 representing elapsed/running minutes */}
                      {timerCountUp && (
                        <>
                          <circle cx="200" cy="275" r="28" className="fill-transparent stroke-slate-800" strokeWidth="1" />
                          {Array.from({ length: 12 }).map((_, idx) => {
                            const angle = idx * 30;
                            const rad = ((angle - 90) * Math.PI) / 180;
                            const sx1 = 200 + 28 * Math.cos(rad);
                            const sy1 = 275 + 28 * Math.sin(rad);
                            const sx2 = 200 + (idx % 3 === 0 ? 22 : 25) * Math.cos(rad);
                            const sy2 = 275 + (idx % 3 === 0 ? 22 : 25) * Math.sin(rad);
                            return (
                              <line 
                                key={`sub-tick-${idx}`}
                                x1={sx1} y1={sy1} x2={sx2} y2={sy2}
                                stroke={idx % 3 === 0 ? "#94a3b8" : "#475569"}
                                strokeWidth={idx % 3 === 0 ? "1.5" : "1"}
                              />
                            );
                          })}
                          {(() => {
                            const subAngle = ((Math.floor(timerSeconds / 60) % 30) * 12) - 90;
                            const subAngleRad = (subAngle * Math.PI) / 180;
                            const subHandX = 200 + 21 * Math.cos(subAngleRad);
                            const subHandY = 275 + 21 * Math.sin(subAngleRad);
                            return (
                              <g>
                                <line x1="200" y1="275" x2={subHandX} y2={subHandY} className="stroke-sky-400 stroke-[1.5px]" strokeLinecap="round" />
                                <circle cx="200" cy="275" r="3.5" className="fill-sky-450" />
                                <circle cx="200" cy="275" r="1" className="fill-white" />
                              </g>
                            );
                          })()}
                        </>
                      )}

                      {/* Beautiful Mechanical/Electronic Sweep Second Hand pointing to seconds position */}
                      {timerCountUp && (() => {
                        const secondsAngle = ((timerSeconds % 60) * 6) - 90;
                        const handAngleRad = (secondsAngle * Math.PI) / 180;
                        const handX = 200 + 130 * Math.cos(handAngleRad);
                        const handY = 200 + 130 * Math.sin(handAngleRad);
                        return (
                          <g>
                            <line 
                              x1="200" 
                              y1="200" 
                              x2={handX} 
                              y2={handY} 
                              className="stroke-sky-500 stroke-[2px]" 
                              strokeLinecap="round" 
                              style={{ filter: "drop-shadow(0 0 3px rgba(14,165,233,0.8))" }}
                            />
                            {/* Sweeping hand tail pivot accent overlay */}
                            <circle cx="200" cy="200" r="7.5" className="fill-sky-500" style={{ filter: "drop-shadow(0 0 4px rgba(14,165,233,0.8))" }} />
                            <circle cx="200" cy="200" r="2" className="fill-white" />
                          </g>
                        );
                      })()}
                    </svg>

                    {/* Futuristic center digital time overlay inside the circular block */}
                    <div className="absolute flex flex-col items-center justify-center select-none pointer-events-none">
                      <div className="text-[2.6rem] sm:text-[3.2rem] md:text-[4.2rem] font-sans font-black tracking-normal tabular-nums leading-none flex items-center">
                        {timerCountUp ? (
                          <>
                            <span className="text-slate-100">
                              {Math.floor(timerSeconds / 60).toString().padStart(2, '0')}:
                              {Math.floor(timerSeconds % 60).toString().padStart(2, '0')}.
                            </span>
                            <span className="text-sky-400 drop-shadow-[0_0_10px_rgba(56,189,248,0.75)]">
                              {Math.floor((timerSeconds % 1) * 100).toString().padStart(2, '0')}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-slate-100">
                              {Math.floor(timerSeconds / 3600).toString().padStart(2, '0')}:
                              {Math.floor((timerSeconds % 3600) / 60).toString().padStart(2, '0')}:
                            </span>
                            <span className="text-sky-400 drop-shadow-[0_0_10px_rgba(56,189,248,0.75)]">
                              {Math.floor(timerSeconds % 60).toString().padStart(2, '0')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Timer Controls with Neon/Slate aesthetic */}
                  <div className="flex items-center gap-6">
                    <button
                      onClick={() => {
                        playClickSound(soundEnabled);
                        setTimerRunning(!timerRunning)
                      }}
                      className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 ${
                        timerRunning 
                          ? "bg-slate-900 text-rose-500 border-2 border-slate-800 hover:bg-slate-800 hover:border-slate-700/80 [filter:drop-shadow(0_0_15px_rgba(244,63,94,0.15))]" 
                          : "bg-sky-500 text-white hover:bg-sky-400 [filter:drop-shadow(0_0_15px_rgba(14,165,233,0.35))]"
                      }`}
                    >
                      {timerRunning ? <Pause className="w-8 h-8 md:w-10 md:h-10 fill-rose-500" /> : <Play className="w-8 h-8 md:w-10 md:h-10 fill-white translate-x-1" />}
                    </button>
                    <button
                      onClick={() => {
                        playClickSound(soundEnabled);
                        setTimerRunning(false);
                        setTimerSeconds(timerCountUp ? 0 : timerMaxSeconds);
                      }}
                      className="w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-all shadow-md active:scale-95"
                      title="កំណត់ឡើងវិញ"
                    >
                      <RotateCcw className="w-6 h-6 md:w-7 md:h-7 text-slate-400" />
                    </button>
                    <button
                      onClick={() => {
                        playClickSound(soundEnabled);
                        setTimerRunning(false);
                        setIsTimerActive(false);
                      }}
                      className="w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-all shadow-md active:scale-95"
                      title="ថយក្រោយ"
                    >
                      <X className="w-6 h-6 md:w-7 md:h-7 text-slate-400" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto py-6">
                  <Timer className="w-16 h-16 md:w-20 md:h-20 text-sky-400 mb-4 drop-shadow-[0_0_10px_rgba(56,189,248,0.35)]" />
                  <h2 className="text-xl md:text-3xl font-extrabold text-slate-100 mb-3 text-center">កំណត់ពេលវេលា</h2>
                  <p className="text-sm md:text-base text-slate-400 mb-8 text-center">បញ្ចូលម៉ោង នាទី និងវិនាទី (ឧទាហរណ៍ ០០:០៥:០០)</p>
                  
                  <div className="bg-slate-900 p-6 md:p-8 rounded-3xl md:rounded-[2rem] border border-slate-800 w-full mb-8 text-center relative shadow-2xl">
                    <input
                      type="text"
                      value={timerInputStr}
                      onChange={(e) => {
                        let val = e.target.value.replace(/[^0-9:]/g, '');
                        if ((val.length === 2 || val.length === 5) && !val.endsWith(':') && timerInputStr.length < val.length) {
                           val += ':';
                        }
                        if (val.length <= 8) setTimerInputStr(val);
                      }}
                      onBlur={() => {
                        const parts = timerInputStr.split(':').filter(Boolean);
                        let h = 0, m = 5, s = 0;
                        if (parts.length === 1) {
                          m = parseInt(parts[0]) || 5;
                        } else if (parts.length === 2) {
                          m = parseInt(parts[0]) || 0;
                          s = parseInt(parts[1]) || 0;
                        } else if (parts.length >= 3) {
                          h = parseInt(parts[0]) || 0;
                          m = parseInt(parts[1]) || 0;
                          s = parseInt(parts[2]) || 0;
                        }
                        setTimerInputStr(
                          `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
                        );
                      }}
                      placeholder="00:05:00"
                      className="w-full sm:w-64 md:w-80 text-center text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold font-mono text-sky-400 bg-slate-950/80 border-4 border-slate-800 rounded-3xl py-4 focus:outline-none focus:border-sky-500 focus:bg-slate-950 transition-all drop-shadow-sm placeholder:text-slate-800"
                    />
                  </div>

                  <div className="flex flex-wrap justify-center gap-2 md:gap-3 mb-8">
                    {[1, 3, 5, 10, 15, 30].map(min => (
                      <button 
                        key={`preset-${min}`}
                        onClick={() => {
                          playClickSound(soundEnabled);
                          setTimerInputStr(`00:${min.toString().padStart(2, '0')}:00`);
                        }}
                        className="px-4 py-2 md:px-6 md:py-3 bg-slate-900 border-2 border-slate-800 text-slate-300 rounded-2xl text-base md:text-xl font-bold hover:bg-slate-800 hover:border-sky-500 hover:text-sky-400 shadow-sm active:scale-95 transition-all"
                      >
                        {min} នាទី
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg justify-center">
                    <button
                      onClick={() => {
                        playClickSound(soundEnabled);
                        let hrs = 0;
                        let mins = 5;
                        let secs = 0;
                        if (timerInputStr.includes(':')) {
                           const parts = timerInputStr.split(':');
                           if (parts.length === 3) {
                             hrs = parseInt(parts[0] || '0');
                             mins = parseInt(parts[1] || '0');
                             secs = parseInt(parts[2] || '0');
                           } else if (parts.length === 2) {
                             mins = parseInt(parts[0] || '0');
                             secs = parseInt(parts[1] || '0');
                           } else {
                             mins = parseInt(parts[0] || '5');
                           }
                        } else {
                           mins = parseInt(timerInputStr || '5');
                        }
                        if (isNaN(hrs)) hrs = 0;
                        if (isNaN(mins)) mins = 5;
                        if (isNaN(secs)) secs = 0;
                        
                        const totalSecs = (hrs * 3600) + (mins * 60) + secs;
                        const finalSecs = totalSecs > 0 ? totalSecs : 300;
                        setTimerMaxSeconds(finalSecs);
                        setTimerSeconds(finalSecs);
                        setTimerCountUp(false);
                        setTimerRunning(true);
                        setIsTimerActive(true);
                      }}
                      className="bg-sky-500 text-white hover:bg-sky-400 font-extrabold text-lg md:text-xl py-4 px-6 md:py-5 md:px-8 rounded-3xl shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-3 w-full"
                    >
                      <Play className="w-5 h-5 md:w-6 md:h-6 fill-white" />
                      រាប់ថយក្រោយ
                    </button>
                    
                    <button
                      onClick={() => {
                        playClickSound(soundEnabled);
                        setTimerMaxSeconds(0);
                        setTimerSeconds(0);
                        setTimerCountUp(true);
                        setTimerRunning(true);
                        setIsTimerActive(true);
                      }}
                      className="bg-slate-800 border-2 border-slate-705 hover:bg-slate-700 text-slate-100 font-extrabold text-lg md:text-xl py-4 px-6 md:py-5 md:px-8 rounded-3xl shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-3 w-full"
                    >
                      <Play className="w-5 h-5 md:w-6 md:h-6 fill-white" />
                      រាប់ទៅមុខ
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Slot Machine Modal */}
      {isSlotMachineOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white animate-in fade-in duration-300">
          <div className="w-full h-full relative flex flex-col items-center justify-center overflow-hidden">
            {/* Top Toolbar */}
            <div className="absolute top-4 left-4 right-4 z-[110] flex items-center justify-between">
              <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
                <ArrowUpDown className="w-5 h-5 text-indigo-500" />
                <span className="font-bold text-slate-700">ល្បែងអានពាក្យ</span>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    playClickSound(soundEnabled);
                    setIsLuckyBoxListOpen(true);
                  }}
                  className="p-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 shadow-sm transition-all active:scale-95 flex items-center gap-2"
                >
                  <List className="w-5 h-5 text-indigo-500" />
                  <span className="hidden sm:inline font-bold">បញ្ជីឈ្មោះ</span>
                </button>
                <button 
                  onClick={() => {
                    playClickSound(soundEnabled);
                    setIsLuckyBoxSettingsOpen(true);
                  }}
                  className="p-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 shadow-sm transition-all active:scale-95 flex items-center gap-2"
                >
                  <Settings className="w-5 h-5 text-amber-500" />
                  <span className="hidden sm:inline font-bold">ការកំណត់</span>
                </button>
                <button 
                  onClick={() => setIsSlotMachineOpen(false)}
                  className="p-3 rounded-2xl bg-white hover:bg-rose-50 border border-slate-200 text-slate-400 hover:text-rose-500 shadow-sm transition-all active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-grow flex flex-col items-center justify-center w-full max-w-2xl mt-16 px-4">
              {studentList.length === 0 ? (
                <div className="text-center p-8 bg-amber-50 rounded-2xl border border-amber-200 text-amber-700 w-full mb-8">
                  <p className="font-bold mb-2">បញ្ជីឈ្មោះទទេ!</p>
                  <p className="text-sm">សូមបញ្ចូលឈ្មោះសិស្សក្នុងចំណុច "បញ្ជីឈ្មោះ" ជាមុនសិន។</p>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center gap-8 mb-16">
                  <div className="w-48 h-48 md:w-64 md:h-64 bg-indigo-50/50 rounded-[3rem] md:rounded-[4rem] flex items-center justify-center mb-4 border-[8px] border-indigo-100/50 shadow-inner">
                     <ArrowUpDown className="w-24 h-24 md:w-32 md:h-32 text-indigo-300 transform -rotate-12" />
                  </div>

                  <button
                    onClick={startSlotMachine}
                    disabled={slotMachineSpinning || studentList.length === 0}
                    className="w-full max-w-sm flex text-2xl md:text-3xl items-center justify-center gap-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-6 px-8 rounded-[2.5rem] shadow-[0_12px_40px_rgba(0,0,0,0.18)] transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none disabled:transform-none mt-8 group"
                  >
                    <ArrowUpDown className="w-8 h-8 md:w-10 md:h-10 group-hover:scale-110 transition-transform" />
                    ចាប់ផ្ដើម
                  </button>
                  
                  <p className="text-center text-slate-500 text-base md:text-lg font-bold mt-4">
                    មានឈ្មោះសរុប <span className="font-extrabold text-indigo-600">{studentList.length}</span> ក្នុងបញ្ជី
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Winner and Spinning Modal Backdrop Overlay */}
          {(slotMachineSpinning || slotMachineWinner) && (
            <div className="absolute inset-0 z-[120] bg-slate-900/60 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-300 pointer-events-auto">
               <div className="bg-white rounded-[40px] shadow-2xl p-8 md:p-12 max-w-[95vw] md:max-w-6xl w-full mx-4 transform animate-in zoom-in bounce-in duration-300 text-center relative overflow-hidden flex flex-col">
                  <div className="absolute top-0 left-0 w-full h-3 bg-indigo-500" />
                  
                  <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6 shrink-0">
                      <Trophy className={`w-12 h-12 text-amber-500 ${slotMachineSpinning ? 'animate-bounce' : ''}`} />
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-slate-400 mb-6 uppercase tracking-widest shrink-0">
                    {slotMachineSpinning ? 'កំពុងចាប់...' : 'ពាក្យរបស់អ្នកគឺ'}
                  </h3>
                  
                  <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-[32px] p-8 md:p-16 mb-8 shadow-inner flex-grow flex items-center justify-center min-h-[16rem]">
                    <p 
                      key={`${slotMachineWord}-${slotMachineSpinning ? 'spin' : 'stop'}`}
                      className={`text-5xl md:text-7xl lg:text-8xl xl:text-[7rem] font-black font-khmer text-indigo-600 break-words leading-tight px-4 drop-shadow-sm ${slotMachineSpinning ? 'animate-in fade-in slide-in-from-top-2 duration-75' : 'animate-in zoom-in-75 duration-300 scale-110'}`}
                    >
                      {slotMachineSpinning ? slotMachineWord : slotMachineWinner}
                    </p>
                  </div>
                  
                  {!slotMachineSpinning && slotMachineWinner && (
                    <div className="flex flex-col gap-3 w-full max-w-lg mx-auto px-2 shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <button 
                        onClick={removeSlotMachineWinner}
                        className="w-full bg-rose-50 text-rose-600 border border-rose-100 font-bold py-4 md:py-5 px-6 rounded-2xl md:rounded-3xl hover:bg-rose-100 transition-all flex items-center justify-center gap-3 active:scale-95 text-lg md:text-xl"
                      >
                        <UserMinus className="w-6 h-6 md:w-7 md:h-7" />
                        ដកចេញពីបញ្ជី
                      </button>
                      <button 
                        onClick={() => setSlotMachineWinner(null)}
                        className="w-full bg-slate-900 border border-slate-900 text-white font-bold py-4 md:py-5 px-6 rounded-2xl md:rounded-3xl hover:bg-slate-800 transition-all active:scale-95 mt-2 text-lg md:text-xl"
                      >
                        បិទ
                      </button>
                    </div>
                  )}
                  
               </div>
            </div>
          )}
        </div>
      )}

      {/* Lucky Box and Slot Machine Lists / Settings Modals (Shared) */}
      {isLuckyBoxListOpen && (
        <div className="fixed inset-0 z-[120] bg-white/95 backdrop-blur-xl animate-in slide-in-from-left duration-300 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl border border-slate-100 flex flex-col p-8 animate-in zoom-in-95 duration-200">
             <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
                    <List className="w-7 h-7 text-indigo-600" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800">បញ្ជីឈ្មោះសម្រាប់បង្វិល</h3>
                </div>
                <button 
                  onClick={() => setIsLuckyBoxListOpen(false)} 
                  className="p-3 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
             </div>

             <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-6 ml-1">បញ្ចូលដោយដៃ ឬជ្រើសរើសពីបញ្ជី</p>
             
             <div className="mb-6 space-y-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-slate-600 ml-1 flex items-center gap-2">
                    <ChevronDown className="w-4 h-4 text-indigo-400" />
                    ជ្រើសរើសតាមប្រភេទ (Select Category)
                  </label>
                  <select 
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "all") {
                        setStudentInput(challenges.map(c => c.word).join("\n"));
                      } else if (val !== "") {
                        const filtered = challenges.filter(c => (c.category || "ពាក្យដែលបានបញ្ចូល") === val);
                        setStudentInput(filtered.map(c => c.word).join("\n"));
                      }
                      playClickSound(soundEnabled);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-700 font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">-- សូមជ្រើសរើសក្រុមពាក្យ --</option>
                    <option value="all">🔍 បង្ហាញទាំងអស់ ({challenges.length} ពាក្យ)</option>
                    <optgroup label="ក្រុមពាក្យដែលបានបញ្ចូល (Entered Groups)">
                      {Array.from(new Set(challenges.map(c => c.category || "ពាក្យដែលបានបញ្ចូល"))).map((catName) => (
                        <option key={catName} value={catName}>📁 {catName} ({challenges.filter(c => (c.category || "ពាក្យដែលបានបញ្ចូល") === catName).length} ពាក្យ)</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
                      <PlusCircle className="w-4 h-4 text-emerald-500" />
                      បញ្ជីឈ្មោះ/ពាក្យ (Manual Input)
                    </label>
                    <div>
                      <input 
                        type="file" 
                        accept=".xlsx, .xls" 
                        onChange={handleStudentImport} 
                        style={{ display: "none" }} 
                        id="student-excel-upload-luckybox" 
                      />
                      <label 
                        htmlFor="student-excel-upload-luckybox" 
                        className="cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all border border-emerald-200"
                      >
                        <Download className="w-4 h-4" />
                        ទាញចូលពី Excel
                      </label>
                    </div>
                  </div>
                  <textarea 
                    value={studentInput}
                    onChange={(e) => setStudentInput(e.target.value)}
                    placeholder="បញ្ចូលឈ្មោះសិស្ស ឬពាក្យក្នុងមួយជួរ..."
                    className="h-64 bg-slate-50 border border-slate-200 rounded-3xl p-6 text-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 resize-none shadow-inner leading-relaxed text-slate-700 font-khmer transition-all"
                  />
                </div>
             </div>

            <button 
              onClick={() => {
                updateStudentList();
                setIsLuckyBoxListOpen(false);
                playSuccessSound(soundEnabled);
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4.5 rounded-3xl shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-3 text-lg"
            >
              <RotateCcw className="w-6 h-6" />
              យល់ព្រមតាមការជ្រើសរើស
            </button>
          </div>
        </div>
      )}

      {isLuckyBoxSettingsOpen && (
        <div className="fixed inset-0 z-[120] bg-white/95 backdrop-blur-xl animate-in fade-in duration-300 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl border border-slate-100 flex flex-col p-8 animate-in zoom-in-95 duration-200">
             <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
                    <Settings className="w-7 h-7 text-amber-600" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800">ការកំណត់</h3>
                </div>
                <button 
                  onClick={() => setIsLuckyBoxSettingsOpen(false)} 
                  className="p-3 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
             </div>
             
             <div className="space-y-8">
               {/* Font Size */}
               <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-inner">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-bold text-slate-700">ទំហំអក្សរឈ្មោះ</span>
                    <span className="text-indigo-600 font-black bg-white px-3 py-1 rounded-xl border border-indigo-100">{wheelFontSize}px</span>
                  </div>
                  <input 
                    type="range" min="8" max="48" value={wheelFontSize}
                    onChange={(e) => setWheelFontSize(parseInt(e.target.value))}
                    className="w-full h-3 bg-white border border-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <div className="flex justify-between mt-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    <span>តូច</span>
                    <span>ធំ</span>
                  </div>
               </div>
             </div>

             <button 
              onClick={() => setIsLuckyBoxSettingsOpen(false)} 
              className="mt-10 w-full bg-slate-900 text-white font-black py-4.5 rounded-2xl transition-all active:scale-95 shadow-lg shadow-slate-100"
             >
               យល់ព្រម
             </button>
          </div>
        </div>
      )}

      {/* Team Generator Modal */}
      {isTeamGenOpen && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-h-[95vh] md:max-w-4xl overflow-y-auto border border-slate-200 flex flex-col overflow-x-hidden relative">
            <div className="bg-sky-600 p-4 md:p-6 text-white flex justify-between items-center shrink-0 relative overflow-hidden">
              <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none"></div>
              <h3 className="font-extrabold flex items-center gap-3 text-xl md:text-2xl relative z-10 font-khmer">
                <Users className="w-6 h-6 md:w-8 md:h-8 text-sky-200" />
                បែងចែកក្រុមសិស្ស
              </h3>
              <button 
                onClick={() => {
                  playClickSound(soundEnabled);
                  setIsTeamGenOpen(false);
                }}
                className="text-white hover:bg-white/20 p-2 rounded-2xl transition-colors relative z-10"
              >
                <X className="w-7 h-7 md:w-8 md:h-8" />
              </button>
            </div>
            
            <div className="flex-grow p-6 md:p-10 flex flex-col items-center justify-start bg-slate-50/50 min-h-[50vh]">
              <div className="w-full max-w-3xl space-y-6">
                
                {/* Controls */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <label className="font-bold text-slate-700">ចំនួនក្រុមប្រាថ្នា៖</label>
                    <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1">
                      {[2, 3, 4, 5, 6].map(num => (
                        <button
                          key={`team-count-${num}`}
                          onClick={() => {
                            playClickSound(soundEnabled);
                            setTeamCount(num);
                          }}
                          className={`w-10 h-10 rounded-lg font-bold text-lg transition-all ${teamCount === num ? 'bg-sky-500 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200'}`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <button
                    onClick={generateTeams}
                    disabled={studentList.length === 0}
                    className="flex text-lg items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-8 rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"
                  >
                    <Users className="w-6 h-6" />
                    ចាប់ផ្ដើមបែងចែក
                  </button>
                </div>

                {/* Info Note & Edit */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    {studentList.length === 0 ? (
                      <p className="font-bold text-amber-600">គ្មានបញ្ជីឈ្មោះសិស្សទេ!</p>
                    ) : (
                      <p className="text-slate-500 text-sm font-bold">
                        មានសិស្សសរុប <span className="font-extrabold text-sky-600 text-lg">{toKhmerNumeral(studentList.length)}</span> នាក់ក្នុងបញ្ជី
                      </p>
                    )}
                    
                    <button
                      onClick={() => {
                        playClickSound(soundEnabled);
                        if (!isTeamGenEditOpen) {
                          setStudentInput(studentList.join("\n"));
                        }
                        setIsTeamGenEditOpen(!isTeamGenEditOpen);
                        setGeneratedTeams([]);
                      }}
                      className="text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl transition-all"
                    >
                      {isTeamGenEditOpen ? "បោះបង់ការកែប្រែ" : "កែប្រែបញ្ជីឈ្មោះសិស្ស"}
                    </button>
                  </div>

                  {isTeamGenEditOpen ? (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex justify-between items-center mb-3">
                        <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
                          បញ្ជីឈ្មោះ (Manual Input)
                        </label>
                        <div>
                          <input 
                            type="file" 
                            accept=".xlsx, .xls" 
                            onChange={handleStudentImport} 
                            style={{ display: "none" }} 
                            id="student-excel-upload-team" 
                          />
                          <label 
                            htmlFor="student-excel-upload-team" 
                            className="cursor-pointer bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all border border-sky-200"
                          >
                            <Download className="w-4 h-4" />
                            ទាញចូលពី Excel
                          </label>
                        </div>
                      </div>
                      <textarea
                        value={studentInput}
                        onChange={(e) => setStudentInput(e.target.value)}
                        placeholder="បញ្ចូលឈ្មោះសិស្សម្នាក់ក្នុងមួយជួរ..."
                        className="w-full h-48 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-base focus:outline-none focus:ring-4 focus:ring-sky-500/10 resize-none shadow-inner leading-relaxed text-slate-700 font-khmer transition-all mb-4"
                      />
                      <button
                        onClick={() => {
                          playClickSound(soundEnabled);
                          applyTeamGenEdit();
                        }}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-sm transition-all"
                      >
                        រក្សាទុកបញ្ជីថ្មី
                      </button>
                    </div>
                  ) : (
                    studentList.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4 max-h-48 overflow-y-auto p-2 border border-slate-100 rounded-xl bg-slate-50">
                        {studentList.map((student, idx) => (
                          <div key={`student-chip-${idx}`} className="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm">
                            {student}
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>

                {/* Results */}
                {generatedTeams.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                    {generatedTeams.map((team, idx) => (
                      <div key={`team-${idx}`} className="bg-white border-[3px] border-sky-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow animate-in zoom-in duration-300" style={{animationDelay: `${idx * 100}ms`}}>
                        <div className="bg-sky-100 py-3 px-4 flex justify-between items-center border-b-[3px] border-sky-100">
                          <h4 className="font-bold text-sky-800 text-lg">ក្រុមទី {toKhmerNumeral(idx + 1)}</h4>
                          <span className="bg-white text-sky-600 text-xs font-bold px-2 py-1 rounded-md shadow-sm">
                            {toKhmerNumeral(team.length)} នាក់
                          </span>
                        </div>
                        <div className="p-4 bg-white">
                          <ul className="space-y-2">
                            {team.map((member, i) => (
                              <li key={`member-${idx}-${i}`} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors">
                                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold shrink-0">
                                  {toKhmerNumeral(i + 1)}
                                </span>
                                <span className="font-khmer text-slate-800 font-medium">{member}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lucky Box Modal */}
      {isLuckyBoxOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white animate-in fade-in duration-300">
          <div className="w-full h-full relative flex flex-col items-center justify-center overflow-hidden">
            
            {/* Top Toolbar */}
            <div className="absolute top-4 left-4 right-4 z-[110] flex items-center justify-between">
              <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
                <Dice5 className="w-5 h-5 text-indigo-500" />
                <span className="font-bold text-slate-700">កងបង្វិលសំណាង</span>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    playClickSound(soundEnabled);
                    setIsLuckyBoxListOpen(true);
                  }}
                  className="p-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 shadow-sm transition-all active:scale-95 flex items-center gap-2"
                >
                  <List className="w-5 h-5 text-indigo-500" />
                  <span className="hidden sm:inline font-bold">បញ្ជីឈ្មោះ</span>
                </button>
                <button 
                  onClick={() => {
                    playClickSound(soundEnabled);
                    setIsLuckyBoxSettingsOpen(true);
                  }}
                  className="p-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 shadow-sm transition-all active:scale-95 flex items-center gap-2"
                >
                  <Settings className="w-5 h-5 text-amber-500" />
                  <span className="hidden sm:inline font-bold">ការកំណត់</span>
                </button>
                <button 
                  onClick={() => setIsLuckyBoxOpen(false)}
                  className="p-3 rounded-2xl bg-white hover:bg-rose-50 border border-slate-200 text-slate-400 hover:text-rose-500 shadow-sm transition-all active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>


            {/* Main Wheel Area */}
            <div className="w-full h-full flex flex-col items-center justify-center p-4 pt-16">
              
              {/* Success Result Display (Floating above wheel) */}
              <div className={`mb-6 text-2xl md:text-4xl font-black text-indigo-600 transition-all duration-500 h-16 flex items-center justify-center text-center px-4 leading-tight ${winningStudent && !isSpinning ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`}>
                {winningStudent && (
                  <div className="bg-indigo-50 px-8 py-3 rounded-3xl border border-indigo-100 shadow-sm">
                    🎉 អបអរសាទរ: {winningStudent}
                  </div>
                )}
              </div>

              <div className="relative flex items-center justify-center w-[min(95vw,82vh)] aspect-square">
                {/* Pointer */}
                <div className="absolute -top-4 md:-top-6 z-20 flex flex-col items-center drop-shadow-lg pointer-events-none">
                    <div className="w-8 h-8 md:w-12 md:h-12 bg-indigo-600 rounded-full flex items-center justify-center border-4 border-white shadow-md">
                        <div className="w-3 h-3 md:w-4 md:h-4 bg-white rounded-full"></div>
                    </div>
                    <div className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[25px] md:border-t-[35px] border-t-indigo-600 -mt-1"></div>
                </div>

                <canvas 
                  ref={canvasRef} 
                  width={1000} 
                  height={1000} 
                  className="w-full h-full drop-shadow-[0_30px_60px_rgba(0,0,0,0.12)] rounded-full border-4 border-slate-50 bg-white"
                />

                {/* Center Spin Button */}
                <button 
                  onClick={startSpin}
                  disabled={isSpinning || studentList.length === 0}
                  className="absolute z-10 w-24 h-24 md:w-32 md:h-32 bg-white rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.18)] flex items-center justify-center cursor-pointer border-[10px] md:border-[12px] border-slate-50 hover:scale-105 active:scale-95 transition-transform duration-200 disabled:opacity-50 group"
                >
                  <div className={`w-10 h-10 md:w-14 md:h-14 bg-indigo-600 rounded-full shadow-inner ring-4 ring-indigo-200 transition-transform ${isSpinning ? "scale-90" : "group-hover:scale-110"}`} />
                </button>
              </div>

              {/* Instructions */}
              {!winningStudent && !isSpinning && (
                <p className="mt-8 text-slate-400 text-sm md:text-base font-bold animate-pulse uppercase tracking-widest text-center px-4">
                  សូមចុចប៊ូតុងកណ្ដាលដើម្បីបង្វិលផ្សងសំណាង
                </p>
              )}
            </div>
          </div>

          {/* Winner Modal Backdrop Overlay */}
          {winningStudent && !isSpinning && (
            <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300 pointer-events-auto">
               <div className="bg-white rounded-[40px] shadow-2xl p-10 max-w-[95vw] md:max-w-6xl w-full mx-4 transform animate-in zoom-in bounce-in duration-500 text-center relative overflow-hidden flex flex-col">
                  <div className="absolute top-0 left-0 w-full h-2 bg-indigo-500" />
                  <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6 shrink-0">
                      <Trophy className="w-12 h-12 text-amber-500" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-400 mb-4 uppercase tracking-widest shrink-0">ពាក្យរបស់អ្នកគឺ</h3>
                  <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-[32px] p-8 mb-8 shadow-inner flex-grow flex items-center justify-center min-h-[16rem]">
                    <p className="text-5xl md:text-7xl lg:text-8xl xl:text-[7rem] font-black text-indigo-600 break-words leading-tight px-4 drop-shadow-sm animate-in zoom-in-75 duration-300  scale-110">{winningStudent}</p>
                  </div>
                  
                  <div className="flex flex-col gap-3 w-full max-w-lg mx-auto px-2 shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <button 
                      onClick={removeWinningStudent}
                      className="w-full bg-rose-50 text-rose-600 border border-rose-100 font-bold py-4 px-6 rounded-2xl hover:bg-rose-100 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                      <UserMinus className="w-5 h-5" />
                      ដកចេញពីបញ្ជី
                    </button>
                    <button 
                      onClick={() => {
                        playClickSound(soundEnabled);
                        setWinningStudent(null);
                      }}
                      className="w-full bg-slate-900 text-white font-bold py-4 px-6 rounded-2xl hover:bg-slate-800 transition-all shadow-lg active:scale-95 text-lg"
                    >
                      បិទ
                    </button>
                  </div>
               </div>
            </div>
          )}
        </div>
      )}

      {/* If Game is NOT started, render the HOMEPAGE */}
      {!isGameStarted ? (
        <div className="max-w-5xl w-full mx-auto flex-grow flex flex-col justify-center py-6 md:py-10 no-print animate-in fade-in duration-300 relative">
          
          {/* Quick Settings Floating for Homepage */}
          <div className="absolute top-0 right-0 p-2 flex items-center gap-2">
            {deferredPrompt && (
              <button 
                onClick={promptInstall}
                className="p-3 rounded-2xl border border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100 transition-all shadow-sm active:scale-95 flex items-center gap-2 font-bold"
                title="ដំឡើងកម្មវិធី"
              >
                <MonitorSmartphone className="w-5 h-5" />
                <span className="hidden sm:inline">ដំឡើង</span>
              </button>
            )}
            <button 
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-3 rounded-2xl border border-slate-200 bg-white/70 backdrop-blur-md text-slate-600 hover:bg-white transition-all shadow-sm active:scale-95"
              title="បិទ/បើកសម្លេង"
            >
              {soundEnabled ? <Volume2 className="w-5 h-5 text-indigo-600" /> : <VolumeX className="w-5 h-5 text-slate-400" />}
            </button>
            <button 
              onClick={toggleFullscreenMode}
              className="p-3 rounded-2xl border border-slate-200 bg-white/70 backdrop-blur-md text-slate-600 hover:bg-white transition-all shadow-sm active:scale-95"
              title="ពង្រីក/បង្រួមអេក្រង់"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5 text-indigo-600" /> : <Maximize2 className="w-5 h-5 text-indigo-600" />}
            </button>
          </div>
          
          {/* Top Custom Header */}
          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100/50 uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5 text-yellow-500 fill-yellow-400 animate-bounce" />
              កម្មវិធីអប់រំនិងកម្សាន្តកុមារ
            </span>
            <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
              ល្បែងផ្គុំពាក្យខ្មែរ
            </h1>
            <p className="text-xs md:text-sm text-slate-500 mt-2 max-w-xl mx-auto leading-relaxed">
              របកគំហើញថ្មីសម្រាប់បង្កើនការអាន ស្គាល់អត្ថន័យ និងការសរសេរដៃតាមតម្រុយអំណានភាសាខ្មែរយ៉ាងរហ័ស!
            </p>
          </div>

          {activeGameMode === "home" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5 max-w-6xl mx-auto mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Card 1: Add Word */}
              <button 
                type="button"
                onClick={() => {
                  playClickSound(soundEnabled);
                  setIsPlaylistModalOpen(true);
                }}
                className="bg-white/80 hover:bg-white border-2 border-slate-200/60 hover:border-indigo-400 rounded-3xl p-4 md:p-6 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-all hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] group backdrop-blur-sm"
              >
                <div className="w-12 h-12 md:w-16 md:h-16 bg-indigo-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform group-hover:rotate-3">
                  <Plus className="w-6 h-6 md:w-9 md:h-9 text-indigo-500" />
                </div>
                <div>
                  <h3 className="text-sm md:text-lg font-extrabold text-slate-800">បញ្ចូលពាក្យ</h3>
                  <p className="hidden md:block text-[11px] text-slate-500 mt-1">បន្ថែមបញ្ជីពាក្យថ្មីៗសម្រាប់កុមារ</p>
                </div>
              </button>
 
              {/* Card 2: Spelling Game */}
              <button 
                type="button"
                onClick={() => {
                  playClickSound(soundEnabled);
                  setActiveGameMode("spelling");
                  setCurrentIdx(0);
                  setIsGameStarted(true);
                  requestFullscreenSafely();
                }}
                className="bg-white/80 hover:bg-white border-2 border-slate-200/60 hover:border-sky-400 rounded-3xl p-4 md:p-6 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-all hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] group backdrop-blur-sm"
              >
                <div className="w-12 h-12 md:w-16 md:h-16 bg-sky-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform group-hover:-rotate-3">
                  <BookOpen className="w-6 h-6 md:w-9 md:h-9 text-sky-500" />
                </div>
                <div>
                  <h3 className="text-sm md:text-lg font-extrabold text-slate-800">ល្បែងផ្គុំពាក្យខ្មែរ</h3>
                  <p className="hidden md:block text-[11px] text-slate-500 mt-1">រៀនសរសេរនិងផ្គុំអក្ខរាវិរុទ្ធ</p>
                </div>
              </button>
 
              {/* Card 3: Word Search Game */}
              <button 
                type="button"
                onClick={() => {
                  playClickSound(soundEnabled);
                  setActiveGameMode("wordsearch");
                  setIsGameStarted(true);
                  requestFullscreenSafely();
                }}
                className="bg-white/80 hover:bg-white border-2 border-slate-200/60 hover:border-amber-400 rounded-3xl p-4 md:p-6 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-all hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] group backdrop-blur-sm"
              >
                <div className="w-12 h-12 md:w-16 md:h-16 bg-amber-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform group-hover:rotate-3">
                  <Sparkles className="w-6 h-6 md:w-9 md:h-9 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm md:text-lg font-extrabold text-slate-800">ល្បែងស្វែងរកពាក្យ</h3>
                  <p className="hidden md:block text-[11px] text-slate-500 mt-1">រាវរកទីតាំងពាក្យដែលលាក់</p>
                </div>
              </button>
 
              {/* Card 4: Lucky Box */}
              <button 
                type="button"
                onClick={() => {
                  playClickSound(soundEnabled);
                  setIsLuckyBoxOpen(true);
                }}
                className="bg-white/80 hover:bg-white border-2 border-slate-200/60 hover:border-emerald-400 rounded-3xl p-4 md:p-6 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-all hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] group backdrop-blur-sm"
              >
                <div className="w-12 h-12 md:w-16 md:h-16 bg-emerald-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform group-hover:-rotate-3">
                  <Dice5 className="w-6 h-6 md:w-9 md:h-9 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-sm md:text-lg font-extrabold text-slate-800">កងបង្វិលសំណាង</h3>
                  <p className="hidden md:block text-[11px] text-slate-500 mt-1">ចាប់ឈ្មោះសិស្សដោយចៃដន្យ</p>
                </div>
              </button>

              {/* Card 5: Word Card Creator */}
              <button 
                type="button"
                onClick={() => {
                  playClickSound(soundEnabled);
                  if (challenges.length > 0) {
                    const colors = ["#f97316", "#eab308", "#10b981", "#06b6d4", "#8b5cf6", "#f43f5e"];
                    let allCards = challenges.map((puz, idx) => ({
                      id: Date.now() + idx,
                      title: puz.category ? (puz.category.startsWith("អំណាន") ? puz.category : `អំណាន ៖ ${puz.category}`) : "អំណាន",
                      word: puz.word,
                      color: colors[idx % colors.length],
                      category: puz.category || "ទូទៅ"
                    }));
                    setWordCards(allCards);
                  }
                  setActiveGameMode("wordcard");
                  setIsGameStarted(true);
                  requestFullscreenSafely();
                }}
                className="bg-white/80 hover:bg-white border-2 border-slate-200/60 hover:border-orange-400 rounded-3xl p-4 md:p-6 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-all hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] group backdrop-blur-sm"
              >
                <div className="w-12 h-12 md:w-16 md:h-16 bg-orange-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform group-hover:rotate-3">
                  <Printer className="w-6 h-6 md:w-9 md:h-9 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-sm md:text-lg font-extrabold text-slate-800">បណ្ណពាក្យ (A4)</h3>
                  <p className="hidden md:block text-[11px] text-slate-500 mt-1">ទាញយកបណ្ណពាក្យ ៣ ស្មើគ្នាជា PDF</p>
                </div>
              </button>

              {/* Card 6: Multiple Choice */}
              <button 
                type="button"
                onClick={() => {
                  playClickSound(soundEnabled);
                  setActiveGameMode("multiplechoice");
                  setCurrentIdx(0);
                  setIsGameStarted(true);
                  requestFullscreenSafely();
                }}
                className="bg-white/80 hover:bg-white border-2 border-slate-200/60 hover:border-purple-400 rounded-3xl p-4 md:p-6 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-all hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] group backdrop-blur-sm"
              >
                <div className="w-12 h-12 md:w-16 md:h-16 bg-purple-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform group-hover:-rotate-3">
                  <CheckSquare className="w-6 h-6 md:w-9 md:h-9 text-purple-500" />
                </div>
                <div>
                  <h3 className="text-sm md:text-lg font-extrabold text-slate-800">សំណួរពហុជម្រើស</h3>
                  <p className="hidden md:block text-[11px] text-slate-500 mt-1">ជ្រើសរើសចម្លើយត្រឹមត្រូវ ១ ក្នុងចំណោម ៤</p>
                </div>
              </button>

              {/* Card 7: Timer */}
              <button 
                type="button"
                onClick={() => {
                  playClickSound(soundEnabled);
                  setIsTimerOpen(true);
                }}
                className="bg-white/80 hover:bg-white border-2 border-slate-200/60 hover:border-rose-400 rounded-3xl p-4 md:p-6 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-all hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] group backdrop-blur-sm"
              >
                <div className="w-12 h-12 md:w-16 md:h-16 bg-rose-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform group-hover:rotate-3">
                  <Timer className="w-6 h-6 md:w-9 md:h-9 text-rose-500" />
                </div>
                <div>
                  <h3 className="text-sm md:text-lg font-extrabold text-slate-800">នាឡិកាវាស់ពេល</h3>
                  <p className="hidden md:block text-[11px] text-slate-500 mt-1">កំណត់ម៉ោងសម្រាប់សិស្ស</p>
                </div>
              </button>

              {/* Card 8: Team Generator */}
              <button 
                type="button"
                onClick={() => {
                  playClickSound(soundEnabled);
                  setIsTeamGenOpen(true);
                }}
                className="bg-white/80 hover:bg-white border-2 border-slate-200/60 hover:border-sky-400 rounded-3xl p-4 md:p-6 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-all hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] group backdrop-blur-sm"
              >
                <div className="w-12 h-12 md:w-16 md:h-16 bg-sky-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform group-hover:rotate-3">
                  <Users className="w-6 h-6 md:w-9 md:h-9 text-sky-500" />
                </div>
                <div>
                  <h3 className="text-sm md:text-lg font-extrabold text-slate-800">ចាប់ក្រុមសិស្ស</h3>
                  <p className="hidden md:block text-[11px] text-slate-500 mt-1">បែងចែកក្រុមដោយស្វ័យប្រវត្តិ</p>
                </div>
              </button>

              {/* Card 9: Slot Machine */}
              <button 
                type="button"
                onClick={() => {
                  playClickSound(soundEnabled);
                  setIsSlotMachineOpen(true);
                }}
                className="bg-white/80 hover:bg-white border-2 border-slate-200/60 hover:border-indigo-400 rounded-3xl p-4 md:p-6 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-all hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] group backdrop-blur-sm"
              >
                <div className="w-12 h-12 md:w-16 md:h-16 bg-indigo-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform group-hover:-rotate-3">
                  <ArrowUpDown className="w-6 h-6 md:w-9 md:h-9 text-indigo-500" />
                </div>
                <div>
                  <h3 className="text-sm md:text-lg font-extrabold text-slate-800">ល្បែងអានពាក្យ</h3>
                  <p className="hidden md:block text-[11px] text-slate-500 mt-1">ជ្រើសរើសចៃដន្យបែប Slot</p>
                </div>
              </button>
            </div>
          ) : null}

        </div>
      ) : (
        <>
          {activeGameMode === "wordcard" ? (
            renderWordCardCreator()
          ) : (
            <main className={isImmersive ? `w-full max-w-full md:h-full mx-auto flex flex-col items-stretch md:justify-center gap-8 flex-grow no-print min-h-0 ${activeGameMode === "wordsearch" ? "md:flex-row-reverse" : "md:flex-row"}` : "max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 flex-grow no-print min-h-0"}>
            {/* RIGHT SIDE: Header + Active puzzle board */}
            <div className={`${isImmersive ? "w-full flex-grow flex flex-col gap-6 min-h-0" : "lg:col-span-8 flex flex-col gap-6 min-h-0"} transition-all`}>
              
              {/* Shared Main Header (Separate Card) */}
              <div className={`bg-white shadow-sm border border-slate-200/80 p-5 md:p-6 transition-all ${isImmersive ? "rounded-3xl shadow-md" : "rounded-2xl shrink-0"}`}>
                {renderSharedGameHeader(true, true)}
              </div>

              {/* CENTER BOARD: Active puzzle box */}
              <section className={`bg-white shadow-sm border border-slate-200/80 p-5 flex flex-col justify-between transition-all ${isImmersive ? "flex-grow min-h-0 rounded-3xl p-2 sm:p-4 shadow-xl" : "rounded-2xl xl:p-6 flex-grow min-h-0"}`} id="puzzle-main-board">

          {activeGameMode === "spelling" ? (
            <div className="flex flex-col h-full justify-between relative">
              {isCorrect && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-50/80 backdrop-blur-sm rounded-3xl animate-in fade-in zoom-in duration-300">
                  <div className="bg-white p-8 md:p-12 rounded-3xl shadow-2xl flex flex-col items-center max-w-md w-full border-2 border-emerald-400 text-center mx-4">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                      <Check className="w-10 h-10 text-emerald-600 stroke-[3px]" />
                    </div>
                    <span className="text-xl text-slate-500 font-bold mb-2">ពាក្យត្រឹមត្រូវគឺ៖</span>
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-khmer font-bold text-emerald-600 mb-8 tracking-wider">{challenge.word}</h2>
                    
                    <button
                      onClick={handleNextWord}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl py-4 px-8 font-bold flex items-center justify-center gap-3 w-full text-lg shadow-lg shadow-indigo-200 transition-all active:scale-95"
                      id="next-puzzle-modal-btn"
                    >
                      <span>បន្តទៅមុខ</span>
                      <ChevronRight className="w-6 h-6 stroke-[3px]" />
                    </button>
                  </div>
                </div>
              )}


              {/* VISUAL SPELLING INPUT BOXES - Single Row Horizontal Scroll (No Scrollbar) */}
              <div className="w-full overflow-x-auto no-scrollbar py-4 md:py-6 px-2">
                <div className={`flex flex-nowrap justify-center items-center gap-1.5 sm:gap-2 md:gap-3 min-w-max mx-auto px-4 ${isShake ? "animate-shake" : ""}`}>
                  {challenge.blocks.map((block, idx) => {
                    const isPrefilled = challenge.prefilled[idx];
                    const isActive = idx === activeSlot;
                    const hasValue = userInput[idx] !== "";
                    
                    return (
                      <button
                        key={`${challenge.id}-block-${idx}`}
                        onClick={() => handleSlotClick(idx)}
                        disabled={isPrefilled || isCorrect}
                        className={`rounded-xl sm:rounded-2xl font-bold flex flex-col justify-between border-2 transition-all relative overflow-hidden pb-1 pt-0.5 shrink ${
                          isImmersive
                            ? "w-12 h-14 sm:w-16 sm:h-20 md:w-24 md:h-28 xl:w-28 xl:h-32 text-xl sm:text-3xl md:text-5xl xl:text-6xl shadow-sm"
                            : "w-10 h-12 sm:w-12 sm:h-16 md:w-16 md:h-20 text-lg sm:text-xl md:text-2xl shadow-xs"
                        } ${
                          isPrefilled
                            ? "bg-slate-50 border-slate-200 text-blue-600"
                            : isCorrect
                              ? "bg-emerald-50 border-emerald-400 text-emerald-600 shadow-md shadow-emerald-50"
                              : isActive
                                ? "bg-amber-100 border-amber-500 ring-4 ring-amber-200 text-amber-950 shadow-md"
                                : hasValue
                                  ? "bg-white border-amber-500 text-orange-500 shadow-sm"
                                  : "bg-amber-50/30 border-dashed border-amber-300 text-transparent"
                        }`}
                        id={`spelling-slot-${idx}`}
                      >
                        {/* Inside Text */}
                        <div className="flex-grow flex items-center justify-center w-full">
                          <span>{userInput[idx] || ""}</span>
                        </div>

                        {/* Accent Stripe at the bottom of the card block */}
                        <div className={`absolute bottom-0 left-0 right-0 h-1 sm:h-1.5 ${
                          isPrefilled
                            ? "bg-blue-600"
                            : isCorrect
                              ? "bg-emerald-500"
                              : isActive
                                ? "bg-amber-600"
                                : hasValue
                                  ? "bg-amber-500"
                                  : "bg-amber-200"
                        }`} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* LETTER SELECTION BANK */}
              <div className="border border-blue-200/50 rounded-2xl p-3 md:p-5 relative bg-blue-50/50">
                <div className="flex items-center justify-between mb-3 pb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    ផ្ទាំងអក្សរសម្រាប់បំពេញ៖
                  </span>
                  
                  <button
                    onClick={handleResetWord}
                    disabled={isCorrect}
                    className="text-[10px] text-rose-500 hover:text-rose-600 font-bold flex items-center gap-1 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100 disabled:opacity-50 transition-colors"
                    id="reset-word-btn"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>លុបចោល</span>
                  </button>
                </div>

                {/* Letter pool keys - Unified Single Row (No Scrollbar) */}
                <div className="overflow-x-auto no-scrollbar pb-1">
                  <div className="flex flex-nowrap justify-center gap-1 sm:gap-1.5 md:gap-2 font-khmer px-2 min-w-max mx-auto">
                    {letterPool.map((letter, idx) => (
                      <button
                        key={`letter-tile-${idx}`}
                        onClick={() => handleTileClick(letter)}
                        disabled={isCorrect}
                        className={`bg-white hover:bg-slate-50 text-blue-600 font-bold border border-slate-200 shadow-sm active:scale-95 hover:shadow transition-all disabled:opacity-40 flex items-center justify-center shrink-0 ${
                          isImmersive 
                            ? "w-10 h-10 sm:w-14 sm:h-14 md:w-18 md:h-18 lg:w-20 lg:h-20 rounded-lg sm:rounded-xl text-lg sm:text-2xl md:text-3xl lg:text-4xl" 
                            : "w-9 h-9 sm:w-11 sm:h-11 md:w-13 md:h-13 rounded-lg sm:rounded-xl text-base sm:text-lg md:text-xl"
                        }`}
                        id={`letter-tile-${idx}`}
                      >
                        {letter}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* BOTTOM VERIFY/NEXT ACTION WIDGET */}
              <div className="mt-6 pt-5 border-t border-slate-100">
                {!isCorrect && (
                  <button
                    onClick={handleVerify}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl py-4 px-6 font-bold flex items-center justify-center gap-2.5 w-full text-base md:text-lg tracking-wider transition-all shadow-lg shadow-emerald-100/50"
                    id="verify-button"
                  >
                    <Check className="w-5 h-5 stroke-[3px]" />
                    <span>ផ្ទៀងផ្ទាត់ចម្លើយ</span>
                  </button>
                )}
              </div>
            </div>
          ) : activeGameMode === "wordsearch" ? (
            <div className={`flex flex-col w-full h-full relative ${isImmersive ? "justify-center pt-2" : ""}`}>
              <div className={`flex flex-col w-full items-center justify-center ${isImmersive ? "max-h-full h-full my-auto" : "flex-grow h-full"}`}>
              
                <div 
                  className={`bg-slate-50 border border-slate-200 p-2 md:p-3 rounded-2xl shadow-sm w-full md:w-auto h-full flex-grow flex items-center justify-center relative shrink min-h-0 mx-auto ${isImmersive ? "aspect-square max-h-full max-w-full" : "max-w-[500px] aspect-square"}`}
                  style={isImmersive ? { maxHeight: '100%', maxWidth: '100%' } : {}}
                  onMouseLeave={handleGlobalMouseUp}
                >
                  <div 
                    className="grid grid-cols-12 gap-px relative w-full h-full bg-slate-200 border border-slate-200 rounded-xl overflow-hidden"
                    style={{ aspectRatio: '1/1', maxHeight: '100%', maxWidth: '100%' }}
                    onMouseUp={handleGlobalMouseUp}
                  >
                  {wordSearchGrid.map((row, r) => 
                    row.map((val, c) => {
                      const isSelected = wordSearchSelectedCoords.some(coord => coord.r === r && coord.c === c);
                      const isStart = startCell?.r === r && startCell?.c === c;
                      const foundPlacement = foundWordPlacements.find(item => 
                        item.coords.some(coord => coord.r === r && coord.c === c)
                      );

                      let cellBgClass = "bg-white text-slate-700 hover:bg-slate-50";
                      if (isSelected) {
                        cellBgClass = "bg-indigo-600 text-white font-medium z-10 shadow-sm";
                      } else if (foundPlacement) {
                        cellBgClass = `${foundPlacement.colorClass} font-medium text-slate-900 z-0`;
                      } else if (isStart) {
                        cellBgClass = "bg-indigo-100 text-indigo-700 font-medium animate-pulse z-20 shadow-sm";
                      }

                      return (
                        <button
                          key={`${r}-${c}`}
                          type="button"
                          onMouseDown={() => handleCellMouseDown(r, c)}
                          onMouseEnter={() => handleCellMouseEnter(r, c)}
                          onMouseUp={handleGlobalMouseUp}
                          className={`aspect-square w-full flex items-center justify-center rounded-none ${isImmersive ? "text-[15px] sm:text-2xl lg:text-3xl" : "text-[13px] sm:text-[15px] md:text-lg"} font-khmer font-normal transition-colors select-none duration-75 cursor-pointer leading-normal ${cellBgClass}`}
                          style={{ touchAction: "none" }}
                        >
                          {val}
                        </button>
                      );
                    })
                  )}
                  </div>
                </div>
              </div>
            </div>
          ) : activeGameMode === "multiplechoice" && mcQuestions.length > 0 ? (
            !selectedMcTopic ? (
              <div className="flex flex-col h-full items-center justify-center p-6 bg-white/50 rounded-3xl">
                <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mb-6">
                  <CheckSquare className="w-10 h-10 text-purple-600" />
                </div>
                <h2 className="text-3xl font-extrabold font-khmer text-slate-800 mb-2 mt-4 text-center">ជ្រើសរើសប្រធានបទ</h2>
                <p className="text-slate-500 mb-8 font-khmer text-center max-w-md">សូមជ្រើសរើសប្រធានបទ ឬកម្រិតណាមួយខាងក្រោម ដើម្បីចាប់ផ្តើមលេងសំណួរពហុជម្រើស</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-3xl place-content-center">
                  {uniqueMcTopics.map(topic => {
                    const count = mcQuestions.filter(q => (q.topic || "ទូទៅ") === topic).length;
                    return (
                      <button
                        key={`topic-${topic}`}
                        onClick={() => {
                          playClickSound(soundEnabled);
                          setSelectedMcTopic(topic);
                          setCurrentMcIdx(0);
                        }}
                        className="bg-white border-2 border-slate-200 hover:border-purple-400 p-6 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all hover:bg-purple-50 group hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-purple-500/20"
                      >
                        <span className="text-xl md:text-2xl font-bold font-khmer text-slate-800 group-hover:text-purple-700 transition-colors">{topic}</span>
                        <span className="text-xs font-bold text-white bg-slate-300 group-hover:bg-purple-400 px-3 py-1 rounded-full transition-colors font-khmer">{count} សំណួរ</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : filteredMcQuestions.length > 0 ? (
              <div className="flex flex-col h-full justify-between relative">
                {/* Back to Topics Button */}
                <button
                  onClick={() => {
                    playClickSound(soundEnabled);
                    setSelectedMcTopic(null);
                  }}
                  className="absolute top-4 left-4 z-10 p-2.5 bg-white shadow-sm border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 hover:text-slate-700 transition-all flex items-center justify-center"
                  title="ថយក្រោយ"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                
                {isCorrect && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-50/80 backdrop-blur-sm rounded-3xl animate-in fade-in zoom-in duration-300">
                    <div className="bg-white p-8 md:p-12 rounded-3xl shadow-2xl flex flex-col items-center max-w-md w-full border-2 border-emerald-400 text-center mx-4">
                      <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                        <Check className="w-10 h-10 text-emerald-600 stroke-[3px]" />
                      </div>
                      <span className="text-xl text-slate-500 font-bold mb-2">ចម្លើយត្រឹមត្រូវគឺ៖</span>
                      <h2 className="text-4xl md:text-5xl lg:text-6xl font-khmer font-bold text-emerald-600 mb-8 tracking-wider">{filteredMcQuestions[currentMcIdx].correctOption}</h2>
                      
                      <button
                        onClick={handleNextMcQuestion}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl py-4 px-8 font-bold flex items-center justify-center gap-3 w-full text-lg shadow-lg shadow-indigo-200 transition-all active:scale-95"
                      >
                        <span>បន្តទៅមុខ</span>
                        <ChevronRight className="w-6 h-6 stroke-[3px]" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex-grow flex flex-col items-center justify-center py-8 px-4 md:px-8">
                  {/* Topic pill */}
                  <div className="mb-6 px-5 py-2 bg-purple-100 text-purple-700 text-sm md:text-base font-bold font-khmer rounded-full shadow-sm">
                    {selectedMcTopic}
                  </div>
                  
                  {/* Question text (Extra Large) */}
                  <h3 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black font-khmer text-slate-800 mb-12 max-w-6xl text-center leading-relaxed">
                    {filteredMcQuestions[currentMcIdx].question}
                  </h3>

                  {/* Multiple Choice Options / Start Button */}
                  {!mcQuestionStarted ? (
                    <div className="flex justify-center items-center mt-6 w-full animate-in zoom-in-95 duration-500">
                      <button
                        onClick={() => {
                          playClickSound(soundEnabled);
                          setMcQuestionStarted(true);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2rem] py-6 px-16 text-3xl md:text-4xl font-bold font-khmer shadow-xl shadow-indigo-200 transition-all border-b-[8px] border-indigo-800 active:border-b-0 active:translate-y-[8px] flex items-center justify-center gap-4 group"
                      >
                        <Play className="w-10 h-10 md:w-12 md:h-12 fill-current group-hover:scale-110 transition-transform" />
                        ចាប់ផ្ដើម
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Multiple Choice Options (2 Columns Grid) */}
                      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 w-full max-w-[90%] lg:max-w-[80%] xl:max-w-[1400px] animate-in fade-in slide-in-from-bottom-8 duration-500">
                        
                        {/* Center Countdown Circle */}
                        {mcSelectedAnswer === null && !mcShowAnswer && (
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none flex">
                            <div className={`w-32 h-32 md:w-56 md:h-56 rounded-full flex items-center justify-center font-black text-6xl md:text-8xl shadow-2xl border-[10px] md:border-[16px] transition-all duration-300 font-khmer ${
                              mcQuestionCountdown <= 3 ? "bg-rose-50 border-rose-500 text-rose-600 animate-pulse scale-110" : "bg-white border-indigo-400 text-indigo-600"
                            }`}>
                              {toKhmerNumeral(mcQuestionCountdown)}
                            </div>
                          </div>
                        )}
                        
                        {filteredMcQuestions[currentMcIdx].options.map((opt, i) => {
                          const isSelected = mcSelectedAnswer === opt;
                          const isActuallyCorrect = opt === filteredMcQuestions[currentMcIdx].correctOption;
                          const isCorrectOption = (isSelected && mcIsCorrect) || (mcShowAnswer && isActuallyCorrect);
                          const isWrongOption = isSelected && mcIsCorrect === false;
                          
                          // Different colors for each option
                          const defaultColors = [
                            "bg-blue-500 border-blue-600 text-white shadow-blue-200 hover:bg-blue-400",
                            "bg-amber-500 border-amber-600 text-white shadow-amber-200 hover:bg-amber-400",
                            "bg-fuchsia-500 border-fuchsia-600 text-white shadow-fuchsia-200 hover:bg-fuchsia-400",
                            "bg-rose-500 border-rose-600 text-white shadow-rose-200 hover:bg-rose-400"
                          ];
                          
                          const btnColor = defaultColors[i % defaultColors.length];
                          
                          const prefixes = ["ក.", "ខ.", "គ.", "ឃ."];
                          const prefix = prefixes[i % prefixes.length];
                          
                          const isCrossedOut = (mcShowAnswer && !isActuallyCorrect) || isWrongOption;

                          return (
                            <button
                              key={`mc-opt-${i}`}
                              onClick={() => handleMcOptionSelect(opt)}
                              disabled={isCorrect || (mcIsCorrect === false && isSelected) || mcShowAnswer}
                              className={`relative overflow-hidden w-full p-6 lg:p-8 xl:p-10 rounded-[1.5rem] text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-black font-khmer transition-all border-b-[8px] active:border-b-0 active:translate-y-[8px] text-center shadow-xl flex items-center justify-center min-h-[120px] ${
                                isCorrectOption 
                                  ? "bg-emerald-500 border-emerald-600 text-white shadow-emerald-200 rotate-1 scale-105 z-10 !border-b-[0] !translate-y-[8px]"
                                  : isCrossedOut
                                    ? `${btnColor} opacity-90 !border-b-[0] !translate-y-[8px] cursor-not-allowed shadow-none`
                                    : mcSelectedAnswer !== null
                                      ? `${btnColor} opacity-50 grayscale saturate-50 !border-b-[0] !translate-y-[8px] cursor-not-allowed`
                                      : btnColor
                              }`}
                            >
                              <div className={`relative z-10 flex items-center justify-center w-full`}>
                                <span className="opacity-80 mr-4 font-normal">{prefix}</span>
                                <span className={isCrossedOut ? "line-through decoration-[8px] decoration-red-600" : ""}>{opt}</span>
                              </div>
                              
                              {isCrossedOut && (
                                <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
                                  <X className="w-full h-full max-w-[250px] text-red-600 drop-shadow-xl stroke-[6]" />
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>

                      {/* Multiple Choice Action Buttons */}
                      <div className="mt-12 flex flex-col sm:flex-row gap-4 items-center justify-center w-full max-w-2xl px-4 animate-in fade-in zoom-in-95 duration-500 delay-200">
                        {(mcShowAnswer || mcIsCorrect === true) ? (
                          <button
                            onClick={handleNextMcQuestion}
                            className="flex-1 w-full sm:w-auto px-6 lg:px-8 py-4 lg:py-5 rounded-2xl text-lg lg:text-xl font-bold font-khmer transition-all border-b-[4px] active:border-b-0 active:translate-y-[4px] flex items-center justify-center gap-3 bg-emerald-500 hover:bg-emerald-600 border-emerald-600 text-white shadow-sm animate-in fade-in zoom-in-95 duration-300"
                          >
                            សំណួរបន្ទាប់
                            <ArrowRight className="w-5 h-5 lg:w-6 lg:h-6" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setMcCountdown(5)}
                            disabled={mcCountdown !== null}
                            className={`flex-1 w-full sm:w-auto px-6 lg:px-8 py-4 lg:py-5 rounded-2xl text-lg lg:text-xl font-bold font-khmer transition-all border-b-[4px] active:border-b-0 active:translate-y-[4px] flex items-center justify-center gap-3 ${
                              mcCountdown !== null
                                ? "bg-slate-100 border-slate-200 text-slate-400 opacity-70 cursor-not-allowed !border-b-[0] !translate-y-[4px]"
                                : "bg-indigo-50 hover:bg-indigo-100 border-indigo-200 hover:border-indigo-300 text-indigo-700 shadow-sm"
                            }`}
                          >
                            <Eye className="w-5 h-5 lg:w-6 lg:h-6" />
                            {mcCountdown !== null ? `រាប់ថយក្រោយ៖ ${toKhmerNumeral(mcCountdown)}` : "អ្នកជំនួយ បង្ហាញចម្លើយ"}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : null
          ) : null}
        </section>
      </div>

        {/* SIDEBAR */}
        <section 
          className={`${isImmersive ? (activeGameMode === "wordsearch" ? "w-full lg:w-4/12 xl:w-5/12 max-w-2xl shrink-0 h-[400px] sm:h-[500px] lg:h-auto lg:sticky lg:top-4 lg:max-h-[calc(100vh-32px)] flex flex-col" : "hidden") : "lg:col-span-4 h-[400px] sm:h-[500px] lg:h-auto lg:sticky lg:top-4 lg:max-h-[calc(100vh-32px)]"} bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 md:p-5 flex flex-col overflow-hidden transition-all`} 
          id="sidebar"
        >
          
          {activeGameMode === "spelling" ? (
            <div className="flex flex-col h-full justify-between">
              <div className="flex flex-col flex-grow min-h-0">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 shrink-0">
                  <h2 className="font-bold text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-indigo-600" />
                    ពាក្យសរុបទាំង {filteredChallenges.length}
                  </h2>
                  <span className="text-xs text-indigo-600 bg-indigo-50 font-semibold px-2.5 py-1 rounded-full border border-indigo-100/50">
                    វឌ្ឍនភាព
                  </span>
                </div>

                {/* Word selection list */}
                <div className="space-y-2 flex-grow overflow-y-auto pr-1 min-h-0">
                  {filteredChallenges.map((c, idx) => {
                    const isCurrent = idx === currentIdx;
                    const isSolved = completedIds.includes(c.id);
                    
                    return (
                      <button
                        key={`${c.id}-${idx}`}
                        onClick={() => {
                          playClickSound(soundEnabled);
                          setCurrentIdx(idx);
                        }}
                        className={`w-full text-left p-3 rounded-xl flex items-center justify-between border transition-all ${
                          isCurrent 
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100" 
                            : isSolved
                              ? "bg-emerald-50/50 border-emerald-100 hover:bg-slate-50 text-slate-700"
                              : "bg-white border-slate-150 hover:bg-slate-50 text-slate-700"
                        }`}
                        id={`word-item-${c.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center ${
                            isCurrent 
                              ? "bg-white/20 text-white" 
                              : isSolved
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                          }`}>
                            {idx + 1}
                          </span>
                          <div className="flex flex-col text-left">
                            <span className="font-semibold text-base leading-tight">{c.word}</span>
                            <span className="text-[9px] text-slate-400 font-medium">📁 {c.category || "ពាក្យអក្ខរាវិរុទ្ធខ្មែរ"}</span>
                          </div>
                        </div>

                        {isSolved && (
                          <span className={`p-1 rounded-full ${isCurrent ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-600"}`}>
                            <Check className="w-3.5 h-3.5 stroke-[3px]" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Progress Tracker Widget */}
              <div className="mt-6 pt-4 border-t border-slate-100 md:block">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-2">
                  <span className="flex items-center gap-1.5 font-bold">
                    <BookOpenCheck className="w-4 h-4 text-emerald-500" />
                    វឌ្ឍនភាពសរុប
                  </span>
                  <span>{filteredCompletedCount} / {filteredChallenges.length} (ពាក្យ)</span>
                </div>
                
                {/* Progress line */}
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 text-center font-medium">
                  បំពេញពាក្យទាំងអស់ដើម្បីទទួលបានវិញ្ញាបនបត្រដ៏អស្ចារ្យ!
                </p>
              </div>
            </div>
          ) : activeGameMode === "multiplechoice" ? (
            <div className="flex flex-col h-full justify-between">
              <div className="flex flex-col flex-grow min-h-0">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 shrink-0">
                  <h2 className="font-bold text-slate-900 flex items-center gap-2 font-khmer">
                    <CheckSquare className="w-5 h-5 text-purple-600" />
                    សំណួរសរុបទាំង {filteredMcQuestions.length}
                  </h2>
                  <button
                    onClick={() => {
                      playClickSound(soundEnabled);
                      setIsMcModalOpen(true);
                    }}
                    className="flex text-center items-center justify-center p-2 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors shadow-sm active:scale-95 text-xs text-purple-700 font-bold"
                  >
                    បញ្ចូលថ្មី
                  </button>
                </div>

                {/* Multiple choice selection list */}
                <div className="space-y-2 flex-grow overflow-y-auto pr-1 min-h-0">
                  {filteredMcQuestions.map((q, idx) => {
                    const isCurrent = idx === currentMcIdx && selectedMcTopic !== null;
                    
                    return (
                      <div
                        key={`mc-q-${q.id}`}
                        className={`w-full text-left p-3 rounded-xl flex items-center justify-between border transition-all ${
                          isCurrent 
                            ? "bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-100" 
                            : "bg-white border-slate-150 text-slate-700"
                        }`}
                      >
                        <button
                          className="flex items-center gap-3 flex-grow text-left overflow-hidden min-w-0"
                          onClick={() => {
                            playClickSound(soundEnabled);
                            setCurrentMcIdx(idx);
                          }}
                        >
                          <span className={`w-6 h-6 shrink-0 rounded-lg text-xs font-bold flex items-center justify-center ${
                            isCurrent 
                              ? "bg-white/20 text-white" 
                              : "bg-slate-100 text-slate-500"
                          }`}>
                            {idx + 1}
                          </span>
                          <div className="flex flex-col text-left overflow-hidden">
                            <span className="font-semibold text-sm leading-tight truncate px-1">{q.question}</span>
                            <span className="text-[10px] opacity-70 font-medium px-1 truncate">ចម្លើយ: {q.correctOption}</span>
                          </div>
                        </button>
                        
                        <div className="flex items-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              playClickSound(soundEnabled);
                              setNewMcQuestion(q.question);
                              setNewMcOptions([...q.options]);
                              setNewMcCorrectOption(q.options.indexOf(q.correctOption) !== -1 ? q.options.indexOf(q.correctOption) : 0);
                              setNewMcTopic(q.topic || "ទូទៅ");
                              setEditingMcId(q.id);
                              setIsMcFormModalOpen(true);
                            }}
                            className={`p-1.5 rounded-lg shrink-0 transition-colors ml-2 ${
                              isCurrent ? "hover:bg-white/20 text-white/70 hover:text-white" : "hover:bg-blue-50 text-slate-400 hover:text-blue-500"
                            }`}
                            title="កែប្រែសំណួរនេះ"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                          </button>
                          {mcQuestions.length > 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                playClickSound(soundEnabled);
                                setMcToDelete(q.id);
                              }}
                              className={`p-1.5 rounded-lg shrink-0 transition-colors ml-1 ${
                                isCurrent ? "hover:bg-white/20 text-white/70 hover:text-white" : "hover:bg-rose-50 text-slate-400 hover:text-rose-500"
                              }`}
                              title="លុបសំណួរនេះ"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : activeGameMode === "wordsearch" ? (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex flex-col flex-grow min-h-0">
                <h4 className="font-khmer font-bold text-indigo-950 border-b border-slate-100 pb-3 mb-4 flex items-center justify-between text-base shrink-0">
                  <span className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 bg-emerald-50 rounded p-0.5 border border-emerald-200 animate-bounce" />
                    ពាក្យត្រូវស្វែងរក ({toKhmerNumeral(wordSearchFoundList.length)}/{toKhmerNumeral(wordSearchList.length)})
                  </span>
                </h4>

                {/* Category Filter */}
                <div className="mb-4 shrink-0">
                  <label className="text-xs font-khmer font-medium text-slate-500 mb-1 block">ជ្រើសរើសក្រុមពាក្យ (Category)៖</label>
                  <select
                    value={selectedFilterCategory}
                    onChange={(e) => {
                      playClickSound(soundEnabled);
                      setSelectedFilterCategory(e.target.value);
                    }}
                    className="w-full font-khmer bg-slate-50 hover:bg-slate-100 border border-slate-200 focus:border-indigo-400 rounded-xl px-3 py-2 text-sm font-medium text-indigo-800 focus:outline-none transition-colors cursor-pointer"
                  >
                    <option value="ទាំងអស់">🔍 បង្ហាញលាយបញ្ចូលគ្នា (All)</option>
                    {Array.from(new Set(challenges.map(c => c.category || "ពាក្យអក្ខរាវិរុទ្ធខ្មែរ"))).map((catName) => (
                      <option key={catName} value={catName}>📁 {catName}</option>
                    ))}
                  </select>
                </div>

                {wordSearchList.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-10 font-bold">គ្មានពាក្យសម្រាប់ស្វែងរកទេ!</p>
                ) : (
                  <div className="space-y-2 flex-grow overflow-y-auto pr-1 min-h-0">
                    {wordSearchList.map((word, idx) => {
                      const isFound = wordSearchFoundList.includes(word);
                      const foundPlacement = foundWordPlacements.find(p => p.word === word);
                      const highlightClass = foundPlacement ? foundPlacement.colorClass : "bg-slate-50 text-slate-400 border-slate-100 opacity-50";

                      return (
                        <div 
                          key={word}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 ${
                            isFound 
                              ? `${highlightClass} border-slate-350 opacity-90 scale-[0.98]` 
                              : "bg-white border-slate-150 hover:bg-slate-50 shadow-sm"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center ${
                              isFound 
                                ? "bg-white/40 text-emerald-800 font-extrabold" 
                                : "bg-indigo-50 text-indigo-500"
                            }`}>
                              {toKhmerNumeral(idx + 1)}
                            </span>
                            <span className={`font-khmer font-normal text-base tracking-wide ${
                              isFound 
                                ? "line-through text-slate-400 decoration-slate-400" 
                                : "text-slate-800"
                            }`}>
                              {word}
                            </span>
                          </div>

                          {isFound && (
                            <span className="bg-emerald-50 text-emerald-705 border border-emerald-200/50 p-1 px-2.5 text-[10px] rounded-full font-bold flex items-center gap-1 shrink-0 animate-in zoom-in-50 duration-200">
                              <Check className="w-3 h-3 text-emerald-600 font-extrabold" />
                              រកឃើញ
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {/* Completion Congratulations Section */}
              {wordSearchFoundList.length > 0 && wordSearchFoundList.length === wordSearchList.length && (
                <div className="mt-4 shrink-0 bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 text-center animate-in zoom-in-95 duration-300">
                  <h5 className="font-extrabold text-emerald-800 flex items-center justify-center gap-1.5 text-sm">
                    <Sparkles className="w-5 h-5 text-amber-500 fill-amber-400 animate-spin" />
                    ពូកែណាស់!
                  </h5>
                  <p className="text-[10px] sm:text-xs text-emerald-600 font-bold mt-1">
                    រកឃើញពាក្យទាំងអស់ហើយ!
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </section>

      </main>
          )}
        </>
      )}

      {/* FOOTER BAR */}
      {!isImmersive && (
        <footer className="mt-8 pt-4 border-t border-slate-200 max-w-6xl w-full mx-auto flex flex-col md:flex-row items-center justify-between text-xs text-slate-400 no-print gap-3">
          <p>© ២០២៦ កម្មវិធីសិក្សាភាសាខ្មែរសម្រាប់កុមារ - សាងសង់ឡើងជាពិសេសសម្រាប់បង្កើនការអាន</p>
          <div className="flex items-center gap-4">
            <span className="font-semibold text-slate-400 flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5 text-indigo-500" />
              សម្លេងឌីជីថល (Web Audio Synthesis Ready)
            </span>
            <span>•</span>
            <span className="font-medium">រៀបចំដោយក្តីស្រឡាញ់សម្រាប់អនាគតកូនខ្មែរ</span>
          </div>
        </footer>
      )}

      {/* MODAL 1: AI Level Creator Panel */}
      {aiMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center px-4 no-print">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-indigo-600 p-5 text-white relative">
              <h3 className="text-lg md:text-xl font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 fill-white text-yellow-300" />
                បង្កើតកម្រិតលេង និងប្រធានបទថ្មីៗដោយ AI
              </h3>
              <p className="text-indigo-100 text-xs mt-1">
                វាយបញ្ចូលប្រធានបទដែលកូនៗចូលចិត្ត ដើម្បីឱ្យប្រព័ន្ធ AI បង្កើតល្បែងផ្គុំពាក្យខ្មែរថ្មីៗភ្លាមៗ!
              </p>
              <button 
                onClick={() => setAiMenuOpen(false)}
                className="absolute top-4 right-4 text-white/80 hover:text-white font-bold text-sm"
              >
                ✕
              </button>
            </div>
            {/* Modal Body */}
            <div className="p-5 md:p-6">
              
              {/* Tab selectors */}
              <div className="flex border-b border-slate-200 mb-5">
                <button
                  type="button"
                  onClick={() => setActiveTab("presets")}
                  className={`flex-1 py-2 text-center text-sm font-semibold border-b-2 transition-all ${
                    activeTab === "presets" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  ប្រធានបទស្រាប់ៗ (Offline Categories)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("ai")}
                  className={`flex-1 py-2 text-center text-sm font-semibold border-b-2 transition-all ${
                    activeTab === "ai" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  សរសេរប្រធានបទខ្លួនឯង (AI Custom)
                </button>
              </div>

              {activeTab === "presets" ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">
                    សូមជ្រើសរើសប្រធានបទកម្សាន្ត និងអប់រំដ៏ស្រស់ស្អាតខាងក្រោម៖
                  </p>
                  <div className="space-y-2 font-khmer">
                    {Object.keys(FALLBACK_CATEGORIES).map((catName) => (
                      <button
                        type="button"
                        key={catName}
                        onClick={() => handlePresetCategorySelect(catName)}
                        className="w-full text-left p-3.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200/50 flex justify-between items-center transition-all font-semibold text-slate-700"
                      >
                        <span>{catName}</span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </button>
                    ))}
                    
                    <button
                      type="button"
                      onClick={handleResetToPresets}
                      className="w-full mt-4 text-center p-3 text-sm font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl border border-dashed border-indigo-200 transition-colors"
                    >
                      ត្រឡប់ទៅប្រធានបទដើមវិញ (ពាក្យគន្លឹះទាំង ១០)
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleGenerateCustomTheme} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                      សូមវាយបញ្ចូលប្រធានបទ (Khmer Category Name)
                    </label>
                    <input
                      type="text"
                      required
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="ឧ. សត្វស្លាប, របស់របរក្នុងផ្ទះ, ផ្កាឈើ, របស់ញ៉ាំផ្អែមល្ហែម..."
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  {aiError && (
                    <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs text-center font-medium">
                      {aiError}
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setAiMenuOpen(false)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 text-sm font-semibold"
                    >
                      បោះបង់
                    </button>
                    <button
                      type="submit"
                      disabled={aiLoading}
                      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md flex items-center gap-2"
                    >
                      {aiLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>កំពុងបង្កើត...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>បង្កើតឥឡូវនេះ</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

            </div>
          </div>
        </div>
      )}

      {/* MODAL: Excel/CSV Import Dashboard */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center px-4 no-print animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="bg-emerald-600 p-5 text-white relative">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Upload className="w-5 h-5 text-yellow-300" />
                <span>នាំចូលពាក្យពីឯកសារ</span>
              </h3>
              <p className="text-xs text-emerald-100 mt-1">
                អាន និងផ្ទៀងផ្ទាត់ពាក្យខ្មែរស្វ័យប្រវត្តិចេញពីឯកសារបញ្ជីពាក្យរបស់អ្នក!
              </p>
              <button 
                type="button"
                onClick={() => {
                  playClickSound(soundEnabled);
                  setIsImportModalOpen(false);
                  setImportedPuzzles([]);
                  setImportError(null);
                }}
                className="absolute top-4 right-4 text-white hover:text-emerald-100 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCommitImport} className="p-5 space-y-4">
              
              {/* Validation Warning / Success Banner */}
              {importError ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
                  <span className="font-bold">⚠️ ការជូនដំណឹង / បញ្ហាខ្លះៗ៖</span>
                  <p className="whitespace-pre-line leading-relaxed">{importError}</p>
                </div>
              ) : (
                importedPuzzles.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-150 rounded-xl p-3 text-xs text-emerald-800 font-medium">
                    ✨ ជោគជ័យ! រកឃើញ {importedPuzzles.length} ពាក្យមានទម្រង់ត្រឹមត្រូវ និងរួចរាល់សម្រាប់ការនាំចូល។
                  </div>
                )
              )}

              {/* Import Action Strategy Select */}
              {importedPuzzles.length > 0 && (
                <div className="bg-slate-50 border border-slate-200/60 p-3.5 rounded-xl space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    វិធីសាស្ត្របញ្ចូលទៅក្នុងបញ្ជីលេង
                  </label>
                  <div className="flex items-center gap-4 mt-2">
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="importMethod"
                        value="append"
                        checked={importMethod === 'append'}
                        onChange={() => setImportMethod('append')}
                        className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span>បន្ថែមបន្តចូលបញ្ជីចាស់</span>
                    </label>

                    <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="importMethod"
                        value="replace"
                        checked={importMethod === 'replace'}
                        onChange={() => setImportMethod('replace')}
                        className="text-red-600 focus:ring-red-500 cursor-pointer"
                      />
                      <span className="text-red-700">លុបចាស់ជំនួសថ្មីទាំងអស់</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Informative instructions / Template download link */}
              <div className="text-xs bg-slate-50 border border-slate-200/50 p-3 rounded-xl flex items-center justify-between gap-4">
                <span className="text-slate-500 text-[11px] leading-snug">
                  តើអ្នកមិនមានទម្រង់ឯកសារបញ្ជីពាក្យត្រឹមត្រូវមែនទេ?
                </span>
                <button
                  type="button"
                  onClick={loadSampleCSVTemplate}
                  className="px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 text-[10px] sm:text-xs font-extrabold hover:bg-indigo-50 transition-colors cursor-pointer shrink-0"
                >
                  📥 ទាញយកគំរូឯកសារ Excel / CSV
                </button>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    playClickSound(soundEnabled);
                    setIsImportModalOpen(false);
                    setImportedPuzzles([]);
                    setImportError(null);
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 text-xs font-extrabold hover:bg-slate-50 cursor-pointer"
                >
                  បិទ
                </button>
                {importedPuzzles.length > 0 && (
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow transition-all cursor-pointer hover:scale-105"
                  >
                    រក្សាទុកចំនួន {importedPuzzles.length} ពាក្យ
                  </button>
                )}
              </div>
              
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Word Playlist */}
      {isPlaylistModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8 overflow-y-auto no-print">
          <div className="max-w-5xl w-full mx-auto my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-xl relative overflow-hidden" id="custom-word-builder-section">
              <div className="absolute -top-12 -left-12 w-40 h-40 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
              
              {/* Section Title */}
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-6">
                <div className="flex items-start gap-3 sm:gap-4">
                  <button 
                    onClick={() => {
                      playClickSound(soundEnabled);
                      setIsPlaylistModalOpen(false);
                    }}
                    className="w-10 h-10 bg-slate-50 hover:bg-slate-150 text-slate-600 rounded-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer shrink-0 border border-slate-200 mt-1 lg:mt-0"
                    title="ត្រឡប់ក្រោយ"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl hidden sm:flex items-center justify-center text-indigo-600 shrink-0 mt-1 lg:mt-0">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
                      បញ្ជីពាក្យសម្រាប់លេង
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 lg:mt-0.5">
                      អ្នកអាចលេងតាមលំដាប់ពាក្យដែលមានស្រាប់ ឬលុបពាក្យដែលមិនចង់លេងបាន!
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row w-full lg:w-auto items-stretch sm:items-center gap-2 shrink-0 lg:ml-auto">
                  {/* Hidden File Input for CSV Import */}
                  <input
                    type="file"
                    id="csv-file-import"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileImportChange}
                  />

                  <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleExportToCSV}
                      className="px-3 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-extrabold text-xs rounded-xl border border-slate-200 shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95 whitespace-nowrap"
                      title="នាំចេញបញ្ជីជាឯកសារ"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                      <span>នាំចេញបញ្ជី</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        playClickSound(soundEnabled);
                        document.getElementById('csv-file-import')?.click();
                      }}
                      className="px-3 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-extrabold text-xs rounded-xl border border-slate-200 shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95 whitespace-nowrap"
                      title="នាំចូលបញ្ជី"
                    >
                      <Upload className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                      <span>នាំចូលបញ្ជី</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      playClickSound(soundEnabled);
                      setIsAddWordModalOpen(true);
                    }}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md shadow-indigo-150 transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95 whitespace-nowrap w-full sm:w-auto"
                  >
                    <Plus className="w-4 h-4 shrink-0 font-bold" />
                    <span>បន្ថែមពាក្យថ្មី</span>
                  </button>
                </div>
              </div>

              <div className="w-full flex flex-col justify-between">
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-6 no-print">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <span>📋 បញ្ជីពាក្យបង្ហាញ ({filteredChallenges.length} / {challenges.length} ពាក្យ)</span>
                    </h3>
                    
                    {/* Category Filter */}
                    <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
                      <span className="text-xs font-bold text-slate-500 shrink-0">ក្រុមពាក្យ៖</span>
                      <select
                        value={selectedFilterCategory}
                        onChange={(e) => {
                          playClickSound(soundEnabled);
                          setSelectedFilterCategory(e.target.value);
                        }}
                        className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer w-full sm:w-auto flex-grow"
                      >
                        <option value="ទាំងអស់">🔍 បង្ហាញទាំងអស់ (All Groups)</option>
                        {Array.from(new Set(challenges.map(c => c.category || "ពាក្យអក្ខរាវិរុទ្ធខ្មែរ"))).map((catName) => (
                          <option key={catName} value={catName}>📁 {catName}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {filteredChallenges.length === 0 ? (
                    <div className="border border-dashed border-slate-200 rounded-2xl flex-grow flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-50/50 min-h-[220px]">
                      <p className="font-semibold text-sm">មិនទាន់មានពាក្យនៅក្នុងក្រុមពាក្យនេះនៅឡើយ!</p>
                      <p className="text-xs mt-1 max-w-xs leading-relaxed">
                        សូមជ្រើសរើសក្រុមពាក្យផ្សេង ឬចុចផ្ដើមឡើងវិញដើម្បីលេងពាក្យគំរូ។
                      </p>
                    </div>
                  ) : (
                    <div className="mb-8 border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-md">
                      <div className="max-h-[440px] overflow-y-auto custom-scrollbar relative">
                        <table className="w-full text-left border-collapse font-khmer">
                          <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 shadow-sm border-b border-slate-200">
                            <tr className="text-[11px] sm:text-xs font-black text-slate-500 uppercase tracking-wider">
                              <th className="py-3 px-4 w-16 text-center">ល.រ</th>
                              <th className="py-3 px-4">ពាក្យខ្មែរ</th>
                              <th className="py-3 px-4 w-48 text-right">សកម្មភាព</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredChallenges.map((c, idx) => {
                              return (
                                <tr 
                                  key={`${c.id}-${idx}`} 
                                  className="hover:bg-indigo-50/20 group transition-all duration-150"
                                >
                                  {/* Index column */}
                                  <td className="py-3 text-center px-4 align-middle">
                                    <span className="inline-flex w-8 h-8 rounded-lg text-xs font-extrabold items-center justify-center bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                      {toKhmerNumeral(idx + 1)}
                                    </span>
                                  </td>
                                  
                                  {/* Word / Details column */}
                                  <td className="py-3 px-4 align-middle">
                                    <div className="flex flex-col text-left">
                                      <span className="font-extrabold text-base text-slate-900 tracking-wide whitespace-nowrap">
                                        {c.word}
                                      </span>
                                    </div>
                                  </td>

                                  {/* Buttons Action column */}
                                  <td className="py-3 px-4 align-middle text-right">
                                    <div className="flex items-center justify-end gap-2 text-right">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          playClickSound(soundEnabled);
                                          handleDeleteWord(c.id);
                                        }}
                                        className="w-8 h-8 sm:w-9 sm:h-9 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center shrink-0 border border-rose-100/30"
                                        title="លុបពាក្យនេះ"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {filteredChallenges.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      playClickSound(soundEnabled);
                      setIsPlaylistModalOpen(false);
                    }}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-4 px-6 rounded-2xl shadow-xl shadow-indigo-150 transition-all flex items-center justify-center gap-3 text-base md:text-lg select-none active:scale-[0.98] cursor-pointer"
                  >
                    <span>រក្សាទុក</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MCQ Builder (List View) */}
      {isMcModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8 overflow-y-auto no-print">
          <div className="max-w-4xl w-full mx-auto my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-xl relative overflow-hidden flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-6 font-khmer shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 shrink-0">
                    <CheckSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 leading-tight">
                      គ្រប់គ្រងសំណួរពហុជម្រើស
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                      តារាងសំណួរដែលបានបញ្ចូល ({mcQuestions.length})
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDownloadTemplate}
                    className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl shadow-sm transition-all text-sm flex items-center gap-2"
                    title="ទាញយកពុម្ពគំរូ Excel"
                  >
                    <Download className="w-4 h-4" />
                    ទាញពុម្ពគំរូ
                  </button>
                  <div className="relative overflow-hidden group">
                    <button
                      className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold rounded-xl shadow-sm transition-all text-sm flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      ទាញចូល Excel
                    </button>
                    <input 
                      type="file" 
                      accept=".xlsx, .xls" 
                      onChange={handleExcelImport}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </div>
                  <button
                    onClick={() => {
                      playClickSound(soundEnabled);
                      setEditingMcId(null);
                      setNewMcQuestion("");
                      setNewMcOptions(["", "", "", ""]);
                      setNewMcCorrectOption(0);
                      setNewMcTopic("ទូទៅ");
                      setIsMcFormModalOpen(true);
                    }}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-sm transition-all text-sm flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    បញ្ចូលសំណួរថ្មី
                  </button>
                  <button 
                    onClick={() => {
                      playClickSound(soundEnabled);
                      setIsMcModalOpen(false);
                    }}
                    className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="font-khmer flex-grow min-h-0 overflow-y-auto pr-2">
                {mcQuestions.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>មិនទាន់មានសំណួរនៅឡើយទេ</p>
                    <p className="text-sm mt-1">សូមចុចប៊ូតុង "បញ្ចូលសំណួរថ្មី" ដើម្បីបន្ថែម</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mcQuestions.map((q, idx) => (
                      <div key={`modal-q-${idx}`} className="p-4 rounded-xl border border-slate-100 bg-slate-50 relative group flex items-start gap-4">
                        <div className="bg-purple-100 text-purple-700 font-bold w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-1">
                          {idx + 1}
                        </div>
                        <div className="pr-8 flex-grow">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-bold font-khmer text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">{q.topic || "ទូទៅ"}</span>
                          </div>
                          <h4 className="font-bold text-base text-slate-800 mb-3">{q.question}</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                            {q.options.map((o, i) => (
                              <div key={i} className={`px-3 py-2 rounded-lg border ${o === q.correctOption ? "bg-emerald-50 border-emerald-200 text-emerald-800 font-bold flex items-center justify-between" : "bg-white border-slate-100 text-slate-600"}`}>
                                <span>{o}</span>
                                {o === q.correctOption && <Check className="w-4 h-4 text-emerald-600" />}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              playClickSound(soundEnabled);
                              setNewMcQuestion(q.question);
                              setNewMcOptions([...q.options]);
                              setNewMcCorrectOption(q.options.indexOf(q.correctOption) !== -1 ? q.options.indexOf(q.correctOption) : 0);
                              setNewMcTopic(q.topic || "ទូទៅ");
                              setEditingMcId(q.id);
                              setIsMcFormModalOpen(true);
                            }}
                            className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            title="កែប្រែ"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                          </button>
                          {mcQuestions.length > 1 && (
                            <button
                              onClick={() => {
                                playClickSound(soundEnabled);
                                setMcToDelete(q.id);
                              }}
                              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                              title="លុប"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {mcQuestions.length > 0 && (
                <div className="pt-6 mt-4 border-t border-slate-100 font-khmer">
                  <button 
                    onClick={() => {
                      playClickSound(soundEnabled);
                      setIsMcModalOpen(false);
                      setActiveGameMode("multiplechoice");
                      setCurrentMcIdx(0);
                    }}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 transition-transform active:scale-95 text-lg"
                  >
                    លេងឥឡូវនេះ
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add MCQ Form */}
      {isMcFormModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 md:p-8 overflow-y-auto no-print">
          <div className="max-w-2xl w-full mx-auto my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-xl relative overflow-hidden flex flex-col">
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-6 font-khmer shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 shrink-0">
                    {editingMcId !== null ? <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg> : <Plus className="w-6 h-6" />}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 leading-tight">
                      {editingMcId !== null ? "កែប្រែសំណួរ" : "បង្កើតសំណួរថ្មី"}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                      {editingMcId !== null ? "កែប្រែសំណួរ និងជម្រើសរបស់អ្នក។" : "បញ្ចូលសំណួរ និងជម្រើសទាំង៤ របស់អ្នក។"}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    playClickSound(soundEnabled);
                    setIsMcFormModalOpen(false);
                    setEditingMcId(null);
                    setNewMcQuestion("");
                    setNewMcOptions(["", "", "", ""]);
                    setNewMcCorrectOption(0);
                  }}
                  className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="font-khmer space-y-6">
                {/* Topic Input */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">១. ប្រធានបទ / កម្រិត</label>
                  {uniqueMcTopics.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      <div className="relative">
                        <select
                          value={uniqueMcTopics.includes(newMcTopic) ? newMcTopic : "NEW"}
                          onChange={(e) => {
                            if (e.target.value !== "NEW") {
                              setNewMcTopic(e.target.value);
                            } else {
                              setNewMcTopic("");
                            }
                          }}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-400 focus:bg-white transition-colors appearance-none font-khmer cursor-pointer"
                        >
                          <optgroup label="ប្រធានបទមានស្រាប់">
                            {uniqueMcTopics.map(topic => (
                              <option key={topic} value={topic}>{topic}</option>
                            ))}
                          </optgroup>
                          <option value="NEW">✨ បង្កើតប្រធានបទថ្មី...</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                        </div>
                      </div>
                      
                      {(!uniqueMcTopics.includes(newMcTopic)) && (
                        <input
                          type="text"
                          value={newMcTopic}
                          onChange={(e) => setNewMcTopic(e.target.value)}
                          placeholder="ឧ. ចំណេះដឹងទូទៅ, កម្រិត១..."
                          className="w-full px-4 py-3 bg-white border border-purple-200 rounded-xl focus:outline-none focus:border-purple-400 shadow-inner transition-colors animate-in fade-in"
                          autoFocus
                        />
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={newMcTopic}
                      onChange={(e) => setNewMcTopic(e.target.value)}
                      placeholder="ឧ. ចំណេះដឹងទូទៅ, កម្រិត១..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-400 focus:bg-white transition-colors"
                    />
                  )}
                </div>

                {/* Question Input */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">២. សំណួរ</label>
                  <input
                    type="text"
                    value={newMcQuestion}
                    onChange={(e) => setNewMcQuestion(e.target.value)}
                    placeholder="ឧ. តើប្រាសាទអង្គរវត្តស្ថិតនៅខេត្តណា?"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-400 focus:bg-white transition-colors"
                  />
                </div>

                {/* Options Input */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">៣. ជម្រើសចម្លើយ និង ចម្លើយត្រឹមត្រូវ</label>
                  <p className="text-xs text-slate-500 mb-4">សូមបញ្ចូលជម្រើសទាំង៤ ហើយជ្រើសរើសយកមួយណាជាទិន្នន័យចម្លើយត្រឹមត្រូវ (Tick 👉)</p>
                  
                  <div className="space-y-3">
                    {newMcOptions.map((opt, idx) => (
                      <div key={idx} className={`flex items-center gap-3 p-2 rounded-xl border ${newMcCorrectOption === idx ? "border-emerald-400 bg-emerald-50/30" : "border-slate-100"}`}>
                        <button 
                          onClick={() => setNewMcCorrectOption(idx)}
                          className={`w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${newMcCorrectOption === idx ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-white"}`}
                        >
                          {newMcCorrectOption === idx && <Check className="w-4 h-4 text-white" />}
                        </button>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...newMcOptions];
                            newOpts[idx] = e.target.value;
                            setNewMcOptions(newOpts);
                          }}
                          placeholder={`ជម្រើស ${idx + 1}`}
                          className="w-full px-3 py-2 bg-transparent border-none focus:outline-none focus:ring-0"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Save Button */}
                <button
                  onClick={() => {
                    if (!newMcQuestion.trim() || newMcOptions.some(o => !o.trim()) || !newMcTopic.trim()) {
                      alert("សូមបំពេញប្រធានបទ សំណួរ និងជម្រើសទាំង៤ ឲ្យបានគ្រប់!");
                      return;
                    }
                    playClickSound(soundEnabled);
                    
                    if (editingMcId !== null) {
                      setMcQuestions(
                        mcQuestions.map(q => 
                          q.id === editingMcId ? { 
                            ...q, 
                            question: newMcQuestion, 
                            options: [...newMcOptions], 
                            correctOption: newMcOptions[newMcCorrectOption],
                            topic: newMcTopic
                          } : q
                        )
                      );
                    } else {
                      const newQuestion = {
                        id: Date.now(),
                        question: newMcQuestion,
                        options: [...newMcOptions],
                        correctOption: newMcOptions[newMcCorrectOption],
                        topic: newMcTopic
                      };
                      setMcQuestions([...mcQuestions, newQuestion]);
                    }
                    
                    setNewMcQuestion("");
                    setNewMcOptions(["", "", "", ""]);
                    setNewMcCorrectOption(0);
                    setEditingMcId(null);
                    setIsMcFormModalOpen(false);
                  }}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-purple-200 transition-transform active:scale-95 flex items-center justify-center gap-2 text-lg mt-4"
                >
                  <CheckSquare className="w-5 h-5" />
                  <span>{editingMcId !== null ? "រក្សាទុកការកែប្រែ" : "រក្សាទុកសំណួរនេះ"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* MODAL: Delete Confirmation */}
      {mcToDelete !== null && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full mx-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200 font-khmer text-center">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center text-rose-500 mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">បញ្ជាក់ការលុប</h3>
            <p className="text-slate-500 mb-8 text-sm">
              តើអ្នកពិតជាចង់លុបសំណួរនេះមែនទេ? លុបហើយមិនអាចយកមកវិញបានទេ។
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  playClickSound(soundEnabled);
                  setMcToDelete(null);
                }}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
              >
                បោះបង់
              </button>
              <button
                onClick={() => {
                  playClickSound(soundEnabled);
                  const newQuestions = mcQuestions.filter(q => q.id !== mcToDelete);
                  setMcQuestions(newQuestions);
                  setCurrentMcIdx(0);
                  setMcToDelete(null);
                }}
                className="flex-1 py-3 px-4 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl shadow-lg shadow-rose-200 transition-colors"
              >
                យល់ព្រមលុប
              </button>
            </div>
          </div>
        </div>
      )}


      {/* MODAL: Simple Word Viewer for Kids / Preview */}
      {isWordViewerOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8 overflow-y-auto no-print">
          <div className="max-w-4xl w-full mx-auto my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-xl relative overflow-hidden">
              <div className="absolute -top-12 -left-12 w-40 h-40 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
              
              {/* Header */}
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 shrink-0 border border-amber-100/50">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg md:text-xl font-black text-slate-900 leading-tight">
                      បញ្ជីពាក្យអក្ខរាវិរុទ្ធ (Vocabulary Word List)
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">
                      មើល ពិនិត្យ និងស្វែងយល់អត្ថន័យពាក្យក្នុងមេរៀននីមួយៗ!
                    </p>
                  </div>
                </div>
                
                <button 
                  onClick={() => {
                    playClickSound(soundEnabled);
                    setIsWordViewerOpen(false);
                    setViewerSearchQuery("");
                  }}
                  className="w-9 h-9 bg-slate-100 hover:bg-slate-250 text-slate-500 hover:text-slate-800 rounded-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer border border-slate-200"
                  title="បិទ"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/40">
                {/* Search Bar */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </span>
                  <input
                    type="text"
                    value={viewerSearchQuery}
                    onChange={(e) => setViewerSearchQuery(e.target.value)}
                    placeholder="វាយស្វែងរកពាក្យ..."
                    className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all shadow-sm"
                  />
                  {viewerSearchQuery && (
                    <button
                      onClick={() => setViewerSearchQuery("")}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Group Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-500 shrink-0">ក្រុមពាក្យ៖</span>
                  <select
                    value={viewerCategoryFilter}
                    onChange={(e) => {
                      playClickSound(soundEnabled);
                      setViewerCategoryFilter(e.target.value);
                    }}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 shadow-sm cursor-pointer"
                  >
                    <option value="ទាំងអស់">🔍 គ្រប់ក្រុមពាក្យទាំងអស់ (All Groups)</option>
                    {Array.from(new Set(challenges.map(c => c.category || "ពាក្យអក្ខរាវិរុទ្ធខ្មែរ"))).map((catName) => (
                      <option key={catName} value={catName}>📁 {catName}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items Count Header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                  បានរកឃើញ៖ {challenges.filter(c => {
                    const matchesCategory = viewerCategoryFilter === "ទាំងអស់" || (c.category || "ពាក្យអក្ខរាវិរុទ្ធខ្មែរ") === viewerCategoryFilter;
                    const matchesKeyword = c.word.includes(viewerSearchQuery) || c.clue.includes(viewerSearchQuery);
                    return matchesCategory && matchesKeyword;
                  }).length} / {challenges.length} ពាក្យ
                </span>
              </div>

              {/* Scrollable grid of words */}
              <div className="max-h-[380px] overflow-y-auto pr-1">
                {challenges.filter(c => {
                  const matchesCategory = viewerCategoryFilter === "ទាំងអស់" || (c.category || "ពាក្យអក្ខរាវិរុទ្ធខ្មែរ") === viewerCategoryFilter;
                  const matchesKeyword = c.word.includes(viewerSearchQuery) || c.clue.includes(viewerSearchQuery);
                  return matchesCategory && matchesKeyword;
                }).length === 0 ? (
                  <div className="border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-12 text-center text-slate-400 bg-slate-50 min-h-[220px]">
                    <Search className="w-10 h-10 text-slate-300 mb-2" />
                    <p className="font-extrabold text-sm text-slate-600">រកមិនឃើញពាក្យដែលអ្នកចង់ស្វែងរកទេ!</p>
                    <p className="text-xs mt-1 max-w-xs leading-relaxed text-slate-400">
                      សូមព្យាយាមវាយស្វែងរកពាក្យផ្សេង ឬប្ដូរក្រុមពាក្យចម្រុះ។
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-2">
                    {challenges
                      .filter(c => {
                        const matchesCategory = viewerCategoryFilter === "ទាំងអស់" || (c.category || "ពាក្យអក្ខរាវិរុទ្ធខ្មែរ") === viewerCategoryFilter;
                        const matchesKeyword = c.word.includes(viewerSearchQuery) || c.clue.includes(viewerSearchQuery);
                        return matchesCategory && matchesKeyword;
                      })
                      .map((c, idx) => (
                        <div 
                          key={`${c.id}-${idx}`} 
                          className="bg-gradient-to-b from-white to-slate-50/40 border border-slate-200/80 rounded-2xl p-4 flex flex-col items-center justify-between text-center relative group hover:border-amber-400 hover:shadow-md hover:scale-[1.01] transition-all duration-200"
                        >
                          {/* Top row */}
                          <div className="w-full flex items-center justify-between mb-2">
                            <span className="px-2 py-0.5 bg-amber-50 border border-amber-100 text-amber-700 rounded-lg text-[10px] font-black">
                              ពាក្យទី {toKhmerNumeral(idx + 1)}
                            </span>
                            <span className="text-[9px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-lg font-black max-w-[120px] truncate" title={c.category || "ទូទៅ"}>
                              📁 {c.category || "ទូទៅ"}
                            </span>
                          </div>

                          {/* Huge friendly word display */}
                          <h4 className="text-3xl font-black text-slate-800 my-2 group-hover:text-indigo-600 transition-colors tracking-wide">
                            {c.word}
                          </h4>

                          {/* Visual syllable puzzle breakdown */}
                          <div className="flex flex-wrap items-center justify-center gap-1 my-2">
                            {c.blocks.map((block, bIdx) => (
                              <div 
                                key={bIdx} 
                                className="w-8 h-8 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center font-black text-indigo-600 text-xs border-b-[3px] border-b-slate-300"
                              >
                                {block}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Dialog Footer Actions */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    playClickSound(soundEnabled);
                    setIsWordViewerOpen(false);
                    setViewerSearchQuery("");
                  }}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs sm:text-sm rounded-xl border border-slate-200 transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  បិទផ្ទាំងនេះ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Add Custom Word */}
      {isAddWordModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center px-4 no-print">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-150 max-w-md w-full overflow-hidden animate-in fade-in duration-200">
            <div className="bg-indigo-600 p-5 text-white relative">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-yellow-300" />
                បន្ថែមពាក្យថ្មី (Add Custom Word)
              </h3>
              <p className="text-xs text-indigo-100 mt-1">
                សូមបញ្ចូលពាក្យខ្មែរ ហើយជ្រើសរើសតួអក្សរដែលត្រូវលាក់សម្រាប់ឱ្យសិស្សល្បងកម្សាន្ត!
              </p>
              <button 
                onClick={() => {
                  playClickSound(soundEnabled);
                  setIsAddWordModalOpen(false);
                  setNewWord("");
                  setWordError(null);
                }}
                className="absolute top-4 right-4 text-white hover:text-indigo-100 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <form onSubmit={handleAddCustomWord} className="space-y-4">
                {/* Word Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                    ពាក្យខ្មែរ
                  </label>
                  <input
                    type="text"
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    placeholder="ឧ. សាលារៀន"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Word Group (Category/ក្រុមពាក្យ) Select */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                    ក្រុមពាក្យ (Word Group / Category)
                  </label>
                  <select
                    value={isCustomCategoryMode ? "__custom__" : selectedCategory}
                    onChange={(e) => {
                      playClickSound(soundEnabled);
                      if (e.target.value === "__custom__") {
                        setIsCustomCategoryMode(true);
                      } else {
                        setIsCustomCategoryMode(false);
                        setSelectedCategory(e.target.value);
                      }
                    }}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
                  >
                    {Array.from(new Set(challenges.map(c => c.category || "ពាក្យអក្ខរាវិរុទ្ធខ្មែរ"))).map((catName) => (
                      <option key={`modal-cat-${catName}`} value={catName}>
                        📁 {catName}
                      </option>
                    ))}
                    <option value="__custom__">➕ បង្កើតក្រុមពាក្យថ្មី... (New custom group)</option>
                  </select>
                </div>

                {isCustomCategoryMode && (
                  <div className="bg-amber-50/50 border border-amber-200/60 p-3.5 rounded-xl animate-in slide-in-from-top-1 duration-200">
                    <label className="block text-xs font-bold text-indigo-700 uppercase mb-2">
                      ឈ្មោះក្រុមពាក្យថ្មី (New Group Name)
                    </label>
                    <input
                      type="text"
                      value={customCategoryInput}
                      onChange={(e) => setCustomCategoryInput(e.target.value)}
                      placeholder="ឧ. សត្វស្លាប, ផ្លែឈើ, សាលារៀន..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                )}

                {/* Auto Split Preview */}
                {newWordBlocks.length > 0 && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <span className="block text-[11px] font-bold text-slate-500 uppercase mb-2 tracking-wide">
                      ការផ្គុំតួអក្សរស្វ័យប្រវត្ត (ចុចដើម្បីលាក់/បង្ហាញជាគន្លឹះ)៖
                    </span>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                      {newWordBlocks.map((block, idx) => {
                        const isPref = newWordPrefilled[idx];
                        return (
                          <button
                            key={`preview-block-${idx}`}
                            type="button"
                            onClick={() => toggleNewWordPrefilledIdx(idx)}
                            className={`px-3 py-2 rounded-xl border font-bold text-sm flex flex-col items-center gap-1 transition-all cursor-pointer ${
                              isPref 
                                ? "bg-white border-slate-200 text-slate-400 font-normal" 
                                : "bg-amber-50 border-amber-300 text-amber-600 ring-2 ring-amber-100"
                            }`}
                            title={isPref ? "ចុចដើម្បីលាក់តួអក្សរនេះ" : "ចុចដើម្បីបង្ហាញជាតួអក្សរគន្លឹះ"}
                          >
                            <span className="text-base">{block}</span>
                            <span className="text-[9px] uppercase tracking-wider font-semibold opacity-85">
                              {isPref ? "គន្លឹះ" : "លាក់"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    
                    <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                      * ប្រអប់ពណ៌លឿង <strong className="text-amber-600">លាក់</strong> គឺតម្រូវឱ្យបំពេញក្នុងការលេង។ ប្រអប់ពណ៌ប្រផេះ <strong className="text-slate-400">គន្លឹះ</strong> បង្ហាញជាតក្កគន្លឹះស្រាប់។
                    </p>
                  </div>
                )}

                {wordError && (
                  <div className="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl border border-rose-100">
                    ⚠️ {wordError}
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      playClickSound(soundEnabled);
                      setIsAddWordModalOpen(false);
                      setNewWord("");
                      setWordError(null);
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                  >
                    បិទវិញ
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow flex items-center gap-1.5 cursor-pointer animate-pulse"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Save</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Print Options for Word Search */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 max-w-sm w-full animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <Printer className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 font-khmer">ឆ្នៃសន្លឹកកិច្ចការ</h3>
              </div>

              <div className="space-y-4 mb-8">
                <label className="block text-sm font-bold text-slate-700 font-khmer leading-relaxed">
                  ចំនួនសន្លឹកកិច្ចការ (ទាញយកម្តងបានច្រើនសន្លឹកដោយពាក្យដដែល តែប្តូរទីតាំងចុះឡើងជារាងរហូត)៖
                </label>
                <div className="flex items-center justify-between border-2 border-indigo-100 rounded-xl p-2 bg-slate-50">
                   <button 
                     onClick={() => setWordSearchPrintPages(Math.max(1, wordSearchPrintPages - 1))}
                     className="w-12 h-12 rounded-lg bg-white border border-slate-200 text-slate-600 font-xl flex items-center justify-center shadow-sm hover:bg-slate-50 active:scale-95"
                   >
                     -
                   </button>
                   <span className="text-2xl font-black text-indigo-700 tabular-nums">
                     {wordSearchPrintPages}
                   </span>
                   <button 
                     onClick={() => setWordSearchPrintPages(Math.min(20, wordSearchPrintPages + 1))}
                     className="w-12 h-12 rounded-lg bg-white border border-slate-200 text-slate-600 font-xl flex items-center justify-center shadow-sm hover:bg-slate-50 active:scale-95"
                   >
                     +
                   </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="flex-1 py-3 px-4 bg-white border-2 border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-colors"
                >
                  បោះបង់
                </button>
                <button
                  onClick={() => executePrintView(wordSearchPrintPages)}
                  className="flex-1 py-3 px-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>ទាញយក</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MCQ Countdown Overlay */}
      {mcCountdown !== null && mcCountdown >= 0 && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[120] flex flex-col items-center justify-center animate-in fade-in duration-200">
          <div className="text-white text-center font-khmer">
            <h2 className="text-3xl md:text-5xl font-bold mb-8 opacity-90 animate-pulse text-red-100">រាប់ថយក្រោយបង្ហាញចម្លើយ...</h2>
            <div className="text-[12rem] md:text-[18rem] leading-none font-black text-red-500 drop-shadow-[0_0_60px_rgba(239,68,68,0.8)] tabular-nums animate-in zoom-in-50 duration-300" key={mcCountdown}>
              {toKhmerNumeral(mcCountdown)}
            </div>
          </div>
        </div>
      )}

      {/* CELEBRATION CERTIFICATE WIN MODAL */}
      {showCertificate && (
        <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-2xl w-full p-6 md:p-8 text-center animate-in zoom-in-95 duration-300 no-print">
            
            {/* Certificate Header */}
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center border-4 border-amber-400">
                <Award className="w-12 h-12 text-amber-500 fill-amber-300 animate-spin-slow" />
              </div>
            </div>

            <h2 className="text-2xl md:text-3xl font-extrabold text-indigo-950 tracking-tight leading-tight">
              អបអរសាទរ កូនៗរៀនអានចប់សព្វគ្រប់ហើយ!
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              កូនបានប្រឡងជាប់ និងផ្គុំពាក្យខ្មែរបានត្រឹមត្រូវទាំងអស់ គួរឱ្យសរសើរក្រៃលែង!
            </p>

            {/* Custom Certificate Frame for Display */}
            <div className="my-6 p-6 md:p-8 bg-amber-50/50 rounded-2xl border-4 border-dashed border-amber-300 relative text-center">
              <div className="absolute top-2 left-2 text-[10px] text-amber-300">★</div>
              <div className="absolute top-2 right-2 text-[10px] text-amber-300">★</div>
              <div className="absolute bottom-2 left-2 text-[10px] text-amber-300">★</div>
              <div className="absolute bottom-2 right-2 text-[10px] text-amber-300">★</div>

              <h4 className="text-xs uppercase tracking-widest text-slate-500 font-bold">វិញ្ញាបនបត្រជ័យលាភី</h4>
              <h3 className="text-lg md:text-xl font-bold text-indigo-900 mt-2">ល្បែងផ្គុំពាក្យខ្មែរ (Khmer Spelling Master)</h3>
              
              <div className="my-5 max-w-xs mx-auto">
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">សូមសរសេរឈ្មោះកូនៗសិស្សនៅទីនេះ៖</label>
                <input
                  type="text"
                  value={certificateName}
                  onChange={(e) => setCertificateName(e.target.value)}
                  className="w-full text-center border-b-2 border-amber-400 focus:border-indigo-500 text-xl font-bold bg-transparent py-1 text-slate-800 outline-none placeholder-slate-300"
                  placeholder="ឈ្មោះរបស់កូន..."
                />
              </div>

              <p className="text-xs text-slate-500 italic px-4 leading-relaxed">
                "វិញ្ញាបនបត្រនេះ បញ្ជាក់ថា {certificateName || "កូនល្អ"} ទទួលបានជោគជ័យក្នុងការសិក្សា អាន និងផ្គុំពាក្យភាសារខ្មែរបានត្រឹមត្រូវ និងរហ័សបំផុត!"
              </p>

              <div className="mt-6 flex justify-between items-center text-[10px] text-slate-400">
                <div>
                  <span className="block border-t border-slate-200 pt-1 px-4">ថ្ងៃទី {new Date().toLocaleDateString("km-KH")}</span>
                </div>
                <div>
                  <span className="block border-t border-slate-200 pt-1 px-4 font-bold text-slate-600">គ្រូបង្រៀនឌីជីថល (AI Teacher)</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => setShowCertificate(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-semibold"
              >
                ត្រឡប់ទៅការលេងឡើងវិញ
              </button>
              
              <button
                onClick={handlePrint}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold shadow flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>បោះពុម្ភវិញ្ញាបនបត្រ (Print)</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* PRINT-ONLY AREA: HIDDEN ON SCREENS, VISIBLE ON printer paper */}
      <div id="worksheet-print-area" className={`hidden print:block ${activeGameMode === "wordcard" ? "p-0" : "p-[0.5cm]"} bg-white text-slate-900 border-none font-khmer`}>
        
        {activeGameMode === "wordcard" ? (
          <div className="flex flex-col w-full gap-0 bg-transparent">
            {(() => {
              const filtered = wordCardCategoryFilter === "All" ? wordCards : wordCards.filter(c => c.category === wordCardCategoryFilter);
              const chunks = [];
              for (let i = 0; i < filtered.length; i += 3) {
                chunks.push(filtered.slice(i, i + 3));
              }
              return chunks.map((chunk, chunkIdx) => (
                <div 
                  key={`print-page-${chunkIdx}`} 
                  className="print-page relative"
                  style={{ 
                    pageBreakAfter: chunkIdx < chunks.length - 1 ? "always" : "auto", 
                    pageBreakInside: "avoid" 
                  }}
                >
                  {chunk.map((card, idx) => {
                    const displayColor = wordCardThemeMode === "bw" ? "#000000" : (wordCardThemeMode === "single" ? wordCardSingleColor : card.color);
                    const displayTitle = card.title ? `អំណាន ៖ ${card.title.replace(/^(អំណាន\s*៖\s*)+/, "").trim()}` : "អំណាន";
                    return (
                      <React.Fragment key={card.id}>
                        {idx > 0 && (
                          <div className="w-full flex items-center justify-center relative z-10" aria-hidden="true">
                            <div className="w-full border-t-[2px] border-dashed border-slate-300 absolute"></div>
                            <Scissors className="w-4 h-4 text-slate-400 absolute left-[3%] bg-white px-1 sm:left-[5%]" style={{ width: '24px', height: '24px' }} />
                          </div>
                        )}
                        <div 
                          className="print-page-card relative overflow-hidden" 
                          style={{ 
                            pageBreakInside: "avoid",
                            ...(wordCardBorder === "custom" && wordCardCustomFrame ? {
                              backgroundImage: `url(${wordCardCustomFrame})`,
                              backgroundSize: '100% 100%',
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'center',
                              border: 'none',
                            } : {
                               border: 'none'
                             })
                          }}
                        >
                          <div 
                            style={{ 
                              borderColor: wordCardBorder === "custom" ? "transparent" : displayColor, 
                              borderWidth: wordCardBorder === "custom" ? "0px" : `${wordCardBorderWidth}px`, 
                              borderRadius: wordCardBorder === "custom" ? "0px" : `${wordCardBorderRadius}px` 
                            }} 
                            className={`border-solid ${wordCardBorder === "classic" ? "p-2" : ""} h-full w-full`}
                          >
                          <div 
                            style={{ 
                              borderColor: wordCardBorder === "classic" ? displayColor : "transparent",
                              borderWidth: wordCardBorder === "classic" ? "2px" : "0px",
                              borderRadius: wordCardBorder === "custom" ? "0px" : `${Math.max(0, wordCardBorderRadius - (wordCardBorder === "classic" ? 8 : 0))}px`
                            }} 
                            className={`border-solid ${wordCardBorder === "classic" ? "p-6" : "p-8"} h-full w-full flex flex-col justify-between relative ${wordCardBorder === "custom" ? "bg-transparent" : "bg-white"}`}
                          >
                            <div className="flex-grow flex items-center justify-center">
                              <h2 
                                style={{ 
                                  color: displayColor,
                                  textShadow: wordCardThemeMode !== "bw" ? `2px 4px 6px rgba(0,0,0,0.12)` : "none",
                                  fontFamily: wordCardFontFamily,
                                  fontSize: `${Math.max(20, wordCardTextSize)}px`,
                                  lineHeight: "1.2",
                                  fontWeight: wordCardFontFamily.toLowerCase().includes("moul") ? 400 : 900
                                }} 
                                className="text-center font-khmer"
                              >
                                {card.word}
                              </h2>
                            </div>
                          </div>
                        </div>
                      </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              ));
            })()}
          </div>
        ) : activeGameMode === "wordsearch" ? null
          : activeGameMode === "spelling" ? (
          <div className="w-full mb-6 font-khmer">
            <div className="flex justify-between items-center border-b-[3px] border-indigo-600 pb-4 mb-8 font-khmer">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-600 rounded-[20px] flex items-center justify-center shadow-lg shrink-0">
                  <Award className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl text-slate-800 font-khmer font-black leading-tight mb-2">
                    ល្បែងផ្គុំពាក្យខ្មែរ
                  </h1>
                  <p className="text-xs text-slate-500 font-medium">
                    បំពេញព្យញ្ជនៈ ស្រៈ និងជើងអក្សរក្នុងប្រអប់
                  </p>
                </div>
              </div>
              <div className="text-right text-xs space-y-1.5 text-slate-800">
                <p>ឈ្មោះសិស្ស ៖ {studentName ? studentName : "......................................"}</p>
                <p>កាលបរិច្ឆេទ ៖ ......../........./...........</p>
              </div>
            </div>

            <div className="mb-6 p-4 border border-slate-200 bg-slate-50 rounded-2xl text-center">
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-khmer">
                <strong>សេចក្ដីណែនាំសម្រាប់សិស្ស៖</strong> ចូរបំពេញតួអក្សរ ស្រៈ ឬជើងព្យញ្ជនៈខ្មែរក្នុងប្រអប់ទំនេរ (ប្រអប់ពណ៌លឿង) ឱ្យបានត្រឹមត្រូវទៅតាមទម្រង់អក្ខរាវិរុទ្ធនៃពាក្យនីមួយៗ ដោយជ្រើសរើសតួអក្សរដែលបានផ្ដល់ជូនខាងក្រោមតារាងនីមួយៗ។
              </p>
            </div>
          </div>
        ) : null}

        {/* Certificate section inside worksheet if completed */}
        {showCertificate && activeGameMode !== "wordcard" && (
          <div className="p-6 border-4 double border-amber-500 rounded-xl mb-6 bg-slate-50 text-center relative">
            <h2 className="text-xl font-bold text-indigo-950 uppercase tracking-widest">វិញ្ញាបនបត្រជ័យលាភីសមិទ្ធផល</h2>
            <p className="text-xs text-slate-500 mt-1">ជូនចំពោះសិស្សឆ្នើម</p>
            <h3 className="text-2xl font-extrabold text-slate-800 my-4 decoration-amber-400 underline decoration-2">{certificateName || studentName || "កូនល្អ"}</h3>
            <p className="text-sm text-slate-600 italic px-10 leading-relaxed">
              "ទទួលបានការកោតសរសើរក្នុងការបំពេញលំហាត់អំណាន ផ្គុំ និងស្គាល់ពាក្យ បានល្បឿនលឿន និងត្រឹមត្រូវបំផុត!"
            </p>
            <div className="mt-8 flex justify-between text-xs text-slate-400">
              <span className="border-t border-slate-200 pt-1">កាលបរិច្ឆេទ</span>
              <span className="border-t border-slate-200 pt-1 font-bold text-slate-600">ហត្ថលេខាគ្រូបង្រៀន</span>
            </div>
          </div>
        )}

        {activeGameMode === "wordsearch" ? (
          (wordSearchPrintGrids.length > 0 ? wordSearchPrintGrids : [{ grid: wordSearchGrid, placements: wordSearchPlacements }]).map((gridData, pageIdx, arr) => (
            <div key={`ws-page-${pageIdx}`} className="print-page relative bg-white mx-auto flex flex-col justify-start" style={pageIdx < arr.length - 1 ? { pageBreakAfter: "always", padding: "1cm" } : { padding: "1cm" }}>
              <div className="flex flex-col w-full mb-4">
                <div className="flex justify-between items-center border-b-[3px] border-amber-500 pb-2 mb-3 font-khmer">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-xl md:text-2xl text-slate-800 font-khmer font-black leading-tight mb-1">
                        ល្បែងស្វែងរកពាក្យខ្មែរ
                      </h1>
                      <p className="text-xs text-slate-500 font-medium">
                        រាវរកទីតាំងពាក្យដែលលាក់នៅក្នុងតារាងអក្សរ
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-xs space-y-1 text-slate-800">
                    <p>ឈ្មោះសិស្ស ៖ {studentName ? studentName : "......................................"}</p>
                    <p>កាលបរិច្ឆេទ ៖ ......../........./...........</p>
                  </div>
                </div>

                <div className="text-center w-full mb-1 px-2 font-khmer">
                  <p className="text-xs text-slate-700 max-w-4xl mx-auto leading-relaxed">
                    <strong>ការណែនាំ៖</strong> ចូរលោកគ្រូ-អ្នកគ្រូឱ្យសិស្សស្វែងរកពាក្យគន្លឹះខ្មែរទាំងឡាយដែលបានផ្ដល់ជូនខាងក្រោម នៅក្នុងប្រអប់តារាងអក្សរ ដោយគូសរង្វង់ព័ទ្ធជុំវិញតាមទីតាំងដេក (ឆ្វេងទៅស្តាំ) ឬបញ្ឈរ (លើចុះក្រោម)។
                  </p>
                </div>
              </div>

              <div className="space-y-4 print:space-y-3 flex-grow flex flex-col justify-between">
                <div className="flex justify-center w-full">
                  <div className="w-full max-w-[18.5cm] mx-auto border-2 border-slate-700 bg-white shadow-xs">
                    <div 
                      className="grid gap-0 w-full"
                      style={{ 
                        gridTemplateColumns: `repeat(${gridData.grid.length || 12}, minmax(0, 1fr))`
                      }}
                    >
                      {gridData.grid.map((row, r) => 
                        row.map((val, c) => {
                          let answerClasses = "";
                          Object.entries(gridData.placements).forEach(([word, coords]) => {
                            if ((coords as { r: number, c: number }[]).some(coord => coord.r === r && coord.c === c)) {
                               const colorCls = PASTEL_COLORS[wordSearchList.indexOf(word) % PASTEL_COLORS.length];
                               answerClasses = colorCls; 
                            }
                          });

                          return (
                            <div 
                              key={`print-cell-${r}-${c}`}
                              className="worksheet-cell aspect-square flex items-center justify-center font-khmer font-bold text-[28px] border border-slate-700 bg-white min-h-[32px]"
                              data-answer-colors={answerClasses}
                            >
                              {val}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>

                <div className="w-full max-w-[18cm] mx-auto page-break-inside-avoid mt-5 print:mt-3">
                  <h4 className="text-[17px] font-bold font-khmer text-slate-800 mb-4 flex items-center gap-3">
                    <Check className="w-5 h-5 text-slate-800 stroke-[3px]" />
                    បញ្ជីពាក្យត្រូវស្វែងរកទាំង {toKhmerNumeral((gridData.placedWords || wordSearchList).length)}៖
                  </h4>
                  <ul className="grid grid-cols-4 gap-x-6 gap-y-3">
                    {(gridData.placedWords || wordSearchList).map((word, i) => (
                      <li key={`print-word-${i}`} className="flex items-center gap-2 text-slate-800 overflow-hidden text-ellipsis whitespace-nowrap">
                        <div className="w-5 h-5 border-[1.5px] border-slate-800 bg-white shrink-0"></div>
                        <span className="font-bold font-khmer text-[15px] leading-tight block truncate md:text-md text-slate-800">{word}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))
        ) : activeGameMode === "spelling" ? (
          <div className="space-y-6">
            {challenges.map((c, index) => (
              <div key={`print-puzzle-${c.id}-${index}`} className="p-6 border border-slate-200 rounded-2xl bg-white space-y-4 page-break-inside-avoid shadow-xs">
                <h3 className="text-base sm:text-lg font-khmer font-black text-indigo-900">
                  ពាក្យទី {getKhmerNumber(index + 1)}៖
                </h3>

                {/* Horizontal boxes representing the blocks */}
                <div className="flex flex-wrap items-center gap-2 pt-1 pb-2">
                  {c.blocks.map((b, i) => (
                    c.prefilled[i] ? (
                      <div key={i} className="w-14 h-14 border-[2px] border-slate-800 rounded-lg flex flex-col justify-between bg-white text-xl font-bold text-slate-800 font-khmer shadow-xs relative overflow-hidden pb-1 pt-0.5">
                        <div className="flex-grow flex items-center justify-center">
                          {b}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-2 bg-indigo-600" />
                      </div>
                    ) : (
                      <div key={i} className="w-14 h-14 border-[2px] border-dashed border-amber-500 bg-amber-50/50 rounded-lg flex flex-col justify-between shadow-xs relative overflow-hidden pb-1 pt-0.5">
                        <div className="flex-grow flex items-center justify-center">
                          {/* Empty spacer for children to write */}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-2 bg-amber-500" />
                      </div>
                    )
                  ))}
                </div>

                {/* Option pool below */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs sm:text-sm text-slate-600 font-khmer">
                  <span className="font-semibold text-slate-700">តួអក្សរសម្រាប់ជ្រើសរើស៖</span>
                  <div className="flex flex-wrap gap-1.5">
                    {getDeterministicPool(c).map((char, charIdx) => (
                      <div
                        key={charIdx}
                        className="w-8 h-8 rounded-lg border border-slate-300 bg-slate-50 flex items-center justify-center text-xs font-semibold text-slate-700 font-khmer shadow-2xs"
                      >
                        {char}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}


      </div>

    </div>
  );
}
