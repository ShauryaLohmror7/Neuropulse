# 21st.dev visual pass

Selected by browsing 21st.dev on September 13, 2026.

- [Neuro Noise · Sensation by Paper Shaders](https://21st.dev/community/shaders/neuro-noise-sensation-daf72911-8bd3-441e-b749-5486758942ef). The 21st.dev export is membership-gated. This project uses the author's public `@paper-design/shaders-react` package, pinned to 0.0.80, rather than that export. [Original documentation](https://shaders.paper.design/neuro-noise), [source repository](https://github.com/paper-design/shaders). Apache-2.0 LICENSE and NOTICE are preserved in `frontend/public/licenses/`.
- Animated border-beam pattern discovered in [21st.dev's border collection](https://21st.dev/community/components/s/border), with [Magic UI's Border Beam](https://v3.magicui.design/docs/components/border-beam) as the reference. `BorderBeam.tsx` is a local CSS implementation; no gated component code was copied.
- `AuroraBackdrop.tsx` is a local CSS ambient-light composition tuned to the existing viewer, informed by the aurora/background components browsed on 21st.dev.

The shader is confined to the experience rail. Abstract colored light is masked toward the viewer edges. Neither represents anatomy or simulation activity. Existing Sci-fi glow toggles the decorations off. Reduced motion freezes the shader and stops CSS animation; tab visibility pauses the shader. The Paper shader is lazy-loaded (~23 KB before gzip) and capped at 160,000 pixels.
