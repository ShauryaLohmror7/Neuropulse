"""Connectome-constrained activity propagation.

IMPORTANT SCIENTIFIC FRAMING
----------------------------
The *graph* here is real: neurons, edges and synaptic weights come from MaleCNS
v1.0.  The *dynamics* are a deliberately simplified, deterministic propagation
model — not a biophysical simulation.  Activation values produced by this module
describe how signal spreads through measured connectivity under an explicit toy
model; they are not predicted firing rates and have not been validated against
physiology.
"""
