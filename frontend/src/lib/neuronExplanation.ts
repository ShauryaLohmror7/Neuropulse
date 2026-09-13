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

/** Curated type-level explanations; never manufacture a function from a body ID. */
export function explainNeuron(node:CircuitNode, sim:SimulationEnvelope|null):Explanation {
  let profile=node.type ? profiles[node.type] : undefined
  if(node.type && /^T[45][a-d]$/.test(node.type)) {
    const on=node.type.startsWith('T4')
    profile={title:'A detector of visual motion',text:`This neuron belongs to the ${on ? 'T4' : 'T5'} family, which helps detect the direction of moving ${on ? 'bright' : 'dark'} features. Different subtypes prefer different directions. The current simulation uses a broad motion input, rather than reproducing each cell’s visual receptive field.`,source:MOTION}
  }
  const input=sim?.experience.components.find(c=>c.body_ids.includes(node.bodyId))
  const activation=sim?.result.activations.find(a=>a.body_id===node.bodyId)
  const role=input ? `In this run, “${input.label}” selected this real cell as an input. This is a curated population mapping, not a recording of this individual cell.` : activation ? `In this run, this cell was reached at model step ${activation.step} through the extracted wiring. Its highlight shows calculated activity, not an observed response.` : 'You are inspecting its anatomy. This selection does not mean the cell was activated by an experience.'
  return {
    title:profile?.title ?? 'A real cell, with an unresolved specific job',
    text:profile?.text ?? `The dataset identifies this cell as ${node.type ?? 'an unassigned cell type'}${node.class ? `, in the ${node.class.replaceAll('_',' ')} class` : ''}. We do not have a verified plain-language account of this type’s specific function in this app. Its shape and connections are available to explore, but those alone do not establish what behavior it controls.`,
    source:profile?.source,
    basis:profile ? 'Research describes this cell type; this individual is identified by its dataset annotation.' : 'Dataset annotation only · specific function not established here',
    role,
  }
}
