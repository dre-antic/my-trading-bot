Use ChatGPT’s free plan for emails and document summaries, and leave Llama 3.1 405B uninstalled. The download is free. Running that model takes a datacenter GPU server, and this PC cannot do it.

Your RTX 3060 has 12 GB of video memory, plus 32 GB of ordinary RAM. Hugging Face’s Llama 3.1 memory figures put the 405B weights at about 810 GB in full precision, 405 GB in 8-bit, and 203 GB in 4-bit, before extra memory for the conversation itself. [Llama 3.1 memory requirements](https://huggingface.co/blog/llama31). Ollama’s published `llama3.1:405b` package is a 243 GB download. [Ollama Llama 3.1 library](https://ollama.com/library/llama3.1). Meta’s own note on the 8-bit version is that it fits one server node of data-center GPUs, not a gaming PC. Nothing you change in a settings screen shrinks 200 GB of weights into 12 GB.

That is also more model than email writing and document summaries need. As of the OpenAI help pages checked on 20 November 2026, the free plan includes unlimited everyday text chats (with abuse safeguards) on GPT-5.6 Luna, and file uploads are a separate limit of 3 a day. [Free tier FAQ](https://help.openai.com/en/articles/9275245-chatgpt-free-tier-faq), [file uploads](https://help.openai.com/en/articles/8555545-uploading-files-and-audio-to-chatgpt). Pasting the text of a document counts as a normal chat, so a typical report does not need an upload. Cancel the paid subscription in your OpenAI account settings. Ads can appear on the free plan in some countries.

Text you put into ChatGPT is sent to OpenAI. For ordinary email that is fine. For anything you would not email to a company, use the local setup below and skip ChatGPT for those files.

## If a document has to stay on this PC

Install [LM Studio](https://lmstudio.ai/download) (free, Windows installer; the same page has a Linux AppImage). It meets their stated requirements: 16 GB of RAM and 4 GB of video memory recommended. [System requirements](https://lmstudio.ai/docs/app/system-requirements). I’m assuming Windows.

1. Install LM Studio and open it. Update the NVIDIA driver first if the app says the GPU is unavailable.
2. Open the Discover tab (`Ctrl+2`) and search for `gemma4`.
3. Download **Gemma 4 12B**, the copy around 8 GB (`gemma4:12b` is 7.7–8.0 GB on Ollama, checked 20 November 2026). Skip anything marked 26B, 31B, 70B, or 405B. [Gemma 4 on Ollama](https://ollama.com/library/gemma4).
4. Open the Chat tab, load that model, and if a context-length setting is shown, set it to 8192. A larger context pushes the model out of the 12 GB card and makes replies crawl.
5. Check the load screen. You want the model on the GPU. If it only partly loads, or it falls back to the CPU, delete it and download **Gemma 4 E4B** instead (the smaller on-device size, starting around 6.6 GB). Same chat box, same tasks.

Give it about 10 GB of free disk space. Do not start the 243 GB Llama download.

Test it on a document you already know:

- Email: “Rewrite this as a clear, polite email. Keep my meaning. Use short paragraphs. Do not add facts I didn’t include.” Then paste your notes.
- Summary: “Summarize this in 5 bullets, then list dates, amounts, and anything I have to do. If it is not in the text, say so.” Then paste the text, or attach a `.pdf`, `.docx`, or `.txt`. LM Studio keeps that file on the machine. A short file is read in full. A very long one is searched in pieces, and that search can miss a section, so summarize long documents a part at a time. [Chat with documents](https://lmstudio.ai/docs/app/basics/rag).

Read the result and check every name, date, and number against the original before you send it. An 8 GB model on this card will write a usable email and a usable summary. It will be flatter, and more likely to drop a detail, than the ChatGPT model you have been paying for. That gap is the trade for keeping the text on the PC.

Once the model is downloaded, chatting and document summaries work with the network unplugged. Searching for new models still needs the internet.

I’ll assume the documents you summarize can be sent to ChatGPT, and that this is a Windows PC. If a document has to stay on the machine, skip the free-plan step and use only the LM Studio steps. If you are on Linux, use the Linux download on the same page.
