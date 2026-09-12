"""The supported sensory ontology, grounded in real MaleCNS v1.0 annotations.

Every entry names a *query* against real dataset annotations (``class``,
``subclass``, ``type``, ``entryNerve``, ``rootSide``) and carries an explicit
mapping-quality judgement:

SUPPORTED_REAL_MAPPING
    The dataset itself annotates this neuron population as belonging to this
    sensory modality, and the published physiology for those cells matches the
    stimulus we claim to deliver.

APPROXIMATE_MAPPING
    The neuron population is real and correctly identified, but the link from
    the *English stimulus* to that population involves an interpretive step
    (e.g. "ripe fruit" -> the specific glomeruli tuned to fruit-ester odorants),
    or the dataset does not annotate the sub-property we are asked for
    (e.g. sweet vs bitter among gustatory receptor neurons).

UNSUPPORTED
    We recognise the semantic content but there is no defensible neuron
    population in this dataset to stimulate.  Nothing is injected.

The ``evidence`` field names the basis for each claim so a reviewer can check it.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

MappingQuality = Literal["SUPPORTED_REAL_MAPPING", "APPROXIMATE_MAPPING", "UNSUPPORTED"]
Modality = Literal[
    "vision",
    "olfaction",
    "gustation",
    "mechanosensation",
    "audition",
    "thermosensation",
    "hygrosensation",
    "airflow",
    "internal_state",
]


class PopulationQuery(BaseModel):
    """How to find this population in MaleCNS. Only real annotation fields."""

    cell_types: list[str] = Field(default_factory=list, description="Exact `type` values.")
    type_regex: str | None = None
    neuron_class: list[str] = Field(default_factory=list, description="`class` values.")
    subclass: list[str] = Field(default_factory=list)
    superclass: list[str] = Field(default_factory=list)
    entry_nerve: list[str] = Field(default_factory=list)
    exclude_subclass: list[str] = Field(
        default_factory=list, description="`subclass` values to exclude from the match."
    )
    exclude_types: list[str] = Field(default_factory=list)
    lateralised: bool = Field(
        default=True, description="Whether `rootSide` L/R meaningfully splits this population."
    )
    max_neurons: int = Field(default=140, description="Cap on seeded neurons, strongest first.")


class StimulusConcept(BaseModel):
    """One thing the fly can experience, and the real neurons that carry it."""

    key: str
    modality: Modality
    label: str
    description: str
    population: PopulationQuery
    mapping_quality: MappingQuality
    evidence: str
    #: Phrases that should retrieve this concept. Used to build the semantic index.
    phrases: list[str] = Field(default_factory=list)
    #: Notes surfaced in the UI when this concept is used.
    caveat: str | None = None


# ---------------------------------------------------------------------------
# VISION
# ---------------------------------------------------------------------------

LOOMING = StimulusConcept(
    key="visual_looming",
    modality="vision",
    label="Looming object",
    description="A dark object expanding rapidly on the retina — an approaching collision or predator.",
    population=PopulationQuery(
        cell_types=["LC4", "LPLC2", "LPLC1"],
        superclass=["visual_projection"],
        lateralised=True,
        max_neurons=160,
    ),
    mapping_quality="SUPPORTED_REAL_MAPPING",
    evidence=(
        "LC4 and LPLC2 are lobula columnar visual projection neurons annotated in MaleCNS as "
        "superclass 'visual_projection'. Both are established loom-selective populations that "
        "drive escape via the giant fibre DNp01 (Klapoetke et al. 2017; Ache et al. 2019; "
        "von Reyn et al. 2017). Their downstream connection to DNp01 is present in this dataset."
    ),
    phrases=[
        "a looming object", "something rushing toward the fly", "a shadow rapidly expanding",
        "a dark object approaching fast", "a predator diving at it", "something about to hit it",
        "a hand swatting at the fly", "an object getting closer very quickly",
        "a large shape growing in its visual field", "an imminent collision",
    ],
)

VISUAL_MOTION = StimulusConcept(
    key="visual_motion",
    modality="vision",
    label="Visual motion",
    description="Directional motion across the visual field.",
    population=PopulationQuery(
        cell_types=["T4a", "T4b", "T4c", "T4d", "T5a", "T5b", "T5c", "T5d"],
        lateralised=True,
        max_neurons=180,
    ),
    mapping_quality="SUPPORTED_REAL_MAPPING",
    evidence=(
        "T4 and T5 are the fly's elementary motion detectors, annotated by subtype (a-d) in "
        "MaleCNS. Each subtype is tuned to one of four cardinal directions; T4 responds to "
        "brightness increments, T5 to decrements (Maisak et al. 2013; Fisher et al. 2015)."
    ),
    phrases=[
        "motion", "something moving", "movement across its vision", "a moving object",
        "something drifting past", "visual flow", "something sliding by", "a passing shape",
    ],
)

BRIGHTNESS = StimulusConcept(
    key="visual_luminance",
    modality="vision",
    label="Luminance change",
    description="A change in overall light level reaching the retina.",
    population=PopulationQuery(
        cell_types=["R1-R6"],
        neuron_class=["visual"],
        superclass=["ol_sensory"],
        lateralised=True,
        max_neurons=160,
    ),
    mapping_quality="SUPPORTED_REAL_MAPPING",
    evidence=(
        "R1-R6 are the broad-spectrum photoreceptors of the outer retina, annotated in MaleCNS "
        "as class 'visual', superclass 'ol_sensory'. They carry luminance and contrast signals."
    ),
    phrases=[
        "it gets dark", "a sudden flash of light", "the light dims", "bright light",
        "a shadow falls over it", "darkness", "the lights go out", "sudden brightness",
    ],
)

# ---------------------------------------------------------------------------
# OLFACTION — glomerulus-specific, via real ORN type annotations
# ---------------------------------------------------------------------------

FRUIT_ODOUR = StimulusConcept(
    key="olfactory_fruit",
    modality="olfaction",
    label="Ripe / fermenting fruit odour",
    description="The ester and acetate volatiles released by ripening and fermenting fruit.",
    population=PopulationQuery(
        cell_types=[
            "ORN_DM1", "ORN_DM2", "ORN_DM4", "ORN_VM2", "ORN_VA2", "ORN_VM7d", "ORN_DM5",
        ],
        neuron_class=["olfactory"],
        lateralised=True,
        max_neurons=150,
    ),
    mapping_quality="APPROXIMATE_MAPPING",
    evidence=(
        "These ORN populations are annotated by target glomerulus in MaleCNS. The receptors "
        "innervating them are tuned to fruit-derived volatiles: Or42b->DM1 (ethyl acetate, the "
        "dominant driver of vinegar attraction), Or22a->DM2 (ethyl hexanoate, a ripe-fruit "
        "marker), Or59b->DM4, Or85b->VM5d, Or43b->VM2 (Hallem & Carlson 2006; Semmelhack & Wang "
        "2009; Knaden et al. 2012)."
    ),
    caveat=(
        "'Ripe fruit' is an odour *category*, not a single odorant. The glomeruli are real and "
        "correctly identified; the mapping from the English phrase to this glomerular set is an "
        "interpretation of published receptor tuning, not a measurement."
    ),
    phrases=[
        "the smell of ripe fruit", "rotting fruit odour", "fermenting fruit", "vinegar smell",
        "the smell of a banana", "smelling food nearby", "food is nearby",
        "the scent of an apple", "attractive food odour", "the odour of a meal",
        "smells something sweet in the air", "the aroma of fruit", "food smell",
        "detects the odour of ripe produce", "an attractive smell of something edible",
    ],
)

AVERSIVE_ODOUR = StimulusConcept(
    key="olfactory_aversive",
    modality="olfaction",
    label="Aversive odour (CO₂ / microbial)",
    description="Stress-associated CO₂ and geosmin, both innately repellent to flies.",
    population=PopulationQuery(
        cell_types=["ORN_V", "ORN_DA2"],
        neuron_class=["olfactory"],
        lateralised=True,
        max_neurons=110,
    ),
    mapping_quality="SUPPORTED_REAL_MAPPING",
    evidence=(
        "The V glomerulus receives Gr21a/Gr63a CO₂ receptor neurons and DA2 receives Or56a "
        "geosmin-tuned neurons; both drive innate avoidance (Suh et al. 2004; Stensmyr et al. "
        "2012). Both ORN populations are annotated by glomerulus in MaleCNS."
    ),
    phrases=[
        "a foul smell", "the smell of mould", "rotten bacterial smell", "carbon dioxide",
        "an alarming odour", "a repellent smell", "the stress odour of other flies",
    ],
)

PHEROMONE = StimulusConcept(
    key="olfactory_pheromone",
    modality="olfaction",
    label="cVA pheromone",
    description="cis-vaccenyl acetate, the male-deposited social pheromone.",
    population=PopulationQuery(
        cell_types=["ORN_DA1"], neuron_class=["olfactory"], lateralised=True, max_neurons=120
    ),
    mapping_quality="SUPPORTED_REAL_MAPPING",
    evidence=(
        "DA1 receives Or67d neurons responding to cVA, the canonical Drosophila social "
        "pheromone channel (Kurtovic et al. 2007; Datta et al. 2008). Annotated by glomerulus."
    ),
    phrases=[
        "cis-vaccenyl acetate", "a mating pheromone", "the scent of a potential mate",
        "conspecific pheromone in the air", "a courtship signal from another individual",
        "male pheromone marking",
    ],
)

# ---------------------------------------------------------------------------
# GUSTATION
# ---------------------------------------------------------------------------

TASTE_LABELLAR = StimulusConcept(
    key="gustatory_labellar",
    modality="gustation",
    label="Taste on the labellum",
    description="Contact chemosensation at the mouthparts — the fly tasting a surface.",
    population=PopulationQuery(
        neuron_class=["gustatory"],
        entry_nerve=["MxLbN"],
        lateralised=True,
        max_neurons=130,
    ),
    mapping_quality="APPROXIMATE_MAPPING",
    evidence=(
        "MaleCNS annotates gustatory receptor neurons entering through the maxillary-labial "
        "nerve (MxLbN) from the labellum. The modality is annotated; the dataset does not label "
        "these neurons by tastant valence."
    ),
    caveat=(
        "MaleCNS does not annotate sweet vs bitter identity for these GRNs (the only receptor "
        "annotations present are ppk23/ppk25/IR52b, which are pheromone-related). NEUROPULSE "
        "therefore stimulates labellar taste input generically and does NOT claim a sugar-"
        "specific channel."
    ),
    phrases=[
        "tastes something", "tasting sugar", "it lands on something sweet", "licks a surface",
        "tastes the food", "puts its proboscis on sugar", "a sweet surface", "tastes something bitter",
    ],
)

TASTE_TARSAL = StimulusConcept(
    key="gustatory_tarsal",
    modality="gustation",
    label="Taste through the legs",
    description="Tarsal contact chemosensation — a fly tastes with its feet on landing.",
    population=PopulationQuery(
        neuron_class=["gustatory"],
        entry_nerve=["ProLN", "MesoLN", "MetaLN"],
        lateralised=True,
        max_neurons=130,
    ),
    mapping_quality="APPROXIMATE_MAPPING",
    evidence=(
        "Gustatory receptor neurons entering via the leg nerves (ProLN/MesoLN/MetaLN) are "
        "annotated in MaleCNS; tarsal GRNs are the first taste contact when a fly lands on a "
        "substrate (Stocker 1994; Thoma et al. 2016). Valence is not annotated."
    ),
    caveat="Tastant identity (sugar vs bitter) is not annotated in this dataset.",
    phrases=[
        "lands on food", "its feet touch something sugary", "steps onto a sweet surface",
        "tastes with its legs", "lands on a piece of fruit",
    ],
)

# ---------------------------------------------------------------------------
# MECHANOSENSATION / AUDITION / AIRFLOW
# ---------------------------------------------------------------------------

ANTENNAL_TOUCH = StimulusConcept(
    key="mechano_antennal",
    modality="mechanosensation",
    label="Antennal mechanical contact",
    description="Something physically touching or deflecting the antenna.",
    population=PopulationQuery(
        type_regex="^(BM|JO-FV|JO-FD.*)$",
        neuron_class=["mechanosensory", "mechanosensory_tactile"],
        entry_nerve=["AN"],
        exclude_subclass=["auditory", "wind_gravity"],
        lateralised=True,
        max_neurons=130,
    ),
    mapping_quality="SUPPORTED_REAL_MAPPING",
    evidence=(
        "MaleCNS annotates bristle mechanosensory neurons (type 'BM') entering through the "
        "antennal nerve, plus the JO-F subgroups associated with antennal deflection and "
        "grooming. The auditory (JO-A/B) and wind_gravity (JO-C/E) subclasses are explicitly "
        "excluded here so that 'touch' does not silently recruit the sound and airflow channels."
    ),
    phrases=[
        "something touches its antenna", "its antenna is brushed", "contact on the antenna",
        "a touch to the left antenna", "its feeler is bumped",
    ],
)

BODY_TOUCH = StimulusConcept(
    key="mechano_body",
    modality="mechanosensation",
    label="Body / leg touch",
    description="Bristle deflection on the body, legs or wings.",
    population=PopulationQuery(
        neuron_class=["mechanosensory_tactile"],
        subclass=["mechanosensory bristle", "leg bristle", "wing bristle", "notum"],
        lateralised=True,
        max_neurons=140,
    ),
    mapping_quality="SUPPORTED_REAL_MAPPING",
    evidence=(
        "MaleCNS annotates tactile bristle mechanosensory neurons by body location "
        "(leg / wing / notum bristles) under class 'mechanosensory_tactile'."
    ),
    phrases=[
        "something touches its body", "a leg is touched", "brushed on the back",
        "contact on its abdomen", "something lands on it", "its leg brushes a surface",
    ],
)

VIBRATION_SOUND = StimulusConcept(
    key="mechano_auditory",
    modality="audition",
    label="Vibration / sound",
    description="Near-field sound and substrate vibration, transduced by Johnston's organ.",
    population=PopulationQuery(
        type_regex="^JO-(A|B).*",
        subclass=["auditory"],
        lateralised=True,
        max_neurons=120,
    ),
    mapping_quality="SUPPORTED_REAL_MAPPING",
    evidence=(
        "JO-A and JO-B are Johnston's-organ neuron subgroups annotated with subclass 'auditory' "
        "in MaleCNS. They are the fly's sound/vibration receptors, responding to antennal "
        "oscillation including courtship song (Kamikouchi et al. 2009; Yorozu et al. 2009)."
    ),
    phrases=[
        "a vibration underneath it", "a buzzing sound", "the surface shakes",
        "it hears a tone", "courtship song", "a low rumble", "trembling ground", "a loud noise",
    ],
)

WIND_GRAVITY = StimulusConcept(
    key="mechano_wind",
    modality="airflow",
    label="Airflow / gravity",
    description="Sustained antennal deflection from wind, and gravitational orientation.",
    population=PopulationQuery(
        subclass=["wind_gravity"],
        lateralised=True,
        max_neurons=110,
    ),
    mapping_quality="SUPPORTED_REAL_MAPPING",
    evidence=(
        "MaleCNS annotates a 'wind_gravity' mechanosensory subclass — the JO-C/E-type Johnston's "
        "organ neurons that encode static antennal displacement from airflow and gravity "
        "(Kamikouchi et al. 2009; Yorozu et al. 2009; Suver et al. 2019)."
    ),
    phrases=[
        "a gust of wind", "air blowing over it", "a breeze", "wind from the side",
        "an air current", "it is upside down", "a draft",
    ],
)

# ---------------------------------------------------------------------------
# THERMO / HYGRO
# ---------------------------------------------------------------------------

TEMPERATURE = StimulusConcept(
    key="thermo_change",
    modality="thermosensation",
    label="Temperature change",
    description="A shift in ambient temperature detected by antennal thermoreceptors.",
    population=PopulationQuery(
        neuron_class=["thermosensory"],
        cell_types=["TRN_VP1m", "TRN_VP2", "TRN_VP3a", "TRN_VP3b"],
        lateralised=True,
        max_neurons=40,
    ),
    mapping_quality="APPROXIMATE_MAPPING",
    evidence=(
        "MaleCNS annotates class 'thermosensory' antennal receptor neurons by target glomerulus "
        "(VP1m, VP2, VP3). Hot- and cold-activated TRNs target distinct glomeruli — VP2 receives "
        "warm-activated and VP3 cool-activated input (Frank et al. 2015; Gallio et al. 2011)."
    ),
    caveat=(
        "The dataset labels the glomerulus, not the thermal sign of each individual neuron, so "
        "NEUROPULSE stimulates the thermosensory channel as a whole. Warm vs cold is reported as "
        "recognised context rather than injected as distinct populations."
    ),
    phrases=[
        "it gets colder", "the temperature rises", "a warm surface", "sudden cold",
        "heat", "a chill in the air", "the environment becomes hot",
    ],
)

HUMIDITY = StimulusConcept(
    key="hygro_change",
    modality="hygrosensation",
    label="Humidity change",
    description="A shift in ambient humidity detected by antennal hygroreceptors.",
    population=PopulationQuery(
        neuron_class=["hygrosensory"],
        cell_types=["HRN_VP4", "HRN_VP1d", "HRN_VP5"],
        lateralised=True,
        max_neurons=60,
    ),
    mapping_quality="SUPPORTED_REAL_MAPPING",
    evidence=(
        "MaleCNS annotates class 'hygrosensory' receptor neurons targeting VP4/VP1d/VP5, the "
        "glomeruli of the moist- and dry-sensing hygroreceptor channels (Enjin et al. 2016; "
        "Knecht et al. 2016)."
    ),
    phrases=["it becomes humid", "the air is dry", "damp air", "moisture", "dry conditions"],
)

# ---------------------------------------------------------------------------
# INTERNAL STATE — recognised, deliberately NOT injected
# ---------------------------------------------------------------------------

HUNGER = StimulusConcept(
    key="state_hunger",
    modality="internal_state",
    label="Hunger",
    description="Metabolic need state that modulates sensory gain in the real animal.",
    population=PopulationQuery(max_neurons=0, lateralised=False),
    mapping_quality="UNSUPPORTED",
    evidence=(
        "Hunger in Drosophila is carried by neuromodulatory and neuroendocrine populations "
        "(e.g. NPF, AKH, DH44, insulin-producing cells) whose functional identity is NOT "
        "annotated in MaleCNS v1.0. There is no defensible way to select 'the hunger neurons' "
        "from this dataset's annotations."
    ),
    caveat=(
        "Recognised as context. NOT injected into the simulation: a state-dependent gain change "
        "would require physiology this connectome does not contain."
    ),
    phrases=[
        "a hungry fly", "starved", "it hasn't eaten", "food-deprived", "it is hungry",
        "satiated", "well fed",
    ],
)

AROUSAL = StimulusConcept(
    key="state_arousal",
    modality="internal_state",
    label="Arousal / alertness",
    description="Global behavioural state.",
    population=PopulationQuery(max_neurons=0, lateralised=False),
    mapping_quality="UNSUPPORTED",
    evidence=(
        "Arousal is mediated by broadly projecting neuromodulatory systems not functionally "
        "annotated in MaleCNS v1.0."
    ),
    caveat="Recognised as context. Not injected into the simulation.",
    phrases=["an alert fly", "a sleepy fly", "it is agitated", "calm", "restless", "asleep"],
)


ONTOLOGY: list[StimulusConcept] = [
    LOOMING,
    VISUAL_MOTION,
    BRIGHTNESS,
    FRUIT_ODOUR,
    AVERSIVE_ODOUR,
    PHEROMONE,
    TASTE_LABELLAR,
    TASTE_TARSAL,
    ANTENNAL_TOUCH,
    BODY_TOUCH,
    VIBRATION_SOUND,
    WIND_GRAVITY,
    TEMPERATURE,
    HUMIDITY,
    HUNGER,
    AROUSAL,
]

BY_KEY: dict[str, StimulusConcept] = {c.key: c for c in ONTOLOGY}

#: Concepts that actually drive neurons.
STIMULATABLE: list[StimulusConcept] = [
    c for c in ONTOLOGY if c.mapping_quality != "UNSUPPORTED" and c.population.max_neurons > 0
]

#: Display colour per modality — restrained, one hue per sensory stream.
MODALITY_COLOUR: dict[str, str] = {
    "vision": "#7fb2ff",
    "olfaction": "#7df0c8",
    "gustation": "#ff9ecb",
    "mechanosensation": "#ffc98a",
    "audition": "#c9a6ff",
    "airflow": "#9fe8ff",
    "thermosensation": "#ff8f6b",
    "hygrosensation": "#8fd5ff",
    "internal_state": "#8b909c",
}
