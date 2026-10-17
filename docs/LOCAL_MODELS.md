# Local vision and speech models

OpenReel can use local OpenAI-compatible providers without paid API credentials. This manual setup reproduces the tested local providers; it does not install models in a hosted deployment. Use **Node.js 24+** for the app. No model weights or native runners are bundled in the repository.

The verified arrangement used a Linux x64 llama.cpp vision server and a Windows x64 whisper.cpp speech server. Both loopback endpoints were reachable from the Node host. Other platforms can use equivalent official builds, but those combinations were not tested here. Keep downloads outside the checkout; examples use a sibling `openreel-local-models` directory. Check hashes before executing a downloaded runner or loading weights.

## Licenses and pinned artifacts

- llama.cpp: [official b11669 release](https://github.com/ggml-org/llama.cpp/releases/tag/b11669), [MIT](https://github.com/ggml-org/llama.cpp/blob/b11669/LICENSE).
- Qwen2-VL-2B-Instruct: publisher [GGUF revision](https://huggingface.co/ggml-org/Qwen2-VL-2B-Instruct-GGUF/tree/bb307c036e8a1ed7b663bbd0c35b41c4c9294cfd); [upstream Apache-2.0 license](https://huggingface.co/Qwen/Qwen2-VL-2B-Instruct/blob/895c3a49bc3fa70a340399125c650a463535e71c/LICENSE). The matching projector is required.
- whisper.cpp: [official b5454 release](https://github.com/ggml-org/whisper.cpp/releases/tag/b5454), target source commit `d1be6fde11ac6e0407606b4e42fe72d34add8037`, [MIT](https://github.com/ggml-org/whisper.cpp/blob/b5454/LICENSE).
- Whisper tiny.en: [publisher revision](https://huggingface.co/ggerganov/whisper.cpp/tree/5359861c739e955e79d9a303bcbc70fb988958b1), MIT model metadata. The [official download script](https://github.com/ggml-org/whisper.cpp/blob/b5454/models/download-ggml-model.sh) names this model source. This model is English-only.

Model/runner licenses remain separate from OpenReel’s MIT code license. Retain their required notices if redistributing them.

| Artifact | Bytes | SHA256 |
| --- | ---: | --- |
| `llama-b11669-bin-ubuntu-x64.tar.gz` | 17,851,611 | `cf07c1c112d709bd67e522017471de57ed0ec8bea031d732c5422351c07f65ac` |
| `Qwen2-VL-2B-Instruct-Q4_K_M.gguf` | 986,046,944 | `5745685d2e607a82a0696c1118e56a2a1ae0901da450fd9cd4f161c6b62867d7` |
| `mmproj-Qwen2-VL-2B-Instruct-Q8_0.gguf` | 709,883,360 | `a0ad91f00a7a80dcf84d719a61b00ee2e07b71794f4ee2dfa81a254621a8c418` |
| `whisper-bin-x64.zip` | 8,928,640 | `6ba69e3482d7826214f90a6a9c84ca07782aec1e1d0c6a7c30c994fd5d816ccb` |
| `ggml-tiny.en.bin` | 77,704,715 | `921e4cf8686fdd993dcd081a5da5b6c365bfde1162e72b08d75ac75289920b1f` |

The Qwen model and projector total about 1.70 GB; Whisper tiny.en is about 78 MB. Local inference also needs adequate RAM/CPU; these download sizes do not describe total runtime memory.

## Diagnostic vision baseline: Linux x64 CPU

Run from the checkout, then keep this provider terminal open:

```sh
mkdir -p ../openreel-local-models/vision
cd ../openreel-local-models/vision
curl --fail --location 'https://github.com/ggml-org/llama.cpp/releases/download/b11669/llama-b11669-bin-ubuntu-x64.tar.gz' --output llama-b11669-bin-ubuntu-x64.tar.gz
curl --fail --location 'https://huggingface.co/ggml-org/Qwen2-VL-2B-Instruct-GGUF/resolve/bb307c036e8a1ed7b663bbd0c35b41c4c9294cfd/Qwen2-VL-2B-Instruct-Q4_K_M.gguf' --output Qwen2-VL-2B-Instruct-Q4_K_M.gguf
curl --fail --location 'https://huggingface.co/ggml-org/Qwen2-VL-2B-Instruct-GGUF/resolve/bb307c036e8a1ed7b663bbd0c35b41c4c9294cfd/mmproj-Qwen2-VL-2B-Instruct-Q8_0.gguf' --output mmproj-Qwen2-VL-2B-Instruct-Q8_0.gguf
sha256sum llama-b11669-bin-ubuntu-x64.tar.gz Qwen2-VL-2B-Instruct-Q4_K_M.gguf mmproj-Qwen2-VL-2B-Instruct-Q8_0.gguf
```

Compare all three hashes with the table, then extract/start:

```sh
tar -xzf llama-b11669-bin-ubuntu-x64.tar.gz
./llama-b11669/llama-server \
  --model Qwen2-VL-2B-Instruct-Q4_K_M.gguf \
  --mmproj mmproj-Qwen2-VL-2B-Instruct-Q8_0.gguf \
  --host 127.0.0.1 --port 4319 --alias openreel-qwen2-vl \
  --threads 8 --threads-batch 8 --ctx-size 8192 --parallel 1 \
  --n-gpu-layers 0 --no-mmproj-offload \
  --image-min-tokens 64 --image-max-tokens 128 --no-webui --offline
```

This is the original low-detail diagnostic configuration, not a validated natural-video critique setup. Its 64–128 image-token cap is below llama.cpp’s 1024-token recommendation for Qwen grounding. Actual natural-video tests made unsupported subject/action claims; eight low-detail frames did not fix them. A corrected 1024-token, 16k-context CPU run exceeded the maximum 180-second application deadline before generation. See the measured limits below. The [official multimodal guide](https://github.com/ggml-org/llama.cpp/blob/b11669/docs/multimodal.md) explains runner support. Changing models or limits requires fresh quality/latency checks.

## Speech server: Windows x64

In PowerShell from the checkout:

```powershell
$Models = Join-Path (Get-Location) '..\openreel-local-models\speech'
New-Item -ItemType Directory -Force $Models | Out-Null
curl.exe --fail --location 'https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-x64.zip' --output "$Models\whisper-bin-x64.zip"
curl.exe --fail --location 'https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-tiny.en.bin' --output "$Models\ggml-tiny.en.bin"
Get-FileHash -Algorithm SHA256 "$Models\whisper-bin-x64.zip","$Models\ggml-tiny.en.bin"
```

Compare both hashes with the table, then extract/start:

```powershell
Expand-Archive -LiteralPath "$Models\whisper-bin-x64.zip" -DestinationPath "$Models\runtime" -Force
Set-Location $Models
& '.\runtime\Release\whisper-server.exe' -m '.\ggml-tiny.en.bin' --host 127.0.0.1 --port 4320 --inference-path /v1/audio/transcriptions -l en -t 4 -ng
```

`-ng` disables GPU. The actual server accepts OpenReel’s multipart WAV request at `/v1/audio/transcriptions`; no response-conversion proxy is needed. Keep the provider terminal open. A corresponding [official source build](https://github.com/ggml-org/whisper.cpp) is an alternative for other platforms, but was not the runtime used in these measurements.

## Configure and use OpenReel

Return to the app checkout in a separate terminal. Add to the ignored local `.env`:

```dotenv
OPENAI_API_KEY=local-placeholder-no-paid-provider
OPENAI_BASE_URL=http://127.0.0.1:4319/v1
OPENAI_MODEL=openreel-qwen2-vl
OPENAI_VISION_MODEL=openreel-qwen2-vl
OPENAI_VISION_RESPONSE_FORMAT=json_schema
OPENREEL_VISION_TIMEOUT_MS=90000
OPENAI_TRANSCRIPTION_MODEL=tiny.en
OPENAI_TRANSCRIPTION_BASE_URL=http://127.0.0.1:4320/v1
```

The placeholder is not an account credential; it satisfies the adapter’s nonempty-key requirement for these local no-auth servers. The separate speech base overrides the shared base URL. Vision uses strict JSON Schema by default. `json_object` is a legacy compatibility option and still undergoes local output validation.

From the same host that runs Node, confirm the provider listeners:

```sh
curl --fail http://127.0.0.1:4319/v1/models
curl --fail http://127.0.0.1:4320/
node --version
npm start
```

If using WSL plus native Windows processes, verify reachability from the Node host; localhost forwarding depends on that setup. Keep provider listeners private. Open the app, attach a supported local MP4/WebM with decodable audio, wait for preparation, then send a question. A manual transcript takes precedence over automatic transcription. Missing/unsupported audio and invalid/provider-timeout responses stay explicit.

Decoded audio is chunked into mono 16 kHz PCM16 WAVs of at most 30 seconds and 1 MiB. Only Send uploads chunks to speech and sampled JPEGs/text to vision. Raw video stays local. Frame/audio payloads stay out of saved workspace data. Successful Video follow-ups reuse in-memory frame context; reload or eviction requires reattachment.

## What was actually verified

On October 17, 2026, a real browser-generated speech-bearing MP4 went through the actual app, Whisper and Qwen providers: eight frames, successful HTTP responses, `transcriptProvided:true`, and 39,171 ms end-to-end Send latency. The extracted 27-word synthetic utterance had zero normalized word edits. A separate 11.095-second WAV transcription completed in 674 ms. No paid API or remote audio was used.

These are one clean synthesized-speech example and a simple generated illustration, not a broad natural-UGC accuracy test. Earlier real model outputs included schema failures, duplicate citations and a color-reading error. Strict output validation catches structural/evidence violations, not every mistaken visual interpretation.

`audioAvailable:false` means raw acoustics were not given to the vision model. Separate speech recognition can have occurred; vision receives the resulting words as unverified text. Music, speaker identity, vocal delivery, precise word timing, continuous footage and causal performance claims remain unsupported. Local success also does not configure a hosted deployment or complete [full parity](PARITY.md). See [VERIFICATION.md](VERIFICATION.md) and [SECURITY.md](../SECURITY.md).

An additional natural-video test with two actual official-player screenshots reached the default 45-second deadline before the CPU model completed its JSON response. A timeout returns an explicit error and does not retry. The optional bounded deadline above gives a local CPU model longer to finish; it does not establish natural-video accuracy. The hosted deployment has no vision or speech provider configured.

## Additional natural-video and GPU evidence

The same actual public clip was sampled at eight positions across its 26.633333 seconds, without downloading its video/audio. The low-detail CPU run returned in 42.337 seconds but failed production title validation; it also made unsupported age/action claims, attributed the late tattooed-leg view to early package samples, repeated observations instead of proposing an experiment, and ignored the requested brevity.

The [pinned llama.cpp implementation](https://github.com/ggml-org/llama.cpp/blob/620d2225cc436ab0b001e3200e590e3b286ef9ab/tools/mtmd/clip.cpp) warns that Qwen grounding needs at least 1024 image tokens. [Qwen’s model documentation](https://huggingface.co/Qwen/Qwen2-VL-2B-Instruct#image-resolution-for-performance-boost) explains the image-resolution/computation tradeoff. A controlled 1024-token, 16,384-context CPU request used byte-identical images, question, schema and model parameters, with a 180-second adapter deadline; it timed out at 180.009 seconds with no returned narrative. About 3.02 GiB RSS and ample available memory indicate a processing-time limit in this run, not observed memory exhaustion.

A separately prepared native Windows CUDA 12.4 runtime, build b11669 / commit 620d2225c, recognized a Quadro P2000 (5,120 MiB, compute capability 6.1) with driver 553.35. Both official archives were checked against the release API’s SHA256 digests:

| Official archive | Bytes | SHA256 |
| --- | ---: | --- |
| `llama-b11669-bin-win-cuda-12.4-x64.zip` | 266,582,698 | `c2da1f73ed176ae093ac5aceb978a7b167a16113f6d74c6789eeaee2135cb8dc` |
| `cudart-llama-bin-win-cuda-12.4-x64.zip` | 391,443,627 | `8c79a9b226de4b3cacfd1f83d24f962d0773be79f1e7b75c6af4ded7e32ae1d6` |

They are available from the [official b11669 release](https://github.com/ggml-org/llama.cpp/releases/tag/b11669). Extract both into the same directory so the CUDA runtime DLLs are present. The existing model/projector hashes above remained unchanged. This measured command used all language layers and the projector on GPU, with Flash Attention disabled:

```powershell
.\llama-server.exe `
  --model 'C:\path\to\Qwen2-VL-2B-Instruct-Q4_K_M.gguf' `
  --mmproj 'C:\path\to\mmproj-Qwen2-VL-2B-Instruct-Q8_0.gguf' `
  --host 127.0.0.1 --port 4321 --alias openreel-qwen2-vl `
  --threads 8 --threads-batch 8 --ctx-size 16384 --parallel 1 `
  --n-gpu-layers 999 --flash-attn off `
  --image-min-tokens 1024 --image-max-tokens 1024 --no-webui --offline
```

Use the native Windows Node host for this endpoint: Linux localhost forwarding to that listener was unavailable in the observed setup. For this GPU test the app-compatible configuration used `OPENAI_BASE_URL=http://127.0.0.1:4321/v1` and `OPENREEL_VISION_TIMEOUT_MS=180000`, retaining the model alias and strict validation. These are explicit diagnostic settings, not a promise of fit or speed on another machine.

The GPU completed the byte-identical high-detail request in **102.630 seconds**, with 9,355 prompt tokens, 674 completion tokens and zero cached tokens. Whole-device use reached about 4,625/5,120 MiB and 100% GPU utilization. Production structure validation passed, but semantic quality still failed: seven sections repeated a paragraph, all sections cited the opening timestamp even when discussing the final scene, an unseen cut was asserted, and no useful editing experiment was proposed. Recognizing more visible packages/legs did not establish a dependable critique. There is no broad natural-video accuracy claim or automatic retry.

The GPU runtime is therefore verified for transport, memory fit and this deadline, while natural-video interpretation remains inadequate. Model/context changes require new evidence; neither these settings nor local success configure hosted inference or complete full parity.
