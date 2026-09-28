"""Pre-record every question, short answer and vocabulary word as MP3.

Recorded files play on every phone, including an iPhone in Silent mode, which mutes
the browser's built-in speech voice. Files are named by a hash of voice + text, so
identical answers (是, 不可以, ...) share one file and re-runs only record what changed.

Usage:
  pip install edge-tts
  python3 Tools/build_audio.py      # writes Sources/audio/*.mp3 and Tools/data/audio.json
  python3 Tools/build_data.py       # embeds the audio map into Sources/data.js
"""
import asyncio
import glob
import hashlib
import json
import os
import re

import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, 'Tools', 'data')
AUDIO_DIR = os.path.join(ROOT, 'Sources', 'audio')
MAP_OUT = os.path.join(DATA_DIR, 'audio.json')

VOICES = {'zh': 'zh-TW-HsiaoChenNeural', 'en': 'en-US-JennyNeural'}
RATE = {'zh': '-10%', 'en': '+0%'}
EXTRA_ZH = ['中華民國總統每幾年選一次？']  # the Settings "Test voice" sentence


def spoken(text):
    """Same clean-up the app applies before speaking."""
    text = re.sub(r'（答對\s*1\s*個即可）', '，答對一個即可', text)
    return re.sub(r'[（(]\d[)）]', '', text)


def load(name):
    with open(os.path.join(DATA_DIR, name), encoding='utf-8') as f:
        return json.load(f)


def collect():
    qa = {i['id']: i for i in load('qa.json')}
    tr = {}
    for path in sorted(glob.glob(os.path.join(DATA_DIR, 'tr*.json'))):
        with open(path, encoding='utf-8') as f:
            for t in json.load(f):
                tr[t['id']] = t
    texts = {'zh': set(EXTRA_ZH), 'en': set()}
    for i, q in qa.items():
        t = tr[i]
        texts['zh'] |= {q['q'], t['key'].rstrip('。')}
        texts['en'] |= {t['q_en'], t['key_en']}
    for v in load('vocab.json'):
        texts['zh'].add(v['zh'])
        texts['en'].add(v['en'])
    return texts


def filename(lang, text):
    h = hashlib.sha1(f'{VOICES[lang]}|{RATE[lang]}|{spoken(text) if lang == "zh" else text}'.encode()).hexdigest()[:12]
    return f'{lang}-{h}.mp3'


async def record(lang, text, path, sem):
    async with sem:
        for attempt in range(4):
            try:
                say = spoken(text) if lang == 'zh' else text
                await edge_tts.Communicate(say, VOICES[lang], rate=RATE[lang]).save(path + '.tmp')
                os.replace(path + '.tmp', path)
                return
            except Exception as e:  # network hiccups: retry with backoff
                if attempt == 3:
                    raise RuntimeError(f'failed to record {text!r}: {e}')
                await asyncio.sleep(2 ** attempt)


async def main():
    os.makedirs(AUDIO_DIR, exist_ok=True)
    texts = collect()
    mapping, jobs, sem = {}, [], asyncio.Semaphore(6)
    for lang, items in texts.items():
        for text in sorted(items):
            name = filename(lang, text)
            mapping[f'{lang}:{text}'] = name
            path = os.path.join(AUDIO_DIR, name)
            if not os.path.exists(path):
                jobs.append(record(lang, text, path, sem))
    print(f'{len(mapping)} clips, {len(jobs)} to record')
    await asyncio.gather(*jobs)
    keep = set(mapping.values())
    for f in os.listdir(AUDIO_DIR):
        if f.endswith('.mp3') and f not in keep:
            os.remove(os.path.join(AUDIO_DIR, f))
    with open(MAP_OUT, 'w', encoding='utf-8') as f:
        json.dump(mapping, f, ensure_ascii=False, indent=0, sort_keys=True)
    size = sum(os.path.getsize(os.path.join(AUDIO_DIR, f)) for f in keep)
    print(f'done: {len(keep)} files, {size / 1e6:.1f} MB')


if __name__ == '__main__':
    asyncio.run(main())
