"""Disjoint system coverage from official class/superclass labels, not inferred ROIs."""

CLASS_GROUPS = {
    "Kenyon_Cell": (
        "memory_input",
        "Kenyon cells",
        "Associative-memory circuitry; activity is not proof of learning.",
    ),
    "MBON": (
        "memory_output",
        "Mushroom-body outputs",
        "Links memory circuitry to other brain systems.",
    ),
    "DAN": (
        "dopamine",
        "Dopamine neurons",
        "Modulatory circuitry; reward and plasticity are not modeled here.",
    ),
    "CX": (
        "navigation",
        "Central complex",
        "Orientation and navigation circuitry; no navigation task is simulated.",
    ),
    "ALPN": (
        "olfactory_relay",
        "Olfactory relay network",
        "Antennal-lobe processing and projection neurons.",
    ),
    "ALLN": (
        "olfactory_relay",
        "Olfactory relay network",
        "Antennal-lobe processing and projection neurons.",
    ),
    "ALIN": (
        "olfactory_relay",
        "Olfactory relay network",
        "Antennal-lobe processing and projection neurons.",
    ),
    "ALON": (
        "olfactory_relay",
        "Olfactory relay network",
        "Antennal-lobe processing and projection neurons.",
    ),
}


def group_for(meta):
    if meta.get("class") in CLASS_GROUPS:
        return CLASS_GROUPS[meta["class"]]
    superclass = meta.get("superclass") or ""
    if superclass.startswith("ol_") or superclass.startswith("visual_"):
        return ("vision", "Visual system", "Optic-lobe and visual projection circuitry.")
    if "sensory" in superclass:
        return ("sensory", "Other sensory pathways", "Annotated sensory inputs and sensory relays.")
    if "motor" in superclass or "descending" in superclass:
        return (
            "output",
            "Descending & motor pathways",
            "Signals toward movement systems; activity alone does not establish a movement.",
        )
    if superclass.startswith("vnc") or "ascending" in superclass:
        return (
            "cord",
            "Nerve-cord & ascending pathways",
            "Ventral-nerve-cord processing and communication with the brain.",
        )
    return (
        "other",
        "Other central circuitry",
        "Remaining annotated cells; individual functions are not assigned by this grouping.",
    )


def system_activity(result, node_meta, threshold=0.035):
    groups = {}
    membership = {}
    for body_id, meta in node_meta.items():
        key, label, role = group_for(meta)
        groups.setdefault(
            key,
            {
                "key": key,
                "label": label,
                "role": role,
                "total": 0,
                "reached": 0,
                "active_by_step": [0] * len(result.steps),
                "peak": 0.0,
                "example_ids": [],
            },
        )["total"] += 1
        membership[body_id] = key
    for a in result.activations:
        if a.body_id not in membership:
            continue
        g = groups[membership[a.body_id]]
        g["reached"] += 1
        g["peak"] = max(g["peak"], a.activation)
        if len(g["example_ids"]) < 3:
            g["example_ids"].append(a.body_id)
        for i, value in enumerate(a.history):
            if i < len(g["active_by_step"]) and value > threshold:
                g["active_by_step"][i] += 1
    return list(groups.values())
