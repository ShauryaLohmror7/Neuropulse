import type { CircuitNode } from '../types/circuit'
import type { SimulationEnvelope } from '../types/api'

interface Explanation { title:string; text:string; source?:string; basis:string; role:string; coverage: 'type' | 'group' | 'annotation' | 'anatomy' }
const LOOM='https://www.janelia.org/publication/neural-basis-for-looming-size-and-velocity-encoding-in-the-drosophila-giant-fiber-escape'
const MOTION='https://www.janelia.org/publication/the-computation-of-directional-selectivity-in-the-off-motion-pathway'
const profiles:Record<string,{title:string;text:string;source:string}>={
  DNg11:{title:'A link to front-leg rubbing',text:'Experiments associate this descending type with rubbing the front legs together during grooming. This is a specific movement component, not proof that the fly cleans its whole body.',source:'https://doi.org/10.1016/j.cub.2021.12.055'},
  DNg13:{title:'Adjusting leg strides during a turn',text:'Experiments link this descending type to lengthening strides on the opposite side of the body during walking turns. The effect depends on locomotor timing; this app does not calculate the resulting turn direction.',source:'https://doi.org/10.1016/j.cell.2024.08.033'},
  DNg97:{title:'A walking-promotion neuron',text:'This type, also called oDN1, is associated with promoting forward walking. Its modeled activation is a pathway hypothesis; it does not establish a complete walking movement.',source:'https://reiserlab.github.io/celltype-explorer-drosophila-male-cns/types/DNg97.html'},
  DNg100:{title:'Part of a walking-promotion pathway',text:'Published circuit work associates this type with walking promotion. Movement also depends on nerve-cord dynamics and the body, which this visualization does not reproduce.',source:'https://www.nature.com/articles/s41586-026-10735-w'},
  MN9:{title:'Lifting the base of the proboscis',text:'This motor-neuron type controls rostrum lifting, one component of extending the fly’s mouthparts. It is used as a feeding-initiation readout in published modeling work. Activation does not establish ingestion or nutrient uptake.',source:'https://www.nature.com/articles/s41586-024-07763-9'},

  'R1-R6': {title:'A light sensor in the eye',text:'This cell belongs to the outer photoreceptors: cells that turn incoming light into signals for the visual system. They help supply information used to see contrast and motion. Our light-change simulation does not reproduce their different electrical responses to light turning on versus off.',source:'https://pmc.ncbi.nlm.nih.gov/articles/PMC6528803/'},
  LC4: {title:'Information about an approaching object',text:'This visual neuron belongs to a population that helps report how quickly an approaching image expands. LC4 cells send information to escape-related circuits, including the giant fiber. A single LC4 cell does not decide on its own whether the fly escapes.',source:LOOM},
  LPLC2: {title:'A warning about an expanding object',text:'This visual neuron belongs to a population that responds to expanding images, such as an approaching object. These cells supply information about image size to the giant-fiber escape pathway. That association does not mean every activation causes an escape.',source:LOOM},
  DNp01: {title:'Part of the rapid escape circuit',text:'This type is known as the giant fiber. Its activity helps coordinate a rapid escape takeoff. Whether that action happens depends on timing and the rest of the nervous system; the glow here only shows our model’s calculation.',source:'https://www.nature.com/articles/nn.3741'},
  DNp09: {title:'A link to defensive stopping',text:'Experiments link this descending neuron type to freezing behavior. It helps connect brain processing with movement circuits. Its effect depends on the fly’s state, so a highlighted cell is not proof that the fly would freeze.',source:'https://www.nature.com/articles/s41467-018-05875-1'},
}

const classProfiles:Record<string,{title:string;text:string;source?:string}>={
 Kenyon_Cell:{title:'Representing experiences in a learning circuit',text:'Kenyon cells form the main intrinsic network of the mushroom body. They encode combinations of sensory information that can become associated with reward or punishment. This app propagates activity through their wiring; it does not implement the synaptic changes that create learned associations.'},
 MBON:{title:'Carrying output from a learning circuit',text:'Mushroom-body output neurons carry signals from circuits involved in learned associations toward other brain networks. Different types influence different responses. A highlight here shows modeled activity, not evidence that a memory was formed or recalled.'},
 DAN:{title:'Modulating other neural circuits with dopamine',text:'This cell is annotated as a dopaminergic neuron. Dopamine can change how target circuits process information; some dopaminergic pathways provide reinforcement signals for learning. Its annotation alone does not identify reward, punishment or an emotional state.'},
 CX:{title:'Part of the orientation and navigation network',text:'The central complex combines information used for orientation and navigation. This cell participates in that network. Its individual contribution may concern direction, movement or other processing; this simulation does not decode a heading from its activity.'},
 ALPN:{title:'Relaying signals from the antennal lobe',text:'This projection neuron carries information from the antennal lobe to other brain regions. Many such pathways carry processed odor information toward circuits for recognition and learning. Its label alone does not identify a preferred odor or an action.'},
 ALLN:{title:'Processing signals within the antennal lobe',text:'This local neuron exchanges signals within the antennal lobe, an early sensory-processing centre. Local circuits help shape how incoming information is represented before it is relayed onward.'},
 ALIN:{title:'Bringing input into the antennal lobe',text:'This neuron is annotated as an antennal-lobe input neuron. Its anatomical role is to bring signals into this sensory-processing network; that does not by itself specify the information carried.'},
 ALON:{title:'Carrying output from the antennal lobe',text:'This cell is annotated as an antennal-lobe output neuron. It connects this early sensory-processing network with other circuitry. The annotation describes the route, not a particular behavior.'},
 SEZPN:{title:'Relaying signals from a feeding-related brain region',text:'This projection neuron connects the subesophageal zone with other brain circuitry. That region includes taste and head-movement circuits. Membership alone does not mean this particular neuron triggers feeding.'},
 ol_bilateral:{title:'Linking visual circuitry across both sides',text:'This neuron is annotated as bilateral in the optic-lobe system. Its anatomy links circuitry across the two sides of the visual network; its precise visual selectivity requires type-level evidence.'},
 chemosensory:{title:'Sensing chemical information',text:'This cell belongs to the chemical-sensory class. It carries information about chemicals encountered by the fly. This broad annotation does not distinguish smell from taste or identify a preferred substance.'},
 unknown_sensory:{title:'Carrying sensory information into the nervous system',text:'The dataset identifies this cell as sensory. It carries information into neural circuits from a sensory structure. The record does not specify which stimulus it detects, so the run explanation below describes its actual modeled participation.'},
 mechanosensory_proprioceptive:{title:'Reporting body position and movement',text:'This neuron is annotated as proprioceptive: it provides feedback about the body’s position or movement. Such information helps sensorimotor circuits coordinate movement. Its class alone does not identify a particular joint or posture.'},
 mechanosensory_tbc:{title:'A candidate sensor for physical movement',text:'The source tentatively classifies this neuron as mechanosensory, associated with physical displacement or vibration. That classification is provisional; its source anatomy and modeled activity can still be inspected.'},

 mechanosensory:{title:'A sensor for physical movement',text:'This neuron carries information about mechanical movement, such as vibration or displacement of a sensory structure. Its class identifies the kind of information it carries; the exact stimulus and resulting movement depend on its type and connections.'},
 gustatory:{title:'A taste-sensing neuron',text:'The dataset classifies this neuron as gustatory: part of the sensory system that carries information about substances touching the fly’s taste organs. Its broad job is taste sensing. This record does not identify whether it prefers sugar, bitter substances or another tastant.'},
 olfactory:{title:'An odor-sensing neuron',text:'The dataset places this cell in the olfactory class. It carries chemical-sensory information used by the smell system. That broad role is known even when its exact cell type or preferred odor is not assigned.'},
 mechanosensory_tactile:{title:'A touch-sensing neuron',text:'This cell is annotated as tactile mechanosensory. It carries information about physical contact or movement of a sensory structure. Its exact body location or behavioral effect should only be inferred from additional source annotations.'},
 thermosensory:{title:'A temperature-sensing neuron',text:'This neuron belongs to the temperature-sensing class. Its annotation establishes a broad thermal sensory role; it does not by itself establish whether this particular cell responds to warming or cooling.'},
 hygrosensory:{title:'A humidity-sensing neuron',text:'This neuron belongs to the humidity-sensing class. It helps carry information about moisture in the environment. The class alone does not identify its specific moist-versus-dry preference.'},
 visual:{title:'A neuron in the visual system',text:'The dataset assigns this cell to the visual class. It participates in processing information from the eyes. A more specific preference—such as motion direction or contrast—requires a named type or functional evidence.'},
}
const groupProfiles:Record<string,{title:string;text:string}>={
 visual_projection:{title:'Sending visual information toward the central brain',text:'This neuron links visual-processing circuitry with the central brain. It carries information that other networks can use to guide behavior. A particular visual feature or movement cannot be assigned from this broad anatomical group alone.'},
 visual_centrifugal:{title:'Sending feedback toward the visual system',text:'This neuron projects toward the optic lobe from more central circuitry. Its anatomical direction provides a route for feedback into visual processing; the signal it carries depends on its specific type.'},
 ol_sensory:{title:'Bringing sensory input into the visual system',text:'This cell belongs to the optic-lobe sensory group. It supplies input to the visual-processing network. Its annotation describes its position in that pathway; exact light sensitivity depends on the cell type.'},
 cb_sensory:{title:'Bringing sensory information into the brain',text:'This sensory neuron supplies input to the central brain. The dataset identifies its place at the sensory entry stage. The highlighted-run explanation shows which input mapping selected it or how activity reached it.'},
 vnc_sensory:{title:'Bringing body sensations into the nerve cord',text:'This sensory cell supplies input to the ventral nerve cord, where many body sensorimotor circuits reside. Its anatomical group identifies where information enters; the class annotation, when available, identifies the kind of sensation.'},
 vnc_motor:{title:'Carrying motor output toward a muscle',text:'This motor neuron belongs to the ventral nerve cord. Motor neurons carry neural output toward muscles. The muscle, contraction pattern and resulting movement need more specific evidence than membership in this group.'},
 cb_motor:{title:'Carrying motor output from brain circuitry',text:'This cell is annotated as a brain motor neuron. It connects neural processing toward a muscle target. Its activity is a motor signal in the model, but the app does not simulate muscle contraction.'},
 sensory_ascending:{title:'Carrying sensory signals along an ascending route',text:'This sensory neuron has an ascending projection, carrying information toward more anterior neural circuitry. Its anatomical route is established by its annotation; its sensory preference depends on more specific classification.'},
 sensory_descending:{title:'Carrying sensory signals along a descending route',text:'This sensory neuron has a descending projection toward more posterior circuitry. It provides a route for sensory information to reach those circuits, rather than being an action decision by itself.'},
 efferent_ascending:{title:'Carrying output along an ascending route',text:'This neuron is annotated as efferent with an ascending projection. Its group describes an outward signaling route; it does not establish a particular muscle movement or internal-body response.'},
 efferent_descending:{title:'Carrying output along a descending route',text:'This neuron is annotated as efferent with a descending projection. Its group describes an output route toward more posterior structures; a specific behavioral effect needs information about its targets.'},
 vnc_efferent:{title:'Carrying output from the nerve cord',text:'This efferent neuron sends signals outward from ventral-nerve-cord circuitry. Efferent output can serve body functions beyond skeletal movement. Its exact target is not specified by this group.'},
 cb_efferent:{title:'Carrying output from the brain',text:'This efferent neuron sends signals outward from brain circuitry. The annotation establishes its output role without identifying a specific muscle or internal-body response.'},
 cb_endocrine:{title:'Linking brain activity with hormonal signaling',text:'This cell belongs to the brain’s endocrine group, associated with signaling through hormones. Hormonal effects can influence body state over time. This simulation does not model hormone release or its physiological effects.'},
 vnc_endocrine:{title:'Linking nerve-cord activity with hormonal signaling',text:'This cell belongs to the nerve cord’s endocrine group. Its role involves hormonal signaling rather than a simple movement command. Hormone release and its effects are outside this activity model.'},
 ENS:{title:'Part of the internal-organ nervous system',text:'The dataset places this cell in the enteric nervous system, which serves internal-organ functions. This anatomical assignment is useful context; it does not specify a particular digestive action in this simulation.'},
 vnc_tbc:{title:'A provisionally classified nerve-cord neuron',text:'The source places this cell in the ventral nerve cord, with its more specific category awaiting confirmation. You can inspect its measured structure and follow the recorded model activity through its connections.'},

 ol_intrinsic:{title:'A neuron within the optic lobe',text:'The official annotation places this neuron within the optic lobe, the fly’s visual-processing network. Its wiring is available to inspect; the broad group does not specify the visual feature this individual detects.'},
 cb_intrinsic:{title:'A neuron within the central brain',text:'This cell is annotated as intrinsic to the central brain. It exchanges signals within that network. The annotation establishes its anatomical group, while its specific computational or behavioral role remains unassigned here.'},
 vnc_intrinsic:{title:'A neuron within the ventral nerve cord',text:'This cell is annotated as intrinsic to the ventral nerve cord, the neural structure serving the body’s sensorimotor circuits. The annotation does not establish the particular movement this neuron influences.'},
 descending_neuron:{title:'A descending neuron',text:'This neuron belongs to the descending class, which links brain processing with circuits toward the body. Different descending types support different actions. Its group alone is not enough to name an action for this cell.'},
 ascending_neuron:{title:'An ascending neuron',text:'This neuron belongs to the ascending class, carrying signals toward the brain from other parts of the nervous system. Its individual signal content needs more specific functional evidence.'},
}
const classSources:Record<string,string>={
 Kenyon_Cell:'https://pmc.ncbi.nlm.nih.gov/articles/PMC4273437/',
 MBON:'https://pmc.ncbi.nlm.nih.gov/articles/PMC4273437/',
 DAN:'https://pmc.ncbi.nlm.nih.gov/articles/PMC4273437/',
 ALLN:'https://www.nature.com/articles/nn.2489',
 ALPN:'https://www.nature.com/articles/s41467-024-48839-4',
 CX:'https://www.janelia.org/publication/feature-detection-and-orientation-tuning-drosophila-central-complex',
}
export function neuronDisplayName(node:CircuitNode):string {
 return node.type ?? classProfiles[node.class??'']?.title.replace(/^A[n]? /,'') ?? groupProfiles[node.superclass??'']?.title.replace(/^A[n]? /,'') ?? 'Neuron · type unassigned'
}

/** Curated type-level explanations; never manufacture a function from a body ID. */
export function explainNeuron(node:CircuitNode, sim:SimulationEnvelope|null):Explanation {
  let profile=node.type ? profiles[node.type] : undefined
  const joGroup=node.type?.match(/^JO-([ABCDE])(?:\d|[VD]|-unclear)/)?.[1]
  if (joGroup) {
    const auditory=['A','B'].includes(joGroup)
    profile={
      title:auditory ? 'Sensing vibrations with the antenna' : 'Sensing movement of the antenna',
      text:auditory
        ? `${node.type} belongs to the Johnston’s organ ${joGroup} group, a sensory group in the antenna involved in hearing. These neurons report tiny antennal vibrations to the brain. The evidence describes the group; it does not establish this individual cell’s preferred frequency or mean that its activation causes courtship.`
        : `${node.type} belongs to Johnston’s organ group ${joGroup} in the antenna. ${joGroup==='D' ? 'Experiments show that group D responds to both vibrations and sustained antennal displacement.' : 'Groups C and E report sustained antennal displacement associated with wind and gravity sensing.'} This is a group-level role, not a prediction of a particular movement.`,
      source:'https://pmc.ncbi.nlm.nih.gov/articles/PMC4023023/',
    }
  }
  if(node.type && ['DNg62','DNge011','DNge012','DNge078'].includes(node.type)) {
    profile={title:'A link to antenna-cleaning movements',text:'Published work associates this descending neuron type with antennal grooming: movements used to clean the antennae. Descending neurons carry signals toward movement circuits in the nerve cord. This cell’s glow shows the modeled response; it does not prove that a complete grooming movement occurred.',source:'https://www.nature.com/articles/s41586-026-10735-w'}
  }
  if(node.type && /^T[45][a-d]$/.test(node.type)) {
    const on=node.type.startsWith('T4')
    profile={title:'A detector of visual motion',text:`This neuron belongs to the ${on ? 'T4' : 'T5'} family, which helps detect the direction of moving ${on ? 'bright' : 'dark'} features. Different subtypes prefer different directions. The current simulation uses a broad motion input, rather than reproducing each cell’s visual receptive field.`,source:MOTION}
  }
  const tentative=node.superclass?.endsWith('_tbc') ?? false
  const broad=classProfiles[node.class??'']??groupProfiles[node.superclass??'']??groupProfiles[node.superclass?.replace(/_tbc$/, '')??'']
  const input=sim?.experience.components.find(c=>c.body_ids.includes(node.bodyId))
  const activation=sim?.result.activations.find(a=>a.body_id===node.bodyId)
  const incoming=sim?.result.pulses?.filter(p=>p.target===node.bodyId && p.sign>0 && p.step<=(activation?.step??-1)).sort((a,b)=>b.amplitude-a.amplitude)[0]
  const arrival=incoming ? ` One recorded incoming signal came from neuron ${incoming.source} at step ${incoming.step}.` : ''
  const role=input ? `In this run, “${input.label}” selected this real cell as an input. This is a curated population mapping, not a recording of this individual cell.` : activation?.carried ? 'This cell entered this event with activity retained from the preceding event. It was not selected as a new sensory input. This is continuing model activity, not learned memory.' : activation ? `In this run, this cell was reached at model step ${activation.step} through the full connectome’s wiring.${arrival} Its highlight shows calculated activity, not an observed response.` : 'You are inspecting its anatomy. This selection does not mean the cell was activated by an experience.'
  return {
    coverage:joGroup ? 'group' : profile ? 'type' : broad ? 'annotation' : 'anatomy',
    title:profile?.title ?? broad?.title ?? 'An anatomically identified neuron',
    text:profile?.text ?? (broad ? `${broad.text}${tentative ? ' The source marks this anatomical classification as provisional.' : ''}` : `This is a source-reconstructed cell${node.type ? ` labeled ${node.type}` : ''}. ${node.pre != null && node.post != null ? `Its annotation records ${node.pre.toLocaleString()} presynaptic sites (sending side) and ${node.post.toLocaleString()} postsynaptic sites (receiving side).` : 'Its reconstructed branches show where the cell extends through the nervous system.'} These anatomical facts describe its structure; they do not identify a specific sensation or movement.`),
    source:profile?.source ?? classSources[node.class??''] ?? (broad ? 'https://male-cns.janelia.org/download/' : undefined),
    basis:joGroup ? 'Research describes the Johnston’s organ subgroup; individual tuning and behavior are not inferred.' : profile ? 'Research describes this cell type; this individual is identified by its dataset annotation.' : broad ? 'Broad role from the official class/superclass annotation; exact selectivity is not inferred.' : 'Source anatomy only; no functional assignment inferred',
    role,
  }
}
