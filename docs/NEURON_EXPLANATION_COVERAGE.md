# Neuron explanation coverage

The inspector resolves explanations in this order: curated cell type, supported Johnston’s-organ subgroup, official class, official anatomical superclass, then source anatomy for records without those annotations.

Verified against all 166,700 nodes in `data/full-cns/catalogue.json`:

- 17,294 match curated type explanations (including T4/T5 motion families).
- 405 match Johnston’s-organ subgroup explanations.
- 149,001 receive class or anatomical-group descriptions.
- No current catalogue cell falls through to anatomy-only text.

This is explanation coverage, not functional validation of every neuron. Broad anatomical explanations describe routes and roles; they do not assign a specific stimulus, emotion or behavior. Provisional classifications remain marked provisional. Future unclassified records receive source structural facts, including available pre/post site counts, without an invented function.

Run-specific explanations remain based on actual input membership, retained activation or recorded propagation events. Anatomy inspection without activation is identified explicitly.

New learning-circuit descriptions draw on [Aso et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC4273437/), antennal-lobe local neurons on [Chou et al.](https://www.nature.com/articles/nn.2489), and projection pathways on [evolution of mushroom-body connectivity](https://www.nature.com/articles/s41467-024-48839-4). Anatomical class descriptions use the official MaleCNS annotations. These sources do not validate the app’s propagation dynamics.

Verification: `node --experimental-strip-types --test frontend/tests/neuron-explanation.test.mjs` includes the full-catalogue coverage check, provisional annotation handling, source-only fallback and recorded upstream signal checks.
