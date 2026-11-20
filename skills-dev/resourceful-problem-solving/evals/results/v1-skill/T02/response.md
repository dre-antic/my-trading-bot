Use a website for this. Your ThinkPad only has to show the page. Google’s free **Gemini Notebook** (it used to be called NotebookLM) will turn the MP3s into text, give you a short summary of each lecture, and let you search them by typing a question.

Open [notebook.google](https://notebook.google/) in the browser you already have.

## Why this fits your laptop

The laptop has 4 GB of memory and no graphics card, and you want something you can click through yourself. A local speech tool such as whisper.cpp can run on a processor alone, but its own memory table lists about 273 MB for the weakest model and about 2.1 GB to 3.9 GB for the stronger ones, before Windows has taken its share ([whisper.cpp](https://github.com/ggml-org/whisper.cpp/)). Using it also means installing a programmer’s tool, and it still would not write the summaries. A website does that work on Google’s computers.

Forty hours is too much for the usual meeting apps. Otter’s free plan is 300 minutes a month, 30 minutes per recording, and 3 uploaded files for the life of the account ([Otter](https://otter.ai/start-for-free)). Word’s Transcribe is 300 minutes of uploaded audio a month with Microsoft 365, unless you already pay for a Copilot license ([Microsoft](https://support.microsoft.com/en-us/word/transcribe-your-recordings)).

## What to do

1. Plug the laptop in. Close other programs so Windows has memory free. Open Microsoft Edge and go to [https://notebook.google/](https://notebook.google/).
2. Sign in with a free personal Gmail. A school Google account works only when the school has switched this on ([Google Help](https://support.google.com/notebooklm/answer/16337734)).
3. Create one notebook and name it after the course.
4. Choose **Add sources** and upload the MP3s. Upload a few files, wait until they finish, then upload more. On the free plan one notebook holds 50 sources, and you can have 100 notebooks, so more than 50 lectures just means a second notebook ([Google Help](https://support.google.com/gemininotebook/answer/16213268?hl=en)).
5. Each file must be 200 MB or smaller ([Google Help](https://support.google.com/gemininotebook/answer/16215270?hl=en)). In File Explorer, right-click a file, choose Properties, and read Size. A normal lecture MP3 is usually under that. Skip any file that says more than 200 MB and use the backup below for those.
6. Test one lecture before the rest. Click its name on the left. Google transcribes the audio when you import it and saves that text as the source, and the source view includes a short summary of the whole lecture ([Google Help](https://support.google.com/gemininotebook/answer/16215270?hl=en)). Then ask something you already remember, such as “What did this lecture say about [a topic]?” If the answer matches the recording, upload the rest.
7. To find something later, open the notebook and ask in ordinary words: “Which lecture explains mitosis? Quote the sentence.” Answers come from your lectures.
8. Keep the original MP3s on the laptop or a USB stick. The site keeps a copy.

The buttons that make a podcast, slides, or a video are optional extras. The summary on the lecture and the question box are the notes. The free plan has a usage limit that refills about every 5 hours, up to a weekly cap ([Google Help](https://support.google.com/gemininotebook/answer/17670842?hl=en)). Reading a lecture’s summary is separate from a long chat. If a question is refused, wait until the limit resets.

## If a file is over 200 MB, or you want a Word file for every lecture

Pay for one month of [TurboScribe](https://turboscribe.com/), download the documents, and cancel.

- Their free offer is 3 transcripts a day, and each file can be at most 30 minutes. Useful only if you already have a clip that short and want to see whether the wording looks right.
- Unlimited is $20 if you pay month to month, or $10 a month only when you pay $120 for the year. Choose the **$20 monthly** plan. Each file can be up to 10 hours or 5 GB, and you can upload 50 at a time ([TurboScribe](https://turboscribe.com/)).
- Download each transcript as DOCX or TXT. Open one and press Ctrl+F, or put the folder where Windows search can see it.
- Cancel under Account Settings, then Manage Subscription. Access lasts until the end of the month you paid for ([TurboScribe](https://turboscribe.com/)).
- For the short summaries, upload those text files into Gemini Notebook and open each one. Text files are far under the 200 MB cap.

## Watch out for

Upload only recordings you are allowed to share. Google’s help says to avoid documents you do not have rights to. Leave out medical, legal, or other people’s private conversations. For ordinary class lectures, Google says your uploads are not used to train Gemini Notebook unless you send feedback ([Google Help](https://support.google.com/gemininotebook/answer/16213268?hl=en)).

Names and technical terms will sometimes come out wrong. The first transcript is the check. If it is nonsense, the audio may be too noisy, or the language may be outside the list Google publishes for audio import ([Google Help](https://support.google.com/gemininotebook/answer/16215270?hl=en)). English and the usual European and Asian languages are on that list.

Gemini Notebook has no one-click download of every transcript. A folder of Word files, with less copying, is the $20 TurboScribe month.

I’m assuming these are ordinary lectures you are allowed to upload, in a common language, and that a free Google account is fine. Check one file’s size in Properties. If it is over 200 MB, start with the monthly TurboScribe plan instead.

Sources:
- [Add or discover new sources for your notebook](https://support.google.com/gemininotebook/answer/16215270?hl=en) (Google Help, checked Nov 2026)
- [Learn about Gemini Notebook’s plans](https://support.google.com/gemininotebook/answer/16213268?hl=en) (Google Help, checked Nov 2026)
- [Manage your Gemini Notebook usage limits](https://support.google.com/gemininotebook/answer/17670842?hl=en) (Google Help, checked Nov 2026)
- [Use Gemini Notebook with a work or school Google account](https://support.google.com/notebooklm/answer/16337734) (Google Help, checked Nov 2026)
- [Gemini Notebook](https://notebook.google/) (Google, checked Nov 2026)
- [NotebookLM is now Gemini Notebook](https://blog.google/innovation-and-ai/products/gemini-notebook/notebooklm-gemini-notebook/) (Google blog, Jul 16, 2026)
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp/) (project README memory table)
- [TurboScribe](https://turboscribe.com/) (official pricing and limits, checked Nov 2026)
- [Start for Free](https://otter.ai/start-for-free) (Otter.ai)
- [Transcribe your recordings](https://support.microsoft.com/en-us/word/transcribe-your-recordings) (Microsoft Support)
