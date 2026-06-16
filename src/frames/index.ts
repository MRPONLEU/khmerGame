import frame1 from './frame1.png';
import frame2 from './frame2.png';
import frame3 from './frame3.png';
import frame4 from './frame4.png';

export const BUILT_IN_FRAMES = [
  {
    id: "preset1",
    name: "ស៊ុមផ្កា",
    dataUrl: frame1
  },
  {
    id: "preset2",
    name: "ស៊ុមក្មេងលេង",
    dataUrl: frame2
  },
  {
    id: "preset3",
    name: "ស៊ុមបុរាណ",
    dataUrl: frame3
  },
  {
    id: "preset4",
    name: "ស៊ុមសាលារៀន",
    dataUrl: frame4
  },
  {
    id: "preset5",
    name: "ស៊ុមសាមញ្ញ",
    dataUrl: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg width="800" height="360" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="780" height="340" fill="none" stroke="#6366f1" stroke-width="4" rx="20"/><rect x="20" y="20" width="760" height="320" fill="none" stroke="#a5b4fc" stroke-width="2" rx="12"/><path d="M 10 40 L 40 10 M 760 10 L 790 40 M 10 320 L 40 350 M 760 350 L 790 320" stroke="#6366f1" stroke-width="4"/></svg>`)
  }
];
