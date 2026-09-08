# Known limitations

- Campus event forwarding is best effort and does not yet have a durable retry queue.
- The Program list depends on Haiwen's official dataset; the tested local data produced 2027 matches but not the 2028 E2E profile.
- Live Feishu delivery is outside Campus and was not verified without credentials.
- The visual browser backend could not produce screenshots, so UI QA used the live DOM, interactions, report expansion and a 390px overflow check.
