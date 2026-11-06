"""Objective soundtrack checks. This never asserts that anyone listened."""
from __future__ import annotations
from datetime import datetime, timezone
import hashlib
import json
import re
import subprocess
import sys
import wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import timeline as T

sys.path.insert(0, str(T.ROOT / "templates/audio"))
from dsp import SR, integrated, momentary, read_wav, st, true_peak


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def read_pcm16(path):
    with wave.open(str(path), "rb") as wav:
        assert (wav.getframerate(), wav.getnchannels(), wav.getsampwidth()) == (SR, 1, 2)
        return np.frombuffer(wav.readframes(wav.getnframes()), dtype="<i2")


def loudness(path):
    result = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
        "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True, check=True)
    summary = result.stderr[result.stderr.rfind("Summary:"):]
    return {"integratedLufs": float(re.search(r"\bI:\s*([-\d.]+) LUFS", summary)[1]),
            "truePeakDbtp": float(re.search(r"Peak:\s*([-\d.]+) dBFS", summary)[1]), "summary": summary.strip()}


def dbfs(samples):
    return float(20 * np.log10(np.sqrt(np.mean(np.asarray(samples, np.float64) ** 2)) + 1e-15))


def write_waveforms(words, pcm, indices):
    canvas = Image.new("RGB", (1200, 1430), "#faf8f3")
    draw = ImageDraw.Draw(canvas)
    try:
        title_font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 23)
        font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 19)
    except OSError:
        title_font = font = ImageFont.load_default()
    draw.text((24, 18), "Perfect Streaks: 10 deterministic word-boundary waveform checks", fill="#241726", font=title_font)
    draw.text((24, 51), "Objective source/offset inspection only. This image is not proof of listening.", fill="#51434c", font=font)
    for row, index in enumerate(indices):
        word = words[int(index)]
        start = max(0, int((word["s"] - 0.16) * SR))
        end = min(len(pcm), int((word["e"] + 0.16) * SR))
        top = 98 + row * 132
        draw.text((24, top), f"#{index:03d}  {word['w']}   {word['s']:.3f}–{word['e']:.3f} s", fill="#241726", font=font)
        left, width, mid, scale = 26, 1148, top + 79, 37
        draw.line((left, mid, left + width, mid), fill="#d5ccc6")
        low, high = max(0, int(word["s"] * SR)), min(len(pcm), int(word["e"] * SR))
        xa = left + round((low - start) / (end - start) * width)
        xb = left + round((high - start) / (end - start) * width)
        draw.rectangle((xa, top + 34, xb, top + 122), fill="#e3eee1")
        section = pcm[start:end].astype(np.float64) / 32768
        normalizer = max(np.max(np.abs(section)), 0.01)
        for x in range(width):
            a, b = round(x * len(section) / width), round((x + 1) * len(section) / width)
            span = section[a:max(b, a + 1)]
            draw.line((left + x, mid - float(span.max()) / normalizer * scale,
                       left + x, mid - float(span.min()) / normalizer * scale), fill="#285c51")
        draw.line((xa, top + 34, xa, top + 122), fill="#5e975a", width=2)
        draw.line((xb, top + 34, xb, top + 122), fill="#5e975a", width=2)
    path = T.HERE / "word-waveforms.png"
    canvas.save(path)
    return path


def main():
    voice_dir = T.PROJECT / "voice"
    words = read_json(voice_dir / "words.json")
    source_words = read_json(voice_dir / "source-words.json")
    script_words = (T.PROJECT / "narration.txt").read_text(encoding="utf-8-sig").split()
    captions = read_json(T.PROJECT / "captions.json")
    voice = read_pcm16(voice_dir / "voice.wav")
    source_voice = read_pcm16(voice_dir / "source-voice.wav")
    pad_samples = SR // T.FPS
    shift_exact = len(voice) == len(source_voice) + pad_samples and not np.any(voice[:pad_samples]) and np.array_equal(voice[pad_samples:], source_voice)
    assert shift_exact, "Source voice was changed beyond the promised one-frame silence."
    assert script_words == [word["w"] for word in words] == [word["w"] for word in source_words]
    assert len(words) == len(captions) == 205
    assert all(0 <= word["s"] < word["e"] <= T.DURATION for word in words)
    assert all(a["e"] <= b["s"] for a, b in zip(words, words[1:]))
    offset_errors = [abs(word[key] - original[key] - 1 / T.FPS) for word, original in zip(words, source_words) for key in ("s", "e")]
    assert max(offset_errors) < 0.000001
    assert all(caption["text"].strip() == word["w"] and abs(caption["startMs"] - word["s"] * 1000) < 0.001
               and abs(caption["endMs"] - word["e"] * 1000) < 0.001 for word, caption in zip(words, captions))

    gaps = [{"afterWordIndex": index, "after": a["w"], "before": b["w"], "start": a["e"], "end": b["s"],
             "duration": round(b["s"] - a["e"], 6),
             "plannedReason": "Short explanatory clause pause after You see," if a["w"] == "see," else "Sentence/beat boundary pause in the approved narration"}
            for index, (a, b) in enumerate(zip(words, words[1:])) if b["s"] - a["e"] > 0.25]
    assert all(re.search(r"[.,!?]$", item["after"]) for item in gaps), "An unplanned mid-phrase gap needs review."
    indices = sorted(np.random.default_rng(91).choice(len(words), size=10, replace=False).tolist())
    sampled = []
    for index in indices:
        word = words[index]
        a, b = round(word["s"] * SR), round(word["e"] * SR)
        source_start, source_end = a - pad_samples, b - pad_samples
        sample_match = np.array_equal(voice[a:b], source_voice[source_start:source_end])
        rms = dbfs(voice[a:b].astype(np.float64) / 32768)
        assert sample_match and rms > -60
        sampled.append({"index": index, **word, "sourceSamplesUnchanged": sample_match, "windowRmsDbfs": round(rms, 2),
                        "reviewScope": "Exact source-sample mapping and character-timestamp consistency; not speech recognition or listening."})

    mix_path = T.HERE / "mix.wav"
    mix, mix_rate = read_wav(str(mix_path))
    assert mix_rate == SR and mix.shape == (2, T.SAMPLES)
    measured = loudness(mix_path)
    assert -15 <= measured["integratedLufs"] <= -13
    assert measured["truePeakDbtp"] <= -1
    source_report = read_json(T.HERE / "audio-report.json")
    assert source_report["voiceSha256"] == sha(voice_dir / "voice.wav")
    assert source_report["wordsSha256"] == sha(voice_dir / "words.json")
    assert source_report["cuesSha256"] == sha(T.PROJECT / "sound.json")
    sound = read_json(T.PROJECT / "sound.json")
    assert sound["productionNotes"]["timelineSha256"] == T.SOURCE_SHA256
    assert all(abs(cue["at"] * T.FPS - cue["frame"]) < 0.000001 for cue in sound["sfx"])
    event_cues = {cue["name"]: cue["frame"] for cue in sound["sfx"]}
    for key in ("brick-land", "shoes-set", "paperweight"):
        assert event_cues[key] == T.event_frame(key)

    speech = np.zeros((2, T.SAMPLES))
    speech[:, :len(voice)] = voice / 32768
    music, _ = read_wav(str(T.HERE / "stem-music.wav"))
    sfx, _ = read_wav(str(T.HERE / "stem-sfx.wav"))
    bed = music + sfx
    speech_m = momentary(speech, hop=0.01)
    bed_m = momentary(bed, hop=0.01)
    centres = np.arange(len(speech_m)) * 0.01 + 0.2
    speaking = np.zeros(len(centres), dtype=bool)
    for word in words:
        speaking |= (centres >= word["s"] + 0.02) & (centres <= word["e"] - 0.02)
    speaking &= speech_m > integrated(speech) - 10
    margin = speech_m - bed_m
    balances = []
    for number, shot in T.SHOTS.items():
        chosen = speaking & (centres >= T.seconds(shot["a"])) & (centres < T.seconds(shot["b"]))
        window = slice(round(T.seconds(shot["a"]) * SR), round(T.seconds(shot["b"]) * SR))
        balances.append({"shot": number, "speechLufs": round(float(integrated(speech[:, window])), 2),
                         "bedLufs": round(float(integrated(bed[:, window])), 2),
                         "speechMarginMedianLu": round(float(np.median(margin[chosen])), 2),
                         "speechMarginP10Lu": round(float(np.percentile(margin[chosen], 10)), 2)})
    warnings = [f"Shot {item['shot']} has a speech/bed tenth-percentile margin of {item['speechMarginP10Lu']} LU; listen specifically for masking."
                for item in balances if item["speechMarginP10Lu"] < 3]
    waveform_path = write_waveforms(words, voice, indices)
    listening_path = voice_dir / "listening-review.json"
    listening = read_json(listening_path) if listening_path.exists() else {}
    listening_approved = listening.get("status") == "pass" and listening.get("mixSha256") == sha(mix_path)
    listening_status = "approved by user for these exact mix bytes; see voice/listening-review.json" if listening_approved else "pending — this model has no audio-input capability"
    report = {"status": "objective_checks_pass", "checkedAt": datetime.now(timezone.utc).isoformat(),
              "reviewer": "He-MAN", "subjectiveListening": listening_status,
              "scope": "Sample identity, script/caption/character-alignment mapping, planned pauses, cue frames, duration, format and loudness; no listening or independent transcription claimed.",
              "mixPath": str(mix_path), "mixSha256": sha(mix_path), "timelineSha256": T.SOURCE_SHA256,
              "sampleRate": mix_rate, "channels": mix.shape[0], "samples": mix.shape[1], "durationSeconds": mix.shape[1] / mix_rate,
              "voiceFramesAdded": 1, "voiceSamplesAdded": pad_samples, "voiceSamplesOtherwiseIdentical": shift_exact,
              "wordCount": len(words), "captionCount": len(captions), "allTokensMatchScript": True,
              "allCaptionTimesMatchWords": True, "maximumOffsetRoundingErrorSeconds": max(offset_errors),
              "sampledWords": sampled, "plannedPausesOver250ms": gaps, "unplannedPausesOver250ms": [],
              "voiceTailPaddingSamplesInPicture": T.SAMPLES - len(voice), "cueCount": len(sound["sfx"]),
              "exactImpacts": {key: event_cues[key] for key in ("brick-land", "shoes-set", "paperweight")},
              "loudness": measured, "speechBedBalanceBeforeSharedMaster": balances,
              "speechMarginMedianLu": round(float(np.median(margin[speaking])), 2),
              "speechMarginP10Lu": round(float(np.percentile(margin[speaking], 10)), 2),
              "warningsForListening": warnings, "waveformSheet": str(waveform_path)}
    (voice_dir / "audio-objective-review.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    (T.HERE / "objective-review.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    (T.HERE / "loudness.txt").write_text(measured["summary"] + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in ("status", "durationSeconds", "sampleRate", "channels", "wordCount", "captionCount",
          "voiceSamplesOtherwiseIdentical", "cueCount", "exactImpacts", "speechMarginMedianLu", "speechMarginP10Lu", "warningsForListening", "subjectiveListening")}))
    print(measured["summary"])


if __name__ == "__main__":
    main()
