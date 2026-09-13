# Evidence-driven readout expansion

Implemented 2026-09-13. These changes expand monitored circuit associations, not validated behavioral coverage.

| Change | Exact MaleCNS types | Local cells | Source |
|---|---|---:|---|
| Front-leg rubbing | DNg11 | 6 | [Guo et al., 2022](https://doi.org/10.1016/j.cub.2021.12.055) |
| Walking stride adjustment | DNg13 | 2 | [Cell, 2024](https://doi.org/10.1016/j.cell.2024.08.033) |
| Forward-walking pathway | DNg97, DNg100 | 4 | [Sapkal et al., 2024](https://www.nature.com/articles/s41586-024-07854-7), [cross-reference](https://www.nature.com/articles/s41586-026-10735-w) |
| Correct feeding marker | MN9 only | 2 | [Shiu et al., 2024](https://www.nature.com/articles/s41586-024-07763-9) |

DNg97's oDN1 alias is explicitly documented by the [official cell-type explorer](https://reiserlab.github.io/celltype-explorer-drosophila-male-cns/types/DNg97.html). DNg12 was not added: that exact type is absent from the local catalogue. No aliases or cell identities were guessed. No neurons are directly stimulated merely because an action is named.

The monitored readouts increase from 8 to 11. Existing engagement thresholds and propagation parameters stay unchanged. MN11D/MN11V/MN12D are no longer pooled into the MN9 rostrum-lifting readout. Broad MaleCNS taste inputs do not establish sugar-versus-bitter selectivity and cannot be substituted for Shiu's identified FlyWire GRNs.

Published activation experiments establish cell-type associations under experimental conditions; they do not validate our dynamics or a natural-language-to-behavior prediction. DNg13 is monitored separately because its recruitment and limb effects differ from DNa01/02. We do not infer turn direction or physical displacement.

## Controlled comparison

`backend/scripts/compare_readouts.py` evaluates old and new readouts on identical computed activity arrays for 20 local-parser inputs. Results are in `readout-comparison.json`. This comparison showed no improvement in action coverage. It must not be confused with the earlier 20 live-Gemini audit.

The review also exposed and corrected the local parser's generic approach-to-looming override and missed temperature paraphrases. Ordinary approach now maps to visual motion; explicit speed/expansion supports looming. Hot/cold remain one broad thermal population, not distinct physiology.

## Remaining scientific bottleneck

A broader decoder alone does not fix the sensory-to-motor model. A meaningful next research milestone is reproducing an established sensorimotor benchmark with the publication's identified input/output populations and dynamics, then testing held-out perturbations. The current source population labels do not resolve all of those inputs. Changing gains until natural-language examples produce actions would not validate the model. No 90% claim is supported by this pass.
