Use a website to turn the recordings into text, and use your ThinkPad only to upload the MP3s and read the notes. A 2013 laptop with 4 GB of memory can play the files and run a browser. The accurate transcription programs need much more speed and memory, and 40 hours of audio would keep that machine busy for days while it ran hot and felt stuck. You do not need to install any of that.

The straightforward way is one month of [TurboScribe](https://turboscribe.com/), then [Gemini Notebook](https://notebook.google/) (this is the tool Google used to call NotebookLM) for the short summaries and for searching across every lecture. Expect about **$20** if you choose the monthly plan, an afternoon of uploading, and then a simple copy-and-paste step for the summaries.

Prices below are what those companies were listing in November 2026. Open the pricing page before you enter a card, in case it has changed.

## Before you start

Three things change the steps, so check them first:

1. **Are the lectures already separate files?** If each lecture is its own MP3, you can upload them as they are. If one file contains many lectures, split it first (how to do that is at the end).
2. **What language is spoken?** You will set that language on the upload screen. Summaries can be in that language or in English.
3. **Are you allowed to upload them?** The audio is sent to the company’s computers. That is normal for this kind of service. If a lecture includes other students, or your school forbids uploading class recordings, check that before you upload the whole set.

Also copy the MP3s into a folder such as `Documents\Lectures` and name them so they sort in order, for example `01 Intro.mp3`, `02 Cells.mp3`. Keep those originals. The notes are a second copy of the words, and the audio is still what you check when a name looks wrong.

## Do one lecture as a test

TurboScribe’s free account does **3 files a day, each up to 30 minutes**, one at a time. Use that on a single lecture, or on the first 30 minutes of one, before you pay.

1. Go to [turboscribe.com](https://turboscribe.com/) and create an account.
2. Click the button to transcribe a file and choose one MP3.
3. Set **Audio Language** to the language actually spoken. Leave the mode on **Whale** (their most accurate setting).
4. Leave **Speaker Recognition** off when one person is lecturing. Turn it on when several people talk, such as a seminar or a question period.
5. Click **Transcribe** and wait.
6. Open the transcript and click a sentence. It plays that moment of the recording. Listen to a few names and technical words.

If those names and terms look right, do the other 39 hours. If the room recording is very noisy and the text is muddled, try the same file again with **Restore Audio** turned on under More Settings. That costs a few extra minutes per hour of audio and sometimes cleans up a bad recording.

## Transcribe the full 40 hours

The free limit of 30 minutes and 3 files a day is too small for a full lecture, and spreading 40 hours across it means cutting every lecture into half-hour pieces and uploading for about four weeks.

For a one-time batch, the **Unlimited monthly plan is $20**. Each file can be up to **10 hours or 5 GB**, and you can upload **50 files at once**. The yearly price is $10 a month ($120 up front), which is the better deal only if you will keep transcribing after this set. Their site describes the plan as having no overall hour cap, with room for hundreds of hours a month.

1. Subscribe to the monthly Unlimited plan.
2. Upload the lecture MP3s. With 4 GB of memory, close extra browser tabs first. Forty hours of ordinary MP3 is on the order of 2–3 GB, so a normal home connection can handle it. If the upload is slow, send 10 files, wait until they finish, then send the next 10.
3. When a transcript is done, open it and use **Download** to save **DOCX** (Word) and **TXT** (plain text). Unlimited accounts can export a whole folder at once. Save everything into `Documents\Lecture notes`.
4. After the files are on your computer, copy that folder to a USB stick or to Google Drive. An 11-year-old laptop is a bad place for the only copy.
5. Cancel the monthly plan on the account or billing page before the next billing date. Do this after the downloads and the backup are done.

Word’s own Transcribe feature is a poor fit for this pile. Microsoft’s help page says a Microsoft 365 subscription can upload **300 minutes a month** (5 hours), and that the Windows app version is for work and school accounts. Forty hours would take many months. Otter’s free plan is aimed at live meetings: short conversations, and only a handful of imported files over the life of the account. It is the wrong tool for a folder of old lectures.

## Add a short summary to each lecture

Gemini Notebook is the easy place to do this, because you upload the text files and then ask for the summaries in plain English. A free Google account can hold on the order of **50 sources in one notebook**, which covers about 40 lectures, and each source can be up to **500,000 words**. Text files are tiny, so the 200 MB file-size cap will not get in the way.

1. Go to [notebook.google](https://notebook.google/) and sign in with a Google account.
2. Create a notebook named with the course.
3. Add each lecture `.txt` file as a source. Leave the files separate so you can ask about one lecture.
4. In the chat box, paste this, and change the bits in brackets:

```text
I am studying [course name]. The lecturer is [name].
Important spellings: [list any names or terms the transcript got wrong].

For the source "[01 Intro.txt]", write notes I can paste at the top of my document:
- A short summary in one paragraph
- 8 to 12 key points, as short bullets
- Terms I should remember, each with a one-line definition in the lecturer's sense
- Anything that was unclear or possibly mistranscribed

Use only that lecture. Keep names spelled as I listed them.
```

5. Repeat for each lecture. Paste the answer at the **top** of that lecture’s Word document, with the full transcript underneath. You then have one file per lecture: summary first, full text after it.

If you would rather stay on a site you already have open, [ChatGPT](https://chatgpt.com/) or [Gemini](https://gemini.google.com/) can do one lecture at a time. Paste the same instructions, then paste the transcript under them. If the page refuses a long paste, use Gemini Notebook and upload the file instead.

## Make the notes searchable

You get two kinds of search, and both are worth having.

**Search your own files, on the laptop.** Open File Explorer, go to `Documents\Lecture notes`, click the search box, and type a word. Windows searches inside `.txt` and Word files in Documents. If a search only hits file names, click the search box so the Search tab appears, open **Advanced options**, and turn on **File contents**. Inside one lecture, press Ctrl+F in Word.

**Ask a question across the whole course.** In the Gemini Notebook that holds every transcript, ask things like “What did the lectures say about osmosis? Say which lecture it came from.” It answers from those files and shows citations. That is the useful version of “searchable notes” when you remember the idea and have forgotten the lecture number. Open the citation and, for anything you will quote or memorize, check it against the transcript, because a summary can smooth over a bad line in the recording.

Gemini Notebook can also make a study guide from the sources. Use that as a review sheet, and keep the per-lecture Word files as the copy you own.

## If one MP3 contains many lectures

Split it before uploading. Leave Audacity out of this: opening many hours of audio there expands the sound into a huge uncompressed file, and a 4 GB laptop will freeze.

Use [mp3DirectCut](https://mpesch3.de/), a small free Windows program made for cutting MP3s without re-encoding them. Download it only from that site (version 2.40 was the current one there as of March 2026). It can split a long file where the audio goes quiet, which is usually the gap between lectures. Save each piece with the lecture number in the name.

Windows Defender sometimes flags this installer. The author documents that on the [contact page](https://mpesch3.de/contact.html) and publishes a SHA-256 for the download: `fbc96b6730b8caa317ea563a0cfcbb23da7338472e592972c5925452c728003c`. If that warning makes you uncomfortable, skip the program and only upload files that are already one lecture each.

Keep each piece under 10 hours for a paid TurboScribe upload. For the free TurboScribe test, keep each piece under 30 minutes. For a direct audio upload to Gemini Notebook, keep each file under 200 MB. A normal lecture MP3 is about 1 MB per minute, so 200 MB is roughly three hours; check the real size with right-click, Properties.

## What “good enough” looks like

The transcript will read like speech, including ums and repeated sentences. That is what you want. The usual mistakes are people’s names, course jargon, and formulas. Fix those once in the text, then put the correct spellings in the summary request so the notes repeat the right form.

A clean one-person lecture comes out readable enough to study from. A recording made at the back of a noisy room, or several people talking at once, will have more gaps. Speaker labels help in a seminar and add clutter in a straight lecture, which is why the test file is worth doing before you upload the rest.

I assumed the lectures are already separate MP3s in a language TurboScribe supports, and that uploading them is fine for you. If you say which language they are in, whether any file is longer than a few hours, and whether the audio is sensitive, the choice between the $20 month and the free-but-slow route is easy to pin down.
