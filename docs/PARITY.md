# Full demo parity: evidence and remaining work

The target remains **full 1:1 parity with the observable March 2026 Lightreel demo**, including independently acquired real corpus coverage. The [continuation specification](superpowers/specs/2026-10-17-parity-continuation.md) supersedes earlier exclusions that treated live discovery, video understanding or corpus scale as outside scope. This implementation advances that target; it does not establish completion.

## References

The primary reference is the [March 16 launch post](https://x.com/Jibran_05/status/2033589137018917027): competitor hooks, video critique, constrained creator discovery and an advertised 150,000+ analyzed-video index. That advertised number is not an OpenReel dataset.

The later [website](https://lightreel.ai/) and [API documentation](https://lightreel.ai/docs), inspected October 17, 2026, inform navigation and source presentation. They do not prove every later feature appeared in the March demo. No Lightreel application source, private index, model weights or demo media is included.

## Capability matrix

| Required target | Current evidence | Required remaining proof |
| --- | --- | --- |
| Observable visual/interaction fidelity | Measured composer/typography, local Inter font, avatar, attachment preview, source overlays/player, creator table and trend thumbnail fan; keyboard/mobile checks. | Reference-aligned screenshots and measured comparisons for every demonstrated state, including result layouts and transitions. Partial component matches do not establish pixel identity. |
| Actual video and spoken-content critique | Browser samples up to eight real frames and extracts local audio. Configurable speech/vision adapters use actual media/text, strict schemas and citations. A real browser→Whisper→Qwen run succeeded with an eight-frame speech-bearing MP4. | Broad natural-UGC quality, supported visual hooks/pacing/reveal critique and follow-up quality; continuous-footage and acoustic understanding remain limited. A clean synthetic example is not a quality benchmark. Hosted AI deployment is unverified. |
| Live acquisition and source access | Official no-key video oEmbed and creator embeds returned real metadata, followers/bios and selected videos. Sources have canonical links/inline players. Apify keyword discovery has bounded transport/mapping. | Configured end-to-end paid keyword search with relevance/profile/run/billing evidence. Creator-seeded collection alone is not general keyword discovery. No paid Apify run was made. |
| Combined creator accuracy | Topic, school/location, follower/count/contact filters; email-in-bio checks; unknown-aware counts; conservative profile self-description with original bio/citation. | Representative real-source evidence for complex combined criteria and adequate profile coverage. Public self-description is not verified enrollment/residence; captions never establish those attributes. |
| Real corpus comparable to 150,000+ videos | Node 24 SQLite/FTS indexing, iterable atomic imports, provenance classes, sequential profile collection, and bounded corpus research. One observed collection produced 10 real videos. Separate benchmark stored/searched 150,000 synthetic rows. | At least target-scale independently acquired unique real videos with permitted provenance, transcripts/visual descriptions, counts, runtime and complete research/citation queries. The benchmark has zero real videos. |
| Competing hooks and emerging trends | Corpus hook comparisons, format groups across distinct creators, source cards and unknown-aware analytics. | Current real multi-creator audiovisual evidence, meaningful dates/time windows and validated emergence. Supplied labels or repeated examples are insufficient. |
| Public source and matching usable deployment | MIT original code/fixtures, separately licensed Inter, portable Worker build and CI; Node corpus is separately documented. | Verify the final published commit, matching deployed source and deployment smoke checks. Local model success does not configure hosted AI. Node filesystem SQLite is unavailable in the Worker; a hosted storage adapter is still being implemented/verified. |

## Evidence added in this increment

- **Free creator acquisition:** known public handles yield bounded official embed snapshots. A local collection stored 10 provider-observed records from one creator. Followers/views are observed metrics; likes/comments/shares remain unknown where absent. Bio emails and conservative school/city labels retain public self-description evidence.
- **Persistent indexing:** the [SQLite pipeline](CORPUS.md) exceeds the browser’s 2,000-record cap and separates real, example, synthetic and unverified counts. A 150,000-row synthetic test proves tested storage capacity, not real acquisition. A separate candidate described as 950k yielded only 4,162 distinct video IDs in inspection; it has not closed the unique-real-corpus requirement.
- **Actual local models:** the manual [CPU setup](LOCAL_MODELS.md) ran real Qwen2-VL vision and Whisper tiny.en speech. The actual app’s eight-frame plus audio browser path succeeded in 39,171 ms. Both direct WAV and extracted-MP4 speech checks matched all 27 reference words after punctuation/case normalization.
- **Source selection and continuity:** Video, Library, Live search and configured Corpus are explicit. Successful Video context supports in-memory follow-ups for at most two chats. Selecting another source does not silently reuse retained frames. Raw JPEG/WAV payloads do not persist.
- **Structured responses:** strict JSON Schema is the vision default; the optional legacy JSON-object mode still undergoes validation. An earlier actual model response with duplicate citations was correctly rejected. Passing the schema does not prove every visual interpretation is correct.

`audioAvailable:false` means the vision model received no raw acoustics. A separate recognizer can still have processed audio and supplied unverified words, recorded by `transcriptProvided:true`. Music, vocal delivery, exact word timing, unseen cuts and causal analytics are not established by that pipeline.

## Completion boundary

Fictional/synthetic records, repeated rows, provider contract doubles, badges and interface labels never count as real unique indexed videos or successful real inference. Dataset licensing alone does not establish unique coverage or audiovisual/profile completeness. Local inference, model errors and missing providers are reported as observed; no fictional result substitutes for them.

The actual large real corpus, broad transcripts/profile evidence, complete visual states, current real trends, hosted provider/storage configuration and exact published/deployed verification remain required work. See [VERIFICATION.md](VERIFICATION.md).
