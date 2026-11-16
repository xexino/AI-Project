from engine.providers.align import align_to_script, number_words, ProportionalAligner
from engine.stages.captions import ass_color, build_srt_vtt, chunk_words, chunk_windows, srt_time


def test_number_words():
    assert number_words(65) == ["sixtyfive"]
    assert number_words(1908, year_style=True) == ["nineteen", "oh", "eight"]
    assert number_words(2000) == ["two", "thousand"]
    assert number_words(150) == ["one", "hundred", "fifty"]


def test_alignment_handles_digits_and_spelling():
    heard = [(" The", 0, .1), (" blast", .1, .4), (" leveled", .4, .8), (" 2", 1, 1.2), (",000", 1.2, 1.5), (" kilometers", 1.6, 2.2), (" Cheese.", 2.3, 2.4)]
    out = align_to_script("The blast levelled two thousand kilometres", heard, 2.5)
    assert [w["word"] for w in out] == ["The", "blast", "levelled", "two", "thousand", "kilometres"]
    assert all(w["matched"] for w in out)
    assert out[3]["start"] == 1.0 and out[4]["end"] == 1.5


def test_unmatched_words_are_interpolated_not_dropped():
    out = align_to_script("alpha beta gamma", [(" alpha", 0, .3), (" gamma", 1.0, 1.3)], 1.5)
    assert [w["matched"] for w in out] == [True, False, True]
    assert 0.3 <= out[1]["start"] <= out[1]["end"] <= 1.0


def test_proportional_aligner_spans_duration():
    out = ProportionalAligner().align("x.wav", "one two three four", 2.0)
    assert len(out) == 4 and out[-1]["end"] <= 2.0 and not any(w["matched"] for w in out)


def words(text, scene="s", t0=0.0, step=0.4):
    return [{"word": w, "start": t0 + i * step, "end": t0 + i * step + 0.3, "scene": scene} for i, w in enumerate(text.split())]


def test_chunking_rules():
    ws = words("One two three four. Five six") + words("seven eight", scene="t", t0=5)
    ch = chunk_words(ws)
    assert all(len(c) <= 3 for c in ch)
    assert all(len({w["scene"] for w in c}) == 1 for c in ch)          # never across scenes
    assert any(c[-1]["word"] == "four." for c in ch)                    # breaks after punctuation
    wins = chunk_windows(ch)
    assert all(a < b for a, b in wins) and all(wins[i][1] <= wins[i + 1][0] for i in range(len(wins) - 1))


def test_srt_vtt_format():
    srt, vtt = build_srt_vtt({"words": words("Hello there world again")})
    assert srt.startswith("1\n00:00:00,000 --> ") and vtt.startswith("WEBVTT")
    assert srt_time(3723.5) == "01:02:03,500" and srt_time(1.25, ".") == "00:00:01.250"


def test_ass_colors_match_v1_constants():
    assert ass_color("#ede6d6") == "&H00D6E6ED"
    assert ass_color("#ff8a1f") == "&H001F8AFF"
    assert ass_color("#05141a", 0.6) == "&H661A1405"
