import type { CircuitNode } from '../types/circuit'
import type { SimulationEnvelope } from '../types/api'

interface Explanation { title:string; text:string; source?:string; basis:string; role:string }
const LOOM='https://www.janelia.org/publication/neural-basis-for-looming-size-and-velocity-encoding-in-the-drosophila-giant-fiber-escape'
const MOTION='https://www.janelia.org/publication/the-computation-of-directional-selectivity-in-the-off-motion-pathway'
const profiles:Record<string,{title:string;text:string;source:string}>={
  'R1-R6': {title:'A light sensor in the eye',text:'This cell belongs to the outer photoreceptors: cells that turn incoming light into signals for the visual system. They help supply information used to see contrast and motion. Our light-change simulation does not reproduce their different electrical responses to light turning on versus off.',source:'https://pmc.ncbi.nlm.nih.gov/articles/PMC6528803/'},
  LC4: {title:'Information about an approaching object',text:'This visual neuron belongs to a population that helps report how quickly an approaching image expands. LC4 cells send information to escape-related circuits, including the giant fiber. A single LC4 cell does not decide on its own whether the fly escapes.',source:LOOM},
  LPLC2: {title:'A warning about an expanding object',text:'This visual neuron belongs to a population that responds to expanding images, such as an approaching object. These cells supply information about image size to the giant-fiber escape pathway. That association does not mean every activation causes an escape.',source:LOOM},
  DNp01: {title:'Part of the rapid escape circuit',text:'This type is known as the giant fiber. Its activity helps coordinate a rapid escape takeoff. Whether that action happens depends on timing and the rest of the nervous system; the glow here only shows our model’s calculation.',source:'https://www.nature.com/articles/nn.3741'},
  DNp09: {title:'A link to defensive stopping',text:'Experiments link this descending neuron type to freezing behavior. It helps connect brain processing with movement circuits. Its effect depends on the fly’s state, so a highlighted cell is not proof that the fly would freeze.',source:'https://www.nature.com/articles/s41467-018-05875-1'},
}

const classProfiles:Record<string,{title:string;text:string}>={
 gustatory:{title:'A taste-sensing neuron',text:'The dataset classifies this neuron as gustatory: part of the sensory system that carries information about substances touching the fly’s taste organs. Its broad job is taste sensing. This record does not identify whether it prefers sugar, bitter substances or another tastant.'},
 olfactory:{title:'An odor-sensing neuron',text:'The dataset places this cell in the olfactory class. It carries chemical-sensory information used by the smell system. That broad role is known even when its exact cell type or preferred odor is not assigned.'},
 mechanosensory_tactile:{title:'A touch-sensing neuron',text:'This cell is annotated as tactile mechanosensory. It carries information about physical contact or movement of a sensory structure. Its exact body location or behavioral effect should only be inferred from additional source annotations.'},
 thermosensory:{title:'A temperature-sensing neuron',text:'This neuron belongs to the temperature-sensing class. Its annotation establishes a broad thermal sensory role; it does not by itself establish whether this particular cell responds to warming or cooling.'},
 hygrosensory:{title:'A humidity-sensing neuron',text:'This neuron belongs to the humidity-sensing class. It helps carry information about moisture in the environment. The class alone does not identify its specific moist-versus-dry preference.'},
 visual:{title:'A neuron in the visual system',text:'The dataset assigns this cell to the visual class. It participates in processing information from the eyes. A more specific preference—such as motion direction or contrast—requires a named type or functional evidence.'},
}
const groupProfiles:Record<string,{title:string;text:string}>={
 ol_intrinsic:{title:'A neuron within the optic lobe',text:'The official annotation places this neuron within the optic lobe, the fly’s visual-processing network. Its wiring is available to inspect; the broad group does not specify the visual feature this individual detects.'},
 cb_intrinsic:{title:'A neuron within the central brain',text:'This cell is annotated as intrinsic to the central brain. It exchanges signals within that network. The annotation establishes its anatomical group, while its specific computational or behavioral role remains unassigned here.'},
 vnc_intrinsic:{title:'A neuron within the ventral nerve cord',text:'This cell is annotated as intrinsic to the ventral nerve cord, the neural structure serving the body’s sensorimotor circuits. The annotation does not establish the particular movement this neuron influences.'},
 descending_neuron:{title:'A descending neuron',text:'This neuron belongs to the descending class, which links brain processing with circuits toward the body. Different descending types support different actions. Its group alone is not enough to name an action for this cell.'},
 ascending_neuron:{title:'An ascending neuron',text:'This neuron belongs to the ascending class, carrying signals toward the brain from other parts of the nervous system. Its individual signal content needs more specific functional evidence.'},
}
export function neuronDisplayName(node:CircuitNode):string {
 return node.type ?? classProfiles[node.class??'']?.title.replace(/^A[n]? /,'') ?? groupProfiles[node.superclass??'']?.title.replace(/^A[n]? /,'') ?? 'Neuron · type unassigned'
}

/** Curated type-level explanations; never manufacture a function from a body ID. */
export function explainNeuron(node:CircuitNode, sim:SimulationEnvelope|null):Explanation {
  let profile=node.type ? profiles[node.type] : undefined
  if(node.type && /^T[45][a-d]$/.test(node.type)) {
    const on=node.type.startsWith('T4')
    profile={title:'A detector of visual motion',text:`This neuron belongs to the ${on ? 'T4' : 'T5'} family, which helps detect the direction of moving ${on ? 'bright' : 'dark'} features. Different subtypes prefer different directions. The current simulation uses a broad motion input, rather than reproducing each cell’s visual receptive field.`,source:MOTION}
  }
  const broad=classProfiles[node.class??'']??groupProfiles[node.superclass??'']
  const input=sim?.experience.components.find(c=>c.body_ids.includes(node.bodyId))
  const activation=sim?.result.activations.find(a=>a.body_id===node.bodyId)
  const role=input ? `In this run, “${input.label}” selected this real cell as an input. This is a curated population mapping, not a recording of this individual cell.` : activation ? `In this run, this cell was reached at model step ${activation.step} through the full connectome’s wiring. Its highlight shows calculated activity, not an observed response.` : 'You are inspecting its anatomy. This selection does not mean the cell was activated by an experience.'
  return {
    title:profile?.title ?? broad?.title ?? 'An anatomically identified neuron',
    text:profile?.text ?? broad?.text ?? `The dataset identifies this cell as ${node.type ?? 'an unassigned cell type'}${node.class ? `, in the ${node.class.replaceAll('_',' ')} class` : ''}. Its type-specific function is not established in this app. You can still inspect its real connections and see exactly how this run reached it.`,
    source:profile?.source ?? (broad ? 'https://male-cns.janelia.org/download/' : undefined),
    basis:profile ? 'Research describes this cell type; this individual is identified by its dataset annotation.' : broad ? 'Broad role from the official class/superclass annotation; exact selectivity is not inferred.' : 'Dataset annotation · type-specific function unassigned',
    role,
  }
}
