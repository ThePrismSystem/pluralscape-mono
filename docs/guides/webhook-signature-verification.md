# Webhook Signature Verification

Pluralscape signs every outgoing webhook delivery with an HMAC-SHA256 signature so you can verify that the payload originated from Pluralscape and was not tampered with in transit.

## Headers

| Header                    | Description                                    |
| ------------------------- | ---------------------------------------------- |
| `X-Pluralscape-Signature` | Hex-encoded HMAC-SHA256 of the signed content  |
| `X-Pluralscape-Timestamp` | Unix epoch seconds when the payload was signed |

## Signed content format

The signature is computed over the string:

```
{timestamp}.{payload}
```

where `timestamp` is the value of `X-Pluralscape-Timestamp` (as a string) and `payload` is the raw JSON request body.

## Verification steps

1. Extract the `X-Pluralscape-Signature` and `X-Pluralscape-Timestamp` headers.
2. Reconstruct the signed content: `"${timestamp}.${body}"`.
3. Compute HMAC-SHA256 of the signed content using your webhook secret (base64-decoded to raw bytes).
4. Compare the computed hex digest to the signature header using a constant-time comparison.
5. **Replay protection**: reject the request if the timestamp is more than 5 minutes from the current time.

## Dual-secret handling during rotation

When you rotate your webhook secret via `POST /v1/systems/{systemId}/webhook-configs/{webhookId}/rotate-secret`, deliveries already in flight may still be signed with the old secret. During the rotation window:

1. Attempt to verify with the **new** secret first.
2. If verification fails, retry with the **old** secret.
3. Accept the delivery if either secret produces a valid signature.
4. Discard the old secret once all in-flight deliveries have been processed (typically within a few minutes).

## Code examples

### Node.js

```javascript
import crypto from "node:crypto";

function verifyWebhookSignature(secret, signature, timestamp, body) {
  const REPLAY_TOLERANCE_SECONDS = 300; // 5 minutes

  // Replay protection
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > REPLAY_TOLERANCE_SECONDS) {
    throw new Error("Webhook timestamp too old or too far in the future");
  }

  const secretBytes = Buffer.from(secret, "base64");
  const signedContent = `${timestamp}.${body}`;
  const expected = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    throw new Error("Invalid webhook signature");
  }
}

// Express example
app.post("/webhooks/pluralscape", (req, res) => {
  const signature = req.headers["x-pluralscape-signature"];
  const timestamp = req.headers["x-pluralscape-timestamp"];
  const body = req.body; // raw string body

  try {
    verifyWebhookSignature(process.env.WEBHOOK_SECRET, signature, timestamp, body);
  } catch (err) {
    // Dual-secret fallback during rotation
    try {
      verifyWebhookSignature(process.env.WEBHOOK_SECRET_OLD, signature, timestamp, body);
    } catch {
      return res.status(401).send("Signature verification failed");
    }
  }

  // Process the webhook
  res.status(200).send("OK");
});
```

### Python

```python
import hashlib
import hmac
import time
from base64 import b64decode

REPLAY_TOLERANCE_SECONDS = 300  # 5 minutes


def verify_webhook_signature(
    secret: str, signature: str, timestamp: str, body: str
) -> None:
    # Replay protection
    age = abs(time.time() - int(timestamp))
    if age > REPLAY_TOLERANCE_SECONDS:
        raise ValueError("Webhook timestamp too old or too far in the future")

    secret_bytes = b64decode(secret)
    signed_content = f"{timestamp}.{body}".encode()
    expected = hmac.new(secret_bytes, signed_content, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected, signature):
        raise ValueError("Invalid webhook signature")


# Flask example
from flask import Flask, request, abort

app = Flask(__name__)


@app.route("/webhooks/pluralscape", methods=["POST"])
def handle_webhook():
    signature = request.headers.get("X-Pluralscape-Signature", "")
    timestamp = request.headers.get("X-Pluralscape-Timestamp", "")
    body = request.get_data(as_text=True)

    secrets = [app.config["WEBHOOK_SECRET"]]
    old_secret = app.config.get("WEBHOOK_SECRET_OLD")
    if old_secret:
        secrets.append(old_secret)

    verified = False
    for secret in secrets:
        try:
            verify_webhook_signature(secret, signature, timestamp, body)
            verified = True
            break
        except ValueError:
            continue

    if not verified:
        abort(401)

    # Process the webhook
    return "OK", 200
```

### Go

```go
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"strconv"
	"time"
)

const replayToleranceSeconds = 300 // 5 minutes

func verifyWebhookSignature(secret, signature, timestamp, body string) error {
	// Replay protection
	ts, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid timestamp: %w", err)
	}
	age := math.Abs(float64(time.Now().Unix() - ts))
	if age > replayToleranceSeconds {
		return fmt.Errorf("webhook timestamp too old or too far in the future")
	}

	secretBytes, err := base64.StdEncoding.DecodeString(secret)
	if err != nil {
		return fmt.Errorf("invalid secret encoding: %w", err)
	}

	signedContent := fmt.Sprintf("%s.%s", timestamp, body)
	mac := hmac.New(sha256.New, secretBytes)
	mac.Write([]byte(signedContent))
	expected := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(expected), []byte(signature)) {
		return fmt.Errorf("invalid webhook signature")
	}
	return nil
}

func webhookHandler(w http.ResponseWriter, r *http.Request) {
	signature := r.Header.Get("X-Pluralscape-Signature")
	timestamp := r.Header.Get("X-Pluralscape-Timestamp")

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body", http.StatusBadRequest)
		return
	}
	body := string(bodyBytes)

	secrets := []string{os.Getenv("WEBHOOK_SECRET")}
	if old := os.Getenv("WEBHOOK_SECRET_OLD"); old != "" {
		secrets = append(secrets, old)
	}

	verified := false
	for _, secret := range secrets {
		if err := verifyWebhookSignature(secret, signature, timestamp, body); err == nil {
			verified = true
			break
		}
	}

	if !verified {
		http.Error(w, "Signature verification failed", http.StatusUnauthorized)
		return
	}

	// Process the webhook
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "OK")
}

func main() {
	http.HandleFunc("/webhooks/pluralscape", webhookHandler)
	http.ListenAndServe(":8080", nil)
}
```
