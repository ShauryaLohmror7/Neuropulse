# Anatomical branch rendering

The overview now uses screen-space ribbons along the existing measured skeleton segments, giving branches a stable visible width. Their paths and endpoints are unchanged. Ribbon widths and spherical soma sprites are illustrative styling, not source surface meshes or measured radii. Depth attenuation and identity colors make overlapping arbors easier to distinguish.

**Branch focus** is the default: it shows measured somata belonging to overview skeleton neurons plus all somata carrying model activity. **All somata** restores all available measured soma positions. Neither mode changes the full simulation graph, invents missing soma positions, or loads full morphology for every graph neuron. Source geometry in this overview still uses the existing level of detail; unpruned full neuron inspection remains separate.

The additional context skeletons now have a model-activity overlay, driven by actual activation histories and real body IDs. Neurons already in the main circuit are excluded from the extra overlay to avoid duplicate activity. Static anatomical colors distinguish neuron identities/classes; they do not assert sex-specific annotations. Moving colors represent model events, with illustrative travel along source cable paths. Settled summaries remain static, and reduced-motion settings remain respected.

The reference screenshot's blue/orange caption identifies male-specific and sexually dimorphic cells. That coloring is anatomical classification, not evidence of electrical firing. The app's current palette does not claim to reproduce that particular classification.
