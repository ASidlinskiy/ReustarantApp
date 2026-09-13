# Al's Diner

**Live: [als-diner.netlify.app](https://als-diner.netlify.app)**

Vanilla JavaScript + Vite menu and pickup order requests. Customers choose quantities, provide a name and phone number, and send an ASAP pickup request to Netlify Forms. Staff confirms availability, final pricing and pickup by phone. Payment happens at pickup; this is not an online payment or automatic order acceptance system.

## Develop and test

Use Node 22.19 or newer and the checked-in npm lockfile:

```sh
npm ci
npm run lint
npm run build
npx playwright install chromium
npm test
```

`npm start` runs Vite for UI development. Use `npx netlify dev` when developing with Netlify platform services. Real Forms ingestion must be verified on a Netlify deployment; a successful response from a local server does not prove storage.

`npm test` serves the existing `dist/` build without rebuilding it. Rebuild after source changes. Browser tests mock POST requests using synthetic data and never send live orders. They cover desktop and 320px projects plus 375px, 768px and 1280px layouts. Failure traces/screenshots use only synthetic test data; do not run artifact capture with real customer details.

## Enable and verify Netlify Forms

1. Use the existing `als-diner` Netlify project. Enable form detection under Forms before deploying this branch preview. Build command is `npm run build`; publish directory is `dist`.
2. The `pickup-orders` form lives directly in `index.html`, outside the menu template, so its entire field schema is available to Netlify at build time. It includes a honeypot. Do not move it into JavaScript-only markup.
3. On the preview, submit one clearly marked synthetic order (name `TEST - DO NOT PREPARE`, phone `2025550100`, notes explaining it is a deployment check). Look up its request reference in Forms > pickup-orders, including spam submissions if absent. A visible receipt or HTTP 200 alone is not sufficient deployment verification.
4. Review the PR and preview before merging; this work does not authorize a production release.

### Submission contract

URL-encoded `POST /` fields: `form-name=pickup-orders`, `request-reference`, `customer-name`, `phone`, `notes`, `pickup=ASAP`, `order-summary`, `estimated-subtotal`, `currency=USD`, and `bot-field`.

Quantities are whole numbers from 1 to 99 per menu item. The frontend computes cents from the menu and shows USD estimates; submitted quantities/prices are untrusted customer input. Netlify Forms stores requests and applies spam filtering, not menu validation, stock checks, tax calculation or payment processing. Staff must check item IDs, quantities and current menu prices before accepting a request. No tax, tip or delivery rule is invented by this app.

## Staff workflow

Open the existing Netlify project > Forms > pickup-orders. Each submission contains the customer's name/phone, optional notes, itemized quantities and estimated subtotal, plus a request reference. Verify availability and final price, call the customer, and agree on pickup. The confirmation screen only acknowledges receipt of a request; it does not promise acceptance or a preparation time. No email notifications are configured.

The client blocks double clicks while sending. A timeout/network error can happen after the server stored a request: identical manual retries reuse the same reference. Treat matching references as one request before preparing food. Netlify Forms does not provide server-enforced idempotency here. If the customer changes order contents or contact details, the next submission gets a new reference. Contact details and retry state exist only in memory and are cleared after success; refreshing clears the unfinished cart and inputs. Retain/manage submissions using the restaurant's existing data handling policy.

## Graceful failures and Lighthouse

The built HTML contains the menu, so it remains readable if JavaScript is disabled or fails to load. Ordering controls activate only after initialization. A failed module offers a reload link. Invalid customer details receive native field messages plus a persistent form-level explanation. Offline, interrupted, timed-out, rejected and rate-limited submissions have distinct recovery messages; none clears the cart or claims the request was accepted.

After building, run `npm run lighthouse` to start an isolated local preview and audit mobile and desktop three times each with Lighthouse 13.4.1. Every Performance, Accessibility, Best Practices and SEO score must reach 98; a lower score fails CI. HTML and JSON reports are uploaded in the `quality-reports` artifact. `LIGHTHOUSE_RUNS=1` is available for development diagnostics; CI uses three. To audit a deployment use `npm run lighthouse -- https://YOUR-PREVIEW-URL`. Netlify may intentionally add `X-Robots-Tag: noindex` to previews, which lowers their SEO score; do not remove preview indexing protection to improve a score. Audit production-shaped output locally and report preview limitations separately.

Lighthouse scores vary with browser, hardware, network and server response times. Automated navigation scores do not replace the interactive checkout tests.

## Performance comparison

Serve a baseline production build and the updated build on separate local ports, then run:

```sh
node scripts/measure-performance.js http://127.0.0.1:4174 http://127.0.0.1:4175 ../baseline-dist dist
```

The benchmark performs ten cycles of adding all 12 items and removing them, five times per build, in Chromium at 320x800 with 4x CPU slowdown. It records CDP metrics, first-run timeline traces, raw/gzip HTML/CSS/JS sizes, and synthetic screenshots in ignored `test-results/performance/`. It never submits an order. Results are a controlled synchronous cart stress test, not Lighthouse, field performance, or a network loading measurement.
