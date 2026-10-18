# Plain-language brief follow-up

The ordinary browser returned an AI research summary for the typed request “Make a brief.” after a cooking research question. It preserved sources and returned HTTP200, so the initial smoke assertions passed despite missing the requested deliverable. Preserve that failed content evidence.

Root cause: `wantsWriting` recognizes this request and preserves the research topic, but `research` only routes “creative brief” or “shot list” into its brief path. A plain “brief” stays `kind:research`, with research seeds and title. The visible Make a brief button sends the longer explicit request; the typed equivalent must work too.

Approved design: use a shared predicate for noun-form brief and shot-list requests, including explicit/polite writing verbs. Preserve those forms in writing follow-up retrieval; distinguish adjectival brevity instructions. Reuse the existing brief path, sources and date/profile retrieval constraints. Identify the result as a creative brief without claiming the user supplied a script. For synthesis, explicitly use the current request as the deliverable; history supplies topic/constraints, not a competing deliverable. A brief must propose original hooks and a concrete shot list, labeled as proposed footage. No new provider, schema, retry or access behavior.

1. Add a failing plain-follow-up regression and non-writing “brief” negative controls; retain the dated/filter/source tests.
2. Fix the request classification and brief guidance only. Verify useful deterministic fallback and real browser brief/shot-list content, not HTTP/mode alone.
3. Independent review, full tests/build, exact public source/CI/archive/deployment; keep prior1.16.3 video/recovery evidence separate from fresh1.16.4 core evidence. No claim that these fixes close discovery/current-emergence limits.

Review found explicit Write/Give/Make/Create forms regressed under the first writing gate, and Make this brief was misclassified. Both were reproduced red before the shared noun-intent predicate fixed them. Real first-fix output supplies a six-part20-second shot list; final grammar/commit evidence is separate.
