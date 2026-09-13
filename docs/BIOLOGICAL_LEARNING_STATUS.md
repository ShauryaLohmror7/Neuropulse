# Biological learning: implementation status

The maze and its separate Q-learning controller have been removed at the project owner’s request. NEUROPULSE currently has no biological plasticity model. The research requirements below describe possible future work, not a committed maze replacement.

## External demonstrations checked

The [DOOMFLY primary project page](https://fly-brain-doom.awormuth.chatgpt.site/) currently labels its broadcast “NO LEARNING,” uses fixed neural readouts mapped to game controls, and explicitly says these are engineered game controls rather than validated natural fly commands. Its baseline synapses are fixed; stimulation alone does not establish learning. The project also describes an experimental training candidate, whose existence does not validate learning in NEUROPULSE. The specific chess demo has not been identified or verified.

## What a replacement needs to demonstrate

- Sensory observations drive a persistent neural state; movement depends on explicit neural output, not a parallel grid policy.
- A documented plasticity rule changes modeled efficacies on identified existing synapses; original measured synapse counts remain immutable and separately inspectable.
- Reinforcement is tied to modeled reward pathways with explicit assumptions about receptor signs, state and timing.
- Fresh, trained, frozen-plasticity and reward-shuffled controls use matched trials and seeds. Improvements must survive evaluation without learning updates.
- Disconnecting sensory input or silencing decoded output disrupts behavior; disabling the plasticity mechanism removes any attributed learning advantage.
- Held-out mazes test transfer. No guaranteed improvement, target route, random success chart or pretrained hidden navigation policy is acceptable.

Until those mechanisms and controls exist, do not describe NEUROPULSE as a biologically learning fly or a validated brain emulation. This document records unfinished work, not an implemented feature.
