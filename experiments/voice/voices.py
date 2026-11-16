import sys, time, soundfile as sf
from kokoro_onnx import Kokoro
k = Kokoro("/home/user/AI-Project/models/kokoro-v1.0.onnx", "/home/user/AI-Project/models/voices-v1.0.bin")
text = ("There's a shark in the Arctic that is probably older than the United States. "
        "It's called the Greenland shark. It lives in water close to freezing... and moves slower than you walk.")
out = sys.argv[1]
for v in ["bm_george", "bm_fable", "am_michael", "am_onyx", "bf_emma", "af_heart"]:
    t = time.time()
    s, sr = k.create(text, voice=v, speed=0.92, lang="en-gb" if v.startswith("b") else "en-us")
    sf.write(f"{out}/hook_{v}.wav", s, sr)
    print(v, f"{len(s)/sr:.1f}s audio in {time.time()-t:.1f}s")
