# Flows

End-to-end business flows for this project, derived from `docs/SRS.md`. Each names the modules
involved, the aggregates, the invariants that must hold, and the cross-module rules.

| Flow | SRS | Covers |
|---|---|---|
| `order-fulfilment-flow.md` | §4.9 | Cart, FEFO allocation, dispatch, returns |
| `import-to-shelf-flow.md` | §4.8 | Consignments, batches, expiry lifecycle, landed cost |

## Retired flows

The clinic, surgery, vaccination, boarding, prescription-diet and batch-recall flows were removed on
2026-10-23 when the platform pivoted from a cat clinic to the Amar Gram general e-commerce shop. A
generic product-recall flow may be written in Pass 2.

## Archived

`_archive-procurement/` holds eight flow documents from a different project (`Bits.Procurement`)
built on the superseded architecture. They describe nothing in this system. See the README there.
