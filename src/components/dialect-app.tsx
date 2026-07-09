"use client";

import Image from "next/image";
import QRCode from "qrcode";
import {
  ArrowLeft, ArrowRight, Check, CircleDot, Copy, Headphones, Languages,
  Link2, LoaderCircle, Mic, Play, RefreshCcw, Sparkles, Square,
  Users, Volume2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { questionFor, randomName, SENTENCES } from "@/lib/game-data";
import { supabase } from "@/lib/supabase";

type View = "home" | "dialect" | "student";
type QuizGame = { code: string; status: "lobby" | "playing" | "finished"; current_round: number; round_started_at: string | null };
type QuizPlayer = { id: string; game_code: string; name: string; created_at: string };
type QuizAnswer = { player_id: string; round: number; answer: string; correct: boolean; response_ms: number };
type StudentClip = { id: string; display_name: string; dialect: string; prompt: string; public_url: string };

const TOTAL_ROUNDS = 8;

function Spinner() {
  return <LoaderCircle className="size-5 animate-spin" aria-hidden />;
}

function Brand() {
  return (
    <button className="brand" onClick={() => { window.history.replaceState({}, "", "/"); window.dispatchEvent(new PopStateEvent("popstate")); }}>
      <Image src="/spirelight-logo.png" alt="Spirelight" width={40} height={40} priority />
      <span>SPIRELIGHT</span>
    </button>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header><Brand /><span className="event-tag">KU · Sprogets dag</span></header>
      <main>{children}</main>
      <footer>BYGGET AF SPIRELIGHT · AI BEGYNDER MED SPROG</footer>
    </div>
  );
}

function Home({ onChoose }: { onChoose: (view: View) => void }) {
  return (
    <div className="hero">
      <div className="eyebrow"><Sparkles className="size-4" /> To spil. Hele Danmark i dine ører.</div>
      <h1>Hvor <em>dansk</em><br />lyder dansk?</h1>
      <p className="lede">Test dit dialektøre mod historiske stemmer - eller lån din egen stemme ud til eksperimentet.</p>
      <section className="game-grid">
        <button className="game-card primary-card" onClick={() => onChoose("dialect")}>
          <span className="card-number">01</span><Headphones aria-hidden />
          <span><b>Gæt dialekten</b><small>Lav eller deltag i et live spil</small></span>
          <ArrowRight aria-hidden />
        </button>
        <button className="game-card" onClick={() => onChoose("student")}>
          <span className="card-number">02</span><Mic aria-hidden />
          <span><b>Gæt en studerende</b><small>Indtal, lyt og gæt frit</small></span>
          <ArrowRight aria-hidden />
        </button>
      </section>
      <div className="fact-strip"><Languages aria-hidden /><span><b>24 rigtige optagelser</b><small>Fra Lolland til Bornholm. Kilde: Spirelights dialektsamling.</small></span></div>
    </div>
  );
}

function Back({ onClick }: { onClick: () => void }) {
  return <button className="back" onClick={onClick}><ArrowLeft className="size-4" /> Alle spil</button>;
}

function randomCode() {
  let code = "";
  while (code.length < 5) {
    code += "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".charAt(Math.floor(Math.random() * 32));
  }
  return code;
}

function DialectGame({ onBack }: { onBack: () => void }) {
  const initialCode = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("join")?.toUpperCase() ?? "" : "";
  const [mode, setMode] = useState<"gate" | "form" | "room">(initialCode ? "form" : "gate");
  const [action, setAction] = useState<"create" | "join">(initialCode ? "join" : "create");
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState("");
  const [game, setGame] = useState<QuizGame | null>(null);
  const [player, setPlayer] = useState<QuizPlayer | null>(null);
  const [players, setPlayers] = useState<QuizPlayer[]>([]);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [host, setHost] = useState(false);
  const [selected, setSelected] = useState<{ round: number; answer: string } | null>(null);
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);

  const refresh = useCallback(async () => {
    if (!code || mode !== "room") return;
    const [{ data: gameData }, { data: playerData }, { data: answerData }] = await Promise.all([
      supabase.from("quiz_games").select("code,status,current_round,round_started_at").eq("code", code).maybeSingle(),
      supabase.from("quiz_players").select("id,game_code,name,created_at").eq("game_code", code).order("created_at"),
      supabase.from("quiz_answers").select("player_id,round,answer,correct,response_ms").eq("game_code", code),
    ]);
    if (gameData) setGame(gameData as QuizGame);
    setPlayers((playerData ?? []) as QuizPlayer[]);
    setAnswers((answerData ?? []) as QuizAnswer[]);
  }, [code, mode]);

  useEffect(() => {
    if (mode !== "room") return;
    const firstRefresh = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, 1200);
    return () => { window.clearTimeout(firstRefresh); window.clearInterval(timer); };
  }, [mode, refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const joinUrl = typeof window !== "undefined" && code ? `${window.location.origin}/?join=${code}` : "";
  useEffect(() => { if (joinUrl) QRCode.toDataURL(joinUrl, { width: 380, margin: 1, color: { dark: "#08111f", light: "#ffffff" } }).then(setQr); }, [joinUrl]);

  async function enterRoom() {
    const cleanName = (name.trim() || randomName()).slice(0, 32);
    setBusy(true); setError("");
    try {
      let roomCode = code.trim().toUpperCase();
      if (action === "create") {
        roomCode = randomCode();
        const { error: createError } = await supabase.from("quiz_games").insert({ code: roomCode });
        if (createError) throw createError;
        setHost(true);
      } else {
        const { data: existing } = await supabase.from("quiz_games").select("code").eq("code", roomCode).maybeSingle();
        if (!existing) throw new Error("Spillet findes ikke endnu. Tjek koden og prøv igen.");
      }
      const { data, error: playerError } = await supabase.from("quiz_players").insert({ game_code: roomCode, name: cleanName }).select("id,game_code,name,created_at").single();
      if (playerError) throw playerError;
      setCode(roomCode); setName(cleanName); setPlayer(data as QuizPlayer); setMode("room");
      window.history.replaceState({}, "", `/?join=${roomCode}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Noget gik galt. Prøv igen."); }
    finally { setBusy(false); }
  }

  async function startRound(round: number) {
    setBusy(true);
    await supabase.from("quiz_games").update({ status: "playing", current_round: round, round_started_at: new Date().toISOString() }).eq("code", code);
    await refresh(); setBusy(false);
  }

  async function choose(answer: string) {
    if (!player || !game || selected?.round === game.current_round || answers.some((item) => item.player_id === player.id && item.round === game.current_round)) return;
    const { clip } = questionFor(code, game.current_round);
    const elapsed = game.round_started_at ? now - new Date(game.round_started_at).getTime() : 0;
    setSelected({ round: game.current_round, answer });
    await supabase.from("quiz_answers").insert({ game_code: code, player_id: player.id, round: game.current_round, answer, correct: answer === clip.dialect, response_ms: Math.max(0, Math.min(elapsed, 30000)) });
    refresh();
  }

  async function finish() {
    setBusy(true); await supabase.from("quiz_games").update({ status: "finished" }).eq("code", code); await refresh(); setBusy(false);
  }

  if (mode === "gate") return (
    <section className="panel narrow"><Back onClick={onBack} /><span className="section-kicker">LIVE QUIZ</span><h2>Gæt dialekten</h2><p>En vært starter. Alle lytter og svarer på deres egen telefon.</p>
      <div className="stack"><button className="button primary" onClick={() => { setAction("create"); setMode("form"); }}>Opret et spil <ArrowRight /></button><button className="button secondary" onClick={() => { setAction("join"); setMode("form"); }}>Deltag med kode</button></div>
    </section>
  );

  if (mode === "form") return (
    <section className="panel narrow"><button className="back" onClick={() => setMode("gate")}><ArrowLeft className="size-4" /> Tilbage</button><span className="section-kicker">{action === "create" ? "NYT SPIL" : "DELTAG"}</span><h2>{action === "create" ? "Hvad skal vi kalde dig?" : "Indtast koden"}</h2>
      {action === "join" && <label>Spilkode<input className="code-input" value={code} maxLength={5} autoCapitalize="characters" onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCDE" /></label>}
      <label>Dit navn<input value={name} maxLength={32} onChange={(e) => setName(e.target.value)} placeholder="Fx Frisk Frikativ" /></label>
      <button className="text-button" onClick={() => setName(randomName())}><RefreshCcw className="size-4" /> Giv mig et tilfældigt navn</button>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="button primary" disabled={busy || (action === "join" && code.length !== 5)} onClick={enterRoom}>{busy ? <Spinner /> : action === "create" ? "Opret rummet" : "Deltag nu"}<ArrowRight /></button>
    </section>
  );

  if (!game || !player) return <section className="panel center"><Spinner /><p>Henter spillet…</p></section>;

  if (game.status === "finished") {
    const score = (id: string) => answers.filter((answer) => answer.player_id === id && answer.correct).length;
    const ranking = [...players].sort((a, b) => score(b.id) - score(a.id));
    return <section className="panel narrow"><span className="section-kicker">RESULTAT</span><h2>Godt lyttet!</h2><p className="lede-small">{score(player.id)} af {TOTAL_ROUNDS} rigtige</p><ol className="leaderboard">{ranking.map((p, index) => <li key={p.id}><span>{index + 1}</span><b>{p.name}</b><em>{score(p.id)} point</em></li>)}</ol><button className="button secondary" onClick={onBack}>Vælg et andet spil</button></section>;
  }

  if (game.status === "lobby") return (
    <section className="room-grid">
      <div className="panel join-card"><Back onClick={onBack} /><span className="section-kicker">RUMMET ER ÅBENT</span><h2>Kom med!</h2>{qr && <Image unoptimized className="qr" src={qr} width={280} height={280} alt={`QR-kode til spil ${code}`} />}<div className="otp"><span>KODE</span><b>{code}</b></div><button className="text-button" onClick={() => navigator.clipboard.writeText(joinUrl)}><Copy className="size-4" /> Kopiér link</button></div>
      <div className="panel"><div className="room-head"><span><Users /> Spillere</span><b>{players.length}</b></div><ul className="people">{players.map((p) => <li key={p.id}><CircleDot /><span>{p.name}</span>{p.id === player.id && <small>dig</small>}</li>)}</ul>{host ? <button className="button primary" disabled={busy} onClick={() => startRound(1)}>{busy ? <Spinner /> : <Play />} Start 8 runder</button> : <div className="waiting"><span className="pulse" /> Værten starter om lidt…</div>}</div>
    </section>
  );

  const question = questionFor(code, game.current_round);
  const started = game.round_started_at ? new Date(game.round_started_at).getTime() : now;
  const seconds = Math.min(25, Math.max(0, 25 - Math.floor((now - started) / 1000)));
  const roundAnswers = answers.filter((answer) => answer.round === game.current_round);
  const myAnswer = answers.find((answer) => answer.player_id === player.id && answer.round === game.current_round);
  const chosen = selected?.round === game.current_round ? selected.answer : myAnswer?.answer ?? null;
  const chosenIsCorrect = myAnswer ? myAnswer.correct : chosen === question.clip.dialect;

  return (
    <section className="quiz-layout">
      <div className="round-top"><span>Runde {game.current_round} / {TOTAL_ROUNDS}</span><div className="timer" aria-label={`${seconds} sekunder tilbage`}>{seconds}</div></div>
      <div className="panel quiz-panel">
        <span className="section-kicker">LYT GODT</span><h2>Hvor kommer stemmen fra?</h2>
        <audio src={question.clip.url} controls preload="metadata">Din browser understøtter ikke lydafspilning.</audio>
        <div className="answers">{question.options.map((option, index) => { const isCorrect = chosen && option === question.clip.dialect; const isWrong = chosen === option && option !== question.clip.dialect; return <button key={option} className={`${isCorrect ? "correct" : ""} ${isWrong ? "wrong" : ""}`} disabled={Boolean(chosen) || seconds === 0} onClick={() => choose(option)}><span>{String.fromCharCode(65 + index)}</span>{option}{isCorrect && <Check />}</button>; })}</div>
        <div className="quiz-status" aria-live="polite">{chosen ? <><b>{chosenIsCorrect ? "Ja!" : `Det var ${question.clip.dialect}`}</b><span>Optagelsen er fra {question.clip.display}.</span></> : <><Users /><span>{roundAnswers.length} af {players.length} har svaret</span></>}</div>
        {host && <div className="host-controls">{game.current_round < TOTAL_ROUNDS ? <button className="button primary" onClick={() => startRound(game.current_round + 1)}>Næste runde <ArrowRight /></button> : <button className="button primary" onClick={finish}>Se resultater <ArrowRight /></button>}</div>}
      </div>
    </section>
  );
}

function AudioWave({ recording }: { recording: boolean }) {
  return <div className={`wave ${recording ? "active" : ""}`} aria-hidden>{[2,5,3,8,6,10,4,7,3,6,9,5,2].map((v, i) => <i key={i} style={{ height: `${v * 4}px` }} />)}</div>;
}

function StudentGame({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<"record" | "listen">("record");
  const [prompt] = useState(() => SENTENCES[Math.floor(Math.random() * SENTENCES.length)]);
  const [name, setName] = useState("");
  const [dialect, setDialect] = useState("");
  const [consent, setConsent] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  const [ownId, setOwnId] = useState("");
  const [clips, setClips] = useState<StudentClip[]>([]);
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<BlobPart[]>([]);

  useEffect(() => { if (!recording) return; const timer = window.setInterval(() => setSeconds((s) => { if (s >= 44) { recorder.current?.stop(); return s; } return s + 1; }), 1000); return () => window.clearInterval(timer); }, [recording]);

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (event) => chunks.current.push(event.data);
      r.onstop = () => { const audio = new Blob(chunks.current, { type: r.mimeType || "audio/webm" }); setBlob(audio); setPreview(URL.createObjectURL(audio)); setRecording(false); stream.getTracks().forEach((track) => track.stop()); };
      recorder.current = r; r.start(); setSeconds(0); setRecording(true);
    } catch { setError("Mikrofonen kunne ikke åbnes. Giv browseren adgang og prøv igen."); }
  }

  async function publish() {
    if (!blob || !consent || !dialect.trim()) return;
    if (blob.size > 8_000_000) { setError("Optagelsen er for stor. Prøv en kortere indtaling."); return; }
    setBusy(true); setError("");
    try {
      const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
      const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("dialect-clips").upload(path, blob, { contentType: blob.type, upsert: false });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from("dialect-clips").getPublicUrl(path);
      const { data, error: insertError } = await supabase.from("student_clips").insert({ display_name: (name.trim() || "Anonym stemme").slice(0, 32), dialect: dialect.trim().slice(0, 80), prompt, audio_path: path, public_url: publicData.publicUrl, consented: true, consent_version: "event-v1" }).select("id").single();
      if (insertError) throw insertError;
      setOwnId(data.id); await loadClips(data.id); setStep("listen");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Optagelsen kunne ikke gemmes."); }
    finally { setBusy(false); }
  }

  async function loadClips(excludeId = ownId) {
    const { data } = await supabase.from("student_clips").select("id,display_name,dialect,prompt,public_url").eq("consented", true).order("created_at", { ascending: false }).limit(60);
    const available = ((data ?? []) as StudentClip[]).filter((clip) => clip.id !== excludeId);
    setClips(available.sort(() => Math.random() - 0.5)); setIndex(0); setGuess(""); setRevealed(false);
  }

  async function submitGuess() {
    const clip = clips[index]; if (!clip || !guess.trim()) return;
    await supabase.from("clip_guesses").insert({ clip_id: clip.id, guess: guess.trim().slice(0, 80) });
    setRevealed(true);
  }

  if (step === "listen") {
    const clip = clips[index];
    return <section className="panel narrow"><Back onClick={onBack} /><span className="section-kicker">STEMMEBANKEN</span><h2>Gæt en studerendes dialekt</h2>{!clip ? <div className="empty"><Volume2 /><b>Du er den første stemme her.</b><p>Når en anden studerende har givet samtykke og uploadet, dukker optagelsen op her.</p><button className="button secondary" onClick={() => loadClips()}>Tjek igen</button></div> : <><div className="voice-card"><span><Volume2 /> Stemme {index + 1} af {clips.length}</span><audio src={clip.public_url} controls /><blockquote>“{clip.prompt}”</blockquote></div><label>Hvilken dialekt hører du?<input value={guess} disabled={revealed} onChange={(e) => setGuess(e.target.value)} placeholder="Skriv dit bedste gæt" /></label>{!revealed ? <button className="button primary" disabled={!guess.trim()} onClick={submitGuess}>Afslør dialekten <ArrowRight /></button> : <div className="reveal"><span>STUDENTEN SKREV</span><b>{clip.dialect}</b><small>{clip.display_name}</small></div>} {revealed && <button className="button secondary" onClick={() => { setIndex((i) => (i + 1) % clips.length); setGuess(""); setRevealed(false); }}>Næste stemme <ArrowRight /></button>}</>}</section>;
  }

  return <section className="panel narrow"><Back onClick={onBack} /><span className="section-kicker">DIN STEMME</span><h2>Læs den her sætning</h2><div className="prompt">“{prompt}”</div><div className="recorder"><AudioWave recording={recording} /><span>{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</span>{recording ? <button aria-label="Stop optagelse" onClick={() => recorder.current?.stop()}><Square /></button> : <button aria-label={blob ? "Optag igen" : "Start optagelse"} onClick={startRecording}>{blob ? <RefreshCcw /> : <Mic />}</button>}</div>{preview && <audio src={preview} controls />}
    <label>Hvad kalder vi dig? <small>(valgfrit)</small><input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} placeholder="Fx Anonym stemme" /></label><label>Hvilken dialekt taler du?<input value={dialect} onChange={(e) => setDialect(e.target.value)} maxLength={80} placeholder="Fx københavnsk, sønderjysk eller min egen blanding" /></label>
    <label className="consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span><b>Jeg giver samtykke til, at min optagelse må afspilles for andre deltagere ved KU-arrangementet.</b><small>Det er frivilligt. Optagelsen bruges kun i dette spil, vises sammen med det valgte navn og den selvrapporterede dialekt, og Spirelight-teamet skal slette den senest 7 dage efter arrangementet. Undlad at sige dit fulde navn eller andre personoplysninger. Du kan når som helst trække samtykket tilbage ved at bede teamet ved standen om sletning.</small></span></label>
    {error && <p className="error" role="alert">{error}</p>}<button className="button primary" disabled={!blob || !dialect.trim() || !consent || busy} onClick={publish}>{busy ? <Spinner /> : <Link2 />} Del og begynd at gætte</button><button className="text-button center-button" onClick={() => { loadClips(); setStep("listen"); }}>Spring indtaling over og lyt</button>
  </section>;
}

export function DialectApp() {
  const [view, setView] = useState<View>(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("join") ? "dialect" : "home");
  useEffect(() => { const handler = () => setView(new URLSearchParams(window.location.search).has("join") ? "dialect" : "home"); window.addEventListener("popstate", handler); return () => window.removeEventListener("popstate", handler); }, []);
  const choose = (next: View) => { setView(next); if (next === "home") window.history.replaceState({}, "", "/"); };
  return <Shell>{view === "home" ? <Home onChoose={choose} /> : view === "dialect" ? <DialectGame onBack={() => choose("home")} /> : <StudentGame onBack={() => choose("home")} />}</Shell>;
}
