import { useEffect, useState, useRef } from "react";
import "./index.css";

const PLAY_DURATION_MS = 15_000;

interface Song {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl100: string;
  previewUrl: string;
  releaseDate: string;
  primaryGenreName: string;
  trackPrice?: number;
  trackViewUrl?: string;
}

const POP_GENRES = [
  "mandopop", "cantopop", "c-pop", "k-pop", "j-pop", "j-rock",
  "pop", "asian pop", "korean pop", "r&b", "soul", "dance",
  "electronic", "hip-hop", "rap", "vocal", "singer/songwriter",
  "worldwide", "jazz", "city pop",
];

function isPopGenre(g: string) {
  const gl = g.toLowerCase();
  return POP_GENRES.some((a) => gl.includes(a));
}

function getToday() {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "short" });
  const day = now.getDate();
  return { month, day, full: `${month} ${day}`, monthOnly: month };
}

/* ── Fetch songs for exact date ── */
async function fetchByDate(month: string, day: number): Promise<Song[]> {
  const monthNum  = new Date(`${month} 1, 2000`).getMonth() + 1;
  const monthFull = new Date(`${month} 1, 2000`).toLocaleString("en-US", { month: "long" });

  const searches = [
    { q: `${month} ${day}`,       country: "TW" },
    { q: `${month} ${day}`,       country: "HK" },
    { q: `${month} ${day}`,       country: "KR" },
    { q: `${month} ${day}`,       country: "JP" },
    { q: `${monthNum}月${day}日`,  country: "CN" },
    { q: `${monthNum}月${day}日`,  country: "TW" },
    { q: `${monthNum}월${day}일`,  country: "KR" },
    { q: `${monthFull} ${day}`,   country: "TW" },
  ];

  const all: Song[]     = [];
  const seen            = new Set<number>();

  await Promise.allSettled(searches.map(async ({ q, country }) => {
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=100&country=${country}`;
      const data = await fetch(url).then((r) => r.json());
      for (const s of (data.results ?? []) as Song[]) {
        if (!s.previewUrl || seen.has(s.trackId)) continue;
        const year = new Date(s.releaseDate).getFullYear();
        if (year < 1970 || year > 2025) continue;
        if (!isPopGenre(s.primaryGenreName ?? "")) continue;

        const nm = s.trackName, nl = nm.toLowerCase();
        const hasDate =
          nl.includes(`${month.toLowerCase()} ${day}`) ||
          nl.includes(`${monthFull.toLowerCase()} ${day}`) ||
          nm.includes(`${monthNum}月${day}日`) ||
          nm.includes(`${monthNum}월${day}일`) ||
          nm.includes(`${monthNum}月${day}`);
        if (!hasDate) continue;

        seen.add(s.trackId);
        all.push(s);
      }
    } catch { /* ignore */ }
  }));

  all.sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime());

  // One song per artist — keep the newest
  const seenArtists = new Set<string>();
  return all.filter((s) => {
    const key = s.artistName.toLowerCase().trim();
    if (seenArtists.has(key)) return false;
    seenArtists.add(key);
    return true;
  });
}

/* ── Fallback: search month's popular songs ── */
async function fetchByMonth(month: string): Promise<Song[]> {
  const monthNum  = new Date(`${month} 1, 2000`).getMonth() + 1;
  const searches  = [
    { q: month,              country: "TW" },
    { q: month,              country: "HK" },
    { q: month,              country: "KR" },
    { q: `${monthNum}月`,    country: "CN" },
    { q: `${monthNum}월`,    country: "KR" },
  ];

  const all: Song[] = [];
  const seen        = new Set<number>();

  await Promise.allSettled(searches.map(async ({ q, country }) => {
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=100&country=${country}`;
      const data = await fetch(url).then((r) => r.json());
      for (const s of (data.results ?? []) as Song[]) {
        if (!s.previewUrl || seen.has(s.trackId)) continue;
        const year = new Date(s.releaseDate).getFullYear();
        if (year < 1970 || year > 2025) continue;
        if (!isPopGenre(s.primaryGenreName ?? "")) continue;
        seen.add(s.trackId);
        all.push(s);
      }
    } catch { /* ignore */ }
  }));

  // shuffle for variety
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all;
}

/* ── Typing animation ── */
function useTypingAnimation(text: string, delay = 2600) {
  const [shown, setShown]   = useState("");
  const [phase, setPhase]   = useState<"typing"|"wait"|"erasing">("typing");

  useEffect(() => { setShown(""); setPhase("typing"); }, [text]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (phase === "typing") {
      t = shown.length < text.length
        ? setTimeout(() => setShown(text.slice(0, shown.length + 1)), 90)
        : setTimeout(() => setPhase("wait"), delay);
    } else if (phase === "wait") {
      t = setTimeout(() => setPhase("erasing"), 600);
    } else {
      t = shown.length > 0
        ? setTimeout(() => setShown(shown.slice(0, -1)), 45)
        : setTimeout(() => setPhase("typing"), 500);
    }
    return () => clearTimeout(t);
  }, [shown, phase, text, delay]);

  return shown;
}

/* ── Auto-fit text ── */
function AutoFitText({ text }: { text: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const fit = () => {
      const w = wrapRef.current, s = spanRef.current;
      if (!w || !s) return;
      let size = w.clientHeight;
      s.style.fontSize = `${size}px`;
      while (s.scrollWidth > w.clientWidth && size > 20) {
        size -= 2;
        s.style.fontSize = `${size}px`;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [text]);

  return (
    <div ref={wrapRef} className="autofit-wrap">
      <span ref={spanRef} className="autofit-text">{text}</span>
    </div>
  );
}

/* ── Vinyl visual ── */
function Vinyl({ artworkUrl, spinning }: { artworkUrl: string; spinning: boolean }) {
  return (
    <div className="vinyl-bg">
      <div className={`vinyl-disc${spinning ? " spinning" : ""}`}>
        <div className="vinyl-label">
          {artworkUrl
            ? <img src={artworkUrl} alt="" className="vinyl-art" />
            : <div className="vinyl-placeholder" />}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════ */
export default function App() {
  const { month, day, full, monthOnly } = getToday();

  const [songs,        setSongs]        = useState<Song[]>([]);
  const [isFallback,   setIsFallback]   = useState(false);
  const [idx,          setIdx]          = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [soundOn,      setSoundOn]      = useState(false);
  const [needsClick,   setNeedsClick]   = useState(true);
  const [showSndLabel, setShowSndLabel] = useState(false);
  const [showNxtLabel, setShowNxtLabel] = useState(false);

  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const soundRef    = useRef(false);
  const idxRef      = useRef(0);
  const songsRef    = useRef<Song[]>([]);
  const skipTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const typingTarget = isFallback ? `${monthOnly} :D` : full;
  const typingText   = useTypingAnimation(typingTarget);

  /* Load songs on mount */
  useEffect(() => {
    setLoading(true);
    fetchByDate(month, day).then(async (result) => {
      if (result.length > 0) {
        setSongs(result);
        songsRef.current = result;
        setIsFallback(false);
      } else {
        const fallback = await fetchByMonth(month);
        setSongs(fallback);
        songsRef.current = fallback;
        setIsFallback(true);
      }
      setLoading(false);
    });
  }, [month, day]);

  const cur       = songs[idx];
  const artworkHD = cur?.artworkUrl100
    ?.replace("100x100bb", "600x600bb")
    .replace("100x100",    "600x600") ?? "";

  /* ── Core: load + optionally play a track ── */
  const loadTrack = (i: number) => {
    if (skipTimer.current) clearTimeout(skipTimer.current);

    const list = songsRef.current;
    if (!list.length) return;
    const song = list[i % list.length];
    if (!song?.previewUrl) return;

    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.pause();
    }

    const audio = new Audio(song.previewUrl);
    audioRef.current = audio;

    audio.onended = () => advance();

    if (soundRef.current) {
      audio.play()
        .then(() => {
          setNeedsClick(false);
          scheduleSkip(i);
        })
        .catch(() => {});
    }
  };

  const scheduleSkip = (i: number) => {
    if (skipTimer.current) clearTimeout(skipTimer.current);
    skipTimer.current = setTimeout(() => advance(i), PLAY_DURATION_MS);
  };

  const advance = (fromIdx?: number) => {
    const base = fromIdx ?? idxRef.current;
    const next = (base + 1) % songsRef.current.length;
    idxRef.current = next;
    setIdx(next);
  };

  /* When idx changes → load new track */
  useEffect(() => {
    if (!songsRef.current.length) return;
    idxRef.current = idx;
    loadTrack(idx);
  }, [idx]);

  /* When songs first arrive → load track 0 */
  useEffect(() => {
    if (!songs.length) return;
    idxRef.current = 0;
    setIdx(0);
    loadTrack(0);
  }, [songs]);

  /* Sound toggle */
  const handleSoundToggle = () => {
    const on = !soundOn;
    setSoundOn(on);
    soundRef.current = on;
    if (on) {
      if (audioRef.current) {
        audioRef.current.play()
          .then(() => { setNeedsClick(false); scheduleSkip(idxRef.current); })
          .catch(() => {});
      }
    } else {
      audioRef.current?.pause();
      if (skipTimer.current) clearTimeout(skipTimer.current);
    }
  };

  /* Next song */
  const handleNext = () => {
    if (!songs.length) return;
    advance(idxRef.current);
  };

  return (
    <div className="app-root">
      <Vinyl artworkUrl={artworkHD} spinning={true} />
      <div className="bg-overlay" />

      {/* Controls */}
      <div className="controls">
        <div className="control-item"
          onMouseEnter={() => setShowSndLabel(true)}
          onMouseLeave={() => setShowSndLabel(false)}
          onClick={handleSoundToggle}>
          <span className={`control-label${showSndLabel ? " visible" : ""}`}>
            {soundOn ? "Sound On" : "Sound Off"}
          </span>
          <button className={`ctrl-btn green${soundOn ? "" : " muted"}`} aria-label="Toggle sound">
            {soundOn ? (
              <svg viewBox="0 0 24 24" fill="white" width="22" height="22">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="white" width="22" height="22">
                <path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
              </svg>
            )}
          </button>
        </div>

        <div className="control-item"
          onMouseEnter={() => setShowNxtLabel(true)}
          onMouseLeave={() => setShowNxtLabel(false)}
          onClick={handleNext}>
          <span className={`control-label${showNxtLabel ? " visible" : ""}`}>Next Song</span>
          <button className="ctrl-btn pink" aria-label="Next song">
            <svg viewBox="0 0 24 24" fill="white" width="28" height="28">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="content">
        <div className="song-info">
          {loading ? (
            <p className="count-line">Searching for songs…</p>
          ) : songs.length === 0 ? (
            <p className="count-line">No songs found.</p>
          ) : isFallback ? (
            <>
              <p className="count-line">
                No songs with <span className="highlight">{full}</span> found —
                playing <span className="highlight">{monthOnly}</span> songs. Now playing:
              </p>
              <h1 className="now-playing">
                <span className="date-green">{typingText}<span className="cursor">|</span></span>
                {" "}by <span className="artist-name">{cur?.artistName}</span>
                {cur?.releaseDate && <span className="release-year"> ({new Date(cur.releaseDate).getFullYear()})</span>}
              </h1>
            </>
          ) : (
            <>
              <p className="count-line">
                <span className="count-num">{songs.length}</span> songs with{" "}
                <span className="highlight">{full}</span> in the title. Now playing:
              </p>
              <h1 className="now-playing">
                <span className="date-green">{typingText}<span className="cursor">|</span></span>
                {" "}by <span className="artist-name">{cur?.artistName}</span>
                {cur?.releaseDate && <span className="release-year"> ({new Date(cur.releaseDate).getFullYear()})</span>}
              </h1>
            </>
          )}
          {needsClick && !loading && songs.length > 0 && (
            <p className="click-hint" onClick={handleSoundToggle}>▶ Click the green button to play</p>
          )}
        </div>

        <div className="big-date-section">
          <AutoFitText text={isFallback ? `${monthOnly} :D` : full} />
        </div>
      </div>
    </div>
  );
}
