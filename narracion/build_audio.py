"""Genera la narración (Piper TTS, voz es-mls_10246-low), la línea de tiempo de escenas
y los subtítulos (.srt y .ass).

Uso: python3 narracion/build_audio.py <ruta/al/modelo.onnx>
Salida en salida/: narracion.wav, linea_de_tiempo.json, subtitulos.srt, subtitulos.ass
"""
import json, math, os, subprocess, sys, wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "salida")
TMP = os.path.join(OUT, "tmp_audio")
RATE = 22050  # frecuencia final (la voz se remuestrea)
GAP = 0.25    # silencio entre frases
LEAD = 0.5    # silencio inicial


def synth(text, model, path):
    raw = path + ".raw.wav"
    subprocess.run([sys.executable, "-m", "piper", "-m", model, "-f", raw,
                    "--length-scale", "0.88", "--sentence-silence", "0.1"],
                   input=text.encode(), check=True, capture_output=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-ar", str(RATE),
                    "-ac", "1", "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
                    "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
                    "highpass=f=70,loudnorm=I=-16:TP=-1.5", path], check=True)
    with wave.open(path) as w:
        return w.getnframes() / w.getframerate()


def fmt_srt(t):
    ms = round(t * 1000)
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def fmt_ass(t):
    cs = round(t * 100)
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def _balanced(words, k):
    """Reparte palabras en k grupos de largo parecido."""
    total = sum(len(w) + 1 for w in words)
    groups, cur, acc = [], [], 0
    for i, w in enumerate(words):
        cur.append(w); acc += len(w) + 1
        if len(groups) < k - 1 and acc >= total * (len(groups) + 1) / k and len(words) - i - 1 >= k - len(groups) - 1:
            groups.append(cur); cur = []
    groups.append(cur)
    return [g for g in groups if g]


def split_caption(text, max_chars=34):
    """Parte una frase en bloques de 1-2 líneas equilibradas de máximo ~34 caracteres."""
    words = text.split()
    k = math.ceil(len(text) / (2 * max_chars))
    blocks = []
    for grp in _balanced(words, k):
        t = " ".join(grp)
        blocks.append(t if len(t) <= max_chars else "\n".join(" ".join(l) for l in _balanced(grp, 2)))
    return blocks


def main():
    model = sys.argv[1]
    os.makedirs(TMP, exist_ok=True)
    guion = json.load(open(os.path.join(ROOT, "narracion", "guion.json")))
    t, pieces, scenes, cues = LEAD, [("silence", LEAD)], [], []
    for sc in guion["escenas"]:
        start = t if scenes else 0.0
        starts = []
        for i, fr in enumerate(sc["frases"]):
            starts.append(round(t, 3))
            path = os.path.join(TMP, f"{sc['id']}_{i}.wav")
            dur = synth(fr["tts"], model, path)
            blocks = split_caption(fr["text"])
            total_chars = sum(len(b) for b in blocks)
            bt = t
            for b in blocks:
                bd = dur * len(b) / total_chars
                cues.append((bt, bt + bd, b)); bt += bd
            pieces += [("file", path), ("silence", GAP)]
            t += dur + GAP
        pieces.append(("silence", sc["pausa"]))
        t += sc["pausa"]
        scenes.append(dict(id=sc["id"], start=round(start, 3), end=round(t, 3), frases=starts))

    # Concatenación con ffmpeg (silencios generados con anullsrc).
    inputs, labels = [], []
    for k, (kind, v) in enumerate(pieces):
        if kind == "file":
            inputs += ["-i", v]
        else:
            inputs += ["-f", "lavfi", "-t", f"{v:.3f}", "-i", f"anullsrc=r={RATE}:cl=mono"]
        labels.append(f"[{k}:a]")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex",
                    "".join(labels) + f"concat=n={len(pieces)}:v=0:a=1[a]", "-map", "[a]",
                    os.path.join(OUT, "narracion.wav")], check=True)

    json.dump(dict(duration=round(t, 3), scenes=scenes), open(os.path.join(OUT, "linea_de_tiempo.json"), "w"), indent=2)
    with open(os.path.join(OUT, "subtitulos.srt"), "w") as f:
        for n, (a, b, txt) in enumerate(cues, 1):
            f.write(f"{n}\n{fmt_srt(a)} --> {fmt_srt(b)}\n{txt}\n\n")
    with open(os.path.join(OUT, "subtitulos.ass"), "w") as f:
        f.write("[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\n\n"
                "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
                "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
                "Alignment, MarginL, MarginR, MarginV, Encoding\n"
                "Style: Sub,DejaVu Sans,54,&H00FFFFFF,&H00FFFFFF,&H00000000,&H9A0B1420,-1,0,0,0,100,100,0,0,3,18,0,2,90,90,330,1\n\n"
                "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")
        for a, b, txt in cues:
            f.write(f"Dialogue: 0,{fmt_ass(a)},{fmt_ass(b)},Sub,,0,0,0,,{txt.replace(chr(10), r'\N')}\n")
    print(json.dumps(dict(duration=t, scenes=scenes), indent=1))


if __name__ == "__main__":
    main()
