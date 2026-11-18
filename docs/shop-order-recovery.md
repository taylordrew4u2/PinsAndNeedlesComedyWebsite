# Shop order recovery

The webhook uses the Stripe Checkout session ID as Printify's unique per-shop
`external_id`. A duplicate-create 409 is recovered only if its external ID
matches. The order is read back and checked against `metadata.shop_order_id`.
Its ID and shop ID are saved in Stripe metadata before requesting production.
Retries resume that same order; they never create a replacement order.

An accepted production status skips another submission. Pending/cost-calculation
states return 500 until a retry observes readiness. Unknown, canceled,
payment-not-received and has-issues states require operator review.

Before production, a permanent atomic create-only claim is written to the
existing GitHub content repository under `shop-production-claims/`. The filename
is a SHA-256 of shop and order IDs; the record contains only intent and time.
Only a successful create authorizes a send. Existing claims or lost write
responses do not. Claims never expire, overwrite or auto-delete. A second
provider read before sending skips already-accepted orders. After a failed send,
a fresh provider read must confirm acceptance or the webhook returns 500.
Later retries reconcile state, but NEVER resend a claimed on-hold order.

## Limits and operational requirements

This deliberately trades automatic retry of production failures for safety. A
crash after claiming but before sending leaves an order needing operator review.
An on-hold status alone cannot prove that an earlier submission failed. Do not
delete claims to unblock retries without separately establishing provider state
and ensuring no worker or request is still active. Retain this content repository
and its claim files across deployments, migrations and restores.

GitHub's create-without-SHA rejects existing files and concurrent creates. An
unrelated commit conflict can defer an order to a later Stripe retry. Checkout
requires content GitHub credentials and a webhook secret, but configuration
presence does not prove API permissions or registered webhook delivery.

Printify's send endpoint is asynchronous. A successful response means accepted,
not printed or shipped. Later provider failures need monitoring. Exactly-once
physical production is not guaranteed. Existing old-version requests and human
provider actions are outside the claim protocol. PRINTIFY_HOLD_ORDERS skips our
send only; provider auto-approval may still produce orders. Never use real
orders as tests. Do not change Printify shops while unresolved sessions exist:
legacy sessions without a saved shop ID use the configured shop.

## Reviewing affected orders

Use authorized Stripe and Printify dashboards. For paid shop sessions, reconcile
session ID, Printify external ID, saved order/shop IDs, current provider status
and webhook delivery history. Replay only the original event when appropriate;
never change the external ID to bypass a conflict. Escalate ambiguous identities
or failed/canceled states for human review. Replaying can initiate production,
so do not replay real events during a read-only audit or test.

Tests use injected in-memory I/O for duplicate deliveries, lost responses,
metadata failure, production failure, holds and mismatched identities. They
create no real sessions, charges, orders or shipments. Passing tests does not
prove live webhook registration or that any historic customer was affected.
