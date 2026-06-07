# graffathon-demo

Demo for Graffathon 2026 Advanced compo.

![thumbnail](thumbnail.png)

[Watch the recording](https://www.youtube.com/watch?v=37PWIm1RvE0&list=PLmRDkQf8W1WFX7ED2q87HncbY_u8ZW3Hm&index=3)


## Build

```bash
npm install
npm run dev      # live reload + parameter explorer
npm run export   # 64kB export path
```

## Dev reflections

- 99% of the code was written by Opus (I only changed some oneliners), and 99% of the parameters were chosen by me.
- [parameter-flow](https://github.com/felixbadur/parameter-flow) - live parameter explorer used during the development of thes demo. developed it in parallel with this demo.
- I tried to make a sandbox architecture for different scenes so that one becoming a mess with AI doesn't hurt the others. This seemed to work really well. I feel overall I had an easier time following my codebase than typically when partycoding. perhaps because my brain stayed on the architectural level all the time?
- about 70% of the prompts were related to refactoring. AI can create a huge mess in a few prompts – hygienic scaffolding was critical to sustaining productivity.
- I am not sure if the audio counts as AI generated. I have never managed to wire up more complex stuff with Web Audio API, but after reading the generated code, I learned some new key concepts like `exponentialRampToValueAtTime`. I think the way I vibe coded the synths is *less* cheating than using a DAW, but I feel the demoscene will be disappointed in my approach nevertheless.
- I had so much fun! definitely checks the wellness coding box.
- the workflow with parameter-flow was great for me, but it could be further improved on the scene level and with animations (now just used static and linear parameter sets).