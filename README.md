# 歸化口試 237

A study app for the oral version of Taiwan's naturalization test (歸化取得我國國籍者基本語言能力及國民權利義務基本常識測試). It covers all 237 questions in the official oral question bank (內政部, 114年11月 version), with pinyin over every character, English translations and spoken audio.

**Open the app:** https://angelcastillob.github.io/taiwan-naturalization-study/

## How it works

The course is split into 47 levels. For each topic there is a level of vocabulary, then a level of the questions that use it. Level 1 covers the phrases that questions are built from, such as 幾歲, 哪個機關 and 答對1個即可.

- **Learn** introduces 5 items at a time. Each one grows from a seed to a full flower as you pass three tests: multiple choice, then listening (or English → Chinese for words), then building the answer from tiles.
- **Review** brings planted items back after 4 hours, 12 hours, 1 day, 3 days, 1 week, 2 weeks, 1 month and so on. A missed item drops back to the start and is asked again later in the same session.
- **Commute mode** reads a question, pauses for you to answer out loud, then reads the answer. It's hands-free, for the MRT.
- **Mock exam** is 20 random questions, 5 points each. 60 points passes, the same as the real test.
- Points, a daily goal and a streak keep track of your daily practice.

Progress is saved in the browser on each device. Use **Settings → Move your progress** to copy it between devices.

## Install on a phone

- **iPhone:** open the link in Safari → Share → **Add to Home Screen**.
- **Android:** open it in Chrome → ⋮ → **Install app**.

After the first visit it works offline. Audio is pre-recorded in a Taiwan Mandarin voice (曉臻), so it plays on any phone, even an iPhone in Silent mode. Clips are saved as you play them; **Settings → Save all audio for offline use** downloads all of them (about 30 MB). If a clip is missing, the app falls back to the phone's built-in voice.

## Project layout

```
Sources/            the app (deployed to GitHub Pages as-is, no build step)
  index.html, app.css, app.js
  data.js           generated question bank, translations, pinyin, vocabulary and audio map
  audio/            recorded clips (named by content hash)
  sw.js, manifest.webmanifest, icons/
Tools/
  build_audio.py    records Sources/audio/*.mp3 for any new or changed text
  build_data.py     regenerates Sources/data.js
  data/             parsed question bank (qa.json), translations (tr*.json), vocabulary (vocab.json), audio map (audio.json)
```

To change a translation or a short answer, edit the file in `Tools/data/`, then run:

```
pip install pypinyin edge-tts
python3 Tools/build_audio.py   # records only text that changed
python3 Tools/build_data.py
```

Pushing to `main` deploys automatically.

## Notes

- Short answers: when a question accepts any one of several answers (答對1個即可), the app teaches the easiest one. The full official answer is always shown too.
- Personal questions such as 你為什麼想申請歸化 have sample answers. Replace them with your own.
- Pinyin is generated automatically. A few Taiwan pronunciations are corrected (垃圾 lèsè, 星期 xīngqí), but some characters with several readings may still be off. Trust the audio when they disagree.
- Source: [內政部戶政司 歸化測試資訊專區](https://www.ris.gov.tw/app/portal/229).
