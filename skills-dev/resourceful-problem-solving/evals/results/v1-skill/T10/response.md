Skip the tutorial's three setup choices. Build a small React page that speaks with the browser's built-in voice, and publish that page for free on Cloudflare Pages.

That gives you a page where someone types text, clicks Speak, and hears it, on a public URL, at no cost. A Flask server and a neural voice model are not required for that.

## Why this path

The tutorial is describing a stack that no longer matches the free, small side-project goal.

- **Heroku has no free dynos.** They ended on 28 November 2022. The cheapest plan now is Eco at $5 per month for a pool of 1,000 hours: 0.5 GB of RAM, and the app sleeps after 30 minutes of no traffic. ([Heroku changelog](https://devcenter.heroku.com/changelog-items/2502), [Heroku pricing](https://www.heroku.com/pricing/))
- **Create React App is deprecated for new apps.** The React team sunset it on 14 February 2025 and points new projects at a framework, or at Vite if you want a plain client-side app. ([Sunsetting Create React App](https://react.dev/blog/2025/02/14/sunsetting-create-react-app), [Start a new React project](https://react.dev/learn/creating-a-react-app))
- **`pip install TTS` is the abandoned package.** Its last release was December 2023. The maintained fork is `coqui-tts` from Idiap, and from version 0.27.4 it does not even install PyTorch for you. You install PyTorch yourself, then the library, then it downloads a neural model. ([Coqui FAQ](https://coqui-tts.readthedocs.io/en/latest/faq.html), [installation](https://coqui-tts.readthedocs.io/en/latest/installation.html), [maintainer note](https://github.com/coqui-ai/tts/issues/4334))

A 0.5 GB sleeping dyno is the wrong place for PyTorch plus a speech model. The browser already has a speech engine, `speechSynthesis`, which has been widely available since September 2018. ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/speechSynthesis))

## Setup

You need Node.js 20.19+ or 22.12+. ([Vite](https://vite.dev/guide/))

**1. Create the app**

```bash
npm create vite@latest tts-app -- --template react
cd tts-app
npm install
npm run dev
```

Open the local URL Vite prints (usually http://localhost:5173).

**2. Replace `src/App.jsx` with this**

```jsx
import { useEffect, useState } from "react";

export default function App() {
  const [text, setText] = useState("Hello. This is running in the browser.");
  const [voices, setVoices] = useState([]);
  const [voiceURI, setVoiceURI] = useState("");

  useEffect(() => {
    const loadVoices = () => {
      const list = window.speechSynthesis.getVoices();
      setVoices(list);
      setVoiceURI((current) => current || list[0]?.voiceURI || "");
    };
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  function speak(event) {
    event.preventDefault();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = voices.find((item) => item.voiceURI === voiceURI);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  return (
    <main>
      <h1>Speak</h1>
      <form onSubmit={speak}>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={5}
          cols={48}
        />
        <p>
          <label>
            Voice{" "}
            <select
              value={voiceURI}
              onChange={(event) => setVoiceURI(event.target.value)}
            >
              {voices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          </label>
        </p>
        <button type="submit">Speak</button>
      </form>
    </main>
  );
}
```

**3. Check it locally**

Click Speak. You should hear the sentence in the selected voice. If the voice list is empty on first paint, it fills in a moment later when the browser finishes loading voices. Speech has to start from that button click; browsers block speech that starts on its own.

**4. Publish it**

Commit the project and push it to GitHub or GitLab. In the Cloudflare dashboard: Workers & Pages → Create application → Pages → Connect to Git. Use the React (Vite) preset, which is build command `npm run build` and output directory `dist`. Save and deploy. The site lands on a `https://<project>.pages.dev` URL. ([Cloudflare Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/), [build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/))

Open that URL and click Speak again. That is the success check.

Cloudflare's free plan needs no card. Static bandwidth is not metered the way a dyno is; the limits that matter here are 500 builds a month and 20,000 files per site. A Vite app is nowhere near either. ([Pages limits](https://developers.cloudflare.com/pages/platform/limits/))

## Watch out for

The voice is whatever the visitor's operating system and browser already have. Chrome on Windows, Safari on a Mac, and a phone will not sound the same, and you cannot hand someone a `.wav` file from your server.

The flagship Coqui cloning model, XTTS-v2, is under the Coqui Public Model License: non-commercial use only, including hobby projects, and there is no longer a company selling a commercial license. ([model license](https://huggingface.co/coqui/XTTS-v2/raw/main/LICENSE.txt), [Coqui docs](https://docs.coqui.ai/en/stable/models/xtts.html)) You do not need that model for this project.

## If the tutorial's server comes back later

Add Flask only when the app has a job the browser cannot do, such as saving notes or accounts. Host that small API on Render's free web service (750 hours a month, sleeps after 15 idle minutes). ([Render Python hosting](https://render.com/hosting/python)) Leave speech in the browser.

Switch to local `coqui-tts` on your own computer only if you need a downloadable audio file or a cloned voice. That is a machine with enough RAM for PyTorch, not a free web dyno.

I'll assume English and the built-in browser voices are enough unless you say you need a downloadable file, a cloned voice, or another language the browser voices do not cover.

Sources:
- [Free Heroku dynos no longer available](https://devcenter.heroku.com/changelog-items/2502) (effective 28 Nov 2022)
- [Heroku pricing](https://www.heroku.com/pricing/) (Eco $5/month, 0.5 GB, sleeps after 30 minutes)
- [Sunsetting Create React App](https://react.dev/blog/2025/02/14/sunsetting-create-react-app) (14 Feb 2025)
- [Creating a React app](https://react.dev/learn/creating-a-react-app)
- [Coqui TTS FAQ](https://coqui-tts.readthedocs.io/en/latest/faq.html)
- [Coqui TTS installation](https://coqui-tts.readthedocs.io/en/latest/installation.html)
- [coqui-ai/TTS issue #4334](https://github.com/coqui-ai/tts/issues/4334)
- [Window.speechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/Window/speechSynthesis)
- [Vite getting started](https://vite.dev/guide/)
- [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Cloudflare Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [XTTS-v2 license](https://huggingface.co/coqui/XTTS-v2/raw/main/LICENSE.txt)
- [XTTS docs](https://docs.coqui.ai/en/stable/models/xtts.html)
- [Render Python hosting](https://render.com/hosting/python)
