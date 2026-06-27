"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import roastsData from "@/data/roasts.json";

const DEFAULT_REACTION_VIDEOS = [
  "/videos/reaction1.mp4",
  "/videos/reaction2.mp4",
  "/videos/reaction3.mp4",
  "/videos/reaction4.mp4",
  "/videos/reaction5.mp4",
  "/videos/reaction6.mp4",
  "/videos/reaction7.mp4",
  "/videos/reaction8.mp4",
  "/videos/reaction9.mp4",
];

const WHATSAPP_NUMBER = "09131294991";

type Phase = "landing" | "questions" | "loading" | "roast" | "previous" | "submit" | "him";

const FAKE_QUESTIONS = [
   "What is your greatest strength as a person?",
  "What is one flaw or weakness you know you need to work on?",
  "When people misunderstand you, what do they usually get wrong?",
  "What achievement are you most proud of so far?",
  "What kind of person do you aspire to become in the next five years?"
];

const INTENSITY_LABELS = [
  "SCANNING SOUL...",
  "LOCATING VILLAGE...",
  "CONSULTING ANCESTORS...",
  "CALCULATING DAMAGE...",
  "PREPARING VERDICT...",
  "LOADING DISRESPECT...",
];

export default function ToastAI() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [myRoast, setMyRoast] = useState("");
  const [previousRoast, setPreviousRoast] = useState("");
  const [userRoast, setUserRoast] = useState("");
  const [displayedText, setDisplayedText] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [reactionVideos, setReactionVideos] = useState<string[]>(DEFAULT_REACTION_VIDEOS);
  const [himText, setHimText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [intensityValue, setIntensityValue] = useState(0);
  const [intensityLabel, setIntensityLabel] = useState(INTENSITY_LABELS[0]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const TOTAL_STEPS = 1 + FAKE_QUESTIONS.length;

  useEffect(() => {
    fetch("/api/roast")
      .then((r) => r.json())
      .then((d) => setPreviousRoast(d.roast))
      .catch(() => {
        setPreviousRoast(roastsData[Math.floor(Math.random() * roastsData.length)]);
      });

    fetch("/api/videos")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.videos) && d.videos.length > 0) {
          setReactionVideos(d.videos);
        }
      })
      .catch(() => {
        // keep the default fallback list
      });
  }, []);

  // Typewriter
  useEffect(() => {
    const source = phase === "him" ? himText : myRoast;
    if (!source || (phase !== "roast" && phase !== "him")) return;

    const resetTyping = window.setTimeout(() => {
      setDisplayedText("");
      setIsTyping(true);
    }, 0);

    let i = 0;
    const iv = setInterval(() => {
      if (i < source.length) {
        setDisplayedText(source.slice(0, i + 1));
        i++;
      } else {
        setIsTyping(false);
        clearInterval(iv);
      }
    }, phase === "him" ? 35 : 26);
    return () => {
      clearInterval(iv);
      clearTimeout(resetTyping);
    };
  }, [myRoast, himText, phase]);

  // Intensity meter
  useEffect(() => {
    if (phase !== "loading") return;
    let val = 0;
    const iv = setInterval(() => {
      val = Math.min(val + Math.random() * 6, 95);
      setIntensityValue(Math.floor(val));
      const idx = Math.min(Math.floor((val / 100) * INTENSITY_LABELS.length), INTENSITY_LABELS.length - 1);
      setIntensityLabel(INTENSITY_LABELS[idx]);
    }, 200);
    return () => clearInterval(iv);
  }, [phase]);

  useEffect(() => {
    if (phase === "questions") setTimeout(() => inputRef.current?.focus(), 100);
  }, [phase, step]);

  function handleStart() {
    setStep(0);
    setName("");
    setAnswers({});
    setCurrentAnswer("");
    setPhase("questions");
  }

  function handleAnswer() {
    if (!currentAnswer.trim()) return;

    if (step === 0) {
      setName(currentAnswer.trim());
      setCurrentAnswer("");
      setStep(1);
      return;
    }

    const questionIndex = step - 1;
    const newAnswers = { ...answers, [FAKE_QUESTIONS[questionIndex]]: currentAnswer.trim() };
    setAnswers(newAnswers);
    setCurrentAnswer("");

    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      setPhase("loading");
      setIntensityValue(0);
      const availableVideos = reactionVideos.length ? reactionVideos : DEFAULT_REACTION_VIDEOS;
      setVideoUrl(availableVideos[Math.floor(Math.random() * availableVideos.length)]);
      const loadStart = Date.now();
      const minLoadTime = 7000;

      fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "roast", name: name || currentAnswer.trim(), answers: newAnswers }),
      })
        .then((r) => r.json())
        .then((d) => {
          const finish = () => {
            setMyRoast(d.roast);
            setDisplayedText("");
            setIntensityValue(100);
            setIntensityLabel("LOADED.");
            setPhase("roast");
          };

          const elapsed = Date.now() - loadStart;
          const remaining = Math.max(minLoadTime - elapsed, 0);
          setTimeout(finish, remaining);
        })
        .catch(() => {
          const fallback = roastsData[Math.floor(Math.random() * roastsData.length)];
          const finish = () => {
            setMyRoast(fallback);
            setDisplayedText("");
            setIntensityValue(100);
            setIntensityLabel("LOADED.");
            setPhase("roast");
          };

          const elapsed = Date.now() - loadStart;
          const remaining = Math.max(minLoadTime - elapsed, 0);
          setTimeout(finish, remaining);
        });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleAnswer();
  }

  async function handleSubmitRoast() {
    const trimmed = userRoast.trim();

    if (trimmed.toUpperCase() === "HIM.") {
      setPhase("loading");
      setIntensityValue(0);
      setIntensityLabel("ACCESSING CLASSIFIED FILE...");

      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "him" }),
      });

      let compliment: string;
      try {
        const d = await res.json();
        compliment = d.compliment;
      } catch {
        compliment = "You. The fact that you found this means something. It always did.";
      }

      setHimText(compliment);
      setDisplayedText("");
      setIntensityValue(100);
      setTimeout(() => setPhase("him"), 600);
      return;
    }

    if (!trimmed) return;

    fetch("/api/roast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit", roast: trimmed }),
    }).catch(() => {});

    setMyRoast("");
    setDisplayedText("");
    setUserRoast("");
    setName("");
    setAnswers({});
    setStep(0);
    setCurrentAnswer("");
    setPhase("landing");
  }

  const isNameStep = step === 0;
  const currentQuestion = isNameStep ? null : FAKE_QUESTIONS[step - 1];
  const canProceed = currentAnswer.trim().length > 0;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 overflow-hidden relative">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-amber-500/10 blur-[120px]" />
        <div className="absolute bottom-1/3 left-1/4 w-[400px] h-[400px] rounded-full bg-cyan-400/8 blur-[100px]" />
      </div>

      <AnimatePresence mode="wait">

        {/* ── LANDING ── */}
        {phase === "landing" && (
          <motion.div
            key="landing"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.5 }}
            className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-950/40 border border-amber-800/40 text-amber-300 text-xs font-mono tracking-widest mb-10"
            >
              TRIAL IN PROGRESS
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-8xl md:text-[10rem] font-black tracking-tighter leading-none mb-4"
            >
              TOAST<span className="text-amber-400">.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-slate-300 text-lg font-mono mb-2 max-w-md"
            >
              You have been summoned.
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.65 }}
              className="text-slate-400 text-sm font-mono mb-14 max-w-sm"
            >
              The AI will ask you 6 very important questions. Answer carefully.
              It will not matter.
            </motion.p>

            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              onClick={handleStart}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="px-10 py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-lg tracking-wide transition-colors shadow-[0_0_40px_rgba(251,146,60,0.35)] cursor-pointer"
            >
              I accept my fate
            </motion.button>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1 }}
              className="text-slate-500 text-xs font-mono mt-8"
            >
              Warning: This will hurt.
            </motion.p>
          </motion.div>
        )}

        {/* ── QUESTIONS ── */}
        {phase === "questions" && (
          <motion.div
            key={`q-${step}`}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.3 }}
            className="min-h-screen flex flex-col items-center justify-center px-6"
          >
            <div className="flex gap-2 mb-16">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i < step ? "bg-amber-400 w-2" : i === step ? "bg-white w-7" : "bg-slate-600 w-2"
                  }`}
                />
              ))}
            </div>
            <div className="w-full max-w-xl">
              {isNameStep ? (
                <>
                  <p className="text-zinc-500 text-xs font-mono mb-3 tracking-widest">BEFORE WE BEGIN</p>
                  <h2 className="text-3xl md:text-4xl font-bold mb-3 leading-tight">What is your name?</h2>
                  <p className="text-zinc-600 text-sm font-mono mb-10">So we know who to blame.</p>
                </>
              ) : (
                <>
                  <p className="text-zinc-500 text-xs font-mono mb-3 tracking-widest">
                    QUESTION {step} OF {FAKE_QUESTIONS.length}
                  </p>
                  <h2 className="text-3xl md:text-4xl font-bold mb-10 leading-tight">{currentQuestion}</h2>
                </>
              )}

              <input
                ref={inputRef}
                type="text"
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isNameStep ? "Enter your name..." : "Your answer..."}
                className="w-full bg-slate-900/90 border border-slate-700/50 rounded-2xl px-6 py-4 text-slate-100 text-lg placeholder-slate-500 outline-none focus:border-amber-400/50 focus:shadow-[0_0_20px_rgba(251,146,60,0.12)] transition-all font-mono"
              />

              <button
                onClick={handleAnswer}
                disabled={!canProceed}
                className={`mt-4 w-full py-4 rounded-2xl text-sm tracking-widest font-mono font-semibold transition-all ${
                  canProceed
                    ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-[0_0_30px_rgba(251,146,60,0.25)] hover:shadow-[0_0_40px_rgba(251,146,60,0.35)]"
                    : "bg-slate-700 text-slate-500 cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
                }`}
              >
                {isNameStep ? "PROCEED" : "NEXT"}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── LOADING ── */}
        {phase === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
          >
            {name && (
              <p className="text-zinc-600 text-xs font-mono tracking-widest mb-4">
                PROCESSING {name.toUpperCase()}
              </p>
            )}
            <p className="text-zinc-400 text-xs font-mono tracking-widest mb-8">{intensityLabel}</p>

            <div className="w-full max-w-sm mb-6">
              <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-amber-700 via-amber-500 to-amber-300"
                  animate={{ width: `${intensityValue}%` }}
                  transition={{ ease: "linear", duration: 0.2 }}
                />
              </div>
            </div>

            <p className="text-7xl font-black text-amber-300 font-mono">
              {intensityValue}<span className="text-3xl text-zinc-600">%</span>
            </p>

            <p className="text-zinc-700 text-xs font-mono mt-10 tracking-[0.3em]">ROAST INTENSITY METER</p>
          </motion.div>
        )}

        {/* ── ROAST ── */}
        {phase === "roast" && (
          <motion.div
            key="roast"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col items-center justify-center px-6 py-16"
          >
            {/* TikTok video */}
            <div className="w-full max-w-xs mb-8 rounded-2xl overflow-hidden border border-slate-700 shadow-[0_0_60px_rgba(251,146,60,0.18)]">
              <video
                src={videoUrl}
                className="w-full"
                autoPlay
                loop
                playsInline
                style={{ maxHeight: "420px", objectFit: "cover" }}
              />
            </div>

            {/* Verdict card */}
            <div
              style={{
                width: "100%",
                maxWidth: "36rem",
                backgroundColor: "rgba(15, 23, 42, 0.82)",
                border: "1px solid #334155",
                borderRadius: "1.5rem",
                padding: "2rem",
              }}
            >
              <p className="text-amber-300 text-xs font-mono tracking-widest mb-5">
                THE VERDICT{name ? ` FOR ${name.toUpperCase()}` : ""}
              </p>
              <p className="text-slate-100 text-lg leading-relaxed font-mono">
                {displayedText}
                {isTyping && (
                  <span className="inline-block w-0.5 h-5 bg-amber-300 ml-1 animate-pulse align-middle" />
                )}
              </p>
              {!isTyping && displayedText && (
                <p className="text-slate-400 text-xs font-mono mt-6">— toast.ai</p>
              )}
            </div>

            {/* Actions */}
            {!isTyping && displayedText && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="w-full max-w-xl mt-6 flex flex-col gap-3"
              >
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=Hello%20Creator%2C%20I%20just%20got%20roasted%20on%20TOAST.%20Can%20we%20talk%3F`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-4 rounded-2xl bg-amber-500 text-slate-950 font-semibold text-sm tracking-[0.18em] uppercase text-center transition-colors duration-200 hover:bg-amber-400 shadow-[0_12px_30px_rgba(251,146,60,0.25)] border border-amber-400/20"
                >
                  Contact the Creator
                </a>
                <button
                  onClick={() => setPhase("previous")}
                  className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-sm tracking-widest transition-colors cursor-pointer border border-amber-400/20 shadow-[0_14px_35px_rgba(251,146,60,0.18)]"
                >
                  I HAVE RECEIVED MY VERDICT
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── PREVIOUS ROAST ── */}
        {phase === "previous" && (
          <motion.div
            key="previous"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
          >
            <p className="text-zinc-500 text-xs font-mono tracking-widest mb-6">
              THE PERSON BEFORE YOU LEFT YOU A GIFT
            </p>

            <div className="w-full max-w-xl bg-zinc-900/40 border border-orange-900/40 rounded-3xl p-8 shadow-[0_0_50px_rgba(234,88,12,0.08)]">
              <p className="text-orange-400 text-xs font-mono tracking-widest mb-5">
                FROM A STRANGER WHO DOES NOT KNOW YOU
              </p>
              <p className="text-zinc-200 text-xl leading-relaxed font-mono italic">
                &quot;{previousRoast}&quot;
              </p>
            </div>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              onClick={() => setPhase("submit")}
              className="mt-10 px-8 py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold tracking-wide transition-colors shadow-[0_0_30px_rgba(251,146,60,0.25)] cursor-pointer"
            >
              Now roast the next person
            </motion.button>
          </motion.div>
        )}

        {/* ── SUBMIT ROAST ── */}
        {phase === "submit" && (
          <motion.div
            key="submit"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col items-center justify-center px-6"
          >
            <div className="w-full max-w-xl">
              <p className="text-zinc-500 text-xs font-mono tracking-widest mb-3">YOUR TURN TO DESTROY</p>
              <h2 className="text-3xl font-bold mb-2">Leave a roast for the next person.</h2>
              <p className="text-zinc-600 text-sm font-mono mb-8">
                They have not wronged you. That is not the point.
              </p>

              <textarea
                value={userRoast}
                onChange={(e) => setUserRoast(e.target.value)}
                placeholder="Destroy them..."
                rows={5}
                className="w-full bg-slate-900/90 border border-slate-700/50 rounded-2xl px-6 py-4 text-slate-100 text-base placeholder-slate-500 outline-none focus:border-amber-400/50 focus:shadow-[0_0_20px_rgba(251,146,60,0.12)] transition-all font-mono resize-none"
              />

              <button
                onClick={handleSubmitRoast}
                disabled={!userRoast.trim()}
                className="mt-4 w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 font-bold text-lg tracking-wide transition-all cursor-pointer"
              >
                Send it
              </button>

              <p className="text-zinc-700 text-xs font-mono mt-5 text-center">
                Or type something else entirely. You never know.
              </p>
            </div>
          </motion.div>
        )}

        {/* ── HIM. ── */}
        {phase === "him" && (
          <motion.div
            key="him"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative"
          >
            <div className="fixed inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full bg-yellow-500/8 blur-[160px]" />
            </div>

            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-yellow-600/50 text-xs font-mono tracking-[0.4em] mb-10"
            >
              CLASSIFIED
            </motion.p>

            <motion.h2
              initial={{ opacity: 0, scale: 1.3 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, duration: 0.9, ease: "easeOut" }}
              className="text-[100px] md:text-[160px] font-black leading-none tracking-tighter text-yellow-400 mb-12"
              style={{ textShadow: "0 0 100px rgba(234,179,8,0.35)" }}
            >
              HIM.
            </motion.h2>

            <div className="w-full max-w-lg">
              <p className="text-zinc-200 text-xl leading-relaxed font-mono">
                {displayedText}
                {isTyping && (
                  <span className="inline-block w-0.5 h-6 bg-yellow-400 animate-pulse" />
                )}
              </p>
            </div>

            {!isTyping && displayedText && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                onClick={() => {
                  setHimText("");
                  setDisplayedText("");
                  setUserRoast("");
                  setPhase("landing");
                }}
                className="mt-16 px-8 py-3 rounded-full border border-yellow-700/30 text-yellow-700/50 hover:text-yellow-400 hover:border-yellow-400/50 font-mono text-xs tracking-widest transition-all cursor-pointer"
              >
                RETURN
              </motion.button>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </main>
  );
}
